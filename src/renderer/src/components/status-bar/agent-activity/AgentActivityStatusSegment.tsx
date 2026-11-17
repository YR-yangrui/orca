import { Activity } from 'lucide-react'
import { useAppStore } from '@/store'
import { useAgentStatus } from '@/runtime/agent-status/use-agent-status'
import { useNow } from '@/hooks/use-now'
import { useTranslate, type Translate } from '@/i18n/use-translate'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getActivePaneKeyForWorktree } from '../../sidebar/workspace-card/activity/focused-agent-row-highlight'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../composition/status-bar-context-menu-policy'
import { useCodexRequestPhase } from './use-codex-request-phase'
import type { CodexRequestPhase } from '../../../../../shared/agent-status/presentation/codex-request-phase'
import { formatNativeChatDuration } from '../../../../../shared/native-chat/transcript/turns/native-chat-turn-status'

function phaseLabel(phase: CodexRequestPhase['phase'], t: Translate): string {
  switch (phase) {
    case 'request':
      return t('agentActivity.request', 'Request preparation')
    case 'headers':
      return t('agentActivity.headers', 'Response headers received')
    case 'reasoning':
      return t('agentActivity.reasoning', 'Reasoning received')
    case 'output':
      return t('agentActivity.output', 'Output received')
    case 'tool':
      return t('agentActivity.tool', 'Tool dispatched')
    case 'tool-complete':
      return t('agentActivity.toolComplete', 'Tool completed')
    case 'retry':
      return t('agentActivity.retry', 'Retry reported')
    case 'error':
      return t('agentActivity.error', 'Request failed')
  }
}

export function AgentActivityStatusSegment(): React.JSX.Element | null {
  const t = useTranslate()
  const paneKey = useAppStore((state) =>
    state.activeWorktreeId ? getActivePaneKeyForWorktree(state, state.activeWorktreeId) : null
  )
  const entry = useAgentStatus(paneKey)
  const working = entry?.state === 'working' && !entry.restoredUnconfirmed && !entry.paneSleep
  const now = useNow(1_000, working)
  const phase = useCodexRequestPhase(
    paneKey,
    entry?.providerSession?.id,
    working && entry?.agentType === 'codex'
  )
  if (!entry) {
    return null
  }
  const turnStart = entry.turnStartedAt ?? entry.stateStartedAt
  // A previous turn's final log can remain in flight when the next turn opens.
  const currentPhase = working && phase && phase.observedAt >= turnStart ? phase : null
  const evidenceAt = entry.evidenceObservedAt ?? entry.updatedAt
  const program = entry.programStatus
  const currentProgram = program && program.observedAt >= entry.stateStartedAt ? program : null
  let label: string
  let observedAt = evidenceAt
  if (entry.paneSleep || entry.restoredUnconfirmed) {
    label = t('agentActivity.unconfirmed', 'Status unconfirmed')
  } else if (entry.state === 'blocked' || entry.state === 'waiting') {
    label = t('agentActivity.waiting', 'Waiting for input')
  } else if (entry.state === 'done') {
    label = t('agentActivity.done', 'Turn ended')
  } else if (currentPhase) {
    label = phaseLabel(currentPhase.phase, t)
    observedAt = currentPhase.observedAt
  } else if (entry.toolName) {
    label = t('agentActivity.toolName', 'Tool: {{name}}', { name: entry.toolName })
  } else if (currentProgram?.message) {
    label = currentProgram.message
    observedAt = currentProgram.observedAt
  } else {
    label = t('agentActivity.unknown', 'Working · phase unknown')
  }
  const age = formatNativeChatDuration(Math.max(0, (now - observedAt) / 1000))
  const provider = entry.agentType === 'codex' ? 'Codex' : (entry.agentType ?? 'Agent')
  const title = t('agentActivity.title', 'Current session activity')
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
          aria-label={title}
          className="inline-flex min-w-0 shrink items-center gap-1 rounded px-1 py-0.5 text-muted-foreground hover:bg-accent/70 hover:text-foreground"
        >
          <Activity className="size-3 shrink-0" />
          <span className="max-w-64 truncate text-2xs">
            {provider} · {label}
          </span>
          {working ? (
            <span className="shrink-0 text-2xs tabular-nums">
              {t('agentActivity.ago', '{{duration}} ago', { duration: age })}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        {...STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS}
        side="top"
        align="start"
        className="w-80 space-y-2 text-xs"
      >
        <p className="font-medium">{title}</p>
        <p>
          {provider} · {label}
        </p>
        {working ? (
          <p>
            {t('agentActivity.lastEvidence', 'Last confirmed activity: {{duration}} ago', {
              duration: age
            })}
          </p>
        ) : null}
        <p className="text-muted-foreground">
          {currentPhase
            ? t(
                'agentActivity.logSource',
                'Source: this session’s Codex log. This is the last recorded milestone, not a live server state.'
              )
            : t(
                'agentActivity.statusSource',
                'Source: session status events. Detailed request logs are unavailable for this session.'
              )}
        </p>
        <p className="text-muted-foreground">
          {t(
            'agentActivity.networkLimit',
            'Request preparation can be followed by local processing, upload or server wait. These events cannot distinguish upload, TCP retries or server queueing.'
          )}
        </p>
      </PopoverContent>
    </Popover>
  )
}
