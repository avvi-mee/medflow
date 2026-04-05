// Typed fetch wrappers for all MedFlow API endpoints

import type {
  PatientRegisterRequest,
  PatientRegisterResponse,
  TestSubmitRequest,
  TestSubmitResponse,
  PatientReport,
  QueueItem,
  DoctorOverrideRequest,
  DoctorOverrideResponse,
  AuditLogResponse,
  ImagingReport,
  ImagingQueueItem,
  ImagingSubmitResponse,
} from './types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || `API error ${res.status}`)
  }
  return res.json()
}

// ─── Patient ────────────────────────────────────────────────────────────────

export async function registerPatient(data: PatientRegisterRequest): Promise<PatientRegisterResponse> {
  return apiFetch('/patient/register', { method: 'POST', body: JSON.stringify(data) })
}

export async function getPatientReport(patientId: string): Promise<PatientReport> {
  return apiFetch(`/patient/${patientId}/report`)
}

export async function getPatientTag(patientId: string) {
  return apiFetch(`/patient/${patientId}/tag`)
}

export async function getWhatsAppReport(patientId: string): Promise<{ whatsapp_text: string; patient_id: string }> {
  return apiFetch(`/patient/${patientId}/whatsapp-text`)
}

// ─── Test ────────────────────────────────────────────────────────────────────

export async function submitTest(data: TestSubmitRequest): Promise<TestSubmitResponse> {
  return apiFetch('/test/submit', { method: 'POST', body: JSON.stringify(data) })
}

// ─── Doctor ─────────────────────────────────────────────────────────────────

export async function getDoctorQueue(): Promise<QueueItem[]> {
  return apiFetch('/doctor/queue')
}

export async function submitOverride(data: DoctorOverrideRequest): Promise<DoctorOverrideResponse> {
  return apiFetch('/doctor/override', { method: 'POST', body: JSON.stringify(data) })
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function getAuditLog(
  page = 1,
  pageSize = 50,
  eventType?: string
): Promise<AuditLogResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) })
  if (eventType) params.set('event_type', eventType)
  return apiFetch(`/admin/audit?${params}`)
}

// ─── Imaging ─────────────────────────────────────────────────────────────────

export async function submitImaging(data: {
  patient_id: string; department: string; raw_text: string; submitted_by?: string
}): Promise<ImagingSubmitResponse> {
  return apiFetch('/imaging/submit', { method: 'POST', body: JSON.stringify(data) })
}

export async function getImagingReport(imagingId: string): Promise<ImagingReport> {
  return apiFetch(`/imaging/${imagingId}/report`)
}

export async function getPatientImaging(patientId: string): Promise<ImagingReport[]> {
  return apiFetch(`/patient/${patientId}/imaging`)
}

export async function getImagingQueue(): Promise<ImagingQueueItem[]> {
  return apiFetch('/imaging/queue')
}

// ─── Demo ────────────────────────────────────────────────────────────────────

export async function seedDemo() {
  return apiFetch('/demo/seed', { method: 'POST' })
}

// ─── Health ──────────────────────────────────────────────────────────────────

export async function healthCheck() {
  return apiFetch('/health')
}
