import { describe, expect, it } from 'vitest'
import { FORK_IDENTITY } from '../../shared/fork-identity'
import forkIdentityJson from '../../shared/fork-identity.json'
import compatibilityContract from '../../shared/local-build-compatibility-contract.json'

describe('fork identity', () => {
  it('matches the JSON the electron-builder config reads', () => {
    expect(forkIdentityJson).toEqual(FORK_IDENTITY)
  })

  it('is the app id local-build validation expects', () => {
    expect(compatibilityContract.appId).toBe(FORK_IDENTITY.appId)
  })
})
