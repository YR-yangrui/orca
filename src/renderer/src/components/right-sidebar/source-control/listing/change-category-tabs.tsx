import { useId, useState } from 'react'
import { FolderPlus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getWheelScrollDeltaY } from '@/lib/wheel-scroll-delta'
import { useTranslate } from '@/i18n/use-translate'
import { useChangeCategoryContext } from './change-category-context'

export function ChangeCategoryTabs() {
  const context = useChangeCategoryContext()
  const t = useTranslate()
  const inputId = useId()
  const [name, setName] = useState('')
  if (!context) {
    return null
  }
  const { model, pendingPaths, requestCreate, disabled } = context
  const names = ['', ...model.categories.map((category) => category.name)]
  const selectedPaths = context.selectedPaths.length ? context.selectedPaths : context.visiblePaths
  const label = (value: string) =>
    value || t('sourceControl.categories.uncategorized', 'Uncategorized')
  const duplicate = model.categories.some((category) => category.name === name.trim())

  return (
    <>
      <div className="flex min-w-0 items-center gap-1 border-b border-border px-2 pb-1">
        <Tabs
          value={model.selectedCategory}
          onValueChange={model.selectCategory}
          className="min-w-0 flex-1"
        >
          <div
            className="overflow-x-auto scrollbar-sleek"
            onWheel={(event) => {
              if (
                !event.deltaX &&
                event.currentTarget.scrollWidth > event.currentTarget.clientWidth
              ) {
                event.currentTarget.scrollLeft += getWheelScrollDeltaY(
                  event.nativeEvent,
                  event.currentTarget.clientWidth
                )
              }
            }}
          >
            <TabsList
              variant="line"
              size="sm"
              aria-label={t('sourceControl.categories.title', 'Change categories')}
            >
              {names.map((value) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  disabled={disabled}
                  className="shrink-0"
                  onMouseDown={(event) => {
                    if (event.button === 1 && value && !disabled) {
                      event.preventDefault()
                      model.removeCategory(value)
                    }
                  }}
                >
                  {label(value)}{' '}
                  <span className="text-muted-foreground">{model.counts.get(value) ?? 0}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
        {model.selectedCategory && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-xs"
                disabled={disabled}
                aria-label={t('sourceControl.categories.remove', 'Remove category; keep files')}
                onClick={() => model.removeCategory(model.selectedCategory)}
              >
                <X />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t('sourceControl.categories.remove', 'Remove category; keep files')}
            </TooltipContent>
          </Tooltip>
        )}
        <Popover
          open={pendingPaths !== null}
          onOpenChange={(open) => {
            setName('')
            requestCreate(open ? selectedPaths : null)
          }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  disabled={disabled || selectedPaths.length === 0}
                  aria-label={t('sourceControl.categories.create', 'New category…')}
                >
                  <FolderPlus />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>{t('sourceControl.categories.create', 'New category…')}</TooltipContent>
          </Tooltip>
          <PopoverContent className="w-64" align="end">
            <form
              className="space-y-3"
              onSubmit={async (event) => {
                event.preventDefault()
                if (disabled || !name.trim() || duplicate || !pendingPaths) {
                  return
                }
                // Recheck paths after the naming prompt; Git may have refreshed while it was open.
                const paths = pendingPaths.filter((path) => context.eligiblePaths.has(path))
                if (await model.movePaths(paths, name, true)) {
                  requestCreate(null)
                  setName('')
                }
              }}
            >
              <Label htmlFor={inputId}>{t('sourceControl.categories.name', 'Category name')}</Label>
              <Input
                id={inputId}
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-invalid={duplicate || undefined}
                autoFocus
              />
              {duplicate && (
                <p className="text-xs text-destructive">
                  {t('sourceControl.categories.duplicate', 'This category already exists')}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    requestCreate(null)
                    setName('')
                  }}
                >
                  {t('common.cancel', 'Cancel')}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    disabled ||
                    !name.trim() ||
                    duplicate ||
                    !pendingPaths?.some((path) => context.eligiblePaths.has(path))
                  }
                >
                  {t('sourceControl.categories.createAndMove', 'Create and move')}
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      </div>
      {model.loading && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {t('sourceControl.categories.loading', 'Loading shared categories…')}
        </p>
      )}
      {model.error && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {t('sourceControl.categories.loadFailed', 'Could not load shared categories')}
          <Button variant="ghost" size="xs" onClick={model.refresh}>
            {t('common.retry', 'Retry')}
          </Button>
        </div>
      )}
      {model.categories.length > 0 && (model.counts.get(model.selectedCategory) ?? 0) === 0 && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          {t(
            'sourceControl.categories.empty',
            'No unstaged files in this category. Select another category to view its changes.'
          )}
        </p>
      )}
    </>
  )
}
