import type { AttachedWorktreeResolution } from '@/components/right-sidebar/folder-workspace-attached-worktrees'
import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { normalizeRuntimePathForComparison } from '../../../../shared/cross-platform-path'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { sessionGroupProjects } from './session-group-state'

export function isSessionGroupResolution(resolution: AttachedWorktreeResolution): boolean {
  return Boolean(
    resolution.folderWorkspace && sessionGroupProjects()[resolution.folderWorkspace.projectGroupId]
  )
}

export function withSessionGroupSourceControl(
  resolution: AttachedWorktreeResolution,
  repos: readonly Repo[],
  worktreesByRepo: Record<string, readonly Worktree[]>
): AttachedWorktreeResolution {
  const workspace = resolution.folderWorkspace
  if (!workspace || getRepoExecutionHostId(workspace) !== 'local') {
    return resolution
  }
  const repoId = sessionGroupProjects()[workspace.projectGroupId]
  const repo = repos.find((row) => row.id === repoId && getRepoExecutionHostId(row) === 'local')
  if (
    !repo ||
    normalizeRuntimePathForComparison(repo.path) !==
      normalizeRuntimePathForComparison(workspace.folderPath)
  ) {
    return resolution
  }
  const root = Object.values(worktreesByRepo)
    .flat()
    .find(
      (row) =>
        row.repoId === repo.id &&
        row.isMainWorktree &&
        (row.hostId ?? 'local') === 'local' &&
        normalizeRuntimePathForComparison(row.path) === normalizeRuntimePathForComparison(repo.path)
    )
  if (!root || resolution.owners.some((owner) => owner.worktreeId === root.id)) {
    return resolution
  }
  // Share the real checkout's Git owner; never reparent it or give a session group filesystem ownership.
  return {
    ...resolution,
    owners: [
      {
        worktreeId: root.id,
        repoId: repo.id,
        executionHostId: 'local',
        worktree: root,
        attachedAt: workspace.createdAt
      },
      ...resolution.owners
    ]
  }
}
