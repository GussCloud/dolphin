export type WhatsNewRelease = {
  /** First app version that ships the announcement. */
  version: string
  id: 'azure-prs'
}

// Why: oldest first; the decision picks the newest entry the user has not seen.
export const WHATS_NEW_RELEASES: readonly WhatsNewRelease[] = [
  { version: '0.2.10', id: 'azure-prs' }
]
