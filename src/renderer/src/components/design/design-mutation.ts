/**
 * Runs a user mutation, then reloads the design. Only a failed mutation is an error: it is reported
 * and rethrown so the caller keeps the user's input. A failed reload after a successful mutation is
 * silent and yields null, because the action happened and the host's change signal repaints.
 */
export async function runDesignMutation<T>(input: {
  mutate: () => Promise<unknown>
  reload: () => Promise<T>
  onError: (error: unknown) => void
}): Promise<T | null> {
  try {
    await input.mutate()
  } catch (error) {
    input.onError(error)
    throw error
  }
  try {
    return await input.reload()
  } catch {
    return null
  }
}
