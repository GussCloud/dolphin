import { isAbsolute } from 'node:path'
import {
  prefixBareClaudeWithCommandBuiltin,
  replaceBareClaudeExecutable
} from '../../../shared/agent-resume-launch-command'
import { resolveClaudeCommand } from '../../../shared/node-cli-command-resolution'
import type { ClaudeRuntimeAuthPreparation } from '../runtime-auth/runtime-auth-types'
import { RESUME_OWNER_PROVENANCE_SUFFIX } from './claude-resume-owner'
import { discoverClaudeShellSelector } from './claude-shell-selector-discovery'

type BypassDeps = {
  platform?: NodeJS.Platform
  hasClaudeShellFunction?: () => boolean
  resolveClaude?: (pathEnv: string | null) => string
}

/**
 * When the user's zsh wraps `claude` in an account menu and Dolphin already chose the account
 * (or the folder holding the conversation a resume continues),
 * launches the real executable by path: the shell only looks up functions for bare names, so
 * the menu never opens to swallow Dolphin's prompt. The menu keeps working everywhere else.
 */
export function bypassClaudeShellFunction(
  command: string | undefined,
  claudeAuth: ClaudeRuntimeAuthPreparation | null | undefined,
  env: Record<string, string | undefined> | undefined,
  deps: BypassDeps = {}
): string | undefined {
  if (
    !command ||
    (deps.platform ?? process.platform) === 'win32' ||
    claudeAuth?.runtime !== 'host' ||
    !(
      claudeAuth.provenance.startsWith('managed:') ||
      claudeAuth.provenance.endsWith(RESUME_OWNER_PROVENANCE_SUFFIX)
    )
  ) {
    return command
  }
  const hasFunction =
    deps.hasClaudeShellFunction ?? (() => discoverClaudeShellSelector().selectorFile !== null)
  if (!hasFunction()) {
    return command
  }
  const resolve = deps.resolveClaude ?? ((pathEnv) => resolveClaudeCommand({ pathEnv }))
  const executable = resolve(env?.PATH ?? null)
  // Why the builtin fallback: with no path on Dolphin's PATH, the shell still resolves `claude`
  // itself, and `command` makes it skip the function.
  return (
    (isAbsolute(executable)
      ? replaceBareClaudeExecutable(command, executable, 'posix')
      : prefixBareClaudeWithCommandBuiltin(command)) ?? command
  )
}
