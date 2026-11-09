import type { Repo } from '../../shared/repo-types'
import { splitWorktreeId } from '../../shared/worktree/id'
import { setAzureDevOpsRepoAccountLookup } from './azure-devops-account-scope'

// Why its own module: dolphind installs this lookup and must not load the Electron sign-in window.

type RepoLookupStore = {
  getRepos: () => Repo[]
  getAllWorktreeMeta?: () => Record<string, unknown>
}

function samePath(a: string, b: string): boolean {
  const trim = (value: string): string => value.replace(/[\\/]+$/, '')
  return process.platform === 'win32'
    ? trim(a).toLowerCase() === trim(b).toLowerCase()
    : trim(a) === trim(b)
}

/** The project owning `repoPath` (its checkout or one of its registered worktrees) on that host. */
export function findRepoForAzureDevOpsRequest(
  store: RepoLookupStore,
  repoPath: string,
  connectionId?: string | null
): Repo | undefined {
  const repos = store
    .getRepos()
    .filter((repo) => (repo.connectionId ?? null) === (connectionId ?? null))
  const direct = repos.find((repo) => samePath(repo.path, repoPath))
  if (direct) {
    return direct
  }
  for (const worktreeId of Object.keys(store.getAllWorktreeMeta?.() ?? {})) {
    const parsed = splitWorktreeId(worktreeId)
    if (parsed && samePath(parsed.worktreePath, repoPath)) {
      const owner = repos.find((repo) => repo.id === parsed.repoId)
      if (owner) {
        return owner
      }
    }
  }
  return undefined
}

/** Lets repo-scoped Azure DevOps requests find their project's managed account. */
export function installAzureDevOpsRepoAccountLookup(store: RepoLookupStore): void {
  setAzureDevOpsRepoAccountLookup(
    (repoPath, connectionId) =>
      findRepoForAzureDevOpsRequest(store, repoPath, connectionId)?.azureDevOpsAccountId
  )
}
