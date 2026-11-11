import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FolderPlus, Plus, Folder } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import WorktreeCard from '@/components/sidebar/workspace-card/surface/WorktreeCard'
import { activateAndRevealWorktree } from '@/lib/workspace/activation/worktree-activation'
import {
  selectFolderWorkspaces,
  selectWorktreesByRepo
} from '@/store/workspaces/catalog/workspace-record-fields'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import { getActiveSidebarWorkspaceId } from '../../../../shared/workspace-scope'
import { createSessionGroup } from './session-group-actions'
import { SessionGroupCard } from './SessionGroupCard'
import {
  sessionGroupProjects,
  setSessionGroupsEnabled,
  useSessionGroupsEnabled
} from './session-group-state'

function useCopy() {
  const { i18n } = useTranslation()
  return (en: string, zh: string): string => (i18n.language.startsWith('zh') ? zh : en)
}

export function SessionGroupModeSwitch() {
  const enabled = useSessionGroupsEnabled()
  const text = useCopy()
  return (
    <div className="flex shrink-0 gap-1 px-2 py-1" aria-label={text('Sidebar mode', '侧栏模式')}>
      <Button
        size="sm"
        variant={enabled ? 'secondary' : 'ghost'}
        className="flex-1"
        aria-pressed={enabled}
        onClick={() => {
          useAppStore.getState().setSidebarBody('workspaces')
          setSessionGroupsEnabled(true)
        }}
      >
        {text('Session groups', '会话组')}
      </Button>
      <Button
        size="sm"
        variant={!enabled ? 'secondary' : 'ghost'}
        className="flex-1"
        aria-pressed={!enabled}
        onClick={() => setSessionGroupsEnabled(false)}
      >
        {text('Worktrees', '工作树')}
      </Button>
    </div>
  )
}

export default function SessionGroupsSidebar() {
  const text = useCopy()
  const repos = useAppStore((state) => state.repos)
  const folders = useAppStore(selectFolderWorkspaces)
  const worktrees = useAppStore(selectWorktreesByRepo)
  const active = useAppStore((state) =>
    getActiveSidebarWorkspaceId(state.activeWorkspaceKey, state.activeWorktreeId)
  )
  const openModal = useAppStore((state) => state.openModal)
  const [dialog, setDialog] = useState<{ repoId: string } | null>(null)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const localRepos = repos.filter((repo) => getRepoExecutionHostId(repo) === 'local')
  const registrations = sessionGroupProjects()
  const begin = (repoId: string) => {
    setName('')
    setError('')
    setDialog({ repoId })
  }
  const submit = async () => {
    if (!dialog || busy || !name.trim()) {
      return
    }
    const repo = localRepos.find((entry) => entry.id === dialog.repoId)
    if (!repo) {
      return
    }
    setBusy(true)
    setError('')
    // Promise finalization keeps the busy state correct without a React compiler bailout.
    await createSessionGroup(repo, name)
      .then(() => setDialog(null))
      .catch((cause) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setBusy(false))
  }
  return (
    <>
      <div className="flex h-9 shrink-0 items-center justify-between px-3">
        <span className="text-xs font-semibold text-muted-foreground">
          {text('Projects', '项目')}
        </span>
        <div className="flex gap-1">
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={text('Add project', '添加项目')}
            onClick={() => openModal('add-repo')}
          >
            <FolderPlus className="size-4" />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            aria-label={text('New session group', '新建会话组')}
            disabled={!localRepos.length}
            onClick={() =>
              begin(
                localRepos.find((repo) => repo.id === useAppStore.getState().activeRepoId)?.id ??
                  localRepos[0].id
              )
            }
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto worktree-sidebar-scrollbar px-2 pb-2">
        {localRepos.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">
            {text(
              'Add a local project to start. Remote projects remain in Worktrees.',
              '添加本地项目后即可新建会话组。远程项目仍在工作树视图中。'
            )}
          </p>
        )}
        {localRepos.map((repo) => {
          const groups = folders.filter(
            (workspace) =>
              registrations[workspace.projectGroupId] === repo.id &&
              !workspace.isArchived &&
              getRepoExecutionHostId(workspace) === 'local'
          )
          const root = Object.values(worktrees)
            .flat()
            .find(
              (row) =>
                row.repoId === repo.id && row.isMainWorktree && (row.hostId ?? 'local') === 'local'
            )
          return (
            <section key={repo.id} className="mb-2">
              <div className="flex items-center gap-2 px-2 py-1.5">
                <Folder className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate text-xs font-semibold" title={repo.path}>
                  {repo.displayName}
                </span>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label={`${text('New session group', '新建会话组')} — ${repo.displayName}`}
                  onClick={() => begin(repo.id)}
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {root && (
                <div className="relative mb-1" data-worktree-id={root.id}>
                  <WorktreeCard
                    worktree={root}
                    repo={repo}
                    isActive={active === root.id}
                    nativeDragEnabled={false}
                    flushSurface
                    hideRepoBadge
                    onActivate={() =>
                      activateAndRevealWorktree(root.id, {
                        navigationIntent: 'user-open',
                        executionHostId: 'local'
                      })
                    }
                  />
                </div>
              )}
              <div
                role="listbox"
                aria-label={`${repo.displayName} ${text('Session groups', '会话组')}`}
              >
                {groups.map((workspace) => (
                  <SessionGroupCard
                    key={workspace.id}
                    workspace={workspace}
                    activeWorkspaceId={active}
                  />
                ))}
              </div>
              {!groups.length && (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  {text(
                    'Use + to create a group in this directory.',
                    '点击 ＋ 在当前目录新建会话组。'
                  )}
                </p>
              )}
            </section>
          )
        })}
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDialog(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{text('New session group', '新建会话组')}</DialogTitle>
            <DialogDescription>
              {text(
                'Each group has its own tabs and layout. All groups use the existing project directory.',
                '每组保留独立的标签页和布局，共用项目现有目录，不创建 worktree。'
              )}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
            className="space-y-3"
          >
            <label className="block space-y-1 text-sm">
              <span>{text('Project', '项目')}</span>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2"
                value={dialog?.repoId ?? ''}
                disabled={busy}
                onChange={(event) => setDialog({ repoId: event.target.value })}
              >
                {localRepos.map((repo) => (
                  <option key={repo.id} value={repo.id}>
                    {repo.displayName}
                  </option>
                ))}
              </select>
            </label>
            <p className="break-all text-xs text-muted-foreground">
              {localRepos.find((repo) => repo.id === dialog?.repoId)?.path}
            </p>
            <label className="block space-y-1 text-sm">
              <span>{text('Group name', '会话组名称')}</span>
              <Input
                autoFocus
                value={name}
                disabled={busy}
                onChange={(event) => setName(event.target.value)}
                placeholder={text('For example: Bug investigation', '例如：问题排查')}
              />
            </label>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setDialog(null)}>
                {text('Cancel', '取消')}
              </Button>
              <Button type="submit" disabled={busy || !name.trim()}>
                {busy ? text('Saving…', '保存中…') : text('Save', '保存')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
