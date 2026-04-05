"""Orchestrator — manages the 6-agent pipeline with asyncio.gather for Phase 1."""
import asyncio
import json
import time
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from agents.lab_interpreter import LabInterpreterAgent
from agents.pattern_detector import PatternDetectorAgent
from agents.history_comparator import HistoryComparatorAgent
from agents.risk_scorer import RiskScorerAgent
from agents.report_writer import ReportWriterAgent
from utils.sse_broker import publish
from utils.qr_generator import generate_queue_tag
from utils import audit_logger


async def run_pipeline(
    test_id: str,
    patient_id: str,
    patient_name: str,
    patient_age: int,
    gender: str,
    raw_values: Dict[str, Any],
    previous_visits: List[Dict],
    db_session_factory,
) -> None:
    """
    Full 6-agent pipeline:
    Phase 1 (parallel): LabInterpreter + PatternDetector + HistoryComparator
    Phase 2 (sequential): RiskScorer → ReportWriter
    Then: QR tag, DB update, queue assignment
    """
    pipeline_start = time.monotonic()

    # Update test status to RUNNING
    async with _get_db(db_session_factory) as db:
        from models import BloodTest
        test = db.query(BloodTest).filter(BloodTest.test_id == test_id).first()
        if test:
            test.status = "RUNNING"
            db.commit()
        audit_logger.log_event(
            db,
            event_type=audit_logger.PIPELINE_START,
            test_id=test_id,
            patient_id=patient_id,
            details={"raw_values": raw_values, "patient_name": patient_name},
        )

    await publish(test_id, "phase_start", {"phase": 1, "agents": ["lab_interpreter", "pattern_detector", "history_comparator"]})

    # ─── Phase 1: Parallel ───────────────────────────────────────────────────
    lab_agent = LabInterpreterAgent(test_id)
    pattern_agent = PatternDetectorAgent(test_id)
    history_agent = HistoryComparatorAgent(test_id)

    phase1_results = await asyncio.gather(
        lab_agent.run(raw_values=raw_values, gender=gender),
        pattern_agent.run(flags=[], raw_values=raw_values),  # will re-run with flags below
        history_agent.run(raw_values=raw_values, previous_visits=previous_visits),
        return_exceptions=True,
    )

    lab_result, pattern_result_initial, history_result = phase1_results

    # Handle exceptions from gather
    if isinstance(lab_result, Exception):
        lab_result = await lab_agent.fallback(raw_values=raw_values, gender=gender)
        lab_result["status"] = "fallback"

    if isinstance(history_result, Exception):
        history_result = await history_agent.fallback(raw_values=raw_values, previous_visits=previous_visits)
        history_result["status"] = "fallback"

    flags = lab_result.get("flags", [])

    # Run pattern detector again with actual flags
    pattern_agent2 = PatternDetectorAgent(test_id)
    if isinstance(pattern_result_initial, Exception) or not flags:
        pattern_result = await pattern_agent2.run(flags=flags, raw_values=raw_values)
    else:
        # Already ran; re-run with real flags for accuracy
        try:
            pattern_result = await pattern_agent2.execute(flags=flags, raw_values=raw_values)
            pattern_result["status"] = "complete"
        except Exception:
            pattern_result = await pattern_agent2.fallback(flags=flags, raw_values=raw_values)

    conditions = pattern_result.get("conditions", [])
    history_alerts = history_result.get("alerts", [])

    # Save Phase 1 results
    async with _get_db(db_session_factory) as db:
        from models import BloodTest
        test = db.query(BloodTest).filter(BloodTest.test_id == test_id).first()
        if test:
            test.lab_flags = json.dumps(flags)
            test.pattern_results = json.dumps(conditions)
            test.history_alerts = json.dumps(history_alerts)
            db.commit()
        audit_logger.log_event(
            db,
            event_type=audit_logger.PIPELINE_PHASE1_COMPLETE,
            test_id=test_id,
            patient_id=patient_id,
            details={
                "flags_count": len(flags),
                "conditions_count": len(conditions),
                "alerts_count": len(history_alerts),
            },
        )

    await publish(test_id, "phase_complete", {
        "phase": 1,
        "flags_count": len(flags),
        "conditions_count": len(conditions),
        "alerts_count": len(history_alerts),
    })

    # ─── Phase 2: Sequential ─────────────────────────────────────────────────
    await publish(test_id, "phase_start", {"phase": 2, "agents": ["risk_scorer", "report_writer"]})

    # Risk Scorer
    risk_agent = RiskScorerAgent(test_id)
    risk_result = await risk_agent.run(
        flags=flags,
        conditions=conditions,
        history_alerts=history_alerts,
        patient_age=patient_age,
        gender=gender,
    )

    risk_level = risk_result.get("level", "YELLOW")
    risk_score_val = risk_result.get("score", 50)
    queue_number = risk_result.get("queue_number", 30)
    primary_concerns = risk_result.get("primary_concerns", [])
    escalation_reason = risk_result.get("escalation_reason", "")

    await publish(test_id, "risk_scored", {
        "risk_level": risk_level,
        "score": risk_score_val,
        "queue_number": queue_number,
    })

    # Report Writer
    report_agent = ReportWriterAgent(test_id)
    report_result = await report_agent.run(
        patient_name=patient_name,
        patient_age=patient_age,
        gender=gender,
        flags=flags,
        conditions=conditions,
        history_alerts=history_alerts,
        risk_level=risk_level,
        risk_score=risk_score_val,
        escalation_reason=escalation_reason,
    )

    report_text = report_result.get("report_text", "Report generation failed — manual review required.")

    # ─── Finalize ────────────────────────────────────────────────────────────
    qr_data = generate_queue_tag(test_id, patient_name, queue_number, risk_level)

    total_ms = int((time.monotonic() - pipeline_start) * 1000)

    async with _get_db(db_session_factory) as db:
        from models import BloodTest, PreviousVisit
        test = db.query(BloodTest).filter(BloodTest.test_id == test_id).first()
        if test:
            test.status = "COMPLETE"
            test.risk_score = json.dumps({
                "level": risk_level,
                "score": risk_score_val,
                "queue_number": queue_number,
                "primary_concerns": primary_concerns,
                "confidence": risk_result.get("confidence", 0.8),
                "escalation_reason": escalation_reason,
            })
            test.report_text = report_text
            test.qr_tag_data = qr_data
            db.commit()

        # Save to previous_visits for future comparisons
        visit = PreviousVisit(
            patient_id=patient_id,
            visit_date=datetime.utcnow().date(),
            summary_flags=json.dumps({k: v for k, v in raw_values.items() if v is not None}),
            risk_level=risk_level,
        )
        db.add(visit)
        db.commit()

        audit_logger.log_event(
            db,
            event_type=audit_logger.PIPELINE_COMPLETE,
            test_id=test_id,
            patient_id=patient_id,
            details={
                "risk_level": risk_level,
                "queue_number": queue_number,
                "total_ms": total_ms,
                "conditions": [c.get("name") for c in conditions],
            },
        )

    await publish(test_id, "pipeline_complete", {
        "test_id": test_id,
        "risk_level": risk_level,
        "queue_number": queue_number,
        "total_ms": total_ms,
        "qr_data": qr_data[:100] + "..." if len(qr_data) > 100 else qr_data,
    })


class _get_db:
    """Async context manager for sync SQLAlchemy session."""

    def __init__(self, session_factory):
        self.session_factory = session_factory
        self.db = None

    async def __aenter__(self):
        self.db = self.session_factory()
        return self.db

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            self.db.rollback()
        self.db.close()
