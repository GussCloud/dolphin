// Runs in the sign-in page's world via executeInMainWorld, so it must stay self-contained.
// Why: Electron on Windows turns a conditional (autofill) passkey request into the modal
// Windows Hello dialog on page load; an explicit security-key choice must keep working.
export function installConditionalMediationGuard(): void {
  if (typeof PublicKeyCredential !== 'undefined') {
    try {
      Object.defineProperty(PublicKeyCredential, 'isConditionalMediationAvailable', {
        configurable: false,
        writable: false,
        value: (): Promise<boolean> => Promise.resolve(false)
      })
    } catch {}
  }
  // Why the prototype: the page can also reach `get` through CredentialsContainer.prototype.
  if (typeof CredentialsContainer === 'undefined') {
    return
  }
  const container = CredentialsContainer.prototype
  const originalGet = container.get
  if (typeof originalGet !== 'function') {
    return
  }
  function guardedGet(
    this: CredentialsContainer,
    options?: CredentialRequestOptions
  ): Promise<Credential | null> {
    if (options?.mediation === 'conditional') {
      return Promise.reject(
        new DOMException('Conditional mediation is disabled in this window', 'NotAllowedError')
      )
    }
    return originalGet.call(this, options)
  }
  try {
    Object.defineProperty(container, 'get', {
      configurable: false,
      writable: false,
      value: guardedGet
    })
  } catch {}
}
