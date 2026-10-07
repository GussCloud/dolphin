import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { accessSync, constants, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, dirname, isAbsolute, join } from 'node:path'
import {
  addClaudeTeammateModeAuto,
  addClaudeTeammateModeInProcess,
  isDirectClaudeCommand,
  type ClaudeAgentTeamsMode
} from '../../shared/claude-agent-teams-tmux-compat'
import {
  DEV_CLI_COMMAND_NAME,
  getCliCommandFileNameForPlatform
} from '../../shared/cli-command-names'
import { getBundledLauncherPath } from '../cli/bundled-cli-launcher-path'
import { resolveGitBashPath } from '../git-bash'
import type { AgentTeamHostShell } from './claude-agent-teams-host-shell'
import { resolvePathEnvKey } from '../pty/windows-path-segment-merge'

export type ClaudeAgentTeamsLaunchPlan = {
  command: string
  env: Record<string, string>
  envToDelete?: string[]
  teammateMode: 'auto' | 'in-process'
}

export async function ensureClaudeAgentTeamsShimDir(
  root = defaultShimRoot(),
  platform: NodeJS.Platform = process.platform
): Promise<string> {
  await mkdir(root, { recursive: true })
  await writeIfChanged(join(root, 'tmux'), unixShimScript())
  if (platform === 'win32') {
    // Why: dev fallback only — cmd.exe expands `%NAME%` in tmux args; packaged builds put tmux.exe ahead of it.
    await writeIfChanged(join(root, 'tmux.cmd'), windowsClaudeAgentTeamsShimScript())
  }
  return root
}

/** Packaged `bin/agent-teams` dir holding the native tmux.exe shim, or null when this build has none. */
export function resolveBundledAgentTeamsTmuxDir(
  platform: NodeJS.Platform = process.platform,
  resourcesPath: string | undefined = process.resourcesPath
): string | null {
  if (platform !== 'win32' || !resourcesPath) {
    return null
  }
  const dir = join(resourcesPath, 'bin', 'agent-teams')
  return existsSync(join(dir, 'tmux.exe')) ? dir : null
}

/** Directories to prepend to the leader PATH, highest precedence first. */
export function resolveClaudeAgentTeamsShimPathDirs(
  shimDir: string,
  bundledTmuxDir: string | null = resolveBundledAgentTeamsTmuxDir()
): string[] {
  // Why: tmux.exe must win over the dev tmux.cmd, whose cmd.exe hop rewrites `%NAME%` in tmux args.
  return bundledTmuxDir ? [bundledTmuxDir, shimDir] : [shimDir]
}

export async function buildClaudeAgentTeamsLaunchPlan(args: {
  command: string | undefined
  mode: ClaudeAgentTeamsMode | undefined
  baseEnv: Record<string, string | undefined>
  createTeamEnv: (
    shimDir: string,
    shimBin: string,
    shimPathDirs: string[]
  ) => Record<string, string>
  platform?: NodeJS.Platform
  /** 'default' (WSL, SSH) runs teammates in the pane's own POSIX shell; unknown or native Windows needs Git Bash. */
  hostShell?: AgentTeamHostShell | null
  /** SSH leaders cannot reach the host-local tmux shim, so teammates stay in-process. */
  sshLeader?: boolean
  resolveGitBash?: () => string | null
  bundledTmuxDir?: string | null
}): Promise<ClaudeAgentTeamsLaunchPlan | null> {
  const mode = args.mode ?? 'off'
  if (!args.command || mode === 'off' || !isDirectClaudeCommand(args.command)) {
    return null
  }
  if (mode === 'in-process' || args.sshLeader) {
    return inProcessPlan(args.command)
  }
  const platform = args.platform ?? process.platform
  // Why: native Windows teammate panes run Claude's POSIX respawn command in Git Bash; WSL/SSH panes already are POSIX.
  if (
    platform === 'win32' &&
    args.hostShell !== 'default' &&
    !(args.resolveGitBash ?? (() => resolveGitBashPath()))()
  ) {
    return inProcessPlan(args.command)
  }
  const shimBin = resolveClaudeAgentTeamsShimBin(args.baseEnv)
  if (!shimBin) {
    // Why: without an absolute CLI path the shim would resolve a bare `dolphin` against the pane cwd, so degrade instead.
    return inProcessPlan(args.command)
  }
  const shimDir = await ensureClaudeAgentTeamsShimDir(undefined, platform)
  const bundledTmuxDir =
    args.bundledTmuxDir === undefined
      ? resolveBundledAgentTeamsTmuxDir(platform)
      : args.bundledTmuxDir
  const env = args.createTeamEnv(
    shimDir,
    shimBin,
    resolveClaudeAgentTeamsShimPathDirs(shimDir, bundledTmuxDir)
  )
  return {
    command: addClaudeTeammateModeAuto(args.command),
    env,
    envToDelete: ['TERM_PROGRAM'],
    teammateMode: 'auto'
  }
}

function inProcessTeamsEnv(): Record<string, string> {
  return { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: '1' }
}

function inProcessPlan(command: string): ClaudeAgentTeamsLaunchPlan {
  return {
    command: addClaudeTeammateModeInProcess(command),
    env: inProcessTeamsEnv(),
    teammateMode: 'in-process'
  }
}

/**
 * Teams env for an SSH leader's direct `claude --teammate-mode …` launch, or null for any other
 * launch. Never the TMUX/shim env: those paths and the shim CLI exist only on this machine.
 */
