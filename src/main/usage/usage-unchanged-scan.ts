/**
 * True when a scan reused every cached source as-is, in the same order: its projection then
 * equals the previous one, so it need not cross the worker boundary or be re-persisted.
 */
export function isUnchangedUsageScan(scan: {
  cached: readonly { path: string }[]
  /** `cached` after legacy-key migration; a migrated entry must still be persisted. */
  migrated: readonly { path: string }[]
  processed: readonly { path: string }[]
  parsedCount: number
}): boolean {
  const { cached, migrated, processed, parsedCount } = scan
  return (
    parsedCount === 0 &&
    processed.length === cached.length &&
    processed.every((file, index) => file === migrated[index] && migrated[index] === cached[index])
  )
}
