import { afterEach, describe, expect, it, vi } from 'vitest'

import { installConditionalMediationGuard } from './azure-devops-sign-in-window-installation'

function stubCredentials(): { nativeGet: ReturnType<typeof vi.fn>; credentials: object } {
  const nativeGet = vi.fn(function (this: unknown) {
    return Promise.resolve({ id: 'key', receiver: this })
  })
  class FakeCredentialsContainer {}
  Object.defineProperty(FakeCredentialsContainer.prototype, 'get', {
    configurable: true,
    writable: true,
    value: nativeGet
  })
  const credentials = new FakeCredentialsContainer()
  vi.stubGlobal('navigator', { credentials })
  vi.stubGlobal('PublicKeyCredential', { isConditionalMediationAvailable: () => true })
  return { nativeGet, credentials }
}

function callGet(credentials: object, options: unknown): Promise<unknown> {
  return Reflect.apply(Reflect.get(credentials, 'get'), credentials, [options])
}

describe('azure devops sign-in window preload', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects conditional mediation without reaching the native dialog', async () => {
    const { nativeGet, credentials } = stubCredentials()
    installConditionalMediationGuard()
    const rejected = callGet(credentials, { mediation: 'conditional', publicKey: {} })
    await expect(rejected).rejects.toMatchObject({ name: 'NotAllowedError' })
    expect(nativeGet).not.toHaveBeenCalled()
  })

  it('passes an explicit security-key request through on the container', async () => {
    const { nativeGet, credentials } = stubCredentials()
    installConditionalMediationGuard()
    const options = { publicKey: { allowCredentials: [] } }
    await expect(callGet(credentials, options)).resolves.toEqual({
      id: 'key',
      receiver: credentials
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
    expect(() => installConditionalMediationGuard()).not.toThrow()
  })
})
