// ─── Shared TypeScript Interfaces ────────────────────────────────────────────

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED' | 'BLACK'
export type TestStatus = 'PENDING' | 'RUNNING' | 'COMPLETE' | 'ERROR'
export type Severity = 'NORMAL' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type Trend = 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'NEW_FINDING' | 'NO_HISTORY'

export interface PatientRegisterRequest {
  name: string
  age: number
  gender: 'M' | 'F' | 'Other'
  phone?: string
}

export interface PatientRegisterResponse {
  patient_id: string
  name: string
  ai_disclaimer: string
}

export interface BloodValues {
  hemoglobin?: number
  wbc?: number
  rbc?: number
  platelets?: number
  hematocrit?: number
  mcv?: number
  mch?: number
  mchc?: number
  glucose?: number
  hba1c?: number
  creatinine?: number
  urea?: number
  sodium?: number
  potassium?: number
  calcium?: number
  bilirubin_total?: number
  sgot?: number
  sgpt?: number
  albumin?: number
  tsh?: number
}

export interface TestSubmitRequest {
  patient_id: string
  values: BloodValues
}

export interface TestSubmitResponse {
  test_id: string
  stream_url: string
  ai_disclaimer: string
}

export interface LabFlag {
  parameter: string
  value: number
  unit: string
  reference_range: string
  severity: Severity
  direction: 'HIGH' | 'LOW' | 'NORMAL'
}

export interface Condition {
  name: string
  confidence: number
  supporting_flags: string[]
}

export interface HistoryAlert {
  parameter: string
  trend: Trend
  previous_value: number
  current_value: number
  change_pct: number
  alert_level: string
}

export interface RiskScore {
  level: RiskLevel
  score: number
  queue_number: number
  primary_concerns: string[]
  confidence: number
}

export interface PatientReport {
  test_id: string
  patient_id: string
  patient_name: string
  age: number
  gender: string
  submitted_at: string
  status: TestStatus
  lab_flags: LabFlag[]
  suspected_conditions: Condition[]
  history_alerts: HistoryAlert[]
  risk_score: RiskScore | null
  report_text: string
  doctor_verified: boolean
  override_notes: string | null
  ai_disclaimer: string
}

export interface QueueItem {
  test_id: string
  patient_id: string
  patient_name: string
  age: number
  gender: string
  risk_level: RiskLevel
  queue_number: number
  submitted_at: string
  doctor_verified: boolean
  primary_concerns: string[]
  ai_disclaimer: string
}

export interface DoctorOverrideRequest {
  test_id: string
  doctor_id: string
  override_notes: string
  confirmed_critical: boolean
  updated_risk_level?: RiskLevel
}

export interface DoctorOverrideResponse {
  success: boolean
  test_id: string
  message: string
  ai_disclaimer: string
}

export interface AuditLogEntry {
  id: number
  timestamp: string
  event_type: string
  actor: string
  test_id: string | null
  patient_id: string | null
  details: Record<string, unknown>
}

export interface AuditLogResponse {
  entries: AuditLogEntry[]
  total: number
  page: number
  page_size: number
}

// SSE Event payloads
export interface AgentSSEData {
  agent: string
  agent_display: string
  status: 'running' | 'complete' | 'error' | 'fallback'
  elapsed_ms?: number
  result?: Record<string, unknown>
  error?: string
}

export interface PhaseSSEData {
  phase: number
  agents?: string[]
  flags_count?: number
  conditions_count?: number
  alerts_count?: number
}

export interface RiskScoredSSEData {
  risk_level: RiskLevel
  score: number
  queue_number: number
}

export interface PipelineCompleteSSEData {
  test_id: string
  risk_level: RiskLevel
  queue_number: number
  total_ms: number
  qr_data: string
}

export type SSEEventType =
  | 'agent_start'
  | 'agent_complete'
  | 'agent_error'
  | 'phase_start'
  | 'phase_complete'
  | 'risk_scored'
  | 'pipeline_complete'
  | 'pipeline_error'
  | 'ping'

export interface AgentState {
  name: string
  displayName: string
  status: 'pending' | 'running' | 'complete' | 'error' | 'fallback'
  elapsed_ms?: number
  error?: string
}

// ─── Imaging / Radiology ─────────────────────────────────────────────────────

export type ImagingConcern = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ImagingUrgency = 'ROUTINE' | 'URGENT' | 'STAT'

export interface ImagingFinding {
  structure: string
  observation: string
  significance: string
  details: string
}

export interface ImagingCorrelation {
  finding: string
  blood_marker: string
  clinical_significance: string
  concern_level: string
}

export interface ImagingDifferential {
  diagnosis: string
  confidence: number
  supporting_evidence: string[]
}

export interface ImagingReport {
  imaging_id: string
  patient_id: string
  patient_name: string
  age: number
  gender: string
  department: string
  submitted_at: string
  completed_at: string | null
  status: string
  raw_text: string
  findings: ImagingFinding[]
  impression: string
  recommendations: string[]
  correlations: ImagingCorrelation[]
  differential_diagnoses: ImagingDifferential[]
  overall_concern: ImagingConcern
  urgency: ImagingUrgency
  correlation_summary: string
  report_text: string
  ai_disclaimer: string
}

export interface ImagingQueueItem {
  imaging_id: string
  patient_id: string
  patient_name: string
  age: number
  gender: string
  department: string
  submitted_at: string
  status: string
  overall_concern: ImagingConcern
  urgency: ImagingUrgency
  impression: string
}

export interface ImagingSubmitResponse {
  imaging_id: string
  stream_url: string
  ai_disclaimer: string
}
