import { useEffect, useState } from 'react'
import type { CodexRequestPhase } from '../../../../../shared/agent-status/presentation/codex-request-phase'

export function useCodexRequestPhase(
  paneKey: string | null,
  threadId: string | undefined,
  enabled: boolean
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
        // Serialize reads; a slow host must not accumulate overlapping database requests.
        if (!cancelled) {
          timer = setTimeout(() => void poll(), 2_000)
        }
      }
    }
    void poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [paneKey, threadId, enabled])
  return enabled && result?.paneKey === paneKey && result.phase?.threadId === threadId
    ? result.phase
    : null
}
