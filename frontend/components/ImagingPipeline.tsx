'use client'

import { useEffect, useState } from 'react'
import type { ImagingReport } from '@/lib/types'
import { getImagingReport } from '@/lib/api'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const AGENTS = [
  { name: 'findings_extractor',  label: 'Findings Extractor',  desc: 'Parsing report text, extracting structured findings' },
  { name: 'clinical_correlator', label: 'Clinical Correlator',  desc: 'Correlating with blood test data, identifying patterns' },
  { name: 'imaging_report_writer', label: 'Report Composer',   desc: 'Composing AI clinical summary for doctor review' },
]

type AgentStatus = 'pending' | 'running' | 'complete' | 'error'

interface AgentState {
  status: AgentStatus
  elapsed_ms?: number
}

const STATUS_ICON: Record<AgentStatus, React.ReactNode> = {
  pending: <span className="w-5 h-5 rounded-full border-2 border-slate-200 flex-shrink-0" />,
  running: <span className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin flex-shrink-0" />,
  complete: (
    <span className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  ),
  error: (
    <span className="w-5 h-5 rounded-full bg-red-400 flex items-center justify-center flex-shrink-0">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    </span>
  ),
}

export default function ImagingPipeline({
  imagingId,
  onComplete,
}: {
  imagingId: string
  onComplete: (report: ImagingReport) => void
}) {
  const [agents, setAgents] = useState<Record<string, AgentState>>({
    findings_extractor:    { status: 'pending' },
    clinical_correlator:   { status: 'pending' },
    imaging_report_writer: { status: 'pending' },
  })
  const [phase, setPhase]         = useState(0)
  const [done, setDone]           = useState(false)
  const [elapsed, setElapsed]     = useState(0)
  const [startTime]               = useState(Date.now())

  // Tick timer
  useEffect(() => {
    if (done) return
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(t)
  }, [done, startTime])

  useEffect(() => {
    const es = new EventSource(`${BASE_URL}/imaging/stream/${imagingId}`)

    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        const { event, data } = msg

        if (event === 'agent_start' && data?.agent) {
          setAgents(prev => ({ ...prev, [data.agent]: { status: 'running' } }))
        }
        if ((event === 'agent_complete' || event === 'agent_error') && data?.agent) {
          setAgents(prev => ({
            ...prev,
            [data.agent]: { status: event === 'agent_complete' ? 'complete' : 'error', elapsed_ms: data.elapsed_ms },
          }))
        }
        if (event === 'phase_start' && data?.phase) {
          setPhase(data.phase)
        }
        if (event === 'pipeline_complete') {
          setDone(true)
          es.close()
          setTimeout(() => {
            getImagingReport(imagingId).then(onComplete).catch(() => {})
          }, 600)
        }
        if (event === 'pipeline_error') {
          es.close()
        }
      } catch { /* ignore */ }
    }

    es.onerror = () => es.close()
    return () => es.close()
  }, [imagingId, onComplete])

  const completedCount = Object.values(agents).filter(a => a.status === 'complete').length

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          {done ? 'Analysis complete' : `Running agent ${completedCount + 1} of ${AGENTS.length}...`}
        </span>
        <span className="font-mono text-slate-400 text-xs">{elapsed}s</span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${done ? 100 : (completedCount / AGENTS.length) * 100}%` }}
        />
      </div>

      {/* Agent steps */}
      <div className="space-y-2">
        {AGENTS.map((agent, idx) => {
          const state = agents[agent.name]
          const isActive = state.status === 'running'

          return (
            <div
              key={agent.name}
              className={`flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
                state.status === 'complete' ? 'border-emerald-200 bg-emerald-50' :
                state.status === 'running'  ? 'border-blue-200 bg-blue-50' :
                state.status === 'error'    ? 'border-red-200 bg-red-50' :
                'border-slate-100 bg-slate-50'
              }`}
            >
              <div className="mt-0.5">{STATUS_ICON[state.status]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-sm font-semibold ${
                    state.status === 'complete' ? 'text-emerald-700' :
                    state.status === 'running'  ? 'text-blue-700' :
                    state.status === 'error'    ? 'text-red-700' :
                    'text-slate-500'
                  }`}>
                    Agent {idx + 1} — {agent.label}
                  </span>
                  {state.elapsed_ms && (
                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0">
                      {state.elapsed_ms}ms
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 ${
                  isActive ? 'text-blue-500' : 'text-slate-400'
                }`}>
                  {agent.desc}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {done && (
        <div className="text-center text-xs text-slate-400 pt-1">
          All 3 agents completed in {elapsed}s
        </div>
      )}
    </div>
  )
}
