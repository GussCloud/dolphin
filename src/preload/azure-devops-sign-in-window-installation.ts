// Runs in the sign-in page's world via executeInMainWorld, so it must stay self-contained.
// Why: Electron on Windows turns a conditional (autofill) passkey request into the modal
// Windows Hello dialog on page load; an explicit security-key choice must keep working.
export function installConditionalMediationGuard(): void {
  const define = (target: object, key: string, value: unknown): void => {
    try {
      Object.defineProperty(target, key, { configurable: false, writable: false, value })
    } catch {}
  }

  if (typeof PublicKeyCredential !== 'undefined') {
    define(PublicKeyCredential, 'isConditionalMediationAvailable', () => Promise.resolve(false))
  }

  const credentials = typeof navigator === 'undefined' ? undefined : navigator.credentials
  // Why the prototype: the page can also reach `get` through CredentialsContainer.prototype.
  const container: object | null = credentials ? Object.getPrototypeOf(credentials) : null
  const originalGet: unknown = container ? Reflect.get(container, 'get') : undefined
  if (!container || typeof originalGet !== 'function') {
    return
  }
  define(
    container,
    'get',
    function guardedGet(this: unknown, options?: CredentialRequestOptions): Promise<unknown> {
      if (options && typeof options === 'object' && options.mediation === 'conditional') {
        return Promise.reject(
          new DOMException('Conditional mediation is disabled in this window', 'NotAllowedError')
        )
      }
      return Reflect.apply(originalGet, this, [options])
    }
  )
}
