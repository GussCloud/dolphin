import type { RuntimeWorktreePsResult } from '../../shared/runtime-worktree-contracts'
import type { DolphinCloudAuthConfig } from '../dolphin-profiles/profile-cloud-auth-config'
import {
  runOrgMemberCall,
  type OrgCallResult
} from '../dolphin-profiles/profile-cloud-org-members-service'
import { onDolphinCloudSignedIn } from '../dolphin-profiles/profile-cloud-sign-in-events'
import { onDolphinCloudSigningOut } from '../dolphin-profiles/profile-cloud-sign-out-events'
import {
  ensureActiveDolphinProfile,
  type ActiveDolphinProfileState
} from '../dolphin-profiles/profile-index-store'
import { deleteDolphinCloudWorkPresence, putDolphinCloudWorkPresence } from './work-presence-client'
import { workPresenceMachineId, workPresenceMachineLabel } from './work-presence-machine-id'
import { WorkPresencePublisher, type WorkPresenceSendOutcome } from './work-presence-publisher'
import { buildWorkPresenceSnapshot } from './work-presence-snapshot'

// Why above the ps default: the snapshot is capped by agent count, not workspace count.
const WORK_PRESENCE_PS_LIMIT = 1_000

export type WorkPresenceServiceDeps = {
  config: DolphinCloudAuthConfig
  userDataPath: string
  getInstallId: () => string | undefined
  getWorktreePs: (limit: number) => Promise<RuntimeWorktreePsResult>
  subscribeStatusChanges: (listener: () => void) => () => void
}

export type WorkPresenceService = { stop: () => Promise<void> }

export function mapWorkPresencePutResult(
  result: OrgCallResult<{ heartbeatMs: number | null }>
): WorkPresenceSendOutcome {
  switch (result.status) {
    case 'ok':
      return { status: 'ok', heartbeatMs: result.value.heartbeatMs }
    case 'reconnect-required':
      return { status: 'signed-out' }
    case 'request-error':
      // Why any 404: a server without the route must be backed off like an org-less account.
      return result.error.statusCode === 404 ? { status: 'no-organization' } : { status: 'failed' }
    case 'failed':
      return { status: 'failed' }
  }
}

export function startWorkPresenceService(deps: WorkPresenceServiceDeps): WorkPresenceService {
  // Why pinned: a profile switch rewrites the index and then relaunches; until quit, this
  // process must neither publish as the target profile nor say goodbye with its session.
  const processProfileId = ensureActiveDolphinProfile(deps.userDataPath).profile.id
  const processProfile = (): ActiveDolphinProfileState | null => {
    const active = ensureActiveDolphinProfile(deps.userDataPath)
    return active.profile.id === processProfileId ? active : null
  }
  let publishedProfile: ActiveDolphinProfileState | null = null
  const publisher = new WorkPresencePublisher({
    buildSnapshot: async () =>
      buildWorkPresenceSnapshot({
        machineId: workPresenceMachineId(deps.getInstallId() ?? 'no-install-id', processProfileId),
        machineLabel: workPresenceMachineLabel(),
        summaries: (await deps.getWorktreePs(WORK_PRESENCE_PS_LIMIT)).worktrees,
        now: Date.now()
      }),
    send: async (snapshot) => {
      const profile = processProfile()
      if (!profile) {
        return { status: 'signed-out' }
      }
      const outcome = mapWorkPresencePutResult(
        await runOrgMemberCall(deps.config, profile, deps.userDataPath, (session) =>
          putDolphinCloudWorkPresence(deps.config, session, snapshot)
        )
      )
      if (outcome.status === 'ok') {
        publishedProfile = profile
      }
      return outcome
    },
    // Why the published profile: on a switch's quit the index already names the target.
    sendGoodbye: async (id) => {
      const profile = publishedProfile ?? processProfile()
      if (profile) {
        await runOrgMemberCall(deps.config, profile, deps.userDataPath, (session) =>
          deleteDolphinCloudWorkPresence(deps.config, session, id)
        )
      }
    }
  })
  const unsubscribeStatus = deps.subscribeStatusChanges(() => publisher.notifyChange())
  const unsubscribeSignIn = onDolphinCloudSignedIn(() => publisher.resume())
  const unsubscribeSigningOut = onDolphinCloudSigningOut((session) =>
    publisher.signOut((id) => deleteDolphinCloudWorkPresence(deps.config, session, id))
  )
  publisher.start()
  return {
    stop: async () => {
      unsubscribeStatus()
      unsubscribeSignIn()
      unsubscribeSigningOut()
      await publisher.stop()
    }
  }
}
