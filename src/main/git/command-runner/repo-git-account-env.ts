import { parseWslPath } from '../../wsl'
import {
  GIT_REMOTE_URL_CONFIG_PATTERN,
  githubGitUrls,
  remoteUrlCandidatesFromGitConfig
} from '../../../shared/git-scoped-credential-helper'
import {
  azureDevOpsGitUrls,
  buildRepoGitAccountInvocation,
  httpsUrlsInArgs,
  mergeRepoGitAccountEnv,
  needsGitCredentialGrants,
  type GitCredentialGrant,
  type RepoGitAccountContext
} from './repo-git-account-config'

// Why a fixed name: Azure DevOps checks only the Entra token, and the login stays out of the env.
const AZURE_DEVOPS_GIT_USERNAME = 'dolphin'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Every URL this call can reach: https URLs on the command line, each remote URL, and each
 * insteadOf/pushInsteadOf base, read in one config call (a clone's cwd still sees global rewrites).
 * Throws when unreadable: without the concrete hosts the helper cannot be scoped, and the call
 * must not run on the global login.
 */
export async function readReachableUrls(
  args: readonly string[],
  target: { cwd?: string; wslDistro?: string; env?: NodeJS.ProcessEnv }
): Promise<string[]> {
  // Why dynamic: git-exec-file imports this module.
  const { gitExecFileAsync } = await import('./git-exec-file')
  try {
    const { stdout } = await gitExecFileAsync(
      ['config', '--get-regexp', GIT_REMOTE_URL_CONFIG_PATTERN],
      {
        cwd: target.cwd ?? process.cwd(),
        ...(target.wslDistro ? { wslDistro: target.wslDistro } : {}),
        ...(target.env ? { env: target.env } : {})
      }
    )
    return [...httpsUrlsInArgs(args), ...remoteUrlCandidatesFromGitConfig(stdout)]
  } catch (error) {
    // `git config --get-regexp` exits 1 with no output when nothing matches.
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    const stderr =
      error && typeof error === 'object' && 'stderr' in error ? String(error.stderr ?? '') : ''
    if (code === 1 && !stderr.trim()) {
      return httpsUrlsInArgs(args)
    }
    throw Object.assign(
      new Error(
        "Dolphin could not read this project's remotes to apply its account, so the git command was not run."
      ),
      { code: 'repo_git_account_remotes_unreadable' }
    )
  }
}

async function resolveCredentialGrants(
  args: readonly string[],
  context: RepoGitAccountContext,
  target: { cwd?: string; wslDistro?: string; env?: NodeJS.ProcessEnv }
): Promise<GitCredentialGrant[]> {
  const grants: GitCredentialGrant[] = []
  const reachableUrls = await readReachableUrls(args, target)
  if (context.ghAccount) {
    const binding = context.ghAccount
    const urls = githubGitUrls(binding.host, reachableUrls)
    // Why dynamic: the token module imports the command runner.
    const { resolveGhAccountToken } = await import('../../github/gh-account-token')
    try {
      grants.push({
        kind: 'token',
        urls,
        username: binding.user,
        token: await resolveGhAccountToken(binding, {
          cwd: target.cwd,
          wslDistro: target.wslDistro
        })
      })
    } catch (error) {
      grants.push({
        kind: 'unavailable',
        urls,
        message: `Dolphin: ${errorMessage(error)} Fix the project's GitHub account in its settings.`
      })
    }
  }
  if (context.azureDevOpsAccountId) {
    const urls = azureDevOpsGitUrls(reachableUrls)
    const { resolveAzureDevOpsAccountToken } =
      await import('../../azure-devops/azure-devops-account-scope')
    try {
      grants.push({
        kind: 'token',
        urls,
        username: AZURE_DEVOPS_GIT_USERNAME,
        token: await resolveAzureDevOpsAccountToken(context.azureDevOpsAccountId)
      })
    } catch (error) {
      grants.push({
        kind: 'unavailable',
        urls,
        message: `Dolphin: ${errorMessage(error)}`
      })
    }
  }
  return grants
}

/**
 * Args/env for one git call of a repo with an account binding, or null when nothing applies.
 * Tokens are resolved only for network subcommands, and never enter argv.
 */
export async function prepareRepoGitAccountInvocation(
  args: string[],
  options: {
    cwd?: string
    wslDistro?: string
    env?: NodeJS.ProcessEnv
    repoAccount?: RepoGitAccountContext
  }
): Promise<{ args: string[]; env: NodeJS.ProcessEnv | undefined } | null> {
  const context = options.repoAccount
  if (!context) {
    return null
  }
  const wslDistro =
    options.wslDistro ??
    (process.platform === 'win32' && options.cwd ? parseWslPath(options.cwd)?.distro : undefined)
  const grants = needsGitCredentialGrants(args, context)
    ? await resolveCredentialGrants(args, context, {
        cwd: options.cwd,
        wslDistro,
        env: options.env
      })
    : []
  const invocation = buildRepoGitAccountInvocation({ args, context, grants })
  if (invocation.leadingArgs.length === 0) {
    return null
  }
  return {
    args: [...invocation.leadingArgs, ...args],
    env:
      Object.keys(invocation.env).length > 0
        ? mergeRepoGitAccountEnv(options.env ?? process.env, invocation.env)
        : options.env
  }
}
