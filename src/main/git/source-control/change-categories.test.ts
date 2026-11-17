import { afterEach, beforeEach, expect, it } from 'vitest'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { changeWorktreeCategories } from './change-categories'

let root: string
let file: string
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'orca-sourcegit-categories-'))
  await mkdir(join(root, '.git'))
  file = join(root, '.git', 'sourcegit.uistates')
})
afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

it('reads SourceGit categories and applies a move to the latest external document without replacing UI preferences', async () => {
  await writeFile(
    file,
    JSON.stringify({
      HistoryShowFlags: 3,
      UnstagedChangeCategories: [{ Name: 'trae', Paths: ['.trae/skills/说明.md'] }]
    })
  )
  expect(await changeWorktreeCategories(root, { kind: 'read' })).toEqual([
    { name: 'trae', paths: ['.trae/skills/说明.md'] }
  ])
  // Simulate a SourceGit edit after Orca rendered its first snapshot.
  await writeFile(
    file,
    JSON.stringify({
      HistoryShowFlags: 7,
      UnstagedChangeCategories: [
        { Name: 'trae', Paths: ['.trae/skills/说明.md', 'other.txt'] },
        { Name: 'ignore', Paths: ['log.txt'] }
      ]
    })
  )
  expect(
    await changeWorktreeCategories(root, {
      kind: 'move',
      name: 'ignore',
      paths: ['.trae/skills/说明.md']
    })
  ).toEqual([
    { name: 'trae', paths: ['other.txt'] },
    { name: 'ignore', paths: ['log.txt', '.trae/skills/说明.md'] }
  ])
  expect(JSON.parse(await readFile(file, 'utf8'))).toEqual({
    HistoryShowFlags: 7,
    UnstagedChangeCategories: [
      { Name: 'trae', Paths: ['other.txt'] },
      { Name: 'ignore', Paths: ['log.txt', '.trae/skills/说明.md'] }
    ]
  })
})

it('merges former Orca categories without moving files already assigned by SourceGit', async () => {
  await writeFile(
    file,
    JSON.stringify({ UnstagedChangeCategories: [{ Name: 'shared', Paths: ['a.txt'] }] })
  )
  expect(
    await changeWorktreeCategories(root, {
      kind: 'import',
      categories: [
        { name: 'old', paths: ['a.txt', 'b.txt'] },
        { name: 'shared', paths: ['c.txt'] }
      ]
    })
  ).toEqual([
    { name: 'shared', paths: ['a.txt', 'c.txt'] },
    { name: 'old', paths: ['b.txt'] }
  ])
  expect(await changeWorktreeCategories(root, { kind: 'delete', name: 'old' })).toEqual([
    { name: 'shared', paths: ['a.txt', 'c.txt'] }
  ])
})

it('refuses to overwrite unreadable category metadata', async () => {
  await writeFile(file, '{invalid')
  await expect(
    changeWorktreeCategories(root, { kind: 'move', name: 'new', paths: ['a.txt'] })
  ).rejects.toThrow()
  expect(await readFile(file, 'utf8')).toBe('{invalid')
})

it('uses a linked worktree gitdir instead of the shared main checkout metadata', async () => {
  const linked = join(root, 'linked')
  await mkdir(linked)
  await mkdir(join(root, '.git', 'worktrees', 'linked'), { recursive: true })
  await writeFile(join(linked, '.git'), 'gitdir: ../.git/worktrees/linked\n')
  await writeFile(
    file,
    JSON.stringify({ UnstagedChangeCategories: [{ Name: 'main', Paths: ['a.txt'] }] })
  )
  await changeWorktreeCategories(linked, { kind: 'move', name: 'linked', paths: ['b.txt'] })
  expect(await changeWorktreeCategories(root, { kind: 'read' })).toEqual([
    { name: 'main', paths: ['a.txt'] }
  ])
  expect(await changeWorktreeCategories(linked, { kind: 'read' })).toEqual([
    { name: 'linked', paths: ['b.txt'] }
  ])
})
