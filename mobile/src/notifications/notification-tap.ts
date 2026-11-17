import type { HostCatalogEntry } from '../transport/types'
import {
  handleAzureDeviceCodePushTap,
  type AzureDeviceCodeTapActions
} from './azure-device-code-push'
import { readNativeNotificationData } from './native-notification-data'
import {
  getNotificationNavigationTarget,
  type NotificationNavigationTarget
} from './notification-routing'
import { isRemotePushTrigger, pushNotificationRouteData } from './push-receive'

export type NotificationTapRequest = { content: { data?: unknown }; trigger?: unknown }

export type NotificationTapEffects = AzureDeviceCodeTapActions & {
  loadHosts: () => Promise<HostCatalogEntry[]>
  isDisposed: () => boolean
  clearLastResponse: () => void
  openRoute: (target: NotificationNavigationTarget) => void
}

export type NotificationTapOutcome = 'azure-handled' | 'navigated' | 'unrouted' | 'disposed'

function getNavigationTarget(
  request: NotificationTapRequest,
  data: unknown,
  hosts: HostCatalogEntry[] | null
): NotificationNavigationTarget | null {
  // A gateway push names its host by key fingerprint, not by this device's hostId.
  // With no catalog to resolve against, such a push stays unrouted instead of
  // falling back to whatever hostId its raw data carries.
  const routeData = pushNotificationRouteData(
    data,
    hosts ?? [],
    isRemotePushTrigger(request.trigger)
  )
  return getNotificationNavigationTarget(routeData, {
    knownHostIds: hosts ? new Set(hosts.map((host) => host.id)) : undefined,
    credentialStatusByHostId: hosts
      ? new Map(hosts.map((host) => [host.id, host.credentialStatus]))
      : undefined
  })
}

/** A default-action tap that passed the caller's dedup: copy-and-open for Azure sign-in, else route. */
export async function handleNotificationTap(
  request: NotificationTapRequest,
  effects: NotificationTapEffects
): Promise<NotificationTapOutcome> {
  const hosts = await effects.loadHosts().catch(() => null)
  const data = readNativeNotificationData(request)
  // An Azure sign-in push opens the Microsoft login page with its code copied, not a route.
  if (!effects.isDisposed() && (await handleAzureDeviceCodePushTap(data, hosts ?? [], effects))) {
    effects.clearLastResponse()
    return 'azure-handled'
  }
  const target = getNavigationTarget(request, data, hosts)
  effects.clearLastResponse()
  if (effects.isDisposed()) {
    return 'disposed'
  }
  if (!target) {
    return 'unrouted'
  }
  effects.openRoute(target)
  return 'navigated'
}
