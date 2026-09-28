import type { DolphinRuntimeService } from '../dolphin-runtime'

export function routeDispatcherClientHostedBrowserRpc(
  runtime: DolphinRuntimeService,
  method: string,
  params: unknown
) {
  const candidate = runtime as DolphinRuntimeService & {
    routeClientHostedBrowserRpc?: DolphinRuntimeService['routeClientHostedBrowserRpc']
  }
  return candidate.routeClientHostedBrowserRpc?.(method, params) ?? { handled: false as const }
}
