/**
 * Project git account and commit author for terminals and agents opened in a bound project.
 *
 * Everything rides `GIT_CONFIG_PARAMETERS` (see shared/git-config-parameters.ts) plus, for GitHub,
 * `GH_CONFIG_DIR` pointing at a token-free per-account gh config. No token enters the PTY env:
 * GitHub tokens stay in the OS keyring, Azure DevOps tokens are fetched by `az` at credential time.
 * Hosts are the same concrete set Dolphin's own git uses (repo-git-account-env.ts).
 */
import type { Repo } from '../../shared/repo-types'
import { AZURE_DEVOPS_ENTRA_RESOURCE_ID } from '../../shared/azure-devops-auth'
import {
  appendGitConfigParameters,
  scopedCredentialHelperEntries,
  type GitConfigEntry
} from '../../shared/git-config-parameters'
import { azureDevOpsGitUrls, githubGitUrls } from '../../shared/git-scoped-credential-helper'
import { quotePosixShell } from '../../shared/wsl-login-shell-command'
import { splitWorktreeId } from '../../shared/worktree/id'
import { addWslEnvKeys } from '../wsl-env'
import { getRepoGitAccountContext } from '../project-runtime-git-options'
import { readReachableUrls } from '../git/command-runner/repo-git-account-env'
import { detectGhTokenStorage, ensureGhTerminalConfigDir } from '../github/gh-terminal-config-dir'
import { findRepoForAzureDevOpsRequest } from '../azure-devops/azure-devops-repo-account-lookup'
import {
  azureDevOpsAccountConfigDir,
  findAzureDevOpsManagedAccount
} from '../azure-devops/azure-devops-managed-accounts'

/** Emptied, not deleted: an explicit empty value also overrides a detached daemon's inherited copy, and gh treats empty as unset. */
const AMBIENT_GH_TOKEN_KEYS = [
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'GH_ENTERPRISE_TOKEN',
  'GITHUB_ENTERPRISE_TOKEN',
  'GH_HOST'
] as const

export type TerminalGitAccountEnv = {
  env: Record<string, string>
  /** User-facing reasons a binding is not (fully) applied to terminals; never contain secrets. */
  warnings: string[]
}

function failClosedHelper(message: string): string {
  return `!f() { test "$1" = get || exit 0; echo ${quotePosixShell(message)} >&2; echo quit=1; }; f`
}

function azureDevOpsHelper(configDir: string, login: string): string {
  const signedOut = `Dolphin: Azure DevOps account ${login || 'of this project'} is signed out. Sign in again in Settings > Integrations.`
  return [
    '!f() { test "$1" = get || exit 0;',
    `t=$(AZURE_CONFIG_DIR=${quotePosixShell(configDir)} az account get-access-token --resource ${AZURE_DEVOPS_ENTRA_RESOURCE_ID} --query accessToken -o tsv 2>/dev/null);`,
    `if [ -z "$t" ]; then echo ${quotePosixShell(signedOut)} >&2; echo quit=1; exit 0; fi;`,
    `printf 'username=dolphin\\npassword=%s\\n' "$t"; }; f`
  ].join(' ')
}

/**
 * Env patch for one terminal of `repo`, or null when the repo has no binding.
 * SSH repos return null: their shells run on the remote host, which this does not configure.
 */
export async function buildTerminalGitAccountEnv(input: {
  repo: Repo
  cwd: string
  /** Set for a WSL shell; `distro: null` is the default distro. */
  wsl?: { distro: string | null }
  inheritedGitConfigParameters?: string
  /** Env the shell would otherwise inherit; ambient gh tokens found here are neutralized. */
  ambientEnv?: Record<string, string | undefined>
  userDataPath?: string
}): Promise<TerminalGitAccountEnv | null> {
  const context = getRepoGitAccountContext(input.repo)
  if (!context || input.repo.kind === 'folder') {
    return null
  }
  const env: Record<string, string> = {}
  const warnings: string[] = []
  const entries: GitConfigEntry[] = []

  let reachableUrls: string[] = []
  if (context.ghAccount || context.azureDevOpsAccountId) {
    try {
      reachableUrls = await readReachableUrls([], {
        cwd: input.cwd,
        ...(input.wsl?.distro ? { wslDistro: input.wsl.distro } : {})
      })
    } catch {
      warnings.push(
        "Dolphin could not read this project's remotes; terminals cover only the account's main host."
      )
    }
  }

  const ghAccount = context.ghAccount
  if (ghAccount) {
    const storage = await detectGhTokenStorage(ghAccount, input.wsl ? { wsl: input.wsl } : {})
    if (storage === 'keyring') {
      env.GH_CONFIG_DIR = ensureGhTerminalConfigDir(ghAccount, input.userDataPath)
      for (const key of AMBIENT_GH_TOKEN_KEYS) {
        // Why only when present: an ambient token would make gh ignore GH_CONFIG_DIR's login.
        if (input.ambientEnv?.[key]) {
          env[key] = ''
        }
      }
      entries.push(
        ...scopedCredentialHelperEntries(
          githubGitUrls(ghAccount.host, reachableUrls),
          '!gh auth git-credential'
        )
      )
    } else {
      warnings.push(
        storage === 'file'
          ? `GitHub account ${ghAccount.user} is stored without the system keyring, so terminals in this project use your default gh login. Run \`gh auth login --secure-storage\` to enable it.`
          : `GitHub account ${ghAccount.user}@${ghAccount.host} is not signed in to gh where this project's terminals run, so they use your default gh login.`
      )
    }
  }

  const accountId = context.azureDevOpsAccountId
  if (accountId) {
    const urls = azureDevOpsGitUrls(reachableUrls)
    const account = findAzureDevOpsManagedAccount(accountId)
    // Why fail closed: a skipped Azure DevOps binding would push with whatever login git finds.
    const helper = !account
      ? failClosedHelper(
          "Dolphin: this project's Azure DevOps account was removed. Choose another in the project settings."
        )
      : input.wsl
        ? failClosedHelper(
            'Dolphin: Azure DevOps project accounts are not available in WSL terminals yet.'
          )
        : azureDevOpsHelper(azureDevOpsAccountConfigDir(account), account.login)
    if (!account || input.wsl) {
      warnings.push(
        !account
          ? "This project's Azure DevOps account was removed; git in its terminals refuses Azure DevOps until you choose another."
          : 'Azure DevOps project accounts are not available in WSL terminals yet; git there refuses Azure DevOps.'
      )
    }
    entries.push(...scopedCredentialHelperEntries(urls, helper))
  }

  if (context.commitIdentity) {
    entries.push(
      ['user.name', context.commitIdentity.name],
      ['user.email', context.commitIdentity.email]
    )
  }
  if (entries.length > 0) {
    env.GIT_CONFIG_PARAMETERS = appendGitConfigParameters(
      input.inheritedGitConfigParameters,
      entries
    )
  }
  return Object.keys(env).length > 0 || warnings.length > 0 ? { env, warnings } : null
}

