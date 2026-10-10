import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PwshInstallPhase } from '@/lib/pwsh-install-store'
import { TerminalWindowsShellSection } from './TerminalWindowsShellSection'

const { installState } = vi.hoisted(() => {
  const installState: { supported: boolean; phase: PwshInstallPhase } = {
    supported: true,
    phase: { kind: 'idle' }
  }
  return { installState }
})

vi.mock('@/lib/pwsh-install-store', () => ({
  isPwshInstallSupported: () => installState.supported,
  usePwshInstallPhase: () => installState.phase,
  startPwshInstall: vi.fn(),
  cancelPwshInstall: vi.fn()
}))

afterEach(() => {
  installState.supported = true
  installState.phase = { kind: 'idle' }
})

function renderSection(
  overrides: Partial<React.ComponentProps<typeof TerminalWindowsShellSection>> = {}
): string {
  return renderToStaticMarkup(
    <TerminalWindowsShellSection
      updateSettings={vi.fn()}
      windowsShell="powershell.exe"
      gitBashAvailable={false}
      pwshAvailable={false}
      pwshCapabilitiesLoading={false}
      powerShellImplementation="auto"
      isLocalTerminalHost
      {...overrides}
    />
  )
}

describe('TerminalWindowsShellSection PowerShell 7 recommendation', () => {
  it('labels the option PowerShell 7 and marks it recommended when installed', () => {
    const html = renderSection({ pwshAvailable: true })
    expect(html).toContain('PowerShell 7')
    expect(html).toContain('PowerShell 7 is installed and recommended')
    expect(html).not.toContain('Install PowerShell 7')
  })

  it('keeps the plain PowerShell label when Windows PowerShell 5.1 is pinned', () => {
    const html = renderSection({ pwshAvailable: true, powerShellImplementation: 'powershell.exe' })
    expect(html).not.toContain('PowerShell 7')
  })

  it('offers the install when PowerShell 7 is missing on this machine', () => {
    const html = renderSection()
    expect(html).toContain('PowerShell 7 is recommended')
    expect(html).toContain('Install PowerShell 7')
  })

  it('hides the install while Settings edits a remote runtime', () => {
    const html = renderSection({ isLocalTerminalHost: false })
    expect(html).not.toContain('Install PowerShell 7')
    expect(html).not.toContain('data-pwsh-install-state')
  })

  it.each([
    [{ kind: 'installing' }, 'Installing PowerShell 7…'],
    [{ kind: 'installed', pwshAvailable: true }, 'PowerShell 7 is installed'],
    [
      { kind: 'failed', message: 'Installer failed (exit code 0x1)' },
      'Installer failed (exit code 0x1)'
    ],
    [{ kind: 'winget-unavailable' }, 'Windows Package Manager is not available']
  ] satisfies [PwshInstallPhase, string][])('renders the %o install phase', (phase, text) => {
    installState.phase = phase
    expect(renderSection()).toContain(text)
  })
})
