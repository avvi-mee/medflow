'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { AuditLogEntry, QueueItem } from '@/lib/types'
import { getAuditLog, getDoctorQueue } from '@/lib/api'
import SafetyDisclaimer from '@/components/SafetyDisclaimer'
import RiskBadge from '@/components/RiskBadge'

const EVENT_STYLE: Record<string, string> = {
  PIPELINE_COMPLETE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PIPELINE_ERROR:    'bg-red-50 text-red-700 border-red-200',
  PIPELINE_START:    'bg-blue-50 text-blue-700 border-blue-200',
  AGENT_ERROR:       'bg-orange-50 text-orange-700 border-orange-200',
  DOCTOR_OVERRIDE:   'bg-orange-50 text-orange-700 border-orange-200',
  DOCTOR_VERIFY:     'bg-violet-50 text-violet-700 border-violet-200',
  PATIENT_REGISTER:  'bg-slate-100 text-slate-600 border-slate-200',
  TEST_SUBMIT:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  DEMO_SEED:         'bg-teal-50 text-teal-700 border-teal-200',
}

const EVENT_FILTERS = [
  { value: '', label: 'All Events' },
  { value: 'PIPELINE_COMPLETE', label: 'Completed' },
  { value: 'PIPELINE_ERROR', label: 'Errors' },
  { value: 'DOCTOR_OVERRIDE', label: 'Overrides' },
  { value: 'DOCTOR_VERIFY', label: 'Verifications' },
]

export default function AdminPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [queue, setQueue] = useState<QueueItem[]>([])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [logRes, queueRes] = await Promise.all([
        getAuditLog(page, 50, filter || undefined),
        getDoctorQueue(),
      ])
      setLogs(logRes.entries); setTotal(logRes.total); setQueue(queueRes)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [page, filter])

  useEffect(() => { fetchData(); const t = setInterval(fetchData, 15000); return () => clearInterval(t) }, [fetchData])

  const stats = {
    total:    queue.length,
    BLACK:    queue.filter(q => q.risk_level === 'BLACK').length,
    RED:      queue.filter(q => q.risk_level === 'RED').length,
    YELLOW:   queue.filter(q => q.risk_level === 'YELLOW').length,
    GREEN:    queue.filter(q => q.risk_level === 'GREEN').length,
    verified: queue.filter(q => q.doctor_verified).length,
    pending:  queue.filter(q => !q.doctor_verified).length,
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <SafetyDisclaimer />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => router.push('/')} className="text-slate-400 text-sm hover:text-slate-600 mb-1">← Home</button>
            <h1 className="text-3xl font-black text-slate-900">Admin Console</h1>
            <p className="text-slate-400 text-sm mt-0.5">Pipeline monitor · Queue statistics · Audit trail</p>
          </div>
          <button onClick={fetchData} className="btn-primary px-5 py-2.5 rounded-xl text-sm">Refresh</button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
          {[
            { label: 'Total',    value: stats.total,    color: 'text-slate-900' },
            { label: 'BLACK',    value: stats.BLACK,    color: 'text-red-800' },
            { label: 'RED',      value: stats.RED,      color: 'text-red-600' },
            { label: 'YELLOW',   value: stats.YELLOW,   color: 'text-amber-600' },
            { label: 'GREEN',    value: stats.GREEN,    color: 'text-emerald-600' },
            { label: 'Verified', value: stats.verified, color: 'text-blue-600' },
            { label: 'Pending',  value: stats.pending,  color: 'text-orange-600' },
          ].map(s => (
            <div key={s.label} className="card rounded-xl p-3 text-center">
              <div className={`text-2xl font-black ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-[10px] font-semibold mt-0.5 uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Active critical */}
        {queue.filter(q => !q.doctor_verified && (q.risk_level === 'BLACK' || q.risk_level === 'RED')).length > 0 && (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-red-700 font-bold text-sm">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Unverified Critical Patients
            </div>
            <div className="flex flex-wrap gap-2">
              {queue.filter(q => !q.doctor_verified && (q.risk_level === 'BLACK' || q.risk_level === 'RED')).map(item => (
                <button
                  key={item.test_id}
                  onClick={() => router.push(`/doctor/${item.patient_id}`)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white border border-red-200 rounded-xl text-sm text-red-700 hover:bg-red-50 transition shadow-sm"
                >
                  <RiskBadge level={item.risk_level} size="xs" />
                  <span>#{item.queue_number} {item.patient_name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Audit log */}
        <div className="card rounded-3xl overflow-hidden">
          {/* Toolbar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 text-sm">Audit Log</h2>
              <span className="text-slate-400 text-xs">({total} entries)</span>
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
              {EVENT_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => { setFilter(f.value); setPage(1) }}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                    filter === f.value
                      ? 'bg-white text-blue-600 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="p-8 space-y-2">
              {[...Array(5)].map((_, i) => <div key={i} className="h-10 shimmer rounded-lg" />)}
            </div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-slate-400">No audit entries yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[10px] bg-slate-50">
                    <th className="text-left px-5 py-3 font-semibold">Time</th>
                    <th className="text-left px-4 py-3 font-semibold">Event</th>
                    <th className="text-left px-4 py-3 font-semibold">Actor</th>
                    <th className="text-left px-4 py-3 font-semibold">Patient</th>
                    <th className="text-left px-4 py-3 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {logs.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-2.5 text-slate-400 font-mono whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${EVENT_STYLE[entry.event_type] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                          {entry.event_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono">{entry.actor}</td>
                      <td className="px-4 py-2.5 text-slate-500 font-mono">
                        {entry.patient_id ? entry.patient_id.slice(-8) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 max-w-xs">
                        <div className="truncate">
                          {Object.entries(entry.details || {}).slice(0, 2)
                            .map(([k, v]) => `${k}: ${String(v).slice(0, 25)}`)
                            .join(' · ')}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {total > 50 && (
            <div className="px-5 py-3 flex items-center justify-between border-t border-slate-100">
              <span className="text-xs text-slate-400">Page {page} of {Math.ceil(total / 50)}</span>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition">
                  Prev
                </button>
                <button disabled={page >= Math.ceil(total / 50)} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 disabled:opacity-30 hover:bg-slate-50 transition">
                  Next
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-slate-300 text-[10px] pb-4">
          MedFlow v1.0 · FastAPI + Groq llama-3.3-70b + Next.js 14 · AI SUGGESTED — DOCTOR MUST VERIFY
        </p>
      </div>
    </div>
  )
}
