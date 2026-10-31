import { afterEach, describe, expect, it, vi } from 'vitest'

import { installConditionalMediationGuard } from './azure-devops-sign-in-window-installation'

function stubCredentials(): {
  nativeGet: ReturnType<typeof vi.fn>
  credentials: { get: (options?: unknown) => Promise<unknown> }
} {
  const nativeGet = vi.fn(function (this: unknown, options?: unknown) {
    return Promise.resolve({ id: 'key', receiver: this, options })
  })
  class FakeCredentialsContainer {
    get(options?: unknown): Promise<unknown> {
      return nativeGet.call(this, options)
    }
  }
  const credentials = new FakeCredentialsContainer()
  vi.stubGlobal('CredentialsContainer', FakeCredentialsContainer)
  vi.stubGlobal('navigator', { credentials })
  vi.stubGlobal('PublicKeyCredential', { isConditionalMediationAvailable: () => true })
  return { nativeGet, credentials }
}

describe('azure devops sign-in window preload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects conditional mediation without reaching the native dialog', async () => {
    const { nativeGet, credentials } = stubCredentials()
    installConditionalMediationGuard()
    const rejected = credentials.get({ mediation: 'conditional', publicKey: {} })
    await expect(rejected).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(nativeGet).not.toHaveBeenCalled()
  })

  it('passes an explicit security-key request through on the container', async () => {
    const { nativeGet, credentials } = stubCredentials()
    installConditionalMediationGuard()
    const options = { publicKey: { allowCredentials: [] } }
    await expect(credentials.get(options)).resolves.toEqual({
      id: 'key',
      receiver: credentials,
      options
    })
    expect(nativeGet).toHaveBeenCalledWith(options)
  })

  it('reports conditional mediation as unavailable', async () => {
    stubCredentials()
    installConditionalMediationGuard()
    await expect(PublicKeyCredential.isConditionalMediationAvailable()).resolves.toBe(false)
  })

  it('tolerates a page without WebAuthn', () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('CredentialsContainer', undefined)
    vi.stubGlobal('PublicKeyCredential', undefined)
    expect(() => installConditionalMediationGuard()).not.toThrow()
  })
})