export function resolveSshClaudeAgentTeamsLeaderEnv(args: {
  command?: string
  launchConfig?: { agentCommand?: string; agentArgs?: string }
}): Record<string, string> | null {
  const capturedCommand = args.launchConfig?.agentCommand?.trim() || args.command?.trim() || ''
  if (!isDirectClaudeCommand(capturedCommand)) {
    return null
  }
  const capturedLaunch = `${capturedCommand} ${args.launchConfig?.agentArgs?.trim() ?? ''}`
  return /(^|\s)--teammate-mode(?:=|\s+)(?:auto|in-process)(?:\s|$)/.test(capturedLaunch)
    ? inProcessTeamsEnv()
    : null
}

/** Absolute path to the Dolphin CLI that backs the tmux shim, or null when none can be qualified. */
export function resolveClaudeAgentTeamsShimBin(
  env: Record<string, string | undefined> = process.env
): string | null {
  // Why: Windows callers pass an env spelt `Path`; reading only `PATH` there would find no CLI at all.
  const pathValue = env[resolvePathEnvKey(env, process.platform)]
  const override = env.DOLPHIN_AGENT_TEAMS_SHIM_BIN
  if (override) {
    // Why: a bare override name would be resolved by the shim's shell against its cwd, so qualify it or ignore it.
    const qualified = isAbsolute(override) ? override : findExecutableOnPath(override, pathValue)
    if (qualified) {
      return qualified
    }
  }
  const bundled = bundledLauncherPath()
  if (bundled && isExecutableFile(bundled)) {
    return bundled
  }
  return (
    findExecutableOnPath(
      process.platform === 'win32' ? `${DEV_CLI_COMMAND_NAME}.cmd` : DEV_CLI_COMMAND_NAME,
      pathValue
    ) ?? findExecutableOnPath(getCliCommandFileNameForPlatform(process.platform), pathValue)
  )
}

function defaultShimRoot(): string {
  return join(homedir(), '.dolphin', 'claude-agent-teams-bin')
}

function bundledLauncherPath(): string | null {
  return process.resourcesPath
    ? getBundledLauncherPath(process.platform, process.resourcesPath)
    : null
}

function findExecutableOnPath(command: string, pathValue: string | undefined): string | null {
  for (const directory of pathValue?.split(delimiter) ?? []) {
    // Why: empty and relative PATH entries resolve against a cwd we do not control, which is the hijack we are avoiding.
    if (!directory || !isAbsolute(directory)) {
      continue
    }
    const candidate = join(directory, command)
    if (isExecutableFile(candidate)) {
      return candidate
    }
  }
  return null
}

function isExecutableFile(candidate: string): boolean {
  try {
    if (!existsSync(candidate)) {
      return false
    }
    accessSync(candidate, process.platform === 'win32' ? constants.F_OK : constants.X_OK)
    return true
  } catch {
    return false
  }
}

// Why: an unqualified command name is resolved against the invoking pane's cwd (always on cmd.exe, and via `.`/empty
// PATH entries on POSIX), so a stray `dolphin` next to the agent's files would run with the team token. Demand a
// fully-qualified binary instead of guessing one.
function unixShimScript(): string {
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    'dolphin_bin=${DOLPHIN_AGENT_TEAMS_SHIM_BIN:-}',
    'case $dolphin_bin in',
    '  /*|[A-Za-z]:[\\\\/]*) ;;',
    '  *)',
    '    echo "dolphin agent-teams tmux shim: DOLPHIN_AGENT_TEAMS_SHIM_BIN must be an absolute path" >&2',
    '    exit 127',
    '    ;;',
    'esac',
    'exec "$dolphin_bin" agent-teams-tmux "$@"',
    ''
  ].join('\n')
}

export function windowsClaudeAgentTeamsShimScript(): string {
  return [
    '@echo off',
    'setlocal',
    'set "DOLPHIN_SHIM_BIN=%DOLPHIN_AGENT_TEAMS_SHIM_BIN%"',
    'if not defined DOLPHIN_SHIM_BIN goto :unqualified',
    'if "%DOLPHIN_SHIM_BIN:~1,1%"==":" goto :run',
    'if "%DOLPHIN_SHIM_BIN:~0,2%"=="\\\\" goto :run',
    'goto :unqualified',
    ':run',
    // Why: no `call` — its extra percent-expansion pass would rewrite tmux pane args such as `%2` into batch parameters.
    '"%DOLPHIN_SHIM_BIN%" agent-teams-tmux %*',
    'exit /b %ERRORLEVEL%',
    ':unqualified',
    'echo dolphin agent-teams tmux shim: DOLPHIN_AGENT_TEAMS_SHIM_BIN must be an absolute path 1>&2',
    'exit /b 127',
    ''
  ].join('\r\n')
}

async function writeIfChanged(path: string, content: string): Promise<void> {
  try {
    if ((await readFile(path, 'utf8')) === content) {
      return
    }
  } catch {
    // rewrite below
  }
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  let renamed = false
  try {
    await writeFile(tmp, content, 'utf8')
    if (process.platform !== 'win32') {
      await chmod(tmp, 0o755)
    }
    await rename(tmp, path)
    renamed = true
  } finally {
    if (!renamed) {
      await rm(tmp, { force: true })
    }
  }
}
