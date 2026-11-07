import type { GitAdmissionTier } from '../git/command-runner/git-exec-options'
import type { GhAccountBinding } from '../../shared/github/account-binding'
import type { RepoGitAccountContext } from '../git/command-runner/repo-git-account-config'

export type HostedReviewLocalGitOptions = {
  wslDistro?: string
  admissionTier?: GitAdmissionTier
  ghAccount?: GhAccountBinding
  repoAccount?: RepoGitAccountContext
}

export type HostedReviewExecutionOptions = {
  localGitExecOptions?: HostedReviewLocalGitOptions
  /** Paths Dolphin may have symlinked into this worktree. An untracked entry that
   *  is one of these is Dolphin's own artifact, not work the user can commit, so it
   *  must not read as "dirty" and block review creation. */
  sharedLinkPaths?: readonly string[]
}

export function getHostedReviewLocalGitOptions(
  options: HostedReviewExecutionOptions = {}
): HostedReviewLocalGitOptions {
  const wslDistro = options.localGitExecOptions?.wslDistro
  const admissionTier = options.localGitExecOptions?.admissionTier
  const ghAccount = options.localGitExecOptions?.ghAccount
  const repoAccount = options.localGitExecOptions?.repoAccount
  return {
    ...(wslDistro ? { wslDistro } : {}),
    ...(admissionTier ? { admissionTier } : {}),
    ...(ghAccount ? { ghAccount } : {}),
    ...(repoAccount ? { repoAccount } : {})
  }
}

export function hasHostedReviewLocalGitOptions(
  options: HostedReviewExecutionOptions = {}
): boolean {
  return Object.keys(getHostedReviewLocalGitOptions(options)).length > 0
}
