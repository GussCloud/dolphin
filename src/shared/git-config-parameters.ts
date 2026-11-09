/**
 * `GIT_CONFIG_PARAMETERS`: the env form of `git -c`, read by every Git since before 2.25.
 *
 * Why not `GIT_CONFIG_COUNT`: Git 2.25 ignores it silently, so a terminal there would push with
 * the global login. Entries use the classic `'key=value'` form, which 2.25 through current parse.
 * Inherited `GIT_CONFIG_COUNT` entries are applied before these, and appended entries come after
 * inherited ones, so Dolphin's entries are the last word on every version.
 */

export type GitConfigEntry = readonly [key: string, value: string]

/** sq-quotes one `key=value` the way git's own `sq_quote_buf` does. */
export function quoteGitConfigParameter([key, value]: GitConfigEntry): string {
  return `'${`${key}=${value}`.replace(/'/g, "'\\''")}'`
}

/** Appends entries after whatever the inherited value already carries. */
export function appendGitConfigParameters(
  inherited: string | undefined,
  entries: readonly GitConfigEntry[]
): string {
  const appended = entries.map(quoteGitConfigParameter).join(' ')
  const base = inherited?.trim()
  return base ? `${base} ${appended}` : appended
}

/** Reset then helper, per URL: the reset clears every earlier helper for that URL only. */
export function scopedCredentialHelperEntries(
  urls: readonly string[],
  helper: string
): GitConfigEntry[] {
  return urls.flatMap((url): GitConfigEntry[] => [
    [`credential.${url}.helper`, ''],
    [`credential.${url}.helper`, helper]
  ])
}
