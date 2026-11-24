import { createHash, timingSafeEqual } from 'node:crypto'
import type { ServerResponse } from 'node:http'
import type { AgentHookEventPayload } from '../../../shared/agent-hook-listener/listener-event'
import { parseAgentHookJson } from '../../../shared/agent-hook-listener/request-body'
import type { AgentHookSource } from '../../../shared/agent-hook-relay'
import type { AgentPermissionPolicy } from '../../../shared/agent-permission-policy'
import {
  BYPASS_PERMISSION_ALLOW_REPLY,
  decideBypassPermission,
  type BypassPermissionApproval
} from '../bypass-permission-decision'
import { confirmBypassRemovalOnDisk } from '../bypass-removal-disk-check'

export type BypassPermissionAuditRecord = Omit<BypassPermissionApproval, 'diskChecks'> & {
  time: string
  worktreeId: string
  paneKey: string
}

/** The agent launch Dolphin minted when it spawned a pane; never derived from hook posts. */
export type SpawnedAgentLaunch = { worktreeId: string; launchToken: string }

/** Main-process access the hook server needs to answer a permission prompt. */
export type BypassPermissionResolver = {
  lookupPolicy: (worktreeId: string) => AgentPermissionPolicy | null
  spawnedLaunchForPane: (paneKey: string) => SpawnedAgentLaunch | null
  audit: (record: BypassPermissionAuditRecord) => void
  homeDir?: string
  /** Overridable for tests; defaults to realpath checks on this host. */
  confirmOnDisk?: typeof confirmBypassRemovalOnDisk
}

function readHookPayload(body: unknown): unknown {
  if (typeof body !== 'object' || body === null || !('payload' in body)) {
    return null
  }
  return typeof body.payload === 'string' ? parseAgentHookJson(body.payload) : body.payload
}

function sameToken(a: string, b: string): boolean {
  const left = createHash('sha256').update(a).digest()
  const right = createHash('sha256').update(b).digest()
  return timingSafeEqual(left, right)
}

/** The spawn record, when the post carries exactly the token and worktree the pane was spawned with. */
function verifySpawnedLaunch(
  resolver: BypassPermissionResolver,
  event: AgentHookEventPayload
): SpawnedAgentLaunch | null {
  const launchToken = event.launchToken?.trim()
  if (!launchToken || !event.worktreeId) {
    return null
  }
  // Why the spawn record: any process holding the hook token can post another pane's key and
  // rewrite that pane's hook commitment; only the token minted at spawn binds to the pane.
  const spawned = resolver.spawnedLaunchForPane(event.paneKey)
  // Floor: the token proves "this pane's process tree", not "this process". A same-user process
  // can still read another process's env (e.g. Linux /proc/<pid>/environ) and replay its token.
  if (!spawned || !sameToken(spawned.launchToken, launchToken)) {
    return null
  }
  return spawned.worktreeId === event.worktreeId ? spawned : null
}

/**
 * Replies to an approvable PermissionRequest and resolves true; false leaves the request to the
 * normal status path. Any failure resolves false (fail open to the user's prompt).
 */
export async function replyToBypassPermissionRequest(args: {
  resolver: BypassPermissionResolver | null
  source: AgentHookSource
  body: unknown
  event: AgentHookEventPayload
  /** The hook prints our response; an older or Windows hook would drop the answer. */
  clientRelaysDecision: boolean
  res: ServerResponse
}): Promise<boolean> {
  const { resolver, event } = args
  if (
    !resolver ||
    !args.clientRelaysDecision ||
    event.hookEventName !== 'PermissionRequest' ||
    event.connectionId !== null
  ) {
    return false
  }
  try {
    const spawned = verifySpawnedLaunch(resolver, event)
    if (!spawned) {
      return false
    }
    const approval = decideBypassPermission({
      source: args.source,
      payload: readHookPayload(args.body),
      policy: resolver.lookupPolicy(spawned.worktreeId),
      homeDir: resolver.homeDir
    })
    const confirmOnDisk = resolver.confirmOnDisk ?? confirmBypassRemovalOnDisk
    if (
      !approval ||
      !(await confirmOnDisk(approval.diskChecks, approval.cwd, { homeDir: resolver.homeDir }))
    ) {
      return false
    }
    args.res.writeHead(200, { 'Content-Type': 'application/json' })
    args.res.end(BYPASS_PERMISSION_ALLOW_REPLY)
    const { diskChecks: _diskChecks, ...audited } = approval
    try {
      resolver.audit({
        ...audited,
        time: new Date().toISOString(),
        worktreeId: spawned.worktreeId,
        paneKey: event.paneKey
      })
    } catch (error) {
      console.warn('[agent-hooks] bypass permission audit failed', error)
    }
    return true
  } catch (error) {
    console.warn('[agent-hooks] bypass permission decision failed', error)
    return false
  }
}
