import type { RuntimeStore } from '../../../src/main/runtime/runtime-store-contract'
import { getDefaultWorkspaceSession } from '../../../src/shared/constants'

/**
 * Every production runtime host has a store, and tab close resolves its workspace-session
 * partition through it. The fixture's ids name no repo, so they all resolve to `local`.
 */
export function createRepoLessRuntimeStore(): RuntimeStore {
  const workspaceSession = getDefaultWorkspaceSession()
  const store: Partial<RuntimeStore> = {
    getRepos: () => [],
    getRepo: () => undefined,
    getAllWorktreeMeta: () => ({}),
    getWorktreeMeta: () => undefined,
    getWorkspaceSession: () => workspaceSession
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the close and list paths this fixture drives read only the members above.
  return store as RuntimeStore
}
