'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { PatientReport, RiskLevel, ImagingReport } from '@/lib/types'
import { getPatientReport, getPatientImaging } from '@/lib/api'
import PatientBrief from '@/components/PatientBrief'
import OverrideModal from '@/components/OverrideModal'
import SafetyDisclaimer from '@/components/SafetyDisclaimer'

const CONCERN_STYLE: Record<string, string> = {
  LOW:      'bg-emerald-50 text-emerald-700 border-emerald-200',
  MEDIUM:   'bg-amber-50 text-amber-700 border-amber-200',
  HIGH:     'bg-orange-50 text-orange-700 border-orange-200',
  CRITICAL: 'bg-red-50 text-red-700 border-red-200',
}

const DEPT_COLOR: Record<string, string> = {
  XRAY:       'bg-blue-50 text-blue-700 border-blue-200',
  SONOGRAPHY: 'bg-purple-50 text-purple-700 border-purple-200',
  MRI:        'bg-indigo-50 text-indigo-700 border-indigo-200',
  CT:         'bg-cyan-50 text-cyan-700 border-cyan-200',
  ECG:        'bg-red-50 text-red-700 border-red-200',
  PATHOLOGY:  'bg-amber-50 text-amber-700 border-amber-200',
}

type Tab = 'blood' | 'imaging'

