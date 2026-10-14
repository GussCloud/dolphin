import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, GitPullRequest, LoaderCircle } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { AzurePullRequestCard } from './AzurePullRequestCard'
import { AzurePullRequestGroupHeader } from './AzurePullRequestGroupHeader'
import { AzurePullRequestSelectionBar } from './AzurePullRequestSelectionBar'
import { AzurePullRequestSummaryTiles } from './AzurePullRequestSummaryTiles'
import { AzurePullRequestToolbar, type AzurePullRequestFilter } from './AzurePullRequestToolbar'
import { AzureReviewRequestDialog } from './AzureReviewRequestDialog'
import { azurePullRequestKey, groupByWorkItem, multiItemCount } from './azure-pr-groups'
import { useAzurePullRequestBoard } from './use-azure-pull-request-board'
import type { AzureDevOpsBoardPullRequest } from '../../../../shared/azure-devops-pull-request-board'

// Four columns at the default window width, stepping down to one so the minimum window stays readable.
const CARD_GRID =
  'grid auto-rows-min grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'

function filterPullRequests(
  pullRequests: AzureDevOpsBoardPullRequest[],
  filter: AzurePullRequestFilter
): AzureDevOpsBoardPullRequest[] {
  if (filter === 'mine') {
    return pullRequests.filter((pr) => pr.isMine)
  }
  if (filter === 'reviewing') {
    return pullRequests.filter((pr) => pr.isReviewer && !pr.isMine)
  }
  return pullRequests
}

export default function AzurePullRequestsPage(): React.JSX.Element {
  const { board, error, loading, blocking, refresh } = useAzurePullRequestBoard()
  const [filter, setFilter] = useState<AzurePullRequestFilter>('mine')
  const [grouped, setGrouped] = useState(true)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())
  const [composeOpen, setComposeOpen] = useState(false)

  const pullRequests = useMemo(
    () => filterPullRequests(board?.pullRequests ?? [], filter),
    [board, filter]
  )
  // Why: the selection is intersected with what is on screen, so a PR the filter hid never lands in the text unseen.
  const selectedPullRequests = useMemo(
    () => pullRequests.filter((pr) => selected.has(azurePullRequestKey(pr))),
    [pullRequests, selected]
  )
  const counts = useMemo(() => {
    const map: Partial<Record<string, number>> = {}
    for (const pr of pullRequests) {
      map[pr.situation] = (map[pr.situation] ?? 0) + 1
    }
    return map
  }, [pullRequests])
  const groups = useMemo(
    () => groupByWorkItem(pullRequests, board?.workItems ?? {}),
    [pullRequests, board]
  )
  // Without saying so, group totals exceeding the PR count would read as a wrong sum.
  const repeated = useMemo(() => multiItemCount(pullRequests), [pullRequests])

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(key)) {
        next.add(key)
      }
      return next
    })
  }, [])
  const exitSelection = useCallback(() => {
    setSelecting(false)
    setSelected(new Set())
  }, [])

  // The same card serves the flat list and every group; selection is per PR, so ticking one copy ticks the other.
  const renderCard = (
    pr: AzureDevOpsBoardPullRequest,
    groupedUnder: number | null = null
  ): React.JSX.Element => {
    const key = azurePullRequestKey(pr)
    return (
      <AzurePullRequestCard
        key={key}
        pr={pr}
        groupedUnder={groupedUnder}
        selecting={selecting}
        checked={selected.has(key)}
        onToggle={() => toggle(key)}
      />
    )
  }

  const firstLoad = board === null && error === null

  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col bg-background pt-5 text-foreground md:pt-6">
      <header className="flex shrink-0 items-center px-3 pb-3 pr-[max(0.75rem,var(--window-controls-width,0px))] md:pl-5">
        {/* Why: no stacked center titlebar on this page; the right padding keeps the title clear of window controls. */}
        <h1 className="truncate text-base font-semibold leading-8">
          {translate('auto.components.azurePrs.title', 'Azure (PRs)')}
        </h1>
      </header>

      <div className="relative flex min-h-0 flex-1 flex-col gap-4 px-3 pb-4 md:px-5">
        {blocking && board ? (
          <div
            role="status"
            className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/60 text-sm text-muted-foreground"
          >
            <LoaderCircle className="size-4 animate-spin" />
            {translate('auto.components.azurePrs.loadingOverlay', 'Reading pull requests…')}
          </div>
        ) : null}

        <AzurePullRequestToolbar
          filter={filter}
          onFilterChange={setFilter}
          identityEmail={board?.identity.email ?? null}
          grouped={grouped}
          onToggleGrouped={() => setGrouped((value) => !value)}
          selecting={selecting}
          onToggleSelecting={() => (selecting ? exitSelection() : setSelecting(true))}
          loading={loading}
          onRefresh={() => refresh(true)}
        />

        {selecting ? (
          <AzurePullRequestSelectionBar
            selectedCount={selectedPullRequests.length}
            totalCount={pullRequests.length}
            onSelectAll={() => setSelected(new Set(pullRequests.map(azurePullRequestKey)))}
            onClear={() => setSelected(new Set())}
            onCancel={exitSelection}
            onCompose={() => setComposeOpen(true)}
          />
        ) : null}

        <AzurePullRequestSummaryTiles counts={counts} />

        {error ? (
          <div className="flex shrink-0 gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="font-medium">
                {translate(
                  'auto.components.azurePrs.error.title',
                  'Could not read the pull requests'
                )}
              </p>
              <pre className="whitespace-pre-wrap font-mono text-xs opacity-80">{error}</pre>
            </div>
          </div>
        ) : null}

        <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto pr-1">
          {firstLoad ? (
            <div className={CARD_GRID} role="status" aria-busy="true">
              {['one', 'two', 'three', 'four'].map((id) => (
                <div key={id} className="h-44 w-full animate-pulse rounded-xl bg-muted/60" />
              ))}
            </div>
          ) : null}

          {board && pullRequests.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              <GitPullRequest className="mx-auto mb-2 size-6 opacity-40" />
              {filter === 'mine'
                ? translate('auto.components.azurePrs.empty.mine', 'None of your PRs are open.')
                : translate('auto.components.azurePrs.empty.other', 'Nothing here right now.')}
            </div>
          ) : null}

          {pullRequests.length > 0 && grouped ? (
            <div className="space-y-5">
              {repeated > 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  {translate(
                    'auto.components.azurePrs.repeatedNote',
                    '{{value0}} PR(s) appear in more than one group because they cite several items — the group totals add up to more than the PR count.',
                    { value0: repeated }
                  )}
                </p>
              ) : null}
              {groups.map((group) => (
                <section key={group.key} className="space-y-2">
                  <AzurePullRequestGroupHeader group={group} />
                  <div className={CARD_GRID}>
                    {group.pullRequests.map((pr) => renderCard(pr, group.workItemId))}
                  </div>
                </section>
              ))}
            </div>
          ) : null}

          {pullRequests.length > 0 && !grouped ? (
            <div className={CARD_GRID}>{pullRequests.map((pr) => renderCard(pr))}</div>
          ) : null}
        </div>
      </div>

      <AzureReviewRequestDialog
        open={composeOpen}
        pullRequests={selectedPullRequests}
        onOpenChange={setComposeOpen}
        onCopied={exitSelection}
      />
    </main>
  )
}
