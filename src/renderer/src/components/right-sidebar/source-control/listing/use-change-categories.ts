import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import type { GitStatusEntry } from '../../../../../../shared/git/status/git-status-types'
import type { RuntimeClientTarget } from '../../../../../../shared/remote-runtime/host-catalog/runtime-client-target'
import {
  changeCategoryScope,
  deleteChangeCategory,
  forgetChangeCategoryPaths,
  moveChangeCategoryPaths,
  refreshChangeCategories,
  useStoredChangeCategories
} from './change-category-store'

export function isCategorizedChange(entry: GitStatusEntry): boolean {
  return entry.area !== 'staged' && entry.conflictStatus !== 'unresolved' && !entry.submoduleRoot
}

function reportCategoryFailure(): void {
  toast.error(translate('sourceControl.categories.saveFailed', 'Could not save change categories'))
}

export function useChangeCategories({
  target,
  connectionId,
  worktreePath,
  worktreeId,
  entries
}: {
  target: RuntimeClientTarget | null
  connectionId: string | null | undefined
  worktreeId: string | null
  worktreePath: string | null
  entries: GitStatusEntry[]
}) {
  const context = useMemo(
    () =>
      target && worktreePath
        ? {
            target,
            connectionId: connectionId ?? undefined,
            worktreePath,
            worktreeId
          }
        : null,
    [target, connectionId, worktreePath, worktreeId]
  )
  const scope = changeCategoryScope(context)
  const { categories, loading, busy, error } = useStoredChangeCategories(scope, context)
  const refresh = useCallback(() => {
    if (scope) {
      void refreshChangeCategories(scope)
    }
  }, [scope])
  const [selection, setSelection] = useState({ scope, name: '' })
  const selectedCategory =
    selection.scope === scope && categories.some((c) => c.name === selection.name)
      ? selection.name
      : ''
  const selectCategory = useCallback((name: string) => setSelection({ scope, name }), [scope])
  const assignment = useMemo(
    () =>
      new Map(
        categories.flatMap((category) =>
          category.paths.map((path) => [path, category.name] as const)
        )
      ),
    [categories]
  )
  const categoryEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          !isCategorizedChange(entry) || (assignment.get(entry.path) ?? '') === selectedCategory
      ),
    [entries, assignment, selectedCategory]
  )
  const counts = useMemo(() => {
    const result = new Map<string, number>()
    // Count only root worktree changes; expanded submodule files belong to another Git repository.
    for (const entry of entries) {
      if (!isCategorizedChange(entry)) {
        continue
      }
      const name = assignment.get(entry.path) ?? ''
      result.set(name, (result.get(name) ?? 0) + 1)
    }
    return result
  }, [entries, assignment])
  const movePaths = useCallback(
    async (paths: readonly string[], name: string, select = false): Promise<boolean> => {
      if (!scope || paths.length === 0) {
        return false
      }
      try {
        await moveChangeCategoryPaths(scope, name.trim(), paths)
        if (select) {
          selectCategory(name.trim())
        }
        return true
      } catch {
        reportCategoryFailure()
        return false
      }
    },
    [scope, selectCategory]
  )
  const removeCategory = useCallback(
    async (name: string) => {
      if (!scope || !name) {
        return
      }
      try {
        await deleteChangeCategory(scope, name)
      } catch {
        reportCategoryFailure()
      }
    },
    [scope]
  )
  const forgetPaths = useCallback(
    (paths: readonly string[]) => {
      // Metadata failures must not relabel a successful Git mutation as a Git failure.
      void forgetChangeCategoryPaths(scope, paths).catch(reportCategoryFailure)
    },
    [scope]
  )

  return {
    scope,
    categories,
    selectedCategory,
    selectCategory,
    categoryEntries,
    counts,
    movePaths,
    removeCategory,
    forgetPaths,
    refresh,
    loading,
    busy,
    error,
    enabled: scope !== null && !loading && !busy && !error
  }
}

export type ChangeCategories = ReturnType<typeof useChangeCategories>
