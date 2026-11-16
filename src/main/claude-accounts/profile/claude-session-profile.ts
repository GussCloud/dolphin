import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readClaudeResumeSessionId } from '../../../shared/agent-resume-launch-command'

/** The session id a Claude spawn command resumes; tried in each shell grammar the host may use. */
export function readClaudeSpawnResumeSessionId(command: string | undefined): string | null {
  for (const shell of ['posix', 'powershell', 'cmd'] as const) {
    const id = readClaudeResumeSessionId(command, shell)
    if (id) {
      return id
    }
  }
  return null
}

/** Newest mtime of `configDir/projects/<any>/<sessionId>.jsonl`; null when no project holds it. */
export function claudeConfigDirSessionMtime(configDir: string, sessionId: string): number | null {
  const projectsDir = join(configDir, 'projects')
  let projects: string[]
  try {
    projects = readdirSync(projectsDir)
  } catch {
    return null
  }
  let newest: number | null = null
  for (const project of projects) {
    try {
      const mtime = statSync(join(projectsDir, project, `${sessionId}.jsonl`)).mtimeMs
      newest = newest === null ? mtime : Math.max(newest, mtime)
    } catch {
      // Not in this project.
    }
  }
  return newest
}

/** Whether `configDir/projects/<any>/<sessionId>.jsonl` exists. */
export function claudeConfigDirHoldsSession(configDir: string, sessionId: string): boolean {
  return claudeConfigDirSessionMtime(configDir, sessionId) !== null
}
