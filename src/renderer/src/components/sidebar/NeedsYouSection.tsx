import React from 'react'
import { AgentStateDot } from '@/components/AgentStateDot'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useNow } from '@/hooks/use-now'
import { translate } from '@/i18n/i18n'
import { formatShortTimeAgo } from '@/lib/short-time-ago'
import { activateAgentPane } from './activate-agent-pane'
import type { NeedsYouRow } from './needs-you-rows'
import { useNeedsYouRows } from './useNeedsYouRows'

/** Agents blocked on a permission or waiting on an answer, pinned above the workspace list. */
const NeedsYouSection = React.memo(function NeedsYouSection() {
  const rows = useNeedsYouRows()
  if (rows.length === 0) {
    return null
  }
  // Why a separate body: the 30s age tick mounts only while something needs the user.
  return <NeedsYouSectionBody rows={rows} />
})

export const NeedsYouSectionBody = React.memo(function NeedsYouSectionBody({
  rows
}: {
  rows: NeedsYouRow[]
}) {
  const now = useNow(30_000)
  const title = translate('dashboardPopout.bucket.attention', 'Needs You')
  return (
    <section aria-label={title} className="shrink-0 px-2 pb-2" data-needs-you-section="">
      <div className="flex items-center gap-1.5 py-1 pl-2">
        <span className="select-none text-[11px] font-semibold uppercase tracking-[0.05em] text-worktree-sidebar-foreground/55">
          {title}
        </span>
        <Badge variant="secondary">{rows.length}</Badge>
      </div>
      <ul className="worktree-sidebar-scrollbar flex max-h-72 flex-col gap-1.5 overflow-y-auto">
        {rows.map((row) => (
          <NeedsYouCard key={row.paneKey} row={row} now={now} />
        ))}
      </ul>
    </section>
  )
})

function NeedsYouCard({ row, now }: { row: NeedsYouRow; now: number }): React.JSX.Element {
  const kindLabel =
    row.kind === 'blocked'
      ? translate('components.sidebar.needsYou.permission', 'Permission')
      : translate('components.sidebar.needsYou.needsInput', 'Needs input')
  const location = row.branch ? `${row.projectName} · ${row.branch}` : row.projectName
  return (
    <li className="flex flex-col gap-1 rounded-md border border-status-warning-border bg-status-warning-background px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <AgentStateDot state={row.kind} title={null} />
        <span className="min-w-0 truncate text-[13px] font-medium text-foreground">
          {row.workspaceName}
        </span>
        <Badge variant="outline">{kindLabel}</Badge>
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
          {formatShortTimeAgo(row.stateStartedAt, now)}
        </span>
      </div>
      {row.promptText ? (
        <p className="line-clamp-2 text-xs leading-snug text-foreground">{row.promptText}</p>
      ) : null}
      <div className="flex min-w-0 items-center gap-2">
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">
          {location}
        </span>
        <Button size="xs" onClick={() => activateAgentPane(row.worktreeId, row.tabId, row.paneKey)}>
          {translate('components.sidebar.needsYou.reply', 'Reply')}
        </Button>
      </div>
    </li>
  )
}

export default NeedsYouSection
