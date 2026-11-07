import type { GitAdmissionTier } from './command-runner/git-exec-options'
import type { RepoGitAccountContext } from './command-runner/repo-git-account-config'

export type GitRuntimeOptions = {
  wslDistro?: string
  signal?: AbortSignal
  admissionTier?: GitAdmissionTier
  repoAccount?: RepoGitAccountContext
}

export function gitOptionsForWorktree(
  cwd: string,
  options: GitRuntimeOptions = {}
): {
  cwd: string
  wslDistro?: string
  signal?: AbortSignal
  admissionTier?: GitAdmissionTier
  repoAccount?: RepoGitAccountContext
} {
  return {
    cwd,
    ...(options.wslDistro ? { wslDistro: options.wslDistro } : {}),
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.admissionTier ? { admissionTier: options.admissionTier } : {}),
    ...(options.repoAccount ? { repoAccount: options.repoAccount } : {})
  }
}

/**
 * Options for a git invocation that only reads. Opting in explicitly keeps the
 * shell-free WSL route from depending on `wsl-direct-git-read-commands`
 * classifying the argv, which is a heuristic these call sites already know the
 * answer to.
 */
export function gitReadOptionsForWorktree(
  cwd: string,
  options: GitRuntimeOptions = {}
): {
  cwd: string
  wslDistro?: string
  signal?: AbortSignal
  admissionTier?: GitAdmissionTier
  repoAccount?: RepoGitAccountContext
  preferWslDirectGit: true
} {
  return { ...gitOptionsForWorktree(cwd, options), preferWslDirectGit: true }
}
