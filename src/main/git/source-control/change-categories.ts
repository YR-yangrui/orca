import { withSourceGitUIStateLock } from './sourcegit-ui-state-lock'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveGitDir } from './resolve-git-dir'
import type { GitRuntimeOptions } from '../command-runner/git-runtime-options'
import { writeFileAtomically } from '../../filesystem/atomic-file-publication'
import { runKeyedSerializedOperation } from '../../../shared/concurrency/keyed-serialized-operations'
import {
  ChangeCategoryOperation,
  applyChangeCategoryOperation,
  normalizeChangeCategories
} from '../../../shared/source-control/listing/change-categories'

const queues = new Map<string, Promise<void>>()

export async function changeWorktreeCategories(
  worktreePath: string,
  input: ChangeCategoryOperation,
  options: GitRuntimeOptions = {}
) {
  const operation = ChangeCategoryOperation.parse(input)
  // Use this worktree's gitdir, not common-dir: linked worktrees have independent working copies.
  const file = join(await resolveGitDir(worktreePath, options), 'sourcegit.uistates')
  return runKeyedSerializedOperation(queues, file, () =>
    withSourceGitUIStateLock(file, async () => {
      let document: Record<string, unknown> = {}
      try {
        const parsed: unknown = JSON.parse((await readFile(file, 'utf8')).replace(/^\uFEFF/, ''))
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new Error('Invalid sourcegit.uistates')
        }
        document = parsed as Record<string, unknown>
      } catch (error) {
        // Missing metadata is a new repository; malformed/unreadable data must never be replaced with an empty file.
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw error
        }
      }
      if (
        document.UnstagedChangeCategories != null &&
        !Array.isArray(document.UnstagedChangeCategories)
      ) {
        throw new Error('Invalid shared categories')
      }
      const current = normalizeChangeCategories(document.UnstagedChangeCategories)
      const categories = applyChangeCategoryOperation(current, operation)
      if (operation.kind !== 'read' && JSON.stringify(current) !== JSON.stringify(categories)) {
        document.UnstagedChangeCategories = categories.map(({ name, paths }) => ({
          Name: name,
          Paths: paths
        }))
        // Preserve all SourceGit UI preferences; only publish complete JSON so its watcher never reads a partial write.
        writeFileAtomically(file, `${JSON.stringify(document, null, 2)}\n`)
      }
      return categories
    })
  )
}
