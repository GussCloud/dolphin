import { useAppStore } from '@/store'
import type { CreateWorktreeResult } from '../../../shared/worktree/create-types'
import { ensureWorktreeHasInitialTerminal } from './worktree-initial-terminal-seeding'

/** Members aren't activated on create, so queue their setup/default tabs for when they open. */
export function seedMultiProjectMemberSetup(members: readonly CreateWorktreeResult[]): void {
  for (const member of members) {
    if (!member.setup && !member.defaultTabs) {
      continue
    }
    ensureWorktreeHasInitialTerminal(
      useAppStore.getState(),
      member.worktree.id,
      undefined,
      member.setup,
      undefined,
      member.defaultTabs
    )
  }
}
