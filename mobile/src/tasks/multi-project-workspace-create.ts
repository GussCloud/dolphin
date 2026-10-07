import { z } from 'zod'
import type { TuiAgent } from '../../../src/shared/tui-agent'
import { folderWorkspaceKey } from '../../../src/shared/workspace-scope'
import type { RpcClient } from '../transport/rpc-client'
import { bindDeferredRpcOperation, defineRpcOperation } from '../transport/rpc-operation'
import { rpcResultVariant } from '../transport/rpc-operation-result-reader'
import type { AgentLaunchSupport } from './agent-launch-worktree-create'
import { readAgentLaunchCreateOutcome } from './agent-launch-worktree-create'
import { agentLaunchRun } from './mobile-workspace-create-operations'
import { WORKTREE_CREATE_TIMEOUT_MS } from './workspace-create-timeout'
import { translateTasks as t } from './tasks-translate'

// Checked against src/main/runtime/rpc/methods/folder-workspace.ts (MultiProjectWorkspaceCreateResult).
const multiProjectWorkspaceReceiptSchema = z.looseObject({
  folderWorkspace: z.looseObject({ id: z.string().min(1), name: z.string() })
})

/** Not replayed on a lost reply: the host refuses a second create into an existing container. */
export const multiProjectWorkspaceCreateRun = bindDeferredRpcOperation(
  defineRpcOperation({
    name: 'folderWorkspace.create-multi-project',
    method: 'folderWorkspace.createMultiProject',
    acceptance: 'require-result-or-throw-message',
    barrier: 'after-caller-barrier',
    read: rpcResultVariant('multi-project-workspace', multiProjectWorkspaceReceiptSchema)
  })
)

export type MultiProjectWorkspaceCreateOutcome = {
  worktreeId: string
  name: string
  warning?: string
}

/**
 * One worktree per project inside a new container folder, then the agent in that folder, the
 * same landing the desktop composer gives a multi-project workspace.
 */
export async function createMultiProjectWorkspace(args: {
  client: RpcClient
  name: string
  repoIds: readonly string[]
  agent: TuiAgent | undefined
  agentLaunchSupported: Promise<AgentLaunchSupport | false>
}): Promise<MultiProjectWorkspaceCreateOutcome> {
  const reply = await multiProjectWorkspaceCreateRun.request(
    args.client,
    {
      name: args.name,
      repoIds: [...args.repoIds],
      ...(args.agent ? { createdWithAgent: args.agent } : {})
    },
    { timeoutMs: WORKTREE_CREATE_TIMEOUT_MS }
  )
  const { folderWorkspace } = multiProjectWorkspaceCreateRun.interpret(reply)
  const worktreeId = folderWorkspaceKey(folderWorkspace.id)
  const created = { worktreeId, name: folderWorkspace.name || args.name }
  if (!args.agent) {
    return created
  }
  const warning = await launchAgentInContainer(args.client, args.agent, worktreeId, {
    supported: await args.agentLaunchSupported
  })
  return warning ? { ...created, warning } : created
}

// Why a warning, not an error: the workspace exists; failing here would invite a duplicate create.
async function launchAgentInContainer(
  client: RpcClient,
  agent: TuiAgent,
  worktreeId: string,
  launch: { supported: AgentLaunchSupport | false }
): Promise<string | undefined> {
  if (!launch.supported) {
    return t('agentLaunchUnsupportedWarning')
  }
  try {
    const reply = await agentLaunchRun.request(
      client,
      { agent, target: { kind: 'existing', worktree: `id:${worktreeId}` } },
      { timeoutMs: WORKTREE_CREATE_TIMEOUT_MS }
    )
    return readAgentLaunchCreateOutcome(agentLaunchRun.interpret(reply))?.warning
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return t('agentLaunchFailedWarning', { reason })
  }
}
