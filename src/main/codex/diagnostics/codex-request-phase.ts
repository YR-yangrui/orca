import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import SyncDatabase from '../../sqlite/sync-database'
import {
  getSystemCodexHomePath,
  resolveOrcaManagedCodexHomePath
} from '../configuration/homes/codex-home-paths'
import { resolveCodexSqliteHome } from '../history/index/codex-state-db'
import {
  codexRequestPhaseFromLog,
  type CodexRequestPhase
} from '../../../shared/agent-status/presentation/codex-request-phase'

function readPhase(home: string, threadId: string, since: number): CodexRequestPhase | null {
  let db: SyncDatabase | undefined
  try {
    const directory = resolveCodexSqliteHome(home)
    const files = readdirSync(directory).filter((name) => /^logs_\d+\.sqlite$/.test(name))
    files.sort((a, b) => Number(b.match(/\d+/)?.[0]) - Number(a.match(/\d+/)?.[0]))
    if (!files[0]) {
      return null
    }
    db = new SyncDatabase(join(directory, files[0]), {
      readonly: true,
      fileMustExist: true,
      timeout: 50
    })
    // Require the thread/time index: polling must never scan a large log database on the UI host.
    const index = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_logs_thread_id_ts'")
      .get()
    if (!index) {
      return null
    }
    const rows = db
      .prepare(`SELECT ts, ts_nanos, target, feedback_log_body FROM logs
      INDEXED BY idx_logs_thread_id_ts WHERE thread_id = ? AND ts >= ?
      ORDER BY ts DESC, ts_nanos DESC, id DESC LIMIT 128`)
      .all(threadId, Math.floor(since / 1000))
    const recent: NonNullable<CodexRequestPhase['recent']> = []
    // Keep short intermediate phases even if the entire response finishes between UI polls.
    for (const row of rows) {
      const observedAt = Number(row.ts) * 1000 + Number(row.ts_nanos) / 1_000_000
      if (observedAt < since) {
        continue
      }
      const phase = codexRequestPhaseFromLog(String(row.target), String(row.feedback_log_body))
      if (phase && recent.at(-1)?.phase !== phase) {
        recent.push({ phase, observedAt })
        if (recent.length === 8) {
          break
        }
      }
    }
    const latest = recent[0]
    // Only recognized milestones cross IPC; request bodies, headers and credentials stay in the log.
    if (latest) {
      return { threadId, ...latest, recent: recent.toReversed() }
    }
  } catch {
    // Missing, locked or newer log schemas leave normal agent status available.
    return null
  } finally {
    db?.close()
  }
  return null
}

export function readLocalCodexRequestPhase(
  threadId: string,
  since: number
): CodexRequestPhase | null {
  let latest: CodexRequestPhase | null = null
  for (const home of new Set([getSystemCodexHomePath(), resolveOrcaManagedCodexHomePath()])) {
    const phase = readPhase(home, threadId, since)
    if (phase && (!latest || phase.observedAt > latest.observedAt)) {
      latest = phase
    }
  }
  return latest
}
