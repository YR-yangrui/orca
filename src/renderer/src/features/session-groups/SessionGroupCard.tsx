import { memo } from 'react'
import WorktreeCard from '@/components/sidebar/workspace-card/surface/WorktreeCard'
import { activateAndRevealFolderWorkspace } from '@/lib/workspace/activation/worktree-activation'
import { getFolderWorkspaceWorktree } from '../../../../shared/folder-workspaces/folder-workspace-worktree'
import { getWorktreeHostIdentity } from '../../../../shared/worktree/host-qualified-identity'
import type { FolderWorkspace } from '../../../../shared/folder-workspaces/folder-workspace-types'

export const SessionGroupCard = memo(function SessionGroupCard({
  workspace,
  activeWorkspaceId
}: {
  workspace: FolderWorkspace
  activeWorkspaceId: string | null
}) {
  // Keep the upstream folder identity so the card subscribes to this group's live agent panes.
  const worktree = getFolderWorkspaceWorktree(workspace)
  const identity = getWorktreeHostIdentity(worktree)
  const active = activeWorkspaceId === worktree.id
  return (
    <div
      className="relative"
      role="option"
      aria-selected={active}
      aria-current={active ? 'page' : undefined}
      data-worktree-id={worktree.id}
      data-worktree-host-identity={identity}
      data-worktree-row-key={identity}
    >
      <WorktreeCard
        worktree={worktree}
        repo={undefined}
        isActive={active}
        activationRowKey={identity}
        nativeDragEnabled={false}
        flushSurface
        onActivate={() =>
          activateAndRevealFolderWorkspace(workspace.id, {
            executionHostId: 'local',
            runtimeEnvironmentId: null,
            navigationIntent: 'user-open'
          })
        }
      />
    </div>
  )
})
