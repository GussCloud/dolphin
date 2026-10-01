import type { RpcClient } from '../transport/rpc-client'
import type { MobileNewTabAgentOption } from './mobile-new-tab-agent-options'

// Why keyed by client: a reconnect mints a new client, so a host's cached agents never outlive the
// connection that detected them.
const optionsByClient = new WeakMap<RpcClient, Map<string, readonly MobileNewTabAgentOption[]>>()

export function readCachedNewTabAgentOptions(
  client: RpcClient,
  worktreeId: string
): readonly MobileNewTabAgentOption[] | undefined {
  return optionsByClient.get(client)?.get(worktreeId)
}

export function writeCachedNewTabAgentOptions(
  client: RpcClient,
  worktreeId: string,
  options: readonly MobileNewTabAgentOption[]
): void {
  let byWorktree = optionsByClient.get(client)
  if (!byWorktree) {
    byWorktree = new Map()
    optionsByClient.set(client, byWorktree)
  }
  byWorktree.set(worktreeId, options)
}
