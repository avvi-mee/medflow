import json
from datetime import datetime
from typing import Optional, Dict, Any, List

from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, Date, ForeignKey
from sqlalchemy.orm import relationship
from pydantic import BaseModel, Field

from database import Base


# ─── SQLAlchemy ORM Models ───────────────────────────────────────────────────

class Patient(Base):
    __tablename__ = "patients"

    patient_id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    age = Column(Integer, nullable=False)
    gender = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    registered_at = Column(DateTime, default=datetime.utcnow)

    blood_tests = relationship("BloodTest", back_populates="patient")
    previous_visits = relationship("PreviousVisit", back_populates="patient")
    imaging_reports = relationship("ImagingReport", back_populates="patient")


class BloodTest(Base):
    __tablename__ = "blood_tests"

    test_id = Column(String, primary_key=True)
    patient_id = Column(String, ForeignKey("patients.patient_id"), nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="PENDING")  # PENDING/RUNNING/COMPLETE/ERROR
    raw_values = Column(Text)       # JSON blob
    lab_flags = Column(Text)        # JSON — after Phase 1
    pattern_results = Column(Text)  # JSON — after Phase 1
    history_alerts = Column(Text)   # JSON — after Phase 1
    risk_score = Column(Text)       # JSON — after Phase 2
    report_text = Column(Text)
    qr_tag_data = Column(Text)      # base64 PNG
    doctor_verified = Column(Boolean, default=False)
    doctor_id = Column(String, nullable=True)
    override_notes = Column(Text, nullable=True)
    verified_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="blood_tests")

    def get_raw_values(self) -> Dict:
        return json.loads(self.raw_values) if self.raw_values else {}

    def get_lab_flags(self) -> Dict:
        return json.loads(self.lab_flags) if self.lab_flags else {}

    def get_pattern_results(self) -> Dict:
        return json.loads(self.pattern_results) if self.pattern_results else {}

    def get_history_alerts(self) -> Dict:
        return json.loads(self.history_alerts) if self.history_alerts else {}

    def get_risk_score(self) -> Dict:
        return json.loads(self.risk_score) if self.risk_score else {}


class AuditLog(Base):
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    event_type = Column(String, nullable=False)
    actor = Column(String, default="system")
    test_id = Column(String, nullable=True)
    patient_id = Column(String, nullable=True)
    details = Column(Text)  # JSON blob


class PreviousVisit(Base):
    __tablename__ = "previous_visits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(String, ForeignKey("patients.patient_id"), nullable=False)
    visit_date = Column(Date, nullable=False)
    summary_flags = Column(Text)  # JSON key findings
    risk_level = Column(String)   # GREEN/YELLOW/RED/BLACK

    patient = relationship("Patient", back_populates="previous_visits")


class ImagingReport(Base):
    __tablename__ = "imaging_reports"

    imaging_id = Column(String, primary_key=True)
    patient_id = Column(String, ForeignKey("patients.patient_id"), nullable=False)
    department = Column(String, nullable=False)  # XRAY/SONOGRAPHY/MRI/CT/ECG/OTHER
    raw_text = Column(Text, nullable=False)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)
    status = Column(String, default="PENDING")  # PENDING/RUNNING/COMPLETE/ERROR
    findings = Column(Text, nullable=True)         # JSON
    impression = Column(Text, nullable=True)
    recommendations = Column(Text, nullable=True)  # JSON
    correlations = Column(Text, nullable=True)     # JSON
    differential_diagnoses = Column(Text, nullable=True)  # JSON
    overall_concern = Column(String, nullable=True)  # LOW/MEDIUM/HIGH/CRITICAL
    urgency = Column(String, nullable=True)          # ROUTINE/URGENT/STAT
    correlation_summary = Column(Text, nullable=True)
    report_text = Column(Text, nullable=True)
    submitted_by = Column(String, nullable=True)  # staff ID

    patient = relationship("Patient", back_populates="imaging_reports")

    def get_findings(self): return json.loads(self.findings) if self.findings else []
    def get_recommendations(self): return json.loads(self.recommendations) if self.recommendations else []
    def get_correlations(self): return json.loads(self.correlations) if self.correlations else []
    def get_differential_diagnoses(self): return json.loads(self.differential_diagnoses) if self.differential_diagnoses else []


# ─── Pydantic Schemas ────────────────────────────────────────────────────────

class PatientRegisterRequest(BaseModel):
    name: str
    age: int
    gender: str  # M/F/Other
    phone: Optional[str] = None


class PatientRegisterResponse(BaseModel):
    patient_id: str
    name: str
    ai_disclaimer: str = "AI SUGGESTED — DOCTOR MUST VERIFY"


