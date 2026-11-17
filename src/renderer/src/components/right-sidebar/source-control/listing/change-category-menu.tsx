import type { ReactNode } from 'react'
import { FolderPlus, Tags } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
import { useTranslate } from '@/i18n/use-translate'
import { useChangeCategoryContext } from './change-category-context'

export function ChangeCategoryMenuItems({
  paths,
  useSelection = false
}: {
  paths: readonly string[]
  useSelection?: boolean
}) {
  const context = useChangeCategoryContext()
  const t = useTranslate()
  if (!context) {
    return null
  }
  const eligible = paths.filter((path) => context.eligiblePaths.has(path))
  if (!eligible.length) {
    return null
  }
  // A row's existing multi-selection wins only when that row belongs to it; folder actions use descendants.
  const targets =
    useSelection && eligible.some((path) => context.selectedPaths.includes(path))
      ? context.selectedPaths
      : eligible
  return (
    <>
      <ContextMenuSeparator />
      <ContextMenuItem disabled={context.disabled} onSelect={() => context.requestCreate(targets)}>
        <FolderPlus className="size-3.5" />
        {t('sourceControl.categories.create', 'New category…')}
      </ContextMenuItem>
      <ContextMenuSub>
        <ContextMenuSubTrigger disabled={context.disabled}>
          <Tags className="size-3.5" />
          {t('sourceControl.categories.move', 'Move to category')}
        </ContextMenuSubTrigger>
        <ContextMenuSubContent>
          <ContextMenuItem onSelect={() => context.model.movePaths(targets, '')}>
            {t('sourceControl.categories.uncategorized', 'Uncategorized')}
          </ContextMenuItem>
          {context.model.categories.map((category) => (
            <ContextMenuItem
              key={category.name}
              onSelect={() => context.model.movePaths(targets, category.name)}
            >
              {category.name}
            </ContextMenuItem>
          ))}
        </ContextMenuSubContent>
      </ContextMenuSub>
    </>
  )
}

export function ChangeCategoryDirectoryMenu({
  paths,
  children
}: {
  paths: readonly string[]
  children: ReactNode
}) {
  const context = useChangeCategoryContext()
  if (!context || !paths.some((path) => context.eligiblePaths.has(path))) {
    return <>{children}</>
  }
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div>{children}</div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ChangeCategoryMenuItems paths={paths} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
