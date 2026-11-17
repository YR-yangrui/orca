import { useEffect, useState } from 'react'
import type { CodexRequestPhase } from '../../../../../shared/agent-status/presentation/codex-request-phase'

export function useCodexRequestPhase(
  paneKey: string | null,
  threadId: string | undefined,
  enabled: boolean,
  working: boolean
): CodexRequestPhase | null {
  const [result, setResult] = useState<{ paneKey: string; phase: CodexRequestPhase | null } | null>(
    null
  )
  useEffect(() => {
    const read = window.api.agentStatus.getCodexRequestPhase
    if (!paneKey || !threadId || !enabled || !read) {
      return
    }
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let reads = 0
    const poll = async (): Promise<void> => {
      try {
        if (document.visibilityState !== 'hidden') {
          const phase = await read(paneKey)
          if (!cancelled) {
            setResult({ paneKey, phase })
          }
        }
      } catch {
        if (!cancelled) {
          setResult({ paneKey, phase: null })
        }
      } finally {
        reads++
        // Serialize reads; a slow host must not accumulate overlapping database requests.
        // One delayed idle read catches logs flushed just after the turn-ended event.
        if (!cancelled && (working || reads < 2)) {
          timer = setTimeout(() => void poll(), working ? 500 : 1_000)
        }
      }
    }
    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [paneKey, threadId, enabled, working])
  return enabled && result?.paneKey === paneKey && result.phase?.threadId === threadId
    ? result.phase
    : null
}
