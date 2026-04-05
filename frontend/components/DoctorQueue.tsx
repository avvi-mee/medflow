'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { QueueItem, RiskLevel } from '@/lib/types'
import { getDoctorQueue } from '@/lib/api'
import RiskBadge from './RiskBadge'
import SafetyDisclaimer from './SafetyDisclaimer'

const ACCENT: Record<RiskLevel, string> = {
  BLACK:  'border-l-slate-900',
  RED:    'border-l-red-400',
  YELLOW: 'border-l-amber-400',
  GREEN:  'border-l-emerald-400',
}

const NUM_COLOR: Record<RiskLevel, string> = {
  BLACK: 'text-slate-900', RED: 'text-red-500', YELLOW: 'text-amber-500', GREEN: 'text-emerald-500',
}

export default function DoctorQueue() {
  const router = useRouter()
  const [queue, setQueue]         = useState<QueueItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [lastRefresh, setLast]    = useState<Date | null>(null)
  const [countdown, setCountdown] = useState(30)

  const fetchQueue = useCallback(async () => {
    try {
      const data = await getDoctorQueue()
      setQueue(data); setLast(new Date()); setCountdown(30)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchQueue()
    const iv = setInterval(fetchQueue, 30000)
    const tk = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000)
    return () => { clearInterval(iv); clearInterval(tk) }
  }, [fetchQueue])

  const stats = { BLACK: 0, RED: 0, YELLOW: 0, GREEN: 0 }
  queue.forEach(q => { if (q.risk_level in stats) stats[q.risk_level as RiskLevel]++ })
  const critical = queue.filter(q => !q.doctor_verified && (q.risk_level === 'BLACK' || q.risk_level === 'RED'))

  return (
    <div className="min-h-screen bg-slate-50">
      <SafetyDisclaimer />

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <button onClick={() => router.push('/')} className="text-slate-400 text-xs hover:text-slate-600 transition mb-2 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
              Home
            </button>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Doctor Queue</h1>
            <p className="text-slate-400 text-sm mt-1">
              {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Loading...'}
              {countdown > 0 && <span className="ml-2 text-slate-300">· {countdown}s</span>}
            </p>
          </div>
          <button
            onClick={fetchQueue}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition"
          >
            Refresh
          </button>
        </div>

        {/* Stats — compact inline row */}
        <div className="grid grid-cols-4 gap-3">
          {([
            { level: 'BLACK' as RiskLevel, label: 'Critical',  color: 'text-slate-900', border: 'border-l-slate-900' },
            { level: 'RED'   as RiskLevel, label: 'High Risk', color: 'text-red-600',   border: 'border-l-red-400'   },
            { level: 'YELLOW'as RiskLevel, label: 'Moderate',  color: 'text-amber-600', border: 'border-l-amber-400' },
            { level: 'GREEN' as RiskLevel, label: 'Low Risk',  color: 'text-emerald-600', border: 'border-l-emerald-400' },
          ]).map(s => (
            <div key={s.level} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${s.border} px-4 py-3`}>
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{stats[s.level]}</div>
              <div className="text-slate-400 text-xs mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Critical alert — minimal banner */}
        {critical.length > 0 && (
          <div className="bg-white border border-red-200 rounded-xl px-5 py-4 space-y-3">
            <div className="flex items-center gap-2 text-red-600 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              {critical.length} patient{critical.length > 1 ? 's' : ''} awaiting verification
            </div>
            <div className="flex flex-wrap gap-2">
              {critical.slice(0, 6).map(item => (
                <button
                  key={item.test_id}
                  onClick={() => router.push(`/doctor/${item.patient_id}`)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 hover:border-slate-300 hover:bg-white transition"
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.risk_level === 'BLACK' ? 'bg-slate-900' : 'bg-red-500'}`} />
                  <span className="font-mono font-medium">#{item.queue_number}</span>
                  <span>{item.patient_name}</span>
                </button>
              ))}
              {critical.length > 6 && (
                <span className="px-3 py-1.5 text-xs text-slate-400">+{critical.length - 6} more</span>
              )}
            </div>
          </div>
        )}

        {/* Queue list */}
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-white rounded-xl border border-slate-100 shimmer" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 px-8 py-16 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 mx-auto mb-3 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium text-sm">Queue is empty</p>
            <p className="text-slate-400 text-xs mt-1">No completed tests yet</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
            {queue.map(item => (
              <button
                key={item.test_id}
                onClick={() => router.push(`/doctor/${item.patient_id}`)}
                className={`w-full text-left flex items-center gap-5 px-5 py-4 border-l-4 hover:bg-slate-50 transition-colors ${ACCENT[item.risk_level as RiskLevel]}`}
              >
                {/* Queue number */}
                <div className={`text-xl font-bold tabular-nums w-14 text-right flex-shrink-0 font-mono ${NUM_COLOR[item.risk_level as RiskLevel]}`}>
                  {String(item.queue_number).padStart(3, '0')}
                </div>

                {/* Divider */}
                <div className="w-px h-8 bg-slate-100 flex-shrink-0" />

                {/* Patient info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 text-sm">{item.patient_name}</span>
                    <span className="text-slate-400 text-xs">{item.gender} · {item.age}y</span>
                  </div>
                  {item.primary_concerns.length > 0 && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {item.primary_concerns.slice(0, 3).join(' · ')}
                    </p>
                  )}
                </div>

                {/* Right side */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <RiskBadge level={item.risk_level as RiskLevel} size="sm" />
                  {item.doctor_verified ? (
                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                      Verified
                    </span>
                  ) : (item.risk_level === 'BLACK' || item.risk_level === 'RED') ? (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
                      Review
                    </span>
                  ) : null}
                  <svg className="w-4 h-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Summary footer */}
        {queue.length > 0 && (
          <p className="text-center text-slate-300 text-xs">
            {queue.length} patient{queue.length !== 1 ? 's' : ''} in queue
            · {queue.filter(q => q.doctor_verified).length} verified
            · {queue.filter(q => !q.doctor_verified).length} pending
          </p>
        )}
      </div>
    </div>
  )
}
