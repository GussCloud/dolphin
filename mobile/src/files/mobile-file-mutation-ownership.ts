import { parseExecutionHostId } from '../../../src/shared/execution-host'
import { assertFileMutationOwnershipCapability } from '../../../src/shared/file-mutation-ownership'
import type { SshConnectionState, SshMutationExpectation } from '../../../src/shared/ssh-types'
import {
  fileOwnershipRuntimeStatusRead,
  fileOwnershipSshStateRead,
  fileOwnershipWorktreeRead,
  type MobileFileOwnershipRpcSender
} from './mobile-file-ownership-operations'
import { filesText } from './files-text'

const FILE_MUTATION_TIMEOUT_MS = 15_000

export type MobileFileMutationOwnership = SshMutationExpectation & {
  expectedExecutionHostId: 'local' | `ssh:${string}`
}

// The two members the ownership gate routes on, as the reply reader hands them back. Absence and
// an explicit `null` stay distinct: the host omits `state` for a target it holds no connection for.
export type MobileFileMutationSshState =
  | (Pick<SshConnectionState, 'connectionGeneration'> & { targetId?: string })
  | null
  | undefined

export function buildMobileFileMutationOwnership(
  worktreeHostId: string | null | undefined,
  sshState: MobileFileMutationSshState = null
): MobileFileMutationOwnership {
  const host = parseExecutionHostId(worktreeHostId)
  if (worktreeHostId !== undefined && !host) {
    throw new Error(filesText('sshOwnerChanged'))
  }
  if (!host || host.kind === 'local' || host.kind === 'runtime') {
    return { expectedExecutionHostId: 'local' }
  }
  if (sshState?.targetId !== host.targetId || sshState.connectionGeneration === undefined) {
    throw new Error(filesText('sshOwnerChanged'))
  }
  return {
    expectedExecutionHostId: host.id,
    expectedSshTargetId: host.targetId,
    expectedSshConnectionGeneration: sshState.connectionGeneration
  }
}

export async function captureMobileFileMutationOwnership(
  client: MobileFileOwnershipRpcSender,
  worktree: string
): Promise<MobileFileMutationOwnership> {
  const statusReply = await fileOwnershipRuntimeStatusRead.request(client, undefined, {
    timeoutMs: FILE_MUTATION_TIMEOUT_MS
  })
  const status = fileOwnershipRuntimeStatusRead.interpret(statusReply)
  assertFileMutationOwnershipCapability(status)

  const worktreeReply = await fileOwnershipWorktreeRead.request(
    client,
    { worktree },
    { timeoutMs: FILE_MUTATION_TIMEOUT_MS }
  )
  const summary = fileOwnershipWorktreeRead.interpret(worktreeReply)
  if (!summary) {
    throw new Error(filesText('sshOwnerChanged'))
  }

  const host = parseExecutionHostId(summary.hostId)
  let sshState: MobileFileMutationSshState = null
  if (host?.kind === 'ssh') {
    const stateReply = await fileOwnershipSshStateRead.request(
      client,
      { targetId: host.targetId },
      { timeoutMs: FILE_MUTATION_TIMEOUT_MS }
    )
    sshState = fileOwnershipSshStateRead.interpret(stateReply)
  }
  return buildMobileFileMutationOwnership(summary.hostId, sshState)
}
