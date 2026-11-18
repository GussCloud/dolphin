import { describe, expect, it } from 'vitest'
import { contentSnapshotId, resolveReplySnapshot } from './content-snapshot-id'

const reply = { repos: [{ id: 'r1', name: 'dolphin' }] }

describe('resolveReplySnapshot', () => {
  it('returns the plain reply to a caller that sent no snapshot id', () => {
    expect(resolveReplySnapshot(reply, undefined)).toEqual(reply)
  })

  it('labels the full reply for a caller that holds no snapshot yet', () => {
    const result = resolveReplySnapshot(reply, null)
    expect(result).toEqual({ ...reply, snapshotId: contentSnapshotId(JSON.stringify(reply)) })
  })

  it('answers unchanged only when the caller holds the exact content', () => {
    const first = resolveReplySnapshot(reply, null)
    if (!('snapshotId' in first)) {
      throw new Error('expected a labelled reply')
    }
    expect(resolveReplySnapshot(reply, first.snapshotId)).toEqual({
      unchanged: true,
      snapshotId: first.snapshotId
    })

    const renamed = { repos: [{ id: 'r1', name: 'dolphin-renamed' }] }
    const next = resolveReplySnapshot(renamed, first.snapshotId)
    expect(next).toEqual({ ...renamed, snapshotId: contentSnapshotId(JSON.stringify(renamed)) })
    expect('unchanged' in next).toBe(false)
  })

  it('derives ids from content alone, so a restarted host recognises a phone-held id', () => {
    expect(contentSnapshotId(JSON.stringify(reply))).toBe(
      contentSnapshotId(JSON.stringify({ repos: [{ id: 'r1', name: 'dolphin' }] }))
    )
    expect(contentSnapshotId('a')).toHaveLength(32)
  })
})
