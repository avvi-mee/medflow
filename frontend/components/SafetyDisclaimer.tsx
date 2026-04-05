'use client'

export default function SafetyDisclaimer({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold tracking-wide">
        AI SUGGESTED — VERIFY
      </span>
    )
  }
  return (
    <div className="w-full bg-white border-b border-slate-100 px-5 py-2.5 flex items-center gap-2.5">
      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
      <p className="text-slate-500 text-[11px]">
        <span className="font-semibold text-slate-700">AI SUGGESTED — DOCTOR MUST VERIFY.</span>
        {' '}AI-generated analysis. Must be reviewed by a qualified physician before any clinical action.
      </p>
    </div>
  )
}
