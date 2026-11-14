import { existsSync, readdirSync } from 'node:fs'
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

/** Whether `configDir/projects/<any>/<sessionId>.jsonl` exists. */
export function claudeConfigDirHoldsSession(configDir: string, sessionId: string): boolean {
  const projectsDir = join(configDir, 'projects')
  let projects: string[]
  try {
    projects = readdirSync(projectsDir)
  } catch {
    return false
  }
  return projects.some((project) => existsSync(join(projectsDir, project, `${sessionId}.jsonl`)))
}
