import { useAppStore } from '@/store'
import { activateAndRevealFolderWorkspace } from '@/lib/workspace/activation/worktree-activation'
import { launchAgentInNewTabWithOutcome } from '@/lib/agent-session/launch/new-tab/launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from '@/lib/agent-session/launch/routing/agent-launch-request-id'
import { isTuiAgent } from '../../../../shared/agent-launch/catalog/tui-agent-config'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { normalizeRuntimePathForComparison } from '../../../../shared/cross-platform-path'
import type { Repo } from '../../../../shared/repo-types'
import { registerSessionGroupProject, sessionGroupProjects } from './session-group-state'

const pendingGroups = new Map<string, Promise<string>>()

async function ensureProjectGroup(repo: Repo): Promise<string> {
  const state = useAppStore.getState()
  const registered = sessionGroupProjects()
  const path = normalizeRuntimePathForComparison(repo.path)
  const existing = state.projectGroups.find(
    (group) =>
      getRepoExecutionHostId(group) === 'local' &&
      group.parentPath &&
      normalizeRuntimePathForComparison(group.parentPath) === path &&
      (registered[group.id] === repo.id || group.createdFrom === 'manual')
  )
  if (existing) {
    registerSessionGroupProject(existing.id, repo.id)
    return existing.id
  }
  // Native FolderWorkspace records own tabs/PTYs and never upgrade the Git repository kind.
  const group = await window.api.projectGroups.create({
    name: repo.displayName,
    parentPath: repo.path,
    createdFrom: 'manual'
  })
  registerSessionGroupProject(group.id, repo.id)
  await state.fetchProjectGroups({ runtimeEnvironmentId: null })
  return group.id
}

export async function createSessionGroup(repo: Repo, name: string): Promise<void> {
  if (getRepoExecutionHostId(repo) !== 'local') {
    throw new Error('Session groups currently require a local project.')
  }
  let pending = pendingGroups.get(repo.id)
  if (!pending) {
    pending = ensureProjectGroup(repo).finally(() => pendingGroups.delete(repo.id))
    pendingGroups.set(repo.id, pending)
  }
  const projectGroupId = await pending
  const workspace = await useAppStore.getState().createFolderWorkspace(
    {
      projectGroupId,
      name: name.trim(),
      folderPath: repo.path,
      connectionId: null
    },
    { runtimeEnvironmentId: null }
  )
  if (!workspace) {
    throw new Error('Could not create the session group.')
  }
  const defaultAgent = useAppStore.getState().settings?.defaultTuiAgent
  const agent = isTuiAgent(defaultAgent) ? defaultAgent : null
  // Reserve the initial surface for the normal agent launcher, avoiding a duplicate shell tab.
  activateAndRevealFolderWorkspace(workspace.id, {
    executionHostId: 'local',
    runtimeEnvironmentId: null,
    navigationIntent: 'user-open',
    providesInitialSurface: agent !== null
  })
  if (agent) {
    launchAgentInNewTabWithOutcome({
      requestId: newAgentLaunchRequestId(),
      agent,
      worktreeId: folderWorkspaceKey(workspace.id),
      workspaceExecutionHostId: 'local',
      initialCwd: repo.path,
      launchSource: 'sidebar'
    })
  }
}
