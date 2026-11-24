import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseAgentPermissionPolicy } from '../../shared/agent-permission-policy'
import type { WorktreeMeta } from '../../shared/worktree/meta-types'
import { createDaemonFileLog } from '../daemon/daemon-file-log'
import type {
  BypassPermissionResolver,
  SpawnedAgentLaunch
} from './server/server-bypass-permission-reply'

export const BYPASS_PERMISSION_AUDIT_FILE_NAME = 'agent-permission-approvals.jsonl'
const AUDIT_MAX_BYTES = 2 * 1024 * 1024
const AUDIT_COMMAND_MAX_CHARS = 2000

/** The runtime's spawn records; the subset the resolver reads. */
export type SpawnedLaunchLookup = {
  getSpawnedAgentLaunchForPaneKey: (paneKey: string) => SpawnedAgentLaunch | null
}

/** Reads each workspace's policy from worktree meta and logs every automatic approval. */
export function createBypassPermissionResolver(args: {
  getWorktreeMeta: (worktreeId: string) => Pick<WorktreeMeta, 'agentPermissionPolicy'> | undefined
  getRuntime: () => SpawnedLaunchLookup | null
  userDataPath: string
}): BypassPermissionResolver {
  const auditLog = createDaemonFileLog(join(args.userDataPath, BYPASS_PERMISSION_AUDIT_FILE_NAME), {
    maxBytes: AUDIT_MAX_BYTES,
    maxRotatedFiles: 5,
    source: 'main'
  })
  return {
    homeDir: homedir(),
    spawnedLaunchForPane: (paneKey) =>
      args.getRuntime()?.getSpawnedAgentLaunchForPaneKey(paneKey) ?? null,
    lookupPolicy: (worktreeId) =>
      parseAgentPermissionPolicy(args.getWorktreeMeta(worktreeId)?.agentPermissionPolicy),
    audit: (record) => {
      const command = record.command.slice(0, AUDIT_COMMAND_MAX_CHARS)
      auditLog.log('bypass-permission-allowed', { ...record, command })
      console.info(
        `[agent-hooks] auto-approved ${record.toolName} prompt in ${record.worktreeId} (${record.policyMode}${record.categories ? `: ${record.categories.join(', ')}` : ''})`
      )
    }
  }
}
