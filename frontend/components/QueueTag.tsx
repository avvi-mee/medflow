'use client'

import type { RiskLevel } from '@/lib/types'

const CFG: Record<RiskLevel, {
  border: string; headerBg: string; headerBorder: string;
  numColor: string; labelColor: string; noteColor: string;
  label: string; urgency: string; note: string;
  footerBg: string; footerBorder: string;
}> = {
  GREEN: {
    border:       'border-emerald-200',
    headerBg:     'bg-emerald-50',
    headerBorder: 'border-b border-emerald-100',
    numColor:     'text-emerald-700',
    labelColor:   'text-emerald-700',
    noteColor:    'text-emerald-600',
    label:        'LOW PRIORITY',
    urgency:      'LOW RISK',
    note:         'Proceed to waiting area',
    footerBg:     'bg-slate-50',
    footerBorder: 'border-t border-slate-100',
  },
  YELLOW: {
    border:       'border-amber-300',
    headerBg:     'bg-amber-50',
    headerBorder: 'border-b border-amber-100',
    numColor:     'text-amber-700',
    labelColor:   'text-amber-700',
    noteColor:    'text-amber-600',
    label:        'MODERATE',
    urgency:      'MODERATE RISK',
    note:         'Attend within 2 hours',
    footerBg:     'bg-slate-50',
    footerBorder: 'border-t border-slate-100',
  },
  RED: {
    border:       'border-red-300',
    headerBg:     'bg-red-50',
    headerBorder: 'border-b border-red-100',
    numColor:     'text-red-700',
    labelColor:   'text-red-700',
    noteColor:    'text-red-600',
    label:        'URGENT',
    urgency:      'HIGH RISK',
    note:         'Attend within 30 minutes',
    footerBg:     'bg-slate-50',
    footerBorder: 'border-t border-slate-100',
  },
  BLACK: {
    border:       'border-red-900',
    headerBg:     'bg-red-950',
    headerBorder: 'border-b border-red-800',
    numColor:     'text-red-300',
    labelColor:   'text-red-200',
    noteColor:    'text-red-300',
    label:        'CRITICAL — IMMEDIATE',
    urgency:      'CRITICAL RISK',
    note:         'Go to emergency immediately',
    footerBg:     'bg-red-950',
    footerBorder: 'border-t border-red-800',
  },
}

export default function QueueTag({ queueNumber, riskLevel, qrData, patientName }: {
  queueNumber: number; riskLevel: RiskLevel; qrData?: string; patientName?: string
}) {
  const c = CFG[riskLevel]
  const isDark = riskLevel === 'BLACK'

  return (
    <div id="queue-tag-print"
      className={`rounded-3xl border-2 ${c.border} ${isDark ? 'bg-red-950' : 'bg-white'} shadow-lg w-full max-w-sm mx-auto overflow-hidden ${isDark ? 'animate-pulse' : ''}`}
    >
      {/* Header */}
      <div className={`${c.headerBg} ${c.headerBorder} px-6 pt-5 pb-4 text-center`}>
        <div className={`text-[10px] font-bold tracking-[0.25em] uppercase mb-1 ${isDark ? 'text-red-400' : 'text-slate-400'}`}>
          MedFlow Hospital
        </div>
        <div className={`text-base font-black tracking-widest ${c.labelColor}`}>
          {c.label}
        </div>
        <div className={`text-[10px] font-semibold mt-1 ${isDark ? 'text-red-600' : 'text-slate-400'}`}>
          {c.urgency}
        </div>
      </div>

      {/* Queue number */}
      <div className="px-6 py-8 text-center">
        <div className={`text-[11px] font-bold tracking-[0.3em] uppercase mb-3 ${isDark ? 'text-red-500' : 'text-slate-400'}`}>
          Queue Number
        </div>
        <div className={`text-8xl font-black leading-none tabular-nums tracking-tight ${c.numColor}`}>
          {String(queueNumber).padStart(4, '0')}
        </div>
        {patientName && (
          <div className={`text-sm font-semibold mt-4 ${isDark ? 'text-red-300' : 'text-slate-600'}`}>
            {patientName}
          </div>
        )}
        <div className={`text-sm font-medium mt-2 ${c.noteColor}`}>
          {c.note}
        </div>
      </div>

      {/* Footer — QR + disclaimer */}
      <div className={`${c.footerBg} ${c.footerBorder} px-6 py-5 flex flex-col items-center gap-3`}>
        {qrData?.startsWith('data:image')
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={qrData} alt="QR Code" className="w-28 h-28 rounded-xl" />
          : <div className={`w-28 h-28 rounded-xl flex items-center justify-center text-xs font-medium border ${
              isDark ? 'bg-red-900 border-red-700 text-red-500' : 'bg-slate-100 border-slate-200 text-slate-400'
            }`}>
              QR Code
            </div>
        }
        <div className={`text-[10px] ${isDark ? 'text-red-600' : 'text-slate-400'}`}>
          Scan for digital report
        </div>
        <div className={`text-[10px] font-bold tracking-wide border rounded-full px-3 py-1 ${
          isDark ? 'border-red-700 text-red-400 bg-red-900/50' : 'border-amber-200 text-amber-700 bg-amber-50'
        }`}>
          AI SUGGESTED — DOCTOR MUST VERIFY
        </div>
      </div>
    </div>
  )
}
