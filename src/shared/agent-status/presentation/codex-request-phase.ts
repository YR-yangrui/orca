export type CodexRequestPhase = {
  threadId: string
  phase:
    | 'request'
    | 'headers'
    | 'reasoning'
    | 'output'
    | 'tool'
    | 'tool-complete'
    | 'retry'
    | 'error'
  observedAt: number
  /** Recent distinct milestones, oldest first, retained when a short response ends between polls. */
  recent?: { phase: CodexRequestPhase['phase']; observedAt: number }[]
}

/** Logs establish the last observed milestone, not what the server is doing now. */
export function codexRequestPhaseFromLog(
  target: string,
  body: string
): CodexRequestPhase['phase'] | null {
  if (target === 'codex_core::session::world_state' && body.includes('building step world state')) {
    return 'request'
  }
  if (
    target === 'codex_http_client::client' &&
    /method=POST url=\S*\/responses(?:\?|\s|$)/.test(body)
  ) {
    if (body.includes('Request completed')) {
      return /status=2\d\d\b/.test(body) ? 'headers' : 'error'
    }
    if (body.includes('Request failed')) {
      return 'error'
    }
  }
  if (target === 'codex_core::responses_retry' && /retry|Retry|reconnect/.test(body)) {
    return 'retry'
  }
  if (target === 'codex_core::stream_events_utils') {
    if (body.includes('ToolCall:')) {
      return 'tool'
    }
    if (body.includes('item_type="reasoning"')) {
      return 'reasoning'
    }
    if (body.includes('item_type="message"')) {
      return 'output'
    }
  }
  if (target === 'codex_core::tools::parallel' && body.includes('tool call completed')) {
    return 'tool-complete'
  }
  return null
}
