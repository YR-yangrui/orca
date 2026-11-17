import { ipcMain } from 'electron'
import { changeWorktreeCategories } from '../../../git/source-control/change-categories'
import type { ChangeCategoryOperation } from '../../../../shared/source-control/listing/change-categories'
import type { FilesystemHandlerContext } from '../filesystem-handler-context'
import { readWorktreeGitUnlessWslStopped } from './wsl-gated-worktree-git-read'
import { requireReachableGitRoute } from '../../../providers/execution-host-provider-dispatch'
import { getConnectionExecutionHostId } from '../../../../shared/execution-host/execution-host'

export function registerChangeCategoryHandlers({ store }: FilesystemHandlerContext): void {
  ipcMain.handle(
    'git:changeCategories',
    (
      _event,
      args: {
        worktreePath: string
        connectionId?: string
        operation: ChangeCategoryOperation
      }
    ) => {
      requireReachableGitRoute(getConnectionExecutionHostId(args.connectionId))
      return readWorktreeGitUnlessWslStopped(store, args.worktreePath, false, (path, options) =>
        changeWorktreeCategories(path, args.operation, options)
      )
    }
  )
}
