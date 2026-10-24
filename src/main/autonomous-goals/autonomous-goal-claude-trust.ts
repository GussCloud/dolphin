// Pre-accepts Claude Code's per-folder trust dialog for an autonomous goal's worktrees: no one is
// watching a worker pane to answer it, and the dialog holds the agent before its first prompt.
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { lock } from 'proper-lockfile'
import { z } from 'zod'
import { writeFileAtomically } from '../codex-accounts/fs-utils'
import { ClaudeRuntimePathResolver } from '../claude-accounts/runtime-paths'
import { seedDeepSeekClaudeOnboarding } from '../deepseek/deepseek-config-home-setup'
import { parseWslUncPath } from '../../shared/wsl-paths'
import { DEEPSEEK_CLAUDE_CONFIG_DIR_NAME } from '../../shared/deepseek-claude-provider'
import {
  AUTONOMOUS_GOAL_AGENT_CLI,
  isAutonomousGoalAgent,
  type AutonomousGoalAgent
} from '../../shared/autonomous-goal-types'
import type { TuiAgent } from '../../shared/tui-agent'

/** Agents that run Claude Code against a DeepSeek-only config dir. */
const DEEPSEEK_AGENTS: readonly AutonomousGoalAgent[] = ['deepseek', 'deepseek-agent-teams']

const LOCK_RETRIES = {
  retries: 20,
  factor: 1.3,
  minTimeout: 10,
  maxTimeout: 250,
  randomize: true
}

const claudeConfigSchema = z.looseObject({
  projects: z.record(z.string(), z.looseObject({})).optional()
})

export type ClaudeTrustConfigTarget = {
  configPath: string
  /** Runs before the write; DeepSeek seeds onboarding so a fresh file does not reopen it. */
  prepare?: () => void
  /** Claude owns the default config: never create it for a CLI that has not run yet. */
  requireExisting: boolean
}

export function resolveClaudeTrustConfigTarget(
  agent: AutonomousGoalAgent,
  home: string = homedir()
): ClaudeTrustConfigTarget {
  if (DEEPSEEK_AGENTS.includes(agent)) {
    const configDir = join(home, DEEPSEEK_CLAUDE_CONFIG_DIR_NAME)
    return {
      configPath: join(configDir, '.claude.json'),
      prepare: () => seedDeepSeekClaudeOnboarding(configDir),
      requireExisting: false
    }
  }
  return {
    configPath: new ClaudeRuntimePathResolver().getRuntimePaths().configPath,
    requireExisting: true
  }
}

/** Claude keys projects by the resolved path; also write the realpath and its `/` form on Windows. */
export function claudeProjectKeys(workspacePath: string): string[] {
  const resolved = resolve(workspacePath)
  const keys = [resolved]
  try {
    keys.push(realpathSync.native(resolved))
  } catch {
    // The worktree may not exist yet on a slow filesystem; the resolved key still matches.
  }
  const withForwardSlashes = keys.map((key) => key.replaceAll('\\', '/'))
  return [...new Set([...keys, ...withForwardSlashes].map((key) => key.normalize('NFC')))]
}

export async function writeClaudeFolderTrust(
  target: ClaudeTrustConfigTarget,
  workspacePath: string
): Promise<void> {
  target.prepare?.()
  if (target.requireExisting && !existsSync(target.configPath)) {
    return
  }
  // Why: Claude Code rewrites this file under the same proper-lockfile lock (`<config>.lock`).
  const release = await lock(target.configPath, {
    realpath: false,
    retries: LOCK_RETRIES
  })
  try {
    const raw = existsSync(target.configPath) ? readFileSync(target.configPath, 'utf-8') : '{}'
    // A malformed config is Claude's to repair; throwing leaves it untouched.
    const config = claudeConfigSchema.parse(JSON.parse(raw))
    const projects = { ...config.projects }
    const keys = claudeProjectKeys(workspacePath)
    if (keys.every((key) => projects[key]?.hasTrustDialogAccepted === true)) {
      return
    }
    for (const key of keys) {
      projects[key] = { ...projects[key], hasTrustDialogAccepted: true }
    }
    writeFileAtomically(target.configPath, `${JSON.stringify({ ...config, projects }, null, 2)}\n`)
  } finally {
    await release()
  }
}

/** Best-effort: on failure the dialog simply appears, as it would without a goal. */
export async function markAutonomousGoalClaudeFolderTrusted(
  agent: TuiAgent,
  workspacePath: string
): Promise<void> {
  // Why: a WSL worktree's agent reads the distro's own config, not this host's.
  if (
    !isAutonomousGoalAgent(agent) ||
    AUTONOMOUS_GOAL_AGENT_CLI[agent] === 'codex' ||
    parseWslUncPath(workspacePath)
  ) {
    return
  }
  try {
    await writeClaudeFolderTrust(resolveClaudeTrustConfigTarget(agent), workspacePath)
  } catch (error) {
    console.warn('[autonomous-goals] could not pre-accept Claude folder trust', error)
  }
}
