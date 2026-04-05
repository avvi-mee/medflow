"""ImagingOrchestrator — runs the 3-agent imaging pipeline."""
import asyncio
import json
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from database import SessionLocal
from models import ImagingReport, Patient, BloodTest
from utils.sse_broker import publish
from utils import audit_logger
from agents.findings_extractor import FindingsExtractorAgent
from agents.clinical_correlator import ClinicalCorrelatorAgent
from agents.imaging_report_writer import ImagingReportWriterAgent


async def run_imaging_pipeline(imaging_id: str, patient_id: str, department: str, raw_text: str) -> None:
    db: Session = SessionLocal()
    try:
        patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
        if not patient:
            return

        # Update status to RUNNING
        report = db.query(ImagingReport).filter(ImagingReport.imaging_id == imaging_id).first()
        if not report:
            return
        report.status = "RUNNING"
        db.commit()

        await publish(imaging_id, "phase_start", {"phase": 1, "message": "Extracting findings..."})

        patient_age = patient.age
        patient_gender = patient.gender

        # Get latest blood test summary for correlation
        blood_report_summary = "No blood test data available."
        latest_test = (
            db.query(BloodTest)
            .filter(BloodTest.patient_id == patient_id, BloodTest.status == "COMPLETE")
            .order_by(BloodTest.submitted_at.desc())
            .first()
        )
        if latest_test and latest_test.report_text:
            blood_report_summary = latest_test.report_text[:600]

        # Phase 1: Findings Extractor (runs first)
        extractor = FindingsExtractorAgent(imaging_id)
        extractor_result = await extractor.run(
            department=department,
            raw_text=raw_text,
            patient_age=patient_age,
            patient_gender=patient_gender,
        )

        findings = extractor_result.get("findings", [])
        impression = extractor_result.get("impression", "")
        recommendations = extractor_result.get("recommendations", [])
        urgency = extractor_result.get("urgency", "ROUTINE")

        await publish(imaging_id, "phase_start", {"phase": 2, "message": "Correlating with clinical data..."})

        # Phase 2: Clinical Correlator (runs after extractor)
        correlator = ClinicalCorrelatorAgent(imaging_id)
        correlator_result = await correlator.run(
            department=department,
            findings=findings,
            impression=impression,
            blood_report_summary=blood_report_summary,
            patient_age=patient_age,
            patient_gender=patient_gender,
        )

        correlations = correlator_result.get("correlations", [])
        differential_diagnoses = correlator_result.get("differential_diagnoses", [])
        overall_concern = correlator_result.get("overall_concern", "LOW")
        correlation_summary = correlator_result.get("correlation_summary", "")

        await publish(imaging_id, "phase_start", {"phase": 3, "message": "Composing doctor summary..."})

        # Phase 3: Report Writer (runs last)
        writer = ImagingReportWriterAgent(imaging_id)
        writer_result = await writer.run(
            department=department,
            patient_name=patient.name,
            patient_age=patient_age,
            patient_gender=patient_gender,
            findings=findings,
            impression=impression,
            recommendations=recommendations,
            correlations=correlations,
            differential_diagnoses=differential_diagnoses,
            overall_concern=overall_concern,
            urgency=urgency,
        )

        report_text = writer_result.get("report_text", "")

        # Save all results
        db.refresh(report)
        report.status = "COMPLETE"
        report.findings = json.dumps(findings)
        report.impression = impression
        report.recommendations = json.dumps(recommendations)
        report.correlations = json.dumps(correlations)
        report.differential_diagnoses = json.dumps(differential_diagnoses)
        report.overall_concern = overall_concern
        report.urgency = urgency
        report.correlation_summary = correlation_summary
        report.report_text = report_text
        report.completed_at = datetime.utcnow()
        db.commit()

        await publish(imaging_id, "pipeline_complete", {
            "imaging_id": imaging_id,
            "overall_concern": overall_concern,
            "urgency": urgency,
            "findings_count": len(findings),
        })

        audit_logger.log_event(
            db,
            event_type="IMAGING_COMPLETE",
            patient_id=patient_id,
            details={"imaging_id": imaging_id, "department": department, "concern": overall_concern},
        )

    except Exception as e:
        db.refresh(report)
        report.status = "ERROR"
        db.commit()
        await publish(imaging_id, "pipeline_error", {"error": str(e)})
        audit_logger.log_event(
            db,
            event_type="IMAGING_ERROR",
            patient_id=patient_id,
            details={"imaging_id": imaging_id, "error": str(e)},
        )
    finally:
        db.close()
