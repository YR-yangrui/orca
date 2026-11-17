import { useEffect, useSyncExternalStore } from 'react'
import type { RuntimeGitContext } from '@/runtime/source-control/git/runtime-git-client-context'
import { resolveLocalWorktreePath } from '@/runtime/source-control/git/runtime-git-client-context'
import { callRuntimeRpc } from '@/runtime/rpc/calls/runtime-rpc-call'
import { toRuntimeWorktreeSelector } from '@/runtime/rpc/targets/runtime-worktree-selector'
import { normalizeRuntimePathForComparison } from '../../../../../../shared/file-access/cross-platform-path'
import { runKeyedSerializedOperation } from '../../../../../../shared/concurrency/keyed-serialized-operations'
import {
  normalizeChangeCategories,
  type ChangeCategory,
  type ChangeCategoryOperation
} from '../../../../../../shared/source-control/listing/change-categories'
export type { ChangeCategory } from '../../../../../../shared/source-control/listing/change-categories'

type Snapshot = { categories: ChangeCategory[]; loading: boolean; busy: boolean; error: boolean }
const EMPTY: Snapshot = { categories: [], loading: true, busy: false, error: false }
const snapshots = new Map<string, Snapshot>()
const contexts = new Map<string, RuntimeGitContext>()
const queues = new Map<string, Promise<void>>()
const reads = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()

export function changeCategoryScope(context: RuntimeGitContext | null): string | null {
  if (!context) {
    return null
  }
  // Keep the former client key for one-time import; the authoritative data now lives on the worktree's host.
  return `orca.git-change-categories.v1:${JSON.stringify([
    context.target.kind === 'environment' ? context.target.environmentId : 'local',
    context.connectionId ?? null,
    normalizeRuntimePathForComparison(context.worktreePath)
  ])}`
}

function publish(scope: string, patch: Partial<Snapshot>): void {
  snapshots.set(scope, { ...(snapshots.get(scope) ?? EMPTY), ...patch })
  // All mounted views of a worktree observe the same completed host transaction.
  for (const listener of listeners) {
    listener()
  }
}
function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

async function call(
  context: RuntimeGitContext,
  operation: ChangeCategoryOperation
): Promise<ChangeCategory[]> {
  if (context.target.kind === 'local') {
    return window.api.git.changeCategories({
      worktreePath: resolveLocalWorktreePath(context),
      connectionId: context.connectionId,
      operation
    })
  }
  if (!context.worktreeId) {
    throw new Error('Missing worktree owner')
  }
  return callRuntimeRpc<ChangeCategory[]>(context.target, 'git.changeCategories', {
    worktree: toRuntimeWorktreeSelector(context.worktreeId),
    operation
  })
}

export function refreshChangeCategories(scope: string): Promise<void> {
  const existing = reads.get(scope)
  if (existing) {
    return existing
  }
  const context = contexts.get(scope)
  if (!context) {
    return Promise.resolve()
  }
  const pending = runKeyedSerializedOperation(queues, scope, async () => {
    try {
      const legacy = localStorage.getItem(scope)
      const categories = await call(
        context,
        legacy === null
          ? { kind: 'read' }
          : {
              kind: 'import',
              categories: normalizeChangeCategories(JSON.parse(legacy))
            }
      )
      // Retire client-only data only after the host accepted it; failed imports remain retryable.
      if (legacy !== null) {
        localStorage.removeItem(scope)
      }
      const previous = snapshots.get(scope) ?? EMPTY
      publish(scope, {
        categories:
          JSON.stringify(previous.categories) === JSON.stringify(categories)
            ? previous.categories
            : categories,
        loading: false,
        error: false
      })
    } catch {
      // Keep the last good categories; an unavailable host is not an empty category list.
      publish(scope, { loading: false, error: true })
    }
  }).finally(() => {
    reads.delete(scope)
  })
  reads.set(scope, pending)
  return pending
}

export function useStoredChangeCategories(
  scope: string | null,
  context: RuntimeGitContext | null
): Snapshot {
  const snapshot = useSyncExternalStore(subscribe, () =>
    scope ? (snapshots.get(scope) ?? EMPTY) : EMPTY
  )
  useEffect(() => {
    if (!scope || !context) {
      return
    }
    contexts.set(scope, context)
    void refreshChangeCategories(scope)
    const refresh = () => {
      if (document.visibilityState !== 'hidden') {
        void refreshChangeCategories(scope)
      }
    }
    // SourceGit writes outside Orca's renderer; re-read without relying on Git status contents changing.
    const timer = window.setInterval(refresh, 3000)
    window.addEventListener('focus', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', refresh)
    }
  }, [scope, context])
  return snapshot
}

async function mutate(scope: string, operation: ChangeCategoryOperation): Promise<void> {
  const context = contexts.get(scope)
  if (!context) {
    throw new Error('Missing worktree owner')
  }
  publish(scope, { busy: true })
  try {
    await runKeyedSerializedOperation(queues, scope, async () => {
      const categories = await call(context, operation)
      publish(scope, { categories, loading: false, error: false })
    })
  } finally {
    publish(scope, { busy: false })
  }
}
export function moveChangeCategoryPaths(
  scope: string,
  name: string,
  paths: readonly string[]
): Promise<void> {
  return mutate(scope, { kind: 'move', name, paths: [...paths] })
}
export function deleteChangeCategory(scope: string, name: string): Promise<void> {
  return mutate(scope, { kind: 'delete', name })
}
export async function forgetChangeCategoryPaths(
  scope: string | null,
  paths: readonly string[]
): Promise<void> {
  if (!scope || paths.length === 0) {
    return
  }
  // Cleanup is an explicit successful Git action, never a side effect of an incomplete status snapshot.
  await moveChangeCategoryPaths(scope, '', paths)
}
