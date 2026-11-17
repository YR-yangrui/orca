import { z } from 'zod'

export type ChangeCategory = { name: string; paths: string[] }
const Category = z.object({ name: z.string().trim().min(1), paths: z.array(z.string().min(1)) })
export const ChangeCategoryOperation = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('read') }),
  z.object({ kind: z.literal('move'), name: z.string().trim(), paths: z.array(z.string().min(1)) }),
  z.object({ kind: z.literal('delete'), name: z.string().min(1) }),
  z.object({ kind: z.literal('import'), categories: z.array(Category) })
])
export type ChangeCategoryOperation = z.infer<typeof ChangeCategoryOperation>

export function normalizeChangeCategories(value: unknown): ChangeCategory[] {
  if (!Array.isArray(value)) {
    return []
  }
  const assigned = new Set<string>()
  const categories = new Map<string, ChangeCategory>()
  // SourceGit's PascalCase fields and the former Orca client store describe the same file assignments.
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue
    }
    const name = item.Name ?? item.name
    const paths = item.Paths ?? item.paths
    if (typeof name !== 'string' || !name.trim() || !Array.isArray(paths)) {
      continue
    }
    const category = categories.get(name.trim()) ?? { name: name.trim(), paths: [] }
    categories.set(category.name, category)
    // A file can belong to only one category; preserve the first existing assignment.
    for (const path of paths) {
      if (typeof path !== 'string' || !path.trim() || assigned.has(path)) {
        continue
      }
      assigned.add(path)
      category.paths.push(path)
    }
  }
  return [...categories.values()]
}

export function applyChangeCategoryOperation(
  current: ChangeCategory[],
  operation: ChangeCategoryOperation
): ChangeCategory[] {
  if (operation.kind === 'read') {
    return current
  }
  if (operation.kind === 'delete') {
    return current.filter((category) => category.name !== operation.name)
  }
  if (operation.kind === 'import') {
    // Existing shared assignments win; importing an old client must never undo a SourceGit move.
    return normalizeChangeCategories([...current, ...operation.categories])
  }
  const paths = new Set(operation.paths)
  const next = current.map((category) => ({
    ...category,
    paths: category.paths.filter((path) => !paths.has(path))
  }))
  if (operation.name && paths.size) {
    const target = next.find((category) => category.name === operation.name)
    if (target) {
      target.paths.push(...paths)
    } else {
      next.push({ name: operation.name, paths: [...paths] })
    }
  }
  return next.filter((category) => category.paths.length > 0)
}
