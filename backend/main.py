"""MedFlow FastAPI backend — 8 endpoints + demo seed."""
import json
import uuid
import random
from datetime import datetime, date
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from config import settings
from database import get_db, init_db, SessionLocal
from models import (
    Patient, BloodTest, AuditLog, PreviousVisit, ImagingReport,
    PatientRegisterRequest, PatientRegisterResponse,
    TestSubmitRequest, TestSubmitResponse,
    PatientReportResponse, QueueItem,
    DoctorOverrideRequest, DoctorOverrideResponse,
    AuditLogResponse, AuditLogEntry,
    LabFlag, Condition, HistoryAlert, RiskScore,
    ImagingSubmitRequest, ImagingSubmitResponse,
    ImagingReportResponse, ImagingQueueItem,
    ImagingFinding, ImagingCorrelation, ImagingDifferential,
)
from utils.sse_broker import event_stream
from utils import audit_logger
from agents.orchestrator import run_pipeline
from agents.imaging_orchestrator import run_imaging_pipeline

app = FastAPI(
    title="MedFlow — Hospital AI Blood Test Analysis",
    version="1.0.0",
    description="6-agent AI pipeline for blood test analysis. AI SUGGESTED — DOCTOR MUST VERIFY.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    init_db()


# ─── Helpers ────────────────────────────────────────────────────────────────

def generate_patient_id() -> str:
    suffix = uuid.uuid4().hex[:8].upper()
    return f"MF-2024-{suffix}"


def _test_to_queue_item(test: BloodTest, patient: Patient) -> QueueItem:
    risk = test.get_risk_score()
    return QueueItem(
        test_id=test.test_id,
        patient_id=test.patient_id,
        patient_name=patient.name,
        age=patient.age,
        gender=patient.gender,
        risk_level=risk.get("level", "YELLOW"),
        queue_number=risk.get("queue_number", 99),
        submitted_at=test.submitted_at.isoformat(),
        doctor_verified=test.doctor_verified or False,
        primary_concerns=risk.get("primary_concerns", []),
    )


RISK_ORDER = {"BLACK": 0, "RED": 1, "YELLOW": 2, "GREEN": 3}


# ─── 1. Register Patient ─────────────────────────────────────────────────────

@app.post("/patient/register", response_model=PatientRegisterResponse)
async def register_patient(req: PatientRegisterRequest, db: Session = Depends(get_db)):
    patient_id = generate_patient_id()
    patient = Patient(
        patient_id=patient_id,
        name=req.name,
        age=req.age,
        gender=req.gender,
        phone=req.phone,
        registered_at=datetime.utcnow(),
    )
    db.add(patient)
    db.commit()

    audit_logger.log_event(
        db,
        event_type=audit_logger.PATIENT_REGISTER,
        patient_id=patient_id,
        details={"name": req.name, "age": req.age, "gender": req.gender},
    )

    return PatientRegisterResponse(patient_id=patient_id, name=req.name)


# ─── 2. Submit Blood Test ────────────────────────────────────────────────────

@app.post("/test/submit", response_model=TestSubmitResponse)
async def submit_test(
    req: TestSubmitRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.patient_id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    test_id = str(uuid.uuid4())
    values_dict = req.values.model_dump(exclude_none=True)

    test = BloodTest(
        test_id=test_id,
        patient_id=req.patient_id,
        submitted_at=datetime.utcnow(),
        status="PENDING",
        raw_values=json.dumps(values_dict),
    )
    db.add(test)
    db.commit()

    # Fetch previous visits for history comparator
    previous_visits = (
        db.query(PreviousVisit)
        .filter(PreviousVisit.patient_id == req.patient_id)
        .order_by(PreviousVisit.visit_date.desc())
        .limit(3)
        .all()
    )
    prev_data = [
        {
            "visit_date": str(v.visit_date),
            "summary_flags": v.summary_flags,
            "risk_level": v.risk_level,
        }
        for v in previous_visits
    ]

    audit_logger.log_event(
        db,
        event_type=audit_logger.TEST_SUBMIT,
        test_id=test_id,
        patient_id=req.patient_id,
        details={"values": values_dict},
    )

    # Fire background pipeline
    background_tasks.add_task(
        run_pipeline,
        test_id=test_id,
        patient_id=req.patient_id,
        patient_name=patient.name,
        patient_age=patient.age,
        gender=patient.gender,
        raw_values=values_dict,
        previous_visits=prev_data,
        db_session_factory=SessionLocal,
    )

    return TestSubmitResponse(
        test_id=test_id,
        stream_url=f"/pipeline/stream/{test_id}",
    )


# ─── 3. Get Patient Report ───────────────────────────────────────────────────

@app.get("/patient/{patient_id}/report", response_model=PatientReportResponse)
async def get_report(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    test = (
        db.query(BloodTest)
        .filter(BloodTest.patient_id == patient_id, BloodTest.status == "COMPLETE")
        .order_by(BloodTest.submitted_at.desc())
        .first()
    )
    if not test:
        raise HTTPException(status_code=404, detail="No completed test found — pipeline may still be running")

    flags_raw = test.get_lab_flags()
    if isinstance(flags_raw, list):
        flags_list = flags_raw
    else:
        flags_list = flags_raw.get("flags", []) if isinstance(flags_raw, dict) else []

    conditions_raw = test.get_pattern_results()
    if isinstance(conditions_raw, list):
        conditions_list = conditions_raw
    else:
        conditions_list = conditions_raw.get("conditions", []) if isinstance(conditions_raw, dict) else []

    history_raw = test.get_history_alerts()
    if isinstance(history_raw, list):
        alerts_list = history_raw
    else:
        alerts_list = history_raw.get("alerts", []) if isinstance(history_raw, dict) else []

    risk_data = test.get_risk_score()

    lab_flags = [
        LabFlag(
            parameter=f.get("parameter", ""),
            value=f.get("value", 0),
            unit=f.get("unit", ""),
            reference_range=f.get("reference_range", ""),
            severity=f.get("severity", "NORMAL"),
            direction=f.get("direction", "NORMAL"),
        )
        for f in flags_list
    ]

    conditions = [
        Condition(
            name=c.get("name", ""),
            confidence=c.get("confidence", 0),
            supporting_flags=c.get("supporting_flags", []),
        )
        for c in conditions_list
    ]

    history_alerts = [
        HistoryAlert(
            parameter=a.get("parameter", ""),
            trend=a.get("trend", "STABLE"),
            previous_value=a.get("previous_value", 0),
            current_value=a.get("current_value", 0),
            change_pct=a.get("change_pct", 0),
            alert_level=a.get("alert_level", "INFO"),
        )
        for a in alerts_list
    ]

    risk_score = RiskScore(
        level=risk_data.get("level", "YELLOW"),
        score=risk_data.get("score", 50),
        queue_number=risk_data.get("queue_number", 99),
        primary_concerns=risk_data.get("primary_concerns", []),
        confidence=risk_data.get("confidence", 0.8),
    ) if risk_data else None

    return PatientReportResponse(
        test_id=test.test_id,
        patient_id=patient_id,
        patient_name=patient.name,
        age=patient.age,
        gender=patient.gender,
        submitted_at=test.submitted_at.isoformat(),
        status=test.status,
        lab_flags=lab_flags,
        suspected_conditions=conditions,
        history_alerts=history_alerts,
        risk_score=risk_score,
        report_text=test.report_text or "Report not yet available.",
        doctor_verified=test.doctor_verified or False,
        override_notes=test.override_notes,
    )


# ─── 4. Get Queue Tag ────────────────────────────────────────────────────────

@app.get("/patient/{patient_id}/tag")
async def get_tag(patient_id: str, db: Session = Depends(get_db)):
    test = (
        db.query(BloodTest)
        .filter(BloodTest.patient_id == patient_id, BloodTest.status == "COMPLETE")
        .order_by(BloodTest.submitted_at.desc())
        .first()
    )
    if not test:
        raise HTTPException(status_code=404, detail="No completed test found")

    risk = test.get_risk_score()
    return {
        "test_id": test.test_id,
        "patient_id": patient_id,
        "risk_level": risk.get("level", "YELLOW"),
        "queue_number": risk.get("queue_number", 99),
        "qr_tag_data": test.qr_tag_data,
        "ai_disclaimer": "AI SUGGESTED — DOCTOR MUST VERIFY",
    }


# ─── 5. Doctor Queue ─────────────────────────────────────────────────────────

@app.get("/doctor/queue", response_model=List[QueueItem])
async def get_queue(db: Session = Depends(get_db)):
    tests = (
        db.query(BloodTest)
        .filter(BloodTest.status == "COMPLETE")
        .order_by(BloodTest.submitted_at.desc())
        .all()
    )

    items = []
    for test in tests:
        patient = db.query(Patient).filter(Patient.patient_id == test.patient_id).first()
        if patient:
            items.append(_test_to_queue_item(test, patient))

    # Sort: BLACK → RED → YELLOW → GREEN, then by queue number
    items.sort(key=lambda x: (RISK_ORDER.get(x.risk_level, 4), x.queue_number))
    return items


# ─── 6. Doctor Override ──────────────────────────────────────────────────────

@app.post("/doctor/override", response_model=DoctorOverrideResponse)
async def doctor_override(req: DoctorOverrideRequest, db: Session = Depends(get_db)):
    test = db.query(BloodTest).filter(BloodTest.test_id == req.test_id).first()
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")

    # Require explicit confirmation for BLACK/CRITICAL
    risk = test.get_risk_score()
    if risk.get("level") == "BLACK" and not req.confirmed_critical:
        raise HTTPException(
            status_code=400,
            detail="CRITICAL patient requires confirmed_critical=true in request",
        )

    test.doctor_verified = True
    test.doctor_id = req.doctor_id
    test.override_notes = req.override_notes
    test.verified_at = datetime.utcnow()

    if req.updated_risk_level:
        current_risk = risk.copy()
        current_risk["level"] = req.updated_risk_level
        test.risk_score = json.dumps(current_risk)

    db.commit()

    audit_logger.log_event(
        db,
        event_type=audit_logger.DOCTOR_OVERRIDE if req.updated_risk_level else audit_logger.DOCTOR_VERIFY,
        actor=req.doctor_id,
        test_id=req.test_id,
        patient_id=test.patient_id,
        details={
            "override_notes": req.override_notes,
            "updated_risk_level": req.updated_risk_level,
            "confirmed_critical": req.confirmed_critical,
        },
    )

    return DoctorOverrideResponse(
        success=True,
        test_id=req.test_id,
        message="Override recorded successfully",
    )


# ─── 7. SSE Pipeline Stream ──────────────────────────────────────────────────

@app.get("/pipeline/stream/{test_id}")
async def stream_pipeline(test_id: str):
    async def generate():
        async for chunk in event_stream(test_id):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─── 8. Admin Audit Log ──────────────────────────────────────────────────────

@app.get("/admin/audit", response_model=AuditLogResponse)
async def get_audit_log(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    event_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(AuditLog)
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)
    total = query.count()
    entries = (
        query.order_by(AuditLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return AuditLogResponse(
        entries=[
            AuditLogEntry(
                id=e.id,
                timestamp=e.timestamp.isoformat(),
                event_type=e.event_type,
                actor=e.actor,
                test_id=e.test_id,
                patient_id=e.patient_id,
                details=json.loads(e.details) if e.details else {},
            )
            for e in entries
        ],
        total=total,
        page=page,
        page_size=page_size,
    )


# ─── Imaging Department Endpoints ────────────────────────────────────────────

CONCERN_ORDER = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
URGENCY_ORDER = {"STAT": 0, "URGENT": 1, "ROUTINE": 2}


def _imaging_to_queue_item(report: ImagingReport, patient: Patient) -> ImagingQueueItem:
    return ImagingQueueItem(
        imaging_id=report.imaging_id,
        patient_id=report.patient_id,
        patient_name=patient.name,
        age=patient.age,
        gender=patient.gender,
        department=report.department,
        submitted_at=report.submitted_at.isoformat(),
        status=report.status,
        overall_concern=report.overall_concern or "LOW",
        urgency=report.urgency or "ROUTINE",
        impression=report.impression or "",
    )


@app.post("/imaging/submit", response_model=ImagingSubmitResponse)
async def submit_imaging(
    req: ImagingSubmitRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.patient_id == req.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    imaging_id = str(uuid.uuid4())
    report = ImagingReport(
        imaging_id=imaging_id,
        patient_id=req.patient_id,
        department=req.department,
        raw_text=req.raw_text,
        submitted_at=datetime.utcnow(),
        status="PENDING",
        submitted_by=req.submitted_by,
    )
    db.add(report)
    db.commit()

    audit_logger.log_event(
        db,
        event_type="IMAGING_SUBMIT",
        patient_id=req.patient_id,
        details={"imaging_id": imaging_id, "department": req.department},
    )

    background_tasks.add_task(run_imaging_pipeline, imaging_id, req.patient_id, req.department, req.raw_text)

    return ImagingSubmitResponse(
        imaging_id=imaging_id,
        stream_url=f"/imaging/stream/{imaging_id}",
    )


@app.get("/imaging/{imaging_id}/report", response_model=ImagingReportResponse)
async def get_imaging_report(imaging_id: str, db: Session = Depends(get_db)):
    report = db.query(ImagingReport).filter(ImagingReport.imaging_id == imaging_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Imaging report not found")

    patient = db.query(Patient).filter(Patient.patient_id == report.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    return ImagingReportResponse(
        imaging_id=report.imaging_id,
        patient_id=report.patient_id,
        patient_name=patient.name,
        age=patient.age,
        gender=patient.gender,
        department=report.department,
        submitted_at=report.submitted_at.isoformat(),
        completed_at=report.completed_at.isoformat() if report.completed_at else None,
        status=report.status,
        raw_text=report.raw_text,
        findings=[ImagingFinding(**f) for f in report.get_findings()],
        impression=report.impression or "",
        recommendations=report.get_recommendations(),
        correlations=[ImagingCorrelation(**c) for c in report.get_correlations()],
        differential_diagnoses=[ImagingDifferential(**d) for d in report.get_differential_diagnoses()],
        overall_concern=report.overall_concern or "LOW",
        urgency=report.urgency or "ROUTINE",
        correlation_summary=report.correlation_summary or "",
        report_text=report.report_text or "",
    )


@app.get("/patient/{patient_id}/imaging", response_model=List[ImagingReportResponse])
async def get_patient_imaging(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    reports = (
        db.query(ImagingReport)
        .filter(ImagingReport.patient_id == patient_id)
        .order_by(ImagingReport.submitted_at.desc())
        .all()
    )

    return [
        ImagingReportResponse(
            imaging_id=r.imaging_id,
            patient_id=r.patient_id,
            patient_name=patient.name,
            age=patient.age,
            gender=patient.gender,
            department=r.department,
            submitted_at=r.submitted_at.isoformat(),
            completed_at=r.completed_at.isoformat() if r.completed_at else None,
            status=r.status,
            raw_text=r.raw_text,
            findings=[ImagingFinding(**f) for f in r.get_findings()],
            impression=r.impression or "",
            recommendations=r.get_recommendations(),
            correlations=[ImagingCorrelation(**c) for c in r.get_correlations()],
            differential_diagnoses=[ImagingDifferential(**d) for d in r.get_differential_diagnoses()],
            overall_concern=r.overall_concern or "LOW",
            urgency=r.urgency or "ROUTINE",
            correlation_summary=r.correlation_summary or "",
            report_text=r.report_text or "",
        )
        for r in reports
    ]


@app.get("/imaging/queue", response_model=List[ImagingQueueItem])
async def get_imaging_queue(db: Session = Depends(get_db)):
    reports = (
        db.query(ImagingReport)
        .filter(ImagingReport.status == "COMPLETE")
        .order_by(ImagingReport.submitted_at.desc())
        .all()
    )
    items = []
    for r in reports:
        patient = db.query(Patient).filter(Patient.patient_id == r.patient_id).first()
        if patient:
            items.append(_imaging_to_queue_item(r, patient))

    items.sort(key=lambda x: (CONCERN_ORDER.get(x.overall_concern, 3), URGENCY_ORDER.get(x.urgency, 2)))
    return items


@app.get("/imaging/stream/{imaging_id}")
async def stream_imaging(imaging_id: str):
    async def generate():
        async for chunk in event_stream(imaging_id):
            yield chunk

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


# ─── WhatsApp Report ─────────────────────────────────────────────────────────

@app.get("/patient/{patient_id}/whatsapp-text")
async def get_whatsapp_report(patient_id: str, db: Session = Depends(get_db)):
    test = (
        db.query(BloodTest)
        .filter(BloodTest.patient_id == patient_id, BloodTest.status == "COMPLETE")
        .order_by(BloodTest.submitted_at.desc())
        .first()
    )
    if not test:
        raise HTTPException(status_code=404, detail="No completed test found")

    patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
    risk = test.get_risk_score()

    header = (
        f"🏥 *MedFlow Report*\n"
        f"Patient: {patient.name} | Age: {patient.age} | Gender: {patient.gender}\n"
        f"Queue #: {risk.get('queue_number', 'N/A')} | Risk: *{risk.get('level', 'N/A')}*\n"
        f"{'━' * 30}\n\n"
    )

    footer = "\n\n⚕️ _AI SUGGESTED — DOCTOR MUST VERIFY_"
    whatsapp_text = header + (test.report_text or "Report unavailable.") + footer

    return {"whatsapp_text": whatsapp_text, "patient_id": patient_id}


# ─── Demo Seed ───────────────────────────────────────────────────────────────

DEMO_PATIENTS = [
    {
        "name": "Priya Sharma",
        "age": 35,
        "gender": "F",
        "phone": "9876543210",
        "values": {
            "hemoglobin": 7.2,
            "wbc": 12000,
            "platelets": 85000,
            "glucose": 320,
            "hba1c": 9.1,
            "creatinine": 1.4,
        },
        "risk": "BLACK",
    },
    {
        "name": "Rahul Verma",
        "age": 45,
        "gender": "M",
        "phone": "9765432100",
        "values": {
            "hemoglobin": 9.5,
            "wbc": 8500,
            "platelets": 120000,
            "glucose": 180,
            "hba1c": 7.2,
            "sgot": 85,
            "sgpt": 92,
        },
        "risk": "RED",
    },
    {
        "name": "Sunita Patel",
        "age": 28,
        "gender": "F",
        "phone": "9654321000",
        "values": {
            "hemoglobin": 10.8,
            "wbc": 6200,
            "platelets": 210000,
            "glucose": 105,
            "mcv": 72,
            "mch": 24,
            "tsh": 0.2,
        },
        "risk": "YELLOW",
    },
    {
        "name": "Amit Kumar",
        "age": 52,
        "gender": "M",
        "phone": "9543210000",
        "values": {
            "hemoglobin": 14.2,
            "wbc": 7800,
            "platelets": 280000,
            "glucose": 98,
            "hba1c": 5.4,
            "creatinine": 0.9,
        },
        "risk": "GREEN",
    },
    {
        "name": "Meera Nair",
        "age": 41,
        "gender": "F",
        "phone": "9432100000",
        "values": {
            "hemoglobin": 11.5,
            "wbc": 9200,
            "platelets": 165000,
            "glucose": 145,
            "hba1c": 6.8,
            "sodium": 138,
        },
        "risk": "YELLOW",
        "has_history": True,
    },
]


@app.post("/demo/seed")
async def seed_demo(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """Pre-load 5 demo patients covering all risk levels."""
    created = []

    for demo in DEMO_PATIENTS:
        patient_id = generate_patient_id()
        patient = Patient(
            patient_id=patient_id,
            name=demo["name"],
            age=demo["age"],
            gender=demo["gender"],
            phone=demo["phone"],
            registered_at=datetime.utcnow(),
        )
        db.add(patient)
        db.flush()

        # Add history for patient with history flag
        if demo.get("has_history"):
            from datetime import timedelta
            for i in range(1, 4):
                visit = PreviousVisit(
                    patient_id=patient_id,
                    visit_date=(datetime.utcnow() - timedelta(days=30 * i)).date(),
                    summary_flags=json.dumps({
                        k: v * (1 + (i * 0.1))
                        for k, v in demo["values"].items()
                    }),
                    risk_level=["YELLOW", "YELLOW", "GREEN"][i - 1],
                )
                db.add(visit)

        test_id = str(uuid.uuid4())
        test = BloodTest(
            test_id=test_id,
            patient_id=patient_id,
            submitted_at=datetime.utcnow(),
            status="PENDING",
            raw_values=json.dumps(demo["values"]),
        )
        db.add(test)
        db.commit()

        # Get previous visits
        prev_visits = (
            db.query(PreviousVisit)
            .filter(PreviousVisit.patient_id == patient_id)
            .order_by(PreviousVisit.visit_date.desc())
            .limit(3)
            .all()
        )
        prev_data = [
            {
                "visit_date": str(v.visit_date),
                "summary_flags": v.summary_flags,
                "risk_level": v.risk_level,
            }
            for v in prev_visits
        ]

        audit_logger.log_event(
            db,
            event_type=audit_logger.DEMO_SEED,
            test_id=test_id,
            patient_id=patient_id,
            details={"demo_name": demo["name"], "expected_risk": demo["risk"]},
        )

        background_tasks.add_task(
            run_pipeline,
            test_id=test_id,
            patient_id=patient_id,
            patient_name=demo["name"],
            patient_age=demo["age"],
            gender=demo["gender"],
            raw_values=demo["values"],
            previous_visits=prev_data,
            db_session_factory=SessionLocal,
        )

        created.append({"patient_id": patient_id, "test_id": test_id, "name": demo["name"]})

    return {
        "message": "Demo patients seeded — pipelines running in background",
        "created": created,
        "ai_disclaimer": "AI SUGGESTED — DOCTOR MUST VERIFY",
    }


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "MedFlow", "version": "1.0.0"}
