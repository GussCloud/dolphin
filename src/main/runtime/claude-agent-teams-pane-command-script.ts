import { randomUUID } from 'node:crypto'
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'

// Why: a script left behind by a pane that never ran holds the teammate env (possibly secrets).
const STALE_SCRIPT_AGE_MS = 15 * 60 * 1000
const SCRIPT_SUFFIX = '.sh'

export function defaultPaneCommandScriptDir(): string {
  return join(homedir(), '.dolphin', 'claude-agent-teams-bin', 'pane-cmds')
}

export function quotePosixShellWord(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/** `C:\Users\me\x.sh` -> `/c/Users/me/x.sh`; POSIX paths pass through; null for UNC/relative. */
export function toGitBashPath(windowsPath: string): string | null {
  if (windowsPath.startsWith('/')) {
    return windowsPath
  }
  const match = /^([A-Za-z]):[\\/](.*)$/.exec(windowsPath)
  if (!match) {
    return null
  }
  return `/${match[1]!.toLowerCase()}/${match[2]!.replaceAll('\\', '/')}`
}

/**
 * The script body: it deletes itself, runs Claude's command unchanged, then ends the pane's
 * shell with the command's status (tmux respawn-pane semantics). Bash reads a `.`-sourced file
 * whole before running it, so the self-delete cannot truncate what is still to run.
 */
export function buildPaneCommandScript(gitBashScriptPath: string, command: string): string {
  return `rm -f -- ${quotePosixShellWord(gitBashScriptPath)}\n${command}\nexit\n`
}

export type WrittenPaneCommandScript = {
  filePath: string
  /** The short line typed into the Git Bash pane instead of Claude's long command. */
  typedCommand: string
}

// Why: Git Bash echoes typed input slowly (a 400-char command took ~55s); typing only a short
// `.` line and reading the command from a user-private file makes teammates start in seconds.
export async function writePaneCommandScript(
  dir: string,
  command: string,
  now: number = Date.now()
): Promise<WrittenPaneCommandScript> {
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await sweepStalePaneCommandScripts(dir, now)
  const filePath = join(dir, `${randomUUID()}${SCRIPT_SUFFIX}`)
  const gitBashPath = toGitBashPath(filePath)
  if (!gitBashPath) {
    throw new Error('agent teams pane command directory is not on a drive Git Bash can address')
  }
  await writeFile(filePath, buildPaneCommandScript(gitBashPath, command), {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx'
  })
  return { filePath, typedCommand: `. ${quotePosixShellWord(gitBashPath)}` }
}

export async function removePaneCommandScript(filePath: string | undefined): Promise<void> {
  if (filePath) {
    await rm(filePath, { force: true }).catch(() => undefined)
  }
}

export async function sweepStalePaneCommandScripts(dir: string, now: number): Promise<void> {
  const names = await readdir(dir).catch((): string[] => [])
  await Promise.all(
    names
      .filter((name) => name.endsWith(SCRIPT_SUFFIX))
      .map(async (name) => {
        const filePath = join(dir, name)
        const info = await stat(filePath).catch(() => null)
        if (info && now - info.mtimeMs > STALE_SCRIPT_AGE_MS) {
          await removePaneCommandScript(filePath)
        }
      })
  )
}
