// EventSource wrapper with typed event handlers for MedFlow SSE

import type {
  SSEEventType,
  AgentSSEData,
  PhaseSSEData,
  RiskScoredSSEData,
  PipelineCompleteSSEData,
} from './types'

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type SSEHandlers = {
  onAgentStart?: (data: AgentSSEData) => void
  onAgentComplete?: (data: AgentSSEData) => void
  onAgentError?: (data: AgentSSEData) => void
  onPhaseStart?: (data: PhaseSSEData) => void
  onPhaseComplete?: (data: PhaseSSEData) => void
  onRiskScored?: (data: RiskScoredSSEData) => void
  onPipelineComplete?: (data: PipelineCompleteSSEData) => void
  onPipelineError?: (data: { error: string }) => void
  onError?: (error: Event) => void
}

export function connectPipelineStream(testId: string, handlers: SSEHandlers): EventSource {
  const es = new EventSource(`${BASE_URL}/pipeline/stream/${testId}`)

  const handle = (eventType: SSEEventType) => (event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)
      switch (eventType) {
        case 'agent_start':
          handlers.onAgentStart?.(data)
          break
        case 'agent_complete':
          handlers.onAgentComplete?.(data)
          break
        case 'agent_error':
          handlers.onAgentError?.(data)
          break
        case 'phase_start':
          handlers.onPhaseStart?.(data)
          break
        case 'phase_complete':
          handlers.onPhaseComplete?.(data)
          break
        case 'risk_scored':
          handlers.onRiskScored?.(data)
          break
        case 'pipeline_complete':
          handlers.onPipelineComplete?.(data)
          es.close()
          break
        case 'pipeline_error':
          handlers.onPipelineError?.(data)
          es.close()
          break
      }
    } catch (e) {
      console.error('SSE parse error:', e)
    }
  }

  es.addEventListener('agent_start', handle('agent_start'))
  es.addEventListener('agent_complete', handle('agent_complete'))
  es.addEventListener('agent_error', handle('agent_error'))
  es.addEventListener('phase_start', handle('phase_start'))
  es.addEventListener('phase_complete', handle('phase_complete'))
  es.addEventListener('risk_scored', handle('risk_scored'))
  es.addEventListener('pipeline_complete', handle('pipeline_complete'))
  es.addEventListener('pipeline_error', handle('pipeline_error'))

  if (handlers.onError) {
    es.onerror = handlers.onError
  }

  return es
}
