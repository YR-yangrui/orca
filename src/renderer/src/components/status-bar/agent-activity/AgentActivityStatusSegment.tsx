import { Activity } from 'lucide-react'
import { useAppStore } from '@/store'
import { useAgentStatus } from '@/runtime/agent-status/use-agent-status'
import { useNow } from '@/hooks/use-now'
import { useIntlLocale, useTranslate, type Translate } from '@/i18n/use-translate'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getActivePaneKeyForWorktree } from '../../sidebar/workspace-card/activity/focused-agent-row-highlight'
import { STATUS_BAR_CONTEXT_MENU_EXEMPT_PROPS } from '../composition/status-bar-context-menu-policy'
import { useCodexRequestPhase } from './use-codex-request-phase'
import { codexPhaseDescription } from './codex-phase-description'
import type { CodexRequestPhase } from '../../../../../shared/agent-status/presentation/codex-request-phase'
import { formatNativeChatDuration } from '../../../../../shared/native-chat/transcript/turns/native-chat-turn-status'

function phaseLabel(phase: CodexRequestPhase['phase'], t: Translate): string {
  switch (phase) {
    case 'request':
      return t('agentActivity.request', 'Request in progress · phase unknown')
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
  const locale = useIntlLocale()
  const paneKey = useAppStore((state) =>
    state.activeWorktreeId ? getActivePaneKeyForWorktree(state, state.activeWorktreeId) : null
  )
  const entry = useAgentStatus(paneKey)
  const working = entry?.state === 'working' && !entry.restoredUnconfirmed && !entry.paneSleep
  const now = useNow(1_000, working)
  const phase = useCodexRequestPhase(
    paneKey,
    entry?.providerSession?.id,
    entry?.agentType === 'codex' && !entry.restoredUnconfirmed && !entry.paneSleep,
    working
  )
  if (!entry) {
    return null
  }
  const turnStart = entry.turnStartedAt ?? entry.stateStartedAt
  // A previous turn's final log can remain in flight when the next turn opens.
  const currentPhase = phase && phase.observedAt >= turnStart ? phase : null
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
  const explanation =
    entry.state === 'done'
      ? t(
          'agentActivity.doneMeaning',
          'The session reported that this turn ended. The milestones below remain available even if the response finished between refreshes.'
        )
      : entry.paneSleep || entry.restoredUnconfirmed
        ? t(
            'agentActivity.unconfirmedMeaning',
            'This session is asleep or its restored status has not been confirmed. The previous activity is not proof that it is still running.'
          )
        : entry.state === 'blocked' || entry.state === 'waiting'
          ? t(
              'agentActivity.waitingMeaning',
              'The session is waiting for input or confirmation. Check the terminal for a question, permission prompt or other blocking message.'
            )
          : currentPhase
            ? codexPhaseDescription(currentPhase.phase, t)
            : entry.toolName
              ? t(
                  'agentActivity.toolMeaning',
                  'The model issued a tool call and Codex dispatched it. The tool may be running or waiting; this does not confirm completion.'
                )
              : t(
                  'agentActivity.unknownMeaning',
                  'The session reports work in progress, but there is no detailed request milestone. This does not identify whether the wait is local, network or server-side.'
                )
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
        <p>{explanation}</p>
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
        {currentPhase?.recent?.length ? (
          <div className="space-y-1 border-t border-border pt-2">
            <p className="font-medium">{t('agentActivity.recent', 'Recent milestones')}</p>
            {currentPhase.recent
              .filter((item) => item.observedAt >= turnStart)
              .map((item, index) => (
                <div
                  key={`${item.observedAt}-${index}`}
                  className="flex items-start justify-between gap-3 text-muted-foreground"
                >
                  <span>
                    {item.phase === 'request'
                      ? t('agentActivity.requestStarted', 'Started preparing request')
                      : phaseLabel(item.phase, t)}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {new Date(item.observedAt).toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </span>
                </div>
              ))}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
