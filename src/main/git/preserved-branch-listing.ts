// What the cleanup screen shows and deletes from the preserved-branch registry. A record is listed
// only while its branch still sits at the saved commit; anything else (branch gone, moved, project
// removed) is dropped, so the list never offers to delete work the user resumed.
import type { Repo } from '../../shared/repo-types'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type {
  PreservedBranchListing,
  PreservedBranchRecord
} from '../../shared/preserved-branch-registry-types'
import { isFolderRepo } from '../../shared/repo-kind'
import { getLocalProjectWorktreeGitOptions } from '../project-runtime-git-options'
import type { Store } from '../persistence'
import {
  forgetPreservedBranch,
  readPreservedBranchRecords,
  writePreservedBranchRecords
} from './preserved-branch-registry'
import { gitExecFileAsync } from './runner'
import { forceDeleteLocalBranch } from './worktree-branch-removal'

type RunGit = (args: string[], cwd: string) => Promise<{ stdout: string; stderr: string }>

type ListingDeps = {
  dir?: string
  runGit?: (repo: Repo) => RunGit
}

function localGitRepo(store: Pick<Store, 'getRepos'>, repoId: string): Repo | undefined {
  return store
    .getRepos()
    .find(
      (repo) =>
        repo.id === repoId &&
        !isFolderRepo(repo) &&
        getRepoExecutionHostId(repo) === LOCAL_EXECUTION_HOST_ID
    )
}

function repoRunGit(store: Store): (repo: Repo) => RunGit {
  return (repo) => {
    const options = getLocalProjectWorktreeGitOptions(store, repo)
    return (args, cwd) => gitExecFileAsync(args, { cwd, ...options })
  }
}

async function branchHead(runGit: RunGit, repo: Repo, branchName: string): Promise<string | null> {
  try {
    const { stdout } = await runGit(
      ['rev-parse', '--verify', '--quiet', `refs/heads/${branchName}^{commit}`],
      repo.path
    )
    return stdout.trim() || null
  } catch {
    return null
  }
}

export async function listPreservedBranches(
  store: Store,
  deps: ListingDeps = {}
): Promise<PreservedBranchListing[]> {
  const records = readPreservedBranchRecords(deps.dir)
  const runGitFor = deps.runGit ?? repoRunGit(store)
  const kept: PreservedBranchRecord[] = []
  const listed: PreservedBranchListing[] = []
  for (const record of records) {
    const repo = localGitRepo(store, record.repoId)
    if (!repo) {
      continue
    }
    if ((await branchHead(runGitFor(repo), repo, record.branchName)) !== record.head) {
      continue
    }
    kept.push(record)
    listed.push({ ...record, repoName: repo.displayName || repo.path })
  }
  if (kept.length !== records.length) {
    writePreservedBranchRecords(kept, deps.dir)
  }
  return listed.sort((a, b) => b.preservedAt - a.preservedAt)
}

/** Deletes a listed branch only while it still points at the commit Dolphin kept. */
export async function deletePreservedBranch(
  store: Store,
  branch: Pick<PreservedBranchRecord, 'repoId' | 'branchName'>,
  deps: ListingDeps = {}
): Promise<void> {
  const record = readPreservedBranchRecords(deps.dir).find(
    (entry) => entry.repoId === branch.repoId && entry.branchName === branch.branchName
  )
  if (!record) {
    throw new Error(`Branch "${branch.branchName}" is no longer listed.`)
  }
  const repo = localGitRepo(store, record.repoId)
  if (!repo) {
    forgetPreservedBranch(record, deps.dir)
    throw new Error('The project of this branch is no longer in Dolphin.')
  }
  await forceDeleteLocalBranch(
    repo.path,
    record.branchName,
    record.head,
    (deps.runGit ?? repoRunGit(store))(repo)
  )
  forgetPreservedBranch(record, deps.dir)
}
