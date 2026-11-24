import { describe, expect, it } from 'vitest'
import { DolphinRuntimeWithGetPtyRecordForPaneKey } from './dolphin-runtime-get-pty-record-for-pane-key'

const PANE = 'tab-1:11111111-1111-4111-8111-111111111111'

type FakePty = {
  ptyId: string
  paneKey: string | null
  worktreeId: string
  connected: boolean
  connectionId: string | null
  launchToken: string | null
  launchIncarnationId: string | null
  incarnationId: string | null
}

function pty(overrides: Partial<FakePty> = {}): FakePty {
  return {
    ptyId: 'pty-1',
    paneKey: PANE,
    worktreeId: 'wt-1',
    connected: true,
    connectionId: null,
    launchToken: 'spawn-token',
    launchIncarnationId: 'inc-1',
    incarnationId: 'inc-1',
    ...overrides
  }
}

function lookup(records: FakePty[], paneKey = PANE): unknown {
  // Why `call` on a fake: the method reads only `ptysById`; building the whole runtime adds nothing.
  return DolphinRuntimeWithGetPtyRecordForPaneKey.prototype.getSpawnedAgentLaunchForPaneKey.call(
    { ptysById: new Map(records.map((record) => [record.ptyId, record])) },
    paneKey
  )
}

describe('getSpawnedAgentLaunchForPaneKey', () => {
  it('returns the spawn-minted launch of the one live local record for the pane', () => {
    expect(lookup([pty()])).toEqual({ worktreeId: 'wt-1', launchToken: 'spawn-token' })
  })

  it.each([
    ['no record', []],
    ['another pane only', [pty({ paneKey: 'tab-2:22222222-2222-4222-8222-222222222222' })]],
    ['two matching records', [pty(), pty({ ptyId: 'pty-2' })]],
    ['a disconnected record', [pty({ connected: false })]],
    ['a remote record', [pty({ connectionId: 'ssh-1' })]],
    ['no launch token', [pty({ launchToken: null })]],
    ['an empty launch token', [pty({ launchToken: '' })]],
    ['a token from an earlier incarnation', [pty({ incarnationId: 'inc-2' })]]
  ])('returns null for %s', (_label, records) => {
    expect(lookup(records)).toBeNull()
  })
})
