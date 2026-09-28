import { getDolphinPushGatewayUrl } from '../dolphin-profiles/profile-cloud-auth-config'
import { DesktopPushService } from '../runtime/push/desktop-push-service'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import type { DolphinRuntimeRpcServer } from '../runtime/runtime-rpc'
import { mainProcessState as state } from './main-process-state'

// Why: deliberately not gated on cloud sign-in like the relay is — the push gateway
// authenticates with the host keypair, so an accountless host registers phones on
// exactly the same path. The runtime is read from shared state because both launch
// modes have already stored it there; threading it as a parameter would push the
// launch module past its line budget for no gain.
export function startDesktopPushService(runtimeRpc: DolphinRuntimeRpcServer): void {
  const runtime: DolphinRuntimeService | null = state.runtime
  if (!runtime) {
    console.warn('[push] Background push startup skipped: runtime not started')
    return
  }
  try {
    const pushService = DesktopPushService.create({
      runtime,
      runtimeRpc,
      gatewayUrl: getDolphinPushGatewayUrl()
    })
    pushService?.start()
    state.desktopPushService = pushService
  } catch (error) {
    console.warn(
      '[push] Background push startup unavailable:',
      error instanceof Error ? error.message : String(error)
    )
  }
}
