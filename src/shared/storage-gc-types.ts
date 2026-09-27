export type StorageGcPolicy = {
  /** Session trees idle at least this long are eligible. */
  maxAgeMs: number
  /** After the age pass, the oldest eligible trees go until the total fits. */
  maxTotalBytes: number
}

export type StorageGcKeepReason =
  | 'live-in-daemon'
  | 'referenced-by-saved-tab'
  | 'recovery-protected'
  | 'recently-active'
  | 'within-policy'

export type StorageGcCandidate = {
  sessionId: string
  bytes: number
  lastActivityAt: number
}

export type StorageGcResult = {
  dryRun: boolean
  policy: StorageGcPolicy
  scannedSessionCount: number
  totalBytes: number
  removed: StorageGcCandidate[]
  reclaimableBytes: number
  keptByReason: Partial<Record<StorageGcKeepReason, number>>
  /** Set when removal was refused outright; the plan is still reported. */
  refusedReason?: 'daemon-inventory-incomplete'
}
