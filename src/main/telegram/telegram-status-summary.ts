// `/status` listing and `/to` worktree lookup over the status store snapshot.
import type { AgentStatusIpcPayload } from '../../shared/agent-status-types'
import { formatAgentTypeLabel } from '../../shared/agent-type-label'
import { translateMain } from '../i18n/main-i18n'
import { escapeAndClipTelegramText, escapeTelegramHtml } from './telegram-agent-notice'

const STATUS_LIST_MAX_ROWS = 40
const STATE_ICON: Record<AgentStatusIpcPayload['state'], string> = {
  working: '🔄',
  waiting: '⏳',
  blocked: '⛔',
  done: '✅'
}
const STATE_ORDER: Record<AgentStatusIpcPayload['state'], number> = {
  blocked: 0,
  waiting: 1,
  working: 2,
  done: 3
}

export type TelegramStatusRow = Pick<
  AgentStatusIpcPayload,
  'paneKey' | 'state' | 'agentType' | 'worktreeId' | 'restoredUnconfirmed'
>

export function formatTelegramStatusList(
  rows: readonly TelegramStatusRow[],
  resolveWorktreeName: (worktreeId: string) => string | null
): string {
  if (rows.length === 0) {
    return escapeTelegramHtml(translateMain('telegram.status.empty', 'No agents reported yet.'))
  }
  const sorted = [...rows].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state])
  const lines = sorted.slice(0, STATUS_LIST_MAX_ROWS).map((row) => {
    const name = row.worktreeId ? resolveWorktreeName(row.worktreeId) : null
    const where = name ? `<b>${escapeAndClipTelegramText(name, 80)}</b> · ` : ''
    // Why: a hydrated row is a claim from before the restart, not an observation.
    const unverified = row.restoredUnconfirmed
      ? ` <i>(${escapeTelegramHtml(translateMain('telegram.status.unverified', 'unverified'))})</i>`
      : ''
    return `${STATE_ICON[row.state]} ${where}${escapeAndClipTelegramText(formatAgentTypeLabel(row.agentType), 60)}${unverified}`
  })
  if (sorted.length > STATUS_LIST_MAX_ROWS) {
    lines.push(`… +${sorted.length - STATUS_LIST_MAX_ROWS}`)
  }
  return lines.join('\n')
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase()
}

/** Exact (case-insensitive) worktree-name matches win; otherwise substring matches. */
export function resolveTelegramWorktreeQuery(
  query: string,
  rows: readonly TelegramStatusRow[],
  resolveWorktreeName: (worktreeId: string) => string | null
): { worktreeId: string; paneKeys: string[] }[] {
  const needle = normalizeName(query)
  if (!needle) {
    return []
  }
  const byWorktree = new Map<string, string[]>()
  for (const row of rows) {
    if (row.worktreeId) {
      byWorktree.set(row.worktreeId, [...(byWorktree.get(row.worktreeId) ?? []), row.paneKey])
    }
  }
  const named = [...byWorktree].map(([worktreeId, paneKeys]) => ({
    worktreeId,
    paneKeys,
    name: normalizeName(resolveWorktreeName(worktreeId) ?? '')
  }))
  const exact = named.filter((candidate) => candidate.name === needle)
  const matches =
    exact.length > 0 ? exact : named.filter((candidate) => candidate.name.includes(needle))
  return matches.map(({ worktreeId, paneKeys }) => ({ worktreeId, paneKeys }))
}
