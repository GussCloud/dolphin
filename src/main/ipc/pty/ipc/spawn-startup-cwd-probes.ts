/**
 * Runs a synchronous startup-cwd resolver against folders probed asynchronously.
 * Why: the shared resolver asks synchronously, so each folder it asks about is probed off the main
 * thread, in its order, until a dry run asks about none it lacks; that run's answer is final.
 */
export async function resolveWithAsyncDirectoryProbes<T>(
  resolve: (directoryExists: (path: string) => boolean) => T,
  probe: (path: string) => Promise<boolean>
): Promise<T> {
  const probed = new Map<string, boolean>()
  for (;;) {
    let unprobed: string | undefined
    const result = resolve((path) => {
      const exists = probed.get(path)
      if (exists === undefined) {
        unprobed ??= path
      }
      return exists ?? false
    })
    if (unprobed === undefined) {
      return result
    }
    probed.set(unprobed, await probe(unprobed))
  }
}
