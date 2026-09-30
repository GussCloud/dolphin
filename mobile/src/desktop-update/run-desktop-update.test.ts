import { describe, expect, it, vi } from 'vitest'
import type { DesktopUpdateRun } from './desktop-update-offer'
import type { DesktopUpdaterSnapshot } from './desktop-update-reply-schema'
import { runDesktopUpdate, type DesktopUpdatePort } from './run-desktop-update'

function snapshot(status: DesktopUpdaterSnapshot['status']): DesktopUpdaterSnapshot {
  return { appVersion: '1.0.0', support: { automatic: true }, status }
}

function port(statuses: DesktopUpdaterSnapshot[]): DesktopUpdatePort & {
  download: ReturnType<typeof vi.fn>
  install: ReturnType<typeof vi.fn>
} {
  const queue = [...statuses]
  return {
    getStatus: vi.fn(async () => (queue.length > 1 ? queue.shift()! : queue[0]!)),
    download: vi.fn(async () => undefined),
    install: vi.fn(async () => ({ targetVersion: '1.1.0' })),
    wait: async () => undefined
  }
}

describe('runDesktopUpdate', () => {
  it('downloads an available update, reports progress, then installs', async () => {
    const updater = port([
      snapshot({ state: 'available', version: '1.1.0' }),
      snapshot({ state: 'downloading', version: '1.1.0', percent: 50 }),
      snapshot({ state: 'downloaded', version: '1.1.0' })
    ])
    const runs: DesktopUpdateRun[] = []

    await runDesktopUpdate(updater, (run) => runs.push(run))

    expect(updater.download).toHaveBeenCalledTimes(1)
    expect(updater.install).toHaveBeenCalledTimes(1)
    expect(runs.map((run) => run.phase)).toEqual(['starting', 'downloading', 'installing'])
  })

  it('installs a downloaded update without downloading again', async () => {
    const updater = port([snapshot({ state: 'downloaded', version: '1.1.0' })])

    await runDesktopUpdate(updater, () => undefined)

    expect(updater.download).not.toHaveBeenCalled()
    expect(updater.install).toHaveBeenCalledTimes(1)
  })

  it('refuses when the desktop no longer offers an update', async () => {
    const updater = port([snapshot({ state: 'not-available' })])

    await expect(runDesktopUpdate(updater, () => undefined)).rejects.toThrow(
      'remote_update_not_available'
    )
    expect(updater.install).not.toHaveBeenCalled()
  })

  it('surfaces the updater error instead of installing', async () => {
    const updater = port([
      snapshot({ state: 'available', version: '1.1.0' }),
      snapshot({ state: 'error', message: 'Disk full' })
    ])

    await expect(runDesktopUpdate(updater, () => undefined)).rejects.toThrow('Disk full')
    expect(updater.install).not.toHaveBeenCalled()
  })
})