/** Mutates `baseEnv`; registers the vars in WSLENV for a WSL shell (`/p` translates the path). */
export function applyTerminalGitAccountEnv(
  baseEnv: Record<string, string>,
  patch: TerminalGitAccountEnv,
  opts: { isWsl?: boolean } = {}
): void {
  Object.assign(baseEnv, patch.env)
  if (opts.isWsl) {
    const keys = Object.keys(patch.env).map((key) => (key === 'GH_CONFIG_DIR' ? `${key}/p` : key))
    if (keys.length > 0) {
      addWslEnvKeys(baseEnv, keys)
    }
  }
}

type TerminalRepoStore = {
  getRepos: () => Repo[]
  getAllWorktreeMeta?: () => Record<string, unknown>
}

let repoStore: TerminalRepoStore | null = null

/** Registered once by the host that owns the repo store (desktop and dolphind). */
export function installTerminalGitAccountRepoLookup(store: TerminalRepoStore | null): void {
  repoStore = store
}

function findTerminalRepo(
  worktreeId: string | undefined,
  cwd: string | undefined
): Repo | undefined {
  if (!repoStore) {
    return undefined
  }
  const repoId = worktreeId ? splitWorktreeId(worktreeId)?.repoId : undefined
  const byId = repoId ? repoStore.getRepos().find((repo) => repo.id === repoId) : undefined
  return byId ?? (cwd ? findRepoForAzureDevOpsRequest(repoStore, cwd, null) : undefined)
}

/**
 * The single entry every host-local PTY spawn path calls before assembling its env.
 * Only new PTYs are affected; an open terminal keeps the account it started with.
 */
export async function applyTerminalGitAccountForSpawn(
  baseEnv: Record<string, string>,
  spawn: {
    connectionId?: string | null
    worktreeId?: string
    cwd?: string
    isWsl?: boolean
    wslDistro?: string | null
  }
): Promise<void> {
  // Why: SSH shells run on the remote host; this phase configures only local and WSL shells.
  if (spawn.connectionId) {
    return
  }
  const repo = findTerminalRepo(spawn.worktreeId ?? baseEnv.DOLPHIN_WORKTREE_ID, spawn.cwd)
  if (!repo) {
    return
  }
  const patch = await buildTerminalGitAccountEnv({
    repo,
    cwd: spawn.cwd ?? repo.path,
    ...(spawn.isWsl ? { wsl: { distro: spawn.wslDistro ?? null } } : {}),
    inheritedGitConfigParameters:
      baseEnv.GIT_CONFIG_PARAMETERS ?? process.env.GIT_CONFIG_PARAMETERS,
    // Why both: the daemon path's env is sparse; the daemon inherits Dolphin's own env.
    ambientEnv: { ...process.env, ...baseEnv }
  })
  if (!patch) {
    return
  }
  for (const warning of patch.warnings) {
    console.warn(`[terminal-git-account] ${repo.id}: ${warning}`)
  }
  applyTerminalGitAccountEnv(baseEnv, patch, { isWsl: spawn.isWsl })
}

/** For the project UI: why terminals of `repo` do not fully use its accounts (empty = all applied). */
export async function getTerminalGitAccountWarnings(
  repo: Repo,
  wsl?: { distro: string | null }
): Promise<string[]> {
  return (
    (await buildTerminalGitAccountEnv({ repo, cwd: repo.path, ...(wsl ? { wsl } : {}) }))
      ?.warnings ?? []
  )
}
