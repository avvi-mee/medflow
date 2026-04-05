'use client'

import type { PatientReport, RiskLevel } from '@/lib/types'
import RiskBadge from './RiskBadge'
import Sparkline from './Sparkline'

const SEV_COLOR: Record<string, { row: string; badge: string; arrow: string }> = {
  CRITICAL: { row: 'bg-red-50 border-red-200',    badge: 'bg-red-100 text-red-700 border-red-200',    arrow: 'text-red-600' },
  HIGH:     { row: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700 border-orange-200', arrow: 'text-orange-600' },
  MEDIUM:   { row: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700 border-amber-200',   arrow: 'text-amber-600' },
  LOW:      { row: 'bg-slate-50 border-slate-200', badge: 'bg-slate-100 text-slate-600 border-slate-200',    arrow: 'text-slate-500' },
}

const TREND_COLOR: Record<string, string> = {
  DETERIORATING: 'text-red-600',
  IMPROVING:     'text-emerald-600',
  STABLE:        'text-slate-400',
}

const RISK_BAR: Record<RiskLevel, string> = {
  BLACK: 'bg-slate-900', RED: 'bg-red-500', YELLOW: 'bg-amber-400', GREEN: 'bg-emerald-500',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-4">
      {children}
    </div>
  )
}

export default function PatientBrief({ report }: { report: PatientReport }) {
  const riskLevel = (report.risk_score?.level ?? 'YELLOW') as RiskLevel

  return (
    <div className="space-y-4">

      {/* Patient header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="space-y-1.5">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{report.patient_name}</h2>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <span>{report.gender}</span>
              <span className="text-slate-300">·</span>
              <span>Age {report.age}</span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-xs text-slate-400">{report.patient_id}</span>
            </div>
            <p className="text-slate-400 text-xs">{new Date(report.submitted_at).toLocaleString()}</p>
          </div>

          <div className="flex flex-col items-end gap-3">
            <RiskBadge level={riskLevel} size="lg" />

            {report.risk_score && (
              <div className="flex items-center gap-3">
                <span className="text-slate-400 text-xs">Risk score</span>
                <div className="w-28 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full progress-bar ${RISK_BAR[riskLevel]}`}
                    style={{ width: `${report.risk_score.score}%` }} />
                </div>
                <span className="text-slate-700 font-bold text-sm tabular-nums">{report.risk_score.score}/100</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              {report.risk_score && (
                <span className="text-xs text-slate-400">Queue #{report.risk_score.queue_number}</span>
              )}
              {report.doctor_verified && (
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                  Verified
                </span>
              )}
              {report.override_notes && (
                <span className="text-[11px] font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-full px-2.5 py-0.5">
                  Override
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Two-column: Abnormal Values + Suspected Conditions */}
      {(report.lab_flags.length > 0 || report.suspected_conditions.length > 0) && (
        <div className={`grid gap-4 ${report.lab_flags.length > 0 && report.suspected_conditions.length > 0 ? 'lg:grid-cols-2' : 'grid-cols-1'}`}>

          {/* Abnormal values */}
          {report.lab_flags.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <SectionLabel>Abnormal Values ({report.lab_flags.length})</SectionLabel>
              <div className="space-y-2">
                {report.lab_flags.map((f, i) => {
                  const s = SEV_COLOR[f.severity] ?? SEV_COLOR.LOW
                  return (
                    <div key={i} className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-sm ${s.row}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-slate-800 capitalize">{f.parameter.replace(/_/g, ' ')}</span>
                        <span className="text-slate-400 text-[10px] hidden sm:inline">ref: {f.reference_range}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                        <span className="font-mono font-semibold text-slate-700 text-xs">{f.value} {f.unit}</span>
                        <span className={`font-bold text-sm ${s.arrow}`}>{f.direction === 'HIGH' ? '↑' : '↓'}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.badge}`}>{f.severity}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Suspected conditions */}
          {report.suspected_conditions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <SectionLabel>Suspected Conditions</SectionLabel>
              <div className="space-y-4">
                {report.suspected_conditions.map((c, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-800 text-sm font-semibold">{c.name}</span>
                      <span className={`text-sm font-bold tabular-nums ${
                        c.confidence >= 0.8 ? 'text-red-600' : c.confidence >= 0.6 ? 'text-amber-600' : 'text-blue-600'
                      }`}>
                        {Math.round(c.confidence * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full progress-bar ${
                        c.confidence >= 0.8 ? 'bg-red-500' : c.confidence >= 0.6 ? 'bg-amber-400' : 'bg-blue-400'
                      }`} style={{ width: `${Math.round(c.confidence * 100)}%` }} />
                    </div>
                    {c.supporting_flags.length > 0 && (
                      <p className="text-[11px] text-slate-400">via: {c.supporting_flags.join(', ')}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trends vs previous visits — with sparklines */}
      {report.history_alerts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <SectionLabel>Trends vs Previous Visits</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {report.history_alerts.map((a, i) => {
              const isDeteriorate = a.trend === 'DETERIORATING'
              const isImprove     = a.trend === 'IMPROVING'
              const sparkColor    = isDeteriorate ? '#ef4444' : isImprove ? '#10b981' : '#94a3b8'
              // Build mini sparkline from previous → current
              const sparkValues = [a.previous_value, a.current_value]

              return (
                <div key={i} className="flex items-center gap-3 px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-700 truncate capitalize">
                      {a.parameter.replace(/_/g, ' ')}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                      <span className="font-mono">{a.previous_value}</span>
                      <span>→</span>
                      <span className="font-mono font-semibold text-slate-600">{a.current_value}</span>
                      <span className={`font-semibold tabular-nums ${TREND_COLOR[a.trend] || 'text-slate-400'}`}>
                        {a.change_pct > 0 ? '+' : ''}{a.change_pct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Sparkline
                    values={sparkValues}
                    width={64}
                    height={28}
                    color={sparkColor}
                    fillColor={sparkColor}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* AI Clinical Brief */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <SectionLabel>AI Clinical Brief</SectionLabel>
        <div className="text-slate-700 text-sm leading-7 whitespace-pre-wrap">
          {report.report_text || (
            <span className="text-slate-400 italic">Generating analysis...</span>
          )}
        </div>
      </div>

      {/* Override note */}
      {report.override_notes && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <div className="text-[11px] font-bold text-orange-600 uppercase tracking-widest mb-1.5">
            Doctor Override Applied
          </div>
          <p className="text-slate-700 text-sm leading-relaxed">{report.override_notes}</p>
        </div>
      )}
    </div>
  )
}
