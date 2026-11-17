import type { Translate } from '@/i18n/use-translate'
import type { CodexRequestPhase } from '../../../../../shared/agent-status/presentation/codex-request-phase'

export function codexPhaseDescription(phase: CodexRequestPhase['phase'], t: Translate): string {
  switch (phase) {
    case 'request':
      return t(
        'agentActivity.requestMeaning',
        'Codex started preparing a model request. No later milestone has been observed yet; it may be preparing locally, uploading, or waiting for the server. This does not mean preparation is still running.'
      )
    case 'headers':
      return t(
        'agentActivity.headersMeaning',
        'The server returned HTTP response headers. The request has a response, but model text may not have arrived yet.'
      )
    case 'reasoning':
      return t(
        'agentActivity.reasoningMeaning',
        'Codex received a reasoning item from the model. This confirms response data arrived; it does not mean the whole response is finished.'
      )
    case 'output':
      return t(
        'agentActivity.outputMeaning',
        'Codex received an assistant message item. Text output has arrived; the model may still produce more text or tool calls.'
      )
    case 'tool':
      return t(
        'agentActivity.toolMeaning',
        'The model issued a tool call and Codex dispatched it. The tool may be running or waiting; this does not confirm completion.'
      )
    case 'tool-complete':
      return t(
        'agentActivity.toolCompleteMeaning',
        'A tool call finished. Other parallel tools may still be running, or Codex may prepare another model request.'
      )
    case 'retry':
      return t(
        'agentActivity.retryMeaning',
        'Codex reported a request retry or stream reconnection. This is an application retry, not a measured TCP retransmission.'
      )
    case 'error':
      return t(
        'agentActivity.errorMeaning',
        'The model request failed or returned an unsuccessful HTTP status. Codex may retry; this alone does not mean the entire turn failed.'
      )
  }
}
