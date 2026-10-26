/** The goal snapshot reads only the active environment; other environments refresh when made active. */
export function refreshGoalsForClientEvent(
  environmentId: string,
  activeEnvironmentId: string | null | undefined,
  refresh: () => Promise<void>
): void {
  if (environmentId === activeEnvironmentId) {
    void refresh()
  }
}
