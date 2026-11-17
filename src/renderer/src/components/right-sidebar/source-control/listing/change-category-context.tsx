import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { GitStatusEntry } from '../../../../../../shared/git/status/git-status-types'
import type { FlatEntry } from './use-selection'
import { isCategorizedChange, type ChangeCategories } from './use-change-categories'

type CategoryContext = {
  model: ChangeCategories
  selectedPaths: string[]
  visiblePaths: string[]
  eligiblePaths: ReadonlySet<string>
  pendingPaths: readonly string[] | null
  requestCreate: (paths: readonly string[] | null) => void
  disabled: boolean
}
const ChangeCategoryContext = createContext<CategoryContext | null>(null)

export function ChangeCategoryProvider({
  model,
  entries,
  selectedKeys,
  flatEntriesByKey,
  disabled,
  children
}: {
  model: ChangeCategories
  entries: GitStatusEntry[]
  selectedKeys: ReadonlySet<string>
  flatEntriesByKey: ReadonlyMap<string, FlatEntry>
  disabled: boolean
  children: ReactNode
}) {
  const [pendingPaths, requestCreate] = useState<readonly string[] | null>(null)
  const eligiblePaths = useMemo(
    () => new Set(entries.filter(isCategorizedChange).map((e) => e.path)),
    [entries]
  )
  const selectedPaths = useMemo(
    () =>
      [...selectedKeys].flatMap((key) => {
        const entry = flatEntriesByKey.get(key)?.entry
        return entry && isCategorizedChange(entry) && eligiblePaths.has(entry.path)
          ? [entry.path]
          : []
      }),
    [selectedKeys, flatEntriesByKey, eligiblePaths]
  )
  const visiblePaths = useMemo(
    () =>
      [...flatEntriesByKey.values()].flatMap(({ entry }) =>
        isCategorizedChange(entry) && eligiblePaths.has(entry.path) ? [entry.path] : []
      ),
    [flatEntriesByKey, eligiblePaths]
  )
  const value = useMemo(
    () => ({
      model,
      selectedPaths,
      visiblePaths,
      eligiblePaths,
      pendingPaths,
      requestCreate,
      disabled: disabled || !model.enabled
    }),
    [model, selectedPaths, visiblePaths, eligiblePaths, pendingPaths, requestCreate, disabled]
  )
  return <ChangeCategoryContext.Provider value={value}>{children}</ChangeCategoryContext.Provider>
}

export function useChangeCategoryContext(): CategoryContext | null {
  return useContext(ChangeCategoryContext)
}
