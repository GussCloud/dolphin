import type { Repo } from '../shared/repo-types'
import { getRepoExecutionHostId } from '../shared/execution-host'
import {
  normalizeRepoAccountBinding,
  type RepoAccountBinding
} from '../shared/source-control-account-types'
import { prepareRepoGitAccountInvocation } from './git/command-runner/repo-git-account-env'

type RepoBindingStore = {
  updateRepo: (
    id: string,
    updates: RepoAccountBinding & Pick<Repo, 'accountSetupReviewedAt'>,
    hostId?: ReturnType<typeof getRepoExecutionHostId>
  ) => Repo | null
}

/**
 * Stores the account choices made while adding a project, through the same sanitizing
 * update path as the settings page. Only for rows this call created: re-adding an
 * existing project must not silently rebind it.
 */
export function applyRepoAccountBindingToNewRepo(
  store: RepoBindingStore,
  repo: Repo,
  binding: unknown
): Repo {
  // Why reviewed: the add flow already offered every account, so the legacy-project prompt never fires.
  const updates = { ...normalizeRepoAccountBinding(binding), accountSetupReviewedAt: Date.now() }
  return store.updateRepo(repo.id, updates, getRepoExecutionHostId(repo)) ?? repo
}

/** `git clone` args/env that authenticate as the account chosen in the clone request. */
export async function prepareCloneGitInvocation(
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv; binding: unknown }
): Promise<{ args: string[]; env: NodeJS.ProcessEnv }> {
  const repoAccount = normalizeRepoAccountBinding(options.binding)
  const prepared = repoAccount
    ? await prepareRepoGitAccountInvocation(args, {
        cwd: options.cwd,
        env: options.env,
        repoAccount
      })
    : null
  return { args: prepared?.args ?? args, env: prepared?.env ?? options.env }
}
