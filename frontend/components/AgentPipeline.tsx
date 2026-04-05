'use client'

import { useEffect, useState } from 'react'
import { connectPipelineStream } from '@/lib/sse'
import type { AgentState, RiskLevel } from '@/lib/types'

const INIT: AgentState[] = [
  { name: 'lab_interpreter',    displayName: 'Lab Interpreter',    status: 'pending' },
  { name: 'pattern_detector',   displayName: 'Pattern Detector',   status: 'pending' },
  { name: 'history_comparator', displayName: 'History Comparator', status: 'pending' },
  { name: 'risk_scorer',        displayName: 'Risk Scorer',        status: 'pending' },
  { name: 'report_writer',      displayName: 'Report Writer',      status: 'pending' },
]

const META: Record<string, { icon: string; phase: 1 | 2; desc: string }> = {
  lab_interpreter:    { icon: '🔬', phase: 1, desc: 'ICMR ranges'  },
  pattern_detector:   { icon: '🧬', phase: 1, desc: 'Conditions'   },
  history_comparator: { icon: '📈', phase: 1, desc: 'Trends'       },
  risk_scorer:        { icon: '⚡', phase: 2, desc: 'Triage level' },
  report_writer:      { icon: '📝', phase: 2, desc: 'Doctor brief' },
}

const STATUS_STYLE = {
  pending:  { bg: 'bg-slate-50  border-slate-200', text: 'text-slate-400', icon: '○' },
  running:  { bg: 'bg-blue-50   border-blue-300',  text: 'text-blue-600',  icon: '◎' },
  complete: { bg: 'bg-emerald-50 border-emerald-300', text: 'text-emerald-700', icon: '✓' },
  error:    { bg: 'bg-red-50    border-red-300',   text: 'text-red-600',   icon: '✗' },
  fallback: { bg: 'bg-amber-50  border-amber-300', text: 'text-amber-700', icon: '⚠' },
}

interface AgentPipelineProps {
  testId: string
  onComplete?: (data: { riskLevel: RiskLevel; queueNumber: number; totalMs: number }) => void
}

export default function AgentPipeline({ testId, onComplete }: AgentPipelineProps) {
  const [agents, setAgents] = useState<AgentState[]>(INIT)
  const [phase, setPhase]   = useState(0)
  const [totalMs, setTotalMs] = useState<number | null>(null)
  const [isDone, setIsDone] = useState(false)
  const [riskPreview, setRiskPreview] = useState<{ level: RiskLevel; queue: number } | null>(null)

  useEffect(() => {
    if (!testId) return
    const es = connectPipelineStream(testId, {
      onAgentStart:    d => setAgents(p => p.map(a => a.name === d.agent ? { ...a, status: 'running' } : a)),
      onAgentComplete: d => setAgents(p => p.map(a => a.name === d.agent ? { ...a, status: d.status === 'fallback' ? 'fallback' : 'complete', elapsed_ms: d.elapsed_ms } : a)),
      onAgentError:    d => setAgents(p => p.map(a => a.name === d.agent ? { ...a, status: 'error', error: d.error, elapsed_ms: d.elapsed_ms } : a)),
      onPhaseStart:    d => setPhase(d.phase || 0),
      onRiskScored:    d => setRiskPreview({ level: d.risk_level, queue: d.queue_number }),
      onPipelineComplete: d => {
        setTotalMs(d.total_ms); setIsDone(true)
        onComplete?.({ riskLevel: d.risk_level, queueNumber: d.queue_number, totalMs: d.total_ms })
      },
    })
    return () => es.close()
  }, [testId, onComplete])

  const done = agents.filter(a => a.status === 'complete' || a.status === 'fallback').length

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{isDone ? 'Analysis complete' : phase > 0 ? `Phase ${phase} running...` : 'Starting...'}</span>
          <span>{done}/{agents.length} agents</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full progress-bar ${isDone ? 'bg-emerald-500' : 'bg-blue-500'}`}
            style={{ width: `${(done / agents.length) * 100}%` }} />
        </div>
      </div>

      {/* Phase 1 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
          <div className={`w-4 h-px ${phase >= 1 ? 'bg-blue-400' : 'bg-slate-200'}`} />
          Phase 1 — Parallel
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {agents.slice(0, 3).map(a => <AgentCard key={a.name} agent={a} />)}
        </div>
      </div>

      {/* Connector */}
      <div className="flex justify-center">
        <div className={`h-6 w-px ${phase >= 2 ? 'bg-gradient-to-b from-blue-400 to-violet-400' : 'bg-slate-200'} transition-all duration-500`} />
      </div>

      {/* Phase 2 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
          <div className={`w-4 h-px ${phase >= 2 ? 'bg-violet-400' : 'bg-slate-200'}`} />
          Phase 2 — Sequential
          <div className="flex-1 h-px bg-slate-100" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          {agents.slice(3, 5).map(a => <AgentCard key={a.name} agent={a} />)}
        </div>
      </div>

      {/* Risk preview */}
      {riskPreview && !isDone && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-200 animate-fade-in">
          <span>⚡</span>
          <span className="text-sm text-slate-600">Risk scored: <span className={`font-bold ${
            riskPreview.level === 'BLACK' ? 'text-red-700' :
            riskPreview.level === 'RED'   ? 'text-red-600' :
            riskPreview.level === 'YELLOW'? 'text-amber-600' : 'text-emerald-600'
          }`}>{riskPreview.level}</span> · Queue #{riskPreview.queue}</span>
          <div className="ml-auto w-4 h-4 border-2 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Done */}
      {isDone && totalMs !== null && (
        <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 animate-fade-in">
          <span className="text-emerald-700 text-sm font-semibold">✓ Pipeline complete</span>
          <span className="text-slate-400 text-xs">{(totalMs / 1000).toFixed(1)}s {totalMs < 30000 ? '· under 30s ✓' : ''}</span>
        </div>
      )}
    </div>
  )
}

function AgentCard({ agent }: { agent: AgentState }) {
  const meta = META[agent.name] || { icon: '⚙', phase: 1, desc: '' }
  const style = STATUS_STYLE[agent.status]

  return (
    <div className={`
      relative rounded-xl border-2 p-3 flex flex-col items-center gap-1.5 text-center transition-all duration-300
      ${style.bg}
      ${agent.status === 'running' ? 'scale-[1.03] shadow-md' : ''}
    `}>
      {agent.status === 'running' && (
        <div className="absolute inset-0 rounded-xl border-2 border-blue-400/40 animate-ping opacity-40" />
      )}
      <div className="relative">
        <span className="text-xl">{meta.icon}</span>
        {agent.status === 'running' && (
          <span className="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
        )}
      </div>
      <div className={`text-xs font-bold leading-tight ${style.text}`}>{agent.displayName}</div>
      <div className="text-[10px] text-slate-400">{meta.desc}</div>
      {agent.elapsed_ms !== undefined && (
        <div className="text-[10px] text-slate-400 font-mono">{agent.elapsed_ms}ms</div>
      )}
    </div>
  )
}