export default function PatientDetailPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()
  const [report, setReport]             = useState<PatientReport | null>(null)
  const [imaging, setImaging]           = useState<ImagingReport[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [showOverride, setShow]         = useState(false)
  const [gateOpen, setGateOpen]         = useState(false)
  const [confirmed, setConfirmed]       = useState(false)
  const [confirmInput, setInput]        = useState('')
  const [tab, setTab]                   = useState<Tab>('blood')
  const [selectedImaging, setSelected]  = useState<ImagingReport | null>(null)

  useEffect(() => {
    if (!id) return
    getPatientReport(id)
      .then(d => { setReport(d); if (d.risk_score?.level === 'BLACK' && !confirmed) setGateOpen(true) })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))

    getPatientImaging(id)
      .then(setImaging)
      .catch(() => {})
  }, [id, confirmed])

  const riskLevel  = (report?.risk_score?.level ?? 'YELLOW') as RiskLevel
  const isCritical = riskLevel === 'BLACK'

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin mx-auto" />
        <p className="text-slate-400 text-sm">Loading patient report...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="bg-white rounded-2xl p-8 text-center max-w-sm border border-red-100">
        <p className="text-red-600 font-semibold text-sm">{error}</p>
        <button onClick={() => router.back()} className="mt-4 text-slate-500 text-sm hover:text-slate-700">
          Back to queue
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <SafetyDisclaimer />

      {/* Critical gate modal */}
      {gateOpen && !confirmed && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-8 space-y-6 shadow-xl border border-slate-200">
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs font-bold text-red-600 uppercase tracking-widest">Critical Patient</span>
              </div>
              <h2 className="text-xl font-bold text-slate-900">Acknowledgement Required</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                This patient is classified as CRITICAL. You must acknowledge that you have reviewed
                the AI brief before accessing their record.
              </p>
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Type CONFIRM to proceed
              </label>
              <input
                value={confirmInput}
                onChange={e => setInput(e.target.value)}
                placeholder="CONFIRM"
                autoFocus
                className={`w-full rounded-xl px-4 py-3 text-center font-mono text-base border-2 transition outline-none ${
                  confirmInput === 'CONFIRM'
                    ? 'border-slate-900 bg-slate-50 text-slate-900'
                    : 'border-slate-200 bg-slate-50 text-slate-500'
                }`}
              />
            </div>
            <div className="space-y-2">
              <button
                disabled={confirmInput !== 'CONFIRM'}
                onClick={() => { setConfirmed(true); setGateOpen(false) }}
                className="w-full py-3 rounded-xl font-semibold text-sm transition bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                Proceed to Patient Record
              </button>
              <button onClick={() => router.back()} className="w-full text-slate-400 hover:text-slate-600 text-sm py-2 transition">
                Return to queue
              </button>
            </div>
          </div>
        </div>
      )}

      {report && (
        <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">

          {/* Top bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm transition"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Back to Queue
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print
              </button>
              <button
                onClick={() => setShow(true)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition"
              >
                {report.doctor_verified ? 'Override' : 'Verify / Override'}
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white border border-slate-200 rounded-xl w-fit">
            <button
              onClick={() => setTab('blood')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                tab === 'blood' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Blood Report
            </button>
            <button
              onClick={() => setTab('imaging')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
                tab === 'imaging' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Imaging Reports
              {imaging.length > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  tab === 'imaging' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {imaging.length}
                </span>
              )}
            </button>
          </div>

          {/* Blood report tab */}
          {tab === 'blood' && <PatientBrief report={report} />}

          {/* Imaging tab */}
          {tab === 'imaging' && (
            <div className="space-y-4">
              {imaging.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl px-8 py-12 text-center">
                  <div className="w-10 h-10 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-slate-600 font-medium text-sm">No imaging reports yet</p>
                  <p className="text-slate-400 text-xs mt-1">Submit from the Imaging & Diagnostics portal</p>
                </div>
              ) : (
                <>
                  {/* List of imaging reports */}
                  {!selectedImaging && (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                      {imaging.map(img => (
                        <button
                          key={img.imaging_id}
                          onClick={() => setSelected(img)}
                          className="w-full text-left flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition"
                        >
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border flex-shrink-0 ${DEPT_COLOR[img.department] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                            {img.department}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-700">{img.impression || 'Awaiting analysis...'}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{new Date(img.submitted_at).toLocaleString()}</div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${CONCERN_STYLE[img.overall_concern]}`}>
                              {img.overall_concern}
                            </span>
                            <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/>
                            </svg>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Selected imaging detail */}
                  {selectedImaging && (
                    <div className="space-y-4">
                      <button
                        onClick={() => setSelected(null)}
                        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-700 text-sm transition"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
                        </svg>
                        All imaging reports
                      </button>

                      {/* Header */}
                      <div className="bg-white border border-slate-200 rounded-2xl p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${DEPT_COLOR[selectedImaging.department] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                              {selectedImaging.department}
                            </span>
                            <p className="text-slate-400 text-xs mt-2">{new Date(selectedImaging.submitted_at).toLocaleString()}</p>
                          </div>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full border ${CONCERN_STYLE[selectedImaging.overall_concern]}`}>
                            {selectedImaging.overall_concern} CONCERN
                          </span>
                        </div>
                      </div>

                      {/* Findings */}
                      {selectedImaging.findings.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                            Findings ({selectedImaging.findings.length})
                          </div>
                          <div className="space-y-2">
                            {selectedImaging.findings.map((f, i) => {
                              const sigColor =
                                f.significance === 'CRITICAL' ? 'border-red-200 bg-red-50' :
                                f.significance === 'ABNORMAL' ? 'border-orange-200 bg-orange-50' :
                                f.significance === 'BORDERLINE' ? 'border-amber-200 bg-amber-50' :
                                'border-slate-100 bg-slate-50'
                              return (
                                <div key={i} className={`px-4 py-3 rounded-xl border ${sigColor}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <span className="font-semibold text-slate-800 text-sm">{f.structure}</span>
                                      <p className="text-slate-600 text-xs mt-0.5">{f.observation}</p>
                                    </div>
                                    <span className="text-[10px] font-bold flex-shrink-0 text-slate-500">{f.significance}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* AI Summary */}
                      {selectedImaging.report_text && (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
                            AI Clinical Summary
                          </div>
                          <p className="text-slate-700 text-sm leading-7 whitespace-pre-wrap">{selectedImaging.report_text}</p>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {showOverride && report && (
        <OverrideModal
          testId={report.test_id}
          patientName={report.patient_name}
          riskLevel={riskLevel}
          isCritical={isCritical}
          onClose={() => setShow(false)}
          onSuccess={() => { setShow(false); getPatientReport(id).then(setReport).catch(() => {}) }}
        />
      )}
    </div>
  )
}
