import { open, readFile, stat, unlink } from 'node:fs/promises'
import { hostname } from 'node:os'
import { setTimeout } from 'node:timers/promises'

/** Shared with SourceGit's RepositoryUIStateLock: exclusive file creation fences the entire JSON transaction. */
export async function withSourceGitUIStateLock<T>(
  file: string,
  operation: () => Promise<T>
): Promise<T> {
  const lockPath = `${file}.categories.lock`
  const deadline = Date.now() + 5000
  // Retry another application's short transaction; never read old data before acquiring ownership.
  while (true) {
    try {
      const handle = await open(lockPath, 'wx')
      try {
        await handle.writeFile(JSON.stringify({ pid: process.pid, host: hostname().toLowerCase() }))
        await handle.close()
      } catch (error) {
        await handle.close().catch(() => {})
        await unlink(lockPath)
        throw error
      }
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        throw error
      }
      await removeAbandonedLock(lockPath)
      if (Date.now() >= deadline) {
        throw new Error('SourceGit category settings are busy; try again.')
      }
      await setTimeout(25)
    }
  }
  try {
    return await operation()
  } finally {
    await unlink(lockPath)
  }
}

async function removeAbandonedLock(file: string): Promise<void> {
  try {
    // A newly created lock can still be writing its owner record; only inspect older records for recovery.
    const age = Date.now() - (await stat(file)).mtimeMs
    if (age < 30000) {
      return
    }
    const owner = JSON.parse(await readFile(file, 'utf8')) as { pid: number; host: string }
    if (
      owner.host !== hostname().toLowerCase() ||
      !Number.isSafeInteger(owner.pid) ||
      owner.pid <= 0
    ) {
      return
    }
    try {
      process.kill(owner.pid, 0)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
        await unlink(file)
      }
    }
  } catch {
    // Unknown ownership is not permission to break another application's lock.
  }
}
