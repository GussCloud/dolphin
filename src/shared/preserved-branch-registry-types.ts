/** An unmerged branch Dolphin kept when it removed a local worktree. */
export type PreservedBranchRecord = {
  repoId: string
  worktreePath: string
  branchName: string
  /** The commit the branch pointed at when kept; deleting it requires the branch still there. */
  head: string
  preservedAt: number
}

/** A kept branch that still exists unchanged, as the cleanup screen lists it. */
export type PreservedBranchListing = PreservedBranchRecord & {
  repoName: string
}
