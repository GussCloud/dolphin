import { createHash } from 'node:crypto'
import { AGENT_STATUS_STALE_AFTER_MS, type AgentStatusState } from '../../shared/agent-status-types'
import type {
  RuntimeWorktreeAgentRow,
  RuntimeWorktreePsSummary
} from '../../shared/runtime-worktree-contracts'
import { parsePaneKey } from '../../shared/stable-pane-id'
import { resolveTerminalTabTitle } from '../../shared/tab-title-resolution'
import type { TerminalTab } from '../../shared/terminal-tab-types'
import { normalizeLocalBranchName } from '../runtime/runtime-worktree-selection'

// Contract: docs/reference/work-view-presence.md. Only these fields may leave the machine.
export type WorkPresenceState = 'working' | 'permission' | 'idle'

export type WorkPresenceAgent = {
  id: string
  cli: string
  state: WorkPresenceState
  branch: string | null
  /** Omitted when no allowed name source names the pane; the console then numbers it. */
  name?: string
}

/** Names set by the user, agents or automation; never generated, AI-vault or live terminal titles. */
export type WorkPresenceAgentNameSources = {
  teammateNamesByPaneKey: ReadonlyMap<string, string>
  tabsById: ReadonlyMap<string, Pick<TerminalTab, 'customTitle' | 'quickCommandLabel'>>
}

export type WorkPresenceProject = {
  id: string
  name: string
  agents: WorkPresenceAgent[]
}

export type WorkPresenceSnapshot = {
  schemaVersion: 1
  machineId: string
  machineLabel: string
  projects: WorkPresenceProject[]
}

export const WORK_PRESENCE_MAX_PROJECTS = 50
export const WORK_PRESENCE_MAX_AGENTS = 100
const MAX_MACHINE_LABEL = 64
const MAX_PROJECT_NAME = 80
const MAX_BRANCH = 120
const MAX_CLI = 40
export const WORK_PRESENCE_MAX_AGENT_NAME = 60

// Why salted: an unsalted hash of a repo path or pane key can be confirmed by guessing.
export function hashWorkPresenceId(machineId: string, localId: string): string {
  return createHash('sha256').update(`${machineId}\0${localId}`).digest('hex').slice(0, 16)
}

export function mapAgentStatusToWorkPresenceState(state: AgentStatusState): WorkPresenceState {
  switch (state) {
    case 'working':
      return 'working'
    case 'blocked':
    case 'waiting':
      return 'permission'
    case 'done':
      return 'idle'
  }
}

/** The store's display rule: restored rows never, decayed rows only while a structured host owns them. */
export function isDisplayedWorkPresenceRow(row: RuntimeWorktreeAgentRow, now: number): boolean {
  if (row.restoredUnconfirmed === true) {
    return false
  }
  return row.structuredHostOwned === true || now - row.updatedAt <= AGENT_STATUS_STALE_AFTER_MS
}

function presenceBranch(summary: RuntimeWorktreePsSummary): string | null {
  if (summary.workspaceKind === 'folder-workspace') {
    return null
  }
  const branch = normalizeLocalBranchName(summary.branch).trim()
  return branch ? branch.slice(0, MAX_BRANCH) : null
}

function boundedAgentName(raw: string): string | undefined {
  // Why bidi too: override/isolate marks can visually reorder the name on the console.
  // oxlint-disable-next-line no-control-regex -- strips terminal control characters from a pane title.
  let name = raw.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, ' ').trim()
  if (name.length > WORK_PRESENCE_MAX_AGENT_NAME) {
    name = name.slice(0, WORK_PRESENCE_MAX_AGENT_NAME)
    // Why: a cut surrogate pair would serialize as an unpaired code unit.
    if (/[\ud800-\udbff]$/.test(name)) {
      name = name.slice(0, -1)
    }
    name = name.trimEnd()
  }
  return name || undefined
}

// Why teammate first: teammate panes are splits inside the leader's tab, whose tab-level
// label would otherwise name every pane of the team alike.
export function resolveWorkPresenceAgentName(
  paneKey: string,
  sources: WorkPresenceAgentNameSources | undefined
): string | undefined {
  if (!sources) {
    return undefined
  }
  const teammateName = boundedAgentName(sources.teammateNamesByPaneKey.get(paneKey) ?? '')
  if (teammateName) {
    return teammateName
  }
  const tabId = parsePaneKey(paneKey)?.tabId
  const tab = tabId ? sources.tabsById.get(tabId) : undefined
  if (!tab) {
    return undefined
  }
  // Why only these two fields: the resolver would otherwise fall through to prompt-derived titles.
  return boundedAgentName(
    resolveTerminalTabTitle(
      { customTitle: tab.customTitle, quickCommandLabel: tab.quickCommandLabel, title: '' },
      false
    )
  )
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Groups the `worktree ps` roster by repository; sorted by id so an unchanged roster serializes identically. */
export function buildWorkPresenceProjects(
  machineId: string,
  summaries: readonly RuntimeWorktreePsSummary[],
  now: number,
  nameSources?: WorkPresenceAgentNameSources
): WorkPresenceProject[] {
  const projectsByRepoId = new Map<string, WorkPresenceProject>()
  for (const summary of summaries) {
    const branch = presenceBranch(summary)
    for (const row of summary.agents) {
      if (!isDisplayedWorkPresenceRow(row, now)) {
        continue
      }
      let project = projectsByRepoId.get(summary.repoId)
      if (!project) {
        project = {
          id: hashWorkPresenceId(machineId, summary.repoId),
          name: summary.repo.slice(0, MAX_PROJECT_NAME),
          agents: []
        }
        projectsByRepoId.set(summary.repoId, project)
      }
      const name = resolveWorkPresenceAgentName(row.paneKey, nameSources)
      project.agents.push({
        id: hashWorkPresenceId(machineId, row.paneKey),
        cli: (row.agentType || 'unknown').slice(0, MAX_CLI),
        state: mapAgentStatusToWorkPresenceState(row.state),
        branch,
        ...(name ? { name } : {})
      })
    }
  }
  let agentBudget = WORK_PRESENCE_MAX_AGENTS
  const projects: WorkPresenceProject[] = []
  for (const project of [...projectsByRepoId.values()].sort(byId)) {
    if (projects.length >= WORK_PRESENCE_MAX_PROJECTS || agentBudget <= 0) {
      break
    }
    const agents = project.agents.sort(byId).slice(0, agentBudget)
    agentBudget -= agents.length
    projects.push({ id: project.id, name: project.name, agents })
  }
  return projects
}

export function buildWorkPresenceSnapshot(args: {
  machineId: string
  machineLabel: string
  summaries: readonly RuntimeWorktreePsSummary[]
  now: number
  nameSources?: WorkPresenceAgentNameSources
}): WorkPresenceSnapshot {
  return {
    // Why still 1: `name` is optional and absence already means "unnamed", so v1 readers lose nothing.
    schemaVersion: 1,
    machineId: args.machineId,
    machineLabel: args.machineLabel.slice(0, MAX_MACHINE_LABEL) || 'dolphin',
    projects: buildWorkPresenceProjects(args.machineId, args.summaries, args.now, args.nameSources)
  }
}
