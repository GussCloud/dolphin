/**
 * Per-project git account: the `-c` args and child env that make one git invocation
 * authenticate as the project's account and author commits as its identity.
 *
 * Credentials are scoped by git itself: `credential.<https://host>.helper` only fires for
 * https URLs on that host, so ssh remotes and other hosts never see the helper. The token
 * rides in this child's env only; argv carries just the env var name.
 */
import type { GhAccountBinding } from '../../../shared/github/account-binding'
import {
  normalizeCommitIdentity,
  type CommitIdentity
} from '../../../shared/source-control-account-types'
import {
  buildScopedCredentialHelperConfig,
  type GitCredentialGrant
} from '../../../shared/git-scoped-credential-helper'
import { addWslEnvKeys } from '../../wsl-env'
import { findGitSubcommandIndex } from '../wsl-direct-git-read-commands'

/** Repo-level account bindings a git call may honor; set only for local (non-SSH) repos. */
export type RepoGitAccountContext = {
  ghAccount?: GhAccountBinding
  azureDevOpsAccountId?: string
  commitIdentity?: CommitIdentity
}

export type { GitCredentialGrant }
export {
  AZURE_DEVOPS_CLOUD_GIT_URL,
  azureDevOpsGitUrls,
  remoteUrlCandidatesFromGitConfig
} from '../../../shared/git-scoped-credential-helper'

export type RepoGitAccountInvocation = {
  /** Global options to place before the subcommand. */
  leadingArgs: string[]
  env: Record<string, string>
}

/** https URLs passed on the command line (clone source, `fetch <url>`), which bypass remote config. */
export function httpsUrlsInArgs(args: readonly string[]): string[] {
  return args.filter((arg) => /^https:\/\//i.test(arg))
}

const NETWORK_SUBCOMMANDS = new Set(['fetch', 'pull', 'push', 'clone', 'ls-remote'])
const COMMIT_CREATING_SUBCOMMANDS = new Set([
  'commit',
  'merge',
  'rebase',
  'cherry-pick',
  'revert',
  'pull',
  'stash',
  'am',
  'commit-tree',
  'notes',
  'tag'
])

function subcommandOf(args: readonly string[]): string | undefined {
  const index = findGitSubcommandIndex(args)
  return index === -1 ? undefined : args[index]
}

function actionOf(args: readonly string[]): string | undefined {
  const index = findGitSubcommandIndex(args)
  return index === -1 ? undefined : args.slice(index + 1).find((arg) => !arg.startsWith('-'))
}

export function isNetworkGitCommand(args: readonly string[]): boolean {
  const subcommand = subcommandOf(args)
  if (!subcommand) {
    return false
  }
  if (NETWORK_SUBCOMMANDS.has(subcommand)) {
    return true
  }
  const action = actionOf(args)
  return (
    (subcommand === 'submodule' && action === 'update') ||
    (subcommand === 'remote' && action === 'update')
  )
}

export function isCommitCreatingGitCommand(args: readonly string[]): boolean {
  const subcommand = subcommandOf(args)
  return subcommand !== undefined && COMMIT_CREATING_SUBCOMMANDS.has(subcommand)
}

/** True when this call needs a credential lookup for `context` (token resolution is not free). */
export function needsGitCredentialGrants(
  args: readonly string[],
  context: RepoGitAccountContext | undefined
): boolean {
  return Boolean(
    context && (context.ghAccount || context.azureDevOpsAccountId) && isNetworkGitCommand(args)
  )
}

/** Builds the leading `-c` args and env for one git invocation. */
export function buildRepoGitAccountInvocation(input: {
  args: readonly string[]
  context: RepoGitAccountContext | undefined
  grants: readonly GitCredentialGrant[]
}): RepoGitAccountInvocation {
  const leadingArgs: string[] = []
  const env: Record<string, string> = {}
  if (isNetworkGitCommand(input.args)) {
    const scoped = buildScopedCredentialHelperConfig(input.grants)
    leadingArgs.push(...scoped.leadingArgs)
    Object.assign(env, scoped.env)
  }
  const identity = normalizeCommitIdentity(input.context?.commitIdentity)
  if (identity && isCommitCreatingGitCommand(input.args)) {
    leadingArgs.push('-c', `user.name=${identity.name}`, '-c', `user.email=${identity.email}`)
  }
  return { leadingArgs, env }
}

/** Child env for the invocation; registers the credential vars in WSLENV on Windows. */
export function mergeRepoGitAccountEnv(
  baseEnv: NodeJS.ProcessEnv,
  invocationEnv: Record<string, string>,
  platform: NodeJS.Platform = process.platform
): NodeJS.ProcessEnv {
  const next = { ...baseEnv, ...invocationEnv }
  const keys = Object.keys(invocationEnv)
  if (platform === 'win32' && keys.length > 0) {
    // Why: wsl.exe forwards only the variables named in WSLENV; harmless for native git.
    addWslEnvKeys(next, keys)
  }
  return next
}
