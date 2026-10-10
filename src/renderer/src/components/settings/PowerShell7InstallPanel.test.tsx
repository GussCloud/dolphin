// @vitest-environment happy-dom

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  PWSH_DOWNLOAD_URL,
  PWSH_WINGET_INSTALL_COMMAND,
  type PwshInstallResult
} from '../../../../shared/pwsh-install'
import { resetPwshInstallStoreForTests } from '@/lib/pwsh-install-store'
import { PowerShell7InstallPanel } from './PowerShell7InstallPanel'

const { refreshCapabilitiesMock } = vi.hoisted(() => ({
  refreshCapabilitiesMock: vi.fn()
}))

vi.mock('@/lib/windows-terminal-capabilities', () => ({
  refreshWindowsTerminalCapabilities: refreshCapabilitiesMock
}))

let resolveInstall: (result: PwshInstallResult) => void = () => {}
const installMock = vi.fn(
  () =>
    new Promise<PwshInstallResult>((resolve) => {
      resolveInstall = resolve
    })
)
const cancelInstallMock = vi.fn(() => Promise.resolve())
const openUrlMock = vi.fn(() => Promise.resolve())

function setApi(installSupported: boolean): void {
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      pwsh: { installSupported, install: installMock, cancelInstall: cancelInstallMock },
      shell: { openUrl: openUrlMock }
    }
  })
}

function clickButton(name: RegExp): void {
  fireEvent.click(screen.getByRole('button', { name }))
}

async function confirmInstall(): Promise<void> {
  clickButton(/Install PowerShell 7/)
  expect(screen.getByText(PWSH_WINGET_INSTALL_COMMAND)).toBeTruthy()
  expect(screen.getByText(/administrator permission \(UAC\)/)).toBeTruthy()
  clickButton(/^Install$/)
  await act(async () => {})
}

async function finishInstall(result: PwshInstallResult): Promise<void> {
  await act(async () => {
    resolveInstall(result)
  })
}

beforeEach(() => {
  resetPwshInstallStoreForTests()
  installMock.mockClear()
  cancelInstallMock.mockClear()
  openUrlMock.mockClear()
  refreshCapabilitiesMock.mockReset()
  refreshCapabilitiesMock.mockResolvedValue(undefined)
  setApi(true)
})

afterEach(() => cleanup())

describe('PowerShell7InstallPanel', () => {
  it('renders nothing when PowerShell 7 is already installed', () => {
    const { container } = render(
      <PowerShell7InstallPanel pwshAvailable capabilitiesLoading={false} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders nothing where install is unsupported (non-Windows or web client)', () => {
    setApi(false)
    const { container } = render(
      <PowerShell7InstallPanel pwshAvailable={false} capabilitiesLoading={false} />
    )
    expect(container.innerHTML).toBe('')
  })

  it('does not install until the user confirms', () => {
    render(<PowerShell7InstallPanel pwshAvailable={false} capabilitiesLoading={false} />)
    expect(screen.getByText('PowerShell 7 is recommended')).toBeTruthy()
    clickButton(/Install PowerShell 7/)
    clickButton(/^Cancel$/)
    expect(installMock).not.toHaveBeenCalled()
  })

  it('shows progress, then success with a fresh capability probe', async () => {
    render(<PowerShell7InstallPanel pwshAvailable={false} capabilitiesLoading={false} />)
    await confirmInstall()
    expect(installMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Installing PowerShell 7…')).toBeTruthy()

    await finishInstall({ status: 'installed', pwshAvailable: true })
    expect(refreshCapabilitiesMock).toHaveBeenCalledWith('local')
    expect(screen.getByText('PowerShell 7 is installed')).toBeTruthy()
    expect(screen.getByText(/New PowerShell terminals will use PowerShell 7/)).toBeTruthy()
  })

  it('keeps showing success after capabilities flip to installed', async () => {
    const { rerender } = render(
      <PowerShell7InstallPanel pwshAvailable={false} capabilitiesLoading={false} />
    )
    await confirmInstall()
    await finishInstall({ status: 'installed', pwshAvailable: true })
    rerender(<PowerShell7InstallPanel pwshAvailable capabilitiesLoading={false} />)
    expect(screen.getByText('PowerShell 7 is installed')).toBeTruthy()
  })

  it('cancels a running install and returns to the recommendation', async () => {
    render(<PowerShell7InstallPanel pwshAvailable={false} capabilitiesLoading={false} />)
    await confirmInstall()
    clickButton(/^Cancel$/)
    expect(cancelInstallMock).toHaveBeenCalledTimes(1)
    await finishInstall({ status: 'cancelled' })
    expect(screen.getByText('PowerShell 7 is recommended')).toBeTruthy()
  })

  it('shows the winget failure and offers retry plus the download page', async () => {
    render(<PowerShell7InstallPanel pwshAvailable={false} capabilitiesLoading={false} />)
    await confirmInstall()
    await finishInstall({ status: 'failed', message: 'Installer failed (exit code 0x8A150014)' })

    expect(screen.getByRole('alert').textContent).toContain(
      'Installer failed (exit code 0x8A150014)'
    )
    clickButton(/Open download page/)
    expect(openUrlMock).toHaveBeenCalledWith(PWSH_DOWNLOAD_URL)
    clickButton(/Try again/)
    expect(screen.getByText(PWSH_WINGET_INSTALL_COMMAND)).toBeTruthy()
  })

  it('explains a timeout', async () => {
    render(<PowerShell7InstallPanel pwshAvailable={false} capabilitiesLoading={false} />)
    await confirmInstall()
    await finishInstall({ status: 'timed-out' })
    expect(screen.getByText(/longer than 15 minutes/)).toBeTruthy()
  })

  it('falls back to the download page when winget is missing', async () => {
    render(<PowerShell7InstallPanel pwshAvailable={false} capabilitiesLoading={false} />)
    await confirmInstall()
    await finishInstall({ status: 'winget-unavailable' })

    expect(screen.getByText('Windows Package Manager is not available')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Install PowerShell 7/ })).toBeNull()
    clickButton(/Open download page/)
    expect(openUrlMock).toHaveBeenCalledWith(PWSH_DOWNLOAD_URL)
  })
})
