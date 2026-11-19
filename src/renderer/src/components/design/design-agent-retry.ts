import type { DesignListEntry } from '../../../../shared/design-types'
import type { DesignComposerPrefill } from '../../../../shared/design-popout'

/** What the composer reopens with to retry a stuck design: its name, request and project. */
export function designRetryPrefill(
  design: Pick<DesignListEntry, 'name' | 'request' | 'repoId'>
): DesignComposerPrefill {
  return {
    name: design.name,
    request: design.request,
    ...(design.repoId ? { repoId: design.repoId } : {})
  }
}
