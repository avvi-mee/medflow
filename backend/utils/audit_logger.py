"""Audit logger — every action → audit_log table."""
import json
from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session


def log_event(
    db: Session,
    event_type: str,
    actor: str = "system",
    test_id: Optional[str] = None,
    patient_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    """Log an event to the audit_log table."""
    from models import AuditLog

    entry = AuditLog(
        timestamp=datetime.utcnow(),
        event_type=event_type,
        actor=actor,
        test_id=test_id,
        patient_id=patient_id,
        details=json.dumps(details or {}),
    )
    db.add(entry)
    db.commit()


# Event type constants
PIPELINE_START = "PIPELINE_START"
PIPELINE_PHASE1_COMPLETE = "PIPELINE_PHASE1_COMPLETE"
PIPELINE_COMPLETE = "PIPELINE_COMPLETE"
PIPELINE_ERROR = "PIPELINE_ERROR"
AGENT_START = "AGENT_START"
AGENT_COMPLETE = "AGENT_COMPLETE"
AGENT_ERROR = "AGENT_ERROR"
DOCTOR_VERIFY = "DOCTOR_VERIFY"
DOCTOR_OVERRIDE = "DOCTOR_OVERRIDE"
CRITICAL_ACKNOWLEDGE = "CRITICAL_ACKNOWLEDGE"
PATIENT_REGISTER = "PATIENT_REGISTER"
TEST_SUBMIT = "TEST_SUBMIT"
DEMO_SEED = "DEMO_SEED"
