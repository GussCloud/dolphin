import { startDesignRendererBroadcast } from '../designs/design-renderer-broadcast'
import { getDesignStore } from '../designs/design-store-instance'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'

/** Announces design writes to open windows and paired clients. */
export function startMainProcessDesigns(runtime: DolphinRuntimeService): () => void {
  return startDesignRendererBroadcast(
    (notify) => getDesignStore().subscribe(notify),
    () => runtime.notifyDesignsChanged()
  )
}
