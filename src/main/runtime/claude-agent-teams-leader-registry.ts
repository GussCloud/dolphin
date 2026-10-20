import { readFileSync, rmSync } from 'node:fs'
import { writeFileAtomically } from '../codex-accounts/fs-utils'

/** What a main-process restart needs to re-admit a leader whose PTY the daemon kept alive. */
export type PersistedAgentTeamLeader = {
  teamId: string
  token: string
  paneKey: string
  env: Record<string, string>
  nextPaneNumber: number
  savedAt: number
}

const MAX_LEADERS = 64
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export class ClaudeAgentTeamsLeaderRegistry {
  constructor(
    private readonly resolveFilePath: () => string,
    private readonly now: () => number = Date.now
  ) {}

  get(teamId: string): PersistedAgentTeamLeader | null {
    return this.read().find((leader) => leader.teamId === teamId) ?? null
  }

  save(leader: Omit<PersistedAgentTeamLeader, 'savedAt'>): void {
    const others = this.read().filter((entry) => entry.teamId !== leader.teamId)
    this.write([...others, { ...leader, savedAt: this.now() }])
  }

  delete(teamId: string): void {
    const leaders = this.read()
    const remaining = leaders.filter((leader) => leader.teamId !== teamId)
    if (remaining.length !== leaders.length) {
      this.write(remaining)
    }
  }

  private read(): PersistedAgentTeamLeader[] {
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(this.resolveFilePath(), 'utf-8'))
    } catch {
      return []
    }
    if (!Array.isArray(parsed)) {
      return []
    }
    // Why: a leader that died while main was down never reports its exit, so age bounds the file.
    const oldestKept = this.now() - MAX_AGE_MS
    return parsed.filter(isPersistedLeader).filter((leader) => leader.savedAt >= oldestKept)
  }

  private write(leaders: PersistedAgentTeamLeader[]): void {
    const filePath = this.resolveFilePath()
    const kept = leaders.slice(-MAX_LEADERS)
    if (kept.length === 0) {
      rmSync(filePath, { force: true })
      return
    }
    writeFileAtomically(filePath, JSON.stringify(kept), { mode: 0o600 })
  }
}

function isPersistedLeader(value: unknown): value is PersistedAgentTeamLeader {
  return (
    typeof value === 'object' &&
    value !== null &&
    'teamId' in value &&
    typeof value.teamId === 'string' &&
    'token' in value &&
    typeof value.token === 'string' &&
    'paneKey' in value &&
    typeof value.paneKey === 'string' &&
    'nextPaneNumber' in value &&
    typeof value.nextPaneNumber === 'number' &&
    'savedAt' in value &&
    typeof value.savedAt === 'number' &&
    'env' in value &&
    typeof value.env === 'object' &&
    value.env !== null &&
    Object.values(value.env).every((entry) => typeof entry === 'string')
  )
}
