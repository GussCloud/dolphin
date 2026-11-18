import { describe, expect, it } from 'vitest'
import { hostRepoCatalogSnapshotSchema } from './host-screen-reply-schema'

describe('repo.list snapshot replies', () => {
  it('reads an unchanged reply as the catalog the caller already holds', () => {
    expect(hostRepoCatalogSnapshotSchema.parse({ unchanged: true, snapshotId: 'repos-1' })).toEqual(
      { kind: 'unchanged', snapshotId: 'repos-1' }
    )
  })

  it('reads a new host catalog with its id, and an older host catalog without one', () => {
    const repos = [{ id: 'repo-1', displayName: 'api' }]
    expect(hostRepoCatalogSnapshotSchema.parse({ repos, snapshotId: 'repos-1' })).toEqual({
      kind: 'catalog',
      repos,
      snapshotId: 'repos-1'
    })
    expect(hostRepoCatalogSnapshotSchema.parse({ repos })).toEqual({
      kind: 'catalog',
      repos,
      snapshotId: null
    })
  })
})