class BloodValues(BaseModel):
    hemoglobin: Optional[float] = None
    wbc: Optional[float] = None
    rbc: Optional[float] = None
    platelets: Optional[float] = None
    hematocrit: Optional[float] = None
    mcv: Optional[float] = None
    mch: Optional[float] = None
    mchc: Optional[float] = None
    glucose: Optional[float] = None
    hba1c: Optional[float] = None
    creatinine: Optional[float] = None
    urea: Optional[float] = None
    sodium: Optional[float] = None
    potassium: Optional[float] = None
    calcium: Optional[float] = None
    bilirubin_total: Optional[float] = None
    sgot: Optional[float] = None
    sgpt: Optional[float] = None
    albumin: Optional[float] = None
    tsh: Optional[float] = None


class TestSubmitRequest(BaseModel):
    patient_id: str
    values: BloodValues


class TestSubmitResponse(BaseModel):
    test_id: str
    stream_url: str
    ai_disclaimer: str = "AI SUGGESTED — DOCTOR MUST VERIFY"


class RiskScore(BaseModel):
    level: str  # GREEN/YELLOW/RED/BLACK
    score: int  # 0-100
    queue_number: int
    primary_concerns: List[str]
    confidence: float


class LabFlag(BaseModel):
    parameter: str
    value: float
    unit: str
    reference_range: str
    severity: str  # LOW/MEDIUM/HIGH/CRITICAL
    direction: str  # HIGH/LOW/NORMAL


class Condition(BaseModel):
    name: str
    confidence: float
    supporting_flags: List[str]


class HistoryAlert(BaseModel):
    parameter: str
    trend: str
    previous_value: float
    current_value: float
    change_pct: float
    alert_level: str


class PatientReportResponse(BaseModel):
    test_id: str
    patient_id: str
    patient_name: str
    age: int
    gender: str
    submitted_at: str
    status: str
    lab_flags: List[LabFlag]
    suspected_conditions: List[Condition]
    history_alerts: List[HistoryAlert]
    risk_score: Optional[RiskScore]
    report_text: str
    doctor_verified: bool
    override_notes: Optional[str]
    ai_disclaimer: str = "AI SUGGESTED — DOCTOR MUST VERIFY"


class QueueItem(BaseModel):
    test_id: str
    patient_id: str
    patient_name: str
    age: int
    gender: str
    risk_level: str
    queue_number: int
    submitted_at: str
    doctor_verified: bool
    primary_concerns: List[str]
    ai_disclaimer: str = "AI SUGGESTED — DOCTOR MUST VERIFY"


class DoctorOverrideRequest(BaseModel):
    test_id: str
    doctor_id: str
    override_notes: str = Field(..., min_length=20)
    confirmed_critical: bool = False
    updated_risk_level: Optional[str] = None


class DoctorOverrideResponse(BaseModel):
    success: bool
    test_id: str
    message: str
    ai_disclaimer: str = "AI SUGGESTED — DOCTOR MUST VERIFY"


class AuditLogEntry(BaseModel):
    id: int
    timestamp: str
    event_type: str
    actor: str
    test_id: Optional[str]
    patient_id: Optional[str]
    details: Dict[str, Any]


class AuditLogResponse(BaseModel):
    entries: List[AuditLogEntry]
    total: int
    page: int
    page_size: int


class ImagingSubmitRequest(BaseModel):
    patient_id: str
    department: str
    raw_text: str = Field(..., min_length=10)
    submitted_by: Optional[str] = None

class ImagingSubmitResponse(BaseModel):
    imaging_id: str
    stream_url: str
    ai_disclaimer: str = "AI SUGGESTED — DOCTOR MUST VERIFY"

class ImagingFinding(BaseModel):
    structure: str
    observation: str
    significance: str
    details: str = ""

class ImagingCorrelation(BaseModel):
    finding: str
    blood_marker: str = ""
    clinical_significance: str
    concern_level: str

class ImagingDifferential(BaseModel):
    diagnosis: str
    confidence: float
    supporting_evidence: List[str]

class ImagingReportResponse(BaseModel):
    imaging_id: str
    patient_id: str
    patient_name: str
    age: int
    gender: str
    department: str
    submitted_at: str
    completed_at: Optional[str]
    status: str
    raw_text: str
    findings: List[ImagingFinding]
    impression: str
    recommendations: List[str]
    correlations: List[ImagingCorrelation]
    differential_diagnoses: List[ImagingDifferential]
    overall_concern: str
    urgency: str
    correlation_summary: str
    report_text: str
    ai_disclaimer: str = "AI SUGGESTED — DOCTOR MUST VERIFY"

class ImagingQueueItem(BaseModel):
    imaging_id: str
    patient_id: str
    patient_name: str
    age: int
    gender: str
    department: str
    submitted_at: str
    status: str
    overall_concern: str
    urgency: str
    impression: str
