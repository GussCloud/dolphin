import { useAppStore } from '@/store'
import type { DesignListEntry } from '../../../../shared/design-types'

/** Reopens the composer in Design mode with the stuck design's name, request and project. */
export function retryDesignInComposer(
  design: Pick<DesignListEntry, 'name' | 'request' | 'repoId'>
): void {
  useAppStore.getState().openModal('new-workspace-composer', {
    designMode: true,
    prefilledName: design.name,
    designRequest: design.request,
    ...(design.repoId ? { initialRepoId: design.repoId } : {})
  })
}
