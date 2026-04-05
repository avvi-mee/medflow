'use client'

import type { RiskLevel } from '@/lib/types'

interface RiskBadgeProps {
  level: RiskLevel
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

const CFG: Record<RiskLevel, { bg: string; text: string; border: string; dot: string; label: string }> = {
  GREEN:  { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500', label: 'LOW RISK'  },
  YELLOW: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   dot: 'bg-amber-400',   label: 'MODERATE'  },
  RED:    { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     dot: 'bg-red-500',     label: 'HIGH RISK' },
  BLACK:  { bg: 'bg-slate-900',  text: 'text-white',       border: 'border-slate-800',   dot: 'bg-red-400',     label: 'CRITICAL'  },
}

const SIZES = {
  xs: 'px-2 py-0.5 text-[10px] gap-1',
  sm: 'px-2.5 py-1 text-[11px] gap-1.5',
  md: 'px-3 py-1.5 text-xs gap-2',
  lg: 'px-3.5 py-1.5 text-sm gap-2',
}

const DOT = { xs: 'w-1.5 h-1.5', sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2 h-2' }

export default function RiskBadge({ level, size = 'md' }: RiskBadgeProps) {
  const c = CFG[level]
  return (
    <span className={`
      inline-flex items-center font-semibold tracking-wider rounded-full border
      ${c.bg} ${c.text} ${c.border} ${SIZES[size]}
    `}>
      <span className={`rounded-full flex-shrink-0 ${DOT[size]} ${c.dot}`} />
      {c.label}
    </span>
  )
}
