import { useMemo, useState } from 'react'
import { AlertTriangle, LoaderCircle, PenTool, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { useDesignIndex, useDesignIndexSubscription } from './design-index'
import { useDesignMinuteClock } from './design-agent-missing'
import {
  DEFAULT_DESIGN_LIST_FILTER,
  filterDesignList,
  type DesignListFilter
} from './design-list-view'
import { DesignDetail } from './DesignDetail'
import { DesignList } from './DesignList'
import { DesignListFilterMenu } from './DesignListFilterMenu'

function EmptyState({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      <PenTool className="mx-auto mb-2 size-6 opacity-40" />
      {children}
    </div>
  )
}

export default function DesignPage(): React.JSX.Element {
  useDesignIndexSubscription()
  const index = useDesignIndex()
  const openModal = useAppStore((s) => s.openModal)
  const [filter, setFilter] = useState<DesignListFilter>(DEFAULT_DESIGN_LIST_FILTER)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Why: period presets count back from when the page opened; a pure render can't read the clock.
  const [openedAt] = useState(() => Date.now())
  const now = useDesignMinuteClock()
  const visible = useMemo(
    () => filterDesignList(index.designs, filter, openedAt),
    [index.designs, filter, openedAt]
  )
  const selectedEntry = selectedId
    ? (index.designs.find((design) => design.id === selectedId) ?? null)
    : null

  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background pt-5 text-foreground md:pt-6">
      <header className="flex shrink-0 items-center gap-3 px-3 pb-3 pr-[max(0.75rem,var(--window-controls-width,0px))] md:pl-5">
        {/* Why: no stacked center titlebar on this page; the right padding keeps the header clear of window controls. */}
        <h1 className="truncate text-base font-semibold leading-8">
          {translate('auto.components.design.title', 'Design')}
        </h1>
        <Button
          type="button"
          size="sm"
          className="ml-auto"
          disabled={index.kind === 'unsupported'}
          onClick={() => openModal('new-workspace-composer', { designMode: true })}
        >
          <Plus className="size-4" />
          {translate('auto.components.design.new', 'New design')}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 pb-4 md:px-5">
        {selectedId ? (
          <DesignDetail
            id={selectedId}
            listUpdatedAt={selectedEntry?.updatedAt ?? null}
            onBack={() => setSelectedId(null)}
          />
        ) : (
          <>
            <div className="flex shrink-0 items-center gap-2">
              <DesignListFilterMenu filter={filter} onChange={setFilter} />
              {index.kind === 'ready' || index.kind === 'error' ? (
                <span className="text-xs text-muted-foreground">
                  {translate('auto.components.design.count', '{{value0}} of {{value1}}', {
                    value0: visible.length,
                    value1: index.designs.length
                  })}
                </span>
              ) : null}
            </div>

            {index.kind === 'error' ? (
              <div className="flex shrink-0 gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    {translate('auto.components.design.error', 'Could not read the designs')}
                  </p>
                  <pre className="whitespace-pre-wrap font-mono text-xs opacity-80">
                    {index.message}
                  </pre>
                </div>
              </div>
            ) : null}

            <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto pr-1">
              {index.kind === 'loading' ? (
                <div
                  role="status"
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <LoaderCircle className="size-4 animate-spin" />
                  {translate('auto.components.design.loading', 'Loading designs…')}
                </div>
              ) : null}
              {index.kind === 'unsupported' ? (
                <EmptyState>
                  {translate(
                    'auto.components.design.unsupported',
                    'This host runs an older Dolphin without Design. Update it to create and view designs.'
                  )}
                </EmptyState>
              ) : null}
              {index.kind === 'ready' && index.designs.length === 0 ? (
                <EmptyState>
                  {translate(
                    'auto.components.design.empty',
                    'No designs yet. Describe a feature and an agent will draw its flow.'
                  )}
                </EmptyState>
              ) : null}
              {index.designs.length > 0 && visible.length === 0 ? (
                <EmptyState>
                  {filter.statuses.length === 0
                    ? translate(
                        'auto.components.design.noStatus',
                        'Select at least one status to see designs.'
                      )
                    : translate(
                        'auto.components.design.noMatch',
                        'No design matches these filters.'
                      )}
                </EmptyState>
              ) : null}
              {visible.length > 0 ? (
                <DesignList designs={visible} now={now} onOpen={setSelectedId} />
              ) : null}
            </div>
          </>
        )}
      </div>
    </main>
  )
}
