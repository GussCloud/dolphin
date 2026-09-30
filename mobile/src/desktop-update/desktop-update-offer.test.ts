import { describe, expect, it } from 'vitest'
import {
  desktopUpdateConfirmMessage,
  desktopUpdateTag,
  projectDesktopUpdateOffer
} from './desktop-update-offer'
import type { DesktopUpdaterSnapshot } from './desktop-update-reply-schema'

function snapshot(
  status: DesktopUpdaterSnapshot['status'],
  automatic = true
): DesktopUpdaterSnapshot {
  return { appVersion: '1.0.0', support: { automatic }, status }
}

describe('projectDesktopUpdateOffer', () => {
  it('offers an available, downloading or downloaded update', () => {
    expect(projectDesktopUpdateOffer(snapshot({ state: 'available', version: '1.1.0' }))).toEqual({
      phase: 'available',
      version: '1.1.0'
    })
    expect(
      projectDesktopUpdateOffer(snapshot({ state: 'downloading', version: '1.1.0', percent: 40 }))
    ).toEqual({ phase: 'downloading', version: '1.1.0', percent: 40 })
    expect(projectDesktopUpdateOffer(snapshot({ state: 'downloaded', version: '1.1.0' }))).toEqual({
      phase: 'ready',
      version: '1.1.0'
    })
  })

  it('hides the offer when the desktop cannot update itself remotely', () => {
    expect(
      projectDesktopUpdateOffer(snapshot({ state: 'available', version: '1.1.0' }, false))
    ).toBeNull()
  })

  it('hides the offer for idle, checking and error states', () => {
    for (const state of ['idle', 'checking', 'not-available', 'error']) {
      expect(projectDesktopUpdateOffer(snapshot({ state }))).toBeNull()
    }
    expect(projectDesktopUpdateOffer(null)).toBeNull()
  })
})

describe('desktopUpdateTag', () => {
  it('lets the run outrank the host offer and blocks taps while it is in flight', () => {
    const offer = { phase: 'available', version: '1.1.0' } as const
    expect(desktopUpdateTag(offer, null)).toMatchObject({ actionable: true, tone: 'accent' })
    expect(
      desktopUpdateTag(offer, { phase: 'downloading', version: '1.1.0', percent: 12.4 })
    ).toEqual({ label: 'Downloading 12%', tone: 'progress', actionable: false })
    expect(desktopUpdateTag(offer, { phase: 'installing', version: '1.1.0' })).toMatchObject({
      actionable: false
    })
    expect(
      desktopUpdateTag(offer, { phase: 'failed', version: '1.1.0', message: 'boom' })
    ).toMatchObject({ actionable: true, tone: 'error' })
  })

  it('keeps a desktop-initiated download actionable', () => {
    expect(
      desktopUpdateTag({ phase: 'downloading', version: '1.1.0', percent: 5 }, null)
    ).toMatchObject({ actionable: true })
  })

  it('shows nothing without an offer or run', () => {
    expect(desktopUpdateTag(null, null)).toBeNull()
  })
})

describe('desktopUpdateConfirmMessage', () => {
  it('names the version and repeats a previous failure', () => {
    expect(desktopUpdateConfirmMessage('Studio', { phase: 'ready', version: '1.1.0' }, null)).toBe(
      'Install Dolphin 1.1.0 on "Studio"? Dolphin will restart on that desktop.'
    )
    expect(
      desktopUpdateConfirmMessage('Studio', null, {
        phase: 'failed',
        version: '1.1.0',
        message: 'Disk full'
      })
    ).toContain('Last attempt failed: Disk full')
  })
})
