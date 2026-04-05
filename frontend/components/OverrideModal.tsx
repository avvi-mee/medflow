'use client'

import { useState } from 'react'
import type { RiskLevel } from '@/lib/types'
import { submitOverride } from '@/lib/api'

export default function OverrideModal({ testId, patientName, riskLevel, isCritical, onClose, onSuccess }: {
  testId: string; patientName: string; riskLevel: RiskLevel; isCritical: boolean; onClose: () => void; onSuccess: () => void
}) {
  const [notes, setNotes]           = useState('')
  const [doctorId, setDoctorId]     = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [newLevel, setNewLevel]     = useState<RiskLevel | ''>('')
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')

  const isValid = notes.length >= 20 && doctorId.trim().length > 0 && (!isCritical || confirmText === 'CONFIRM')

  const submit = async () => {
    if (!isValid) return
    setLoading(true); setError('')
    try {
      await submitOverride({ test_id: testId, doctor_id: doctorId, override_notes: notes, confirmed_critical: isCritical, updated_risk_level: newLevel || undefined })
      onSuccess()
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Override failed') }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Doctor Override</h2>
            <p className="text-slate-400 text-sm mt-0.5">{patientName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition">×</button>
        </div>

        {isCritical && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
            ⚠️ <strong>CRITICAL patient.</strong> Type <code className="bg-red-100 px-1 rounded font-mono">CONFIRM</code> to proceed.
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Doctor ID *</label>
            <input value={doctorId} onChange={e => setDoctorId(e.target.value)} placeholder="e.g. DR-001" className="input-light w-full px-4 py-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
              Override Notes * <span className="normal-case font-normal text-slate-400">(min 20 chars)</span>
            </label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Clinical justification for override..." rows={4}
              className="input-light w-full px-4 py-2.5 text-sm resize-none" />
            <div className={`text-xs mt-1 text-right ${notes.length >= 20 ? 'text-emerald-600' : 'text-slate-400'}`}>{notes.length}/20 min</div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Update Risk Level (optional)</label>
            <select value={newLevel} onChange={e => setNewLevel(e.target.value as RiskLevel | '')} className="input-light w-full px-4 py-2.5 text-sm">
              <option value="">— Keep current: {riskLevel} —</option>
              <option value="GREEN">GREEN — Low Risk</option>
              <option value="YELLOW">YELLOW — Moderate</option>
              <option value="RED">RED — High Risk</option>
              <option value="BLACK">BLACK — Critical</option>
            </select>
          </div>
          {isCritical && (
            <div>
              <label className="block text-xs font-semibold text-red-600 uppercase tracking-wider mb-1.5">Type CONFIRM to proceed:</label>
              <input value={confirmText} onChange={e => setConfirmText(e.target.value)} placeholder="CONFIRM"
                className={`w-full rounded-xl px-4 py-2.5 text-sm font-mono border-2 transition ${
                  confirmText === 'CONFIRM' ? 'border-red-400 bg-red-50 text-red-700' : 'input-light'}`} />
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl py-2.5 text-sm text-slate-600 font-semibold transition">Cancel</button>
          <button onClick={submit} disabled={!isValid || loading} className="flex-1 btn-primary rounded-xl py-2.5 text-sm">
            {loading ? <span className="flex items-center justify-center gap-2"><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Saving...</span> : 'Submit Override'}
          </button>
        </div>
        <p className="text-[11px] text-center text-slate-400">Permanently logged to audit trail</p>
      </div>
    </div>
  )
}
