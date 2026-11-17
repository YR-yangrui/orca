import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SyncDatabase from '../../sqlite/sync-database'
import { readLocalCodexRequestPhase } from './codex-request-phase'

const paths = vi.hoisted(() => ({ home: '' }))
vi.mock('../configuration/homes/codex-home-paths', () => ({
  getSystemCodexHomePath: () => paths.home,
  resolveOrcaManagedCodexHomePath: () => paths.home
}))
vi.mock('../history/index/codex-state-db', () => ({
  resolveCodexSqliteHome: (home: string) => home
}))

let db: SyncDatabase
beforeEach(() => {
  paths.home = mkdtempSync(join(tmpdir(), 'orca-codex-phase-'))
  db = new SyncDatabase(join(paths.home, 'logs_2.sqlite'))
  db.exec(`CREATE TABLE logs (id INTEGER PRIMARY KEY, thread_id TEXT, ts INTEGER,
    ts_nanos INTEGER, target TEXT, feedback_log_body TEXT);
    CREATE INDEX idx_logs_thread_id_ts ON logs(thread_id, ts DESC, ts_nanos DESC, id DESC);`)
})
afterEach(() => {
  db.close()
  rmSync(paths.home, { recursive: true, force: true })
})

function log(thread: string, seconds: number, target: string, body: string): void {
  db.prepare(
    'INSERT INTO logs(thread_id,ts,ts_nanos,target,feedback_log_body) VALUES(?,?,0,?,?)'
  ).run(thread, seconds, target, body)
}

describe('Codex request milestone isolation', () => {
  it('does not confuse another thread or model catalog response with this request', () => {
    log('a', 10, 'codex_core::session::world_state', 'building step world state')
    log(
      'a',
      11,
      'codex_http_client::client',
      'Request completed method=GET url=https://example.com/models status=200 OK'
    )
    log(
      'b',
      12,
      'codex_http_client::client',
      'Request completed method=POST url=https://example.com/responses status=200 OK'
    )
    expect(readLocalCodexRequestPhase('a', 9000)).toEqual({
      threadId: 'a',
      phase: 'request',
      observedAt: 10000
    })
    expect(readLocalCodexRequestPhase('a', 11000)).toBeNull()
  })

  it('reports a failed response rather than claiming output is arriving', () => {
    log(
      'a',
      10,
      'codex_http_client::client',
      'Request completed method=POST url=https://example.com/responses status=503 Service Unavailable'
    )
    expect(readLocalCodexRequestPhase('a', 0)).toEqual({
      threadId: 'a',
      phase: 'error',
      observedAt: 10000
    })
  })

  it('refuses an unindexed log schema instead of scanning it on each refresh', () => {
    log('a', 10, 'codex_core::stream_events_utils', 'ToolCall: exec')
    db.exec('DROP INDEX idx_logs_thread_id_ts')
    expect(readLocalCodexRequestPhase('a', 0)).toBeNull()
  })
})
