import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { WindowsTerminalCapabilities } from '@/lib/windows-terminal-capabilities'
import { WINDOWS_GIT_BASH_SHELL } from '../../../../shared/windows-terminal-shell'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { WindowsTerminalStep } from './WindowsTerminalStep'

const { capabilitiesState, installState } = vi.hoisted(() => {
  const current: WindowsTerminalCapabilities = {
    wslAvailable: false,
    wslDistros: [],
    pwshAvailable: false,
    gitBashAvailable: false,
    hostPlatform: null,
    isLoading: false
  }
  return { capabilitiesState: { current }, installState: { supported: false } }
})

vi.mock('@/lib/windows-terminal-capabilities', () => ({
  useWindowsTerminalCapabilities: () => capabilitiesState.current
}))

vi.mock('@/lib/pwsh-install-store', () => ({
  isPwshInstallSupported: () => installState.supported,
  usePwshInstallPhase: () => ({ kind: 'idle' }),
  startPwshInstall: vi.fn(),
  cancelPwshInstall: vi.fn()
}))

function setCapabilities(overrides: Partial<WindowsTerminalCapabilities>): void {
  capabilitiesState.current = { ...capabilitiesState.current, ...overrides }
}

afterEach(() => {
  setCapabilities({ pwshAvailable: false, isLoading: false })
  installState.supported = false
})

function createSettings(overrides: Partial<GlobalSettings> = {}): GlobalSettings {
  return {
    terminalWindowsShell: 'powershell.exe',
    terminalWindowsWslDistro: null,
    terminalRightClickToPaste: true,
    ...overrides
  } as GlobalSettings
}

describe('WindowsTerminalStep', () => {
  it('renders default shell and right-click behavior choices', () => {
    const html = renderToStaticMarkup(
      <WindowsTerminalStep settings={createSettings()} updateSettings={vi.fn()} />
    )

    expect(html).toContain('Default Shell')
    expect(html).toContain('PowerShell')
    expect(html).toContain('Command Prompt')
    expect(html).toContain('Right-click behavior')
    expect(html).toContain('Paste on right-click')
    expect(html).toContain('Open context menu')
    expect(html).toContain('role="radiogroup"')
    expect(html).toContain('aria-checked="true"')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('fill="#2E74B5"')
    expect(html).not.toContain('lucide-terminal')
  })

  it('keeps the WSL distro control visible when WSL is already selected', () => {
    const html = renderToStaticMarkup(
      <WindowsTerminalStep
        settings={createSettings({
          terminalWindowsShell: 'wsl.exe',
          terminalWindowsWslDistro: 'Debian'
        })}
        updateSettings={vi.fn()}
      />
    )

    expect(html).toContain('WSL')
    expect(html).toContain('WSL Distribution')
  })

  it('renders Git Bash with the Git Bash mark instead of a text badge', () => {
    const html = renderToStaticMarkup(
      <WindowsTerminalStep
        settings={createSettings({
          terminalWindowsShell: WINDOWS_GIT_BASH_SHELL
        })}
        updateSettings={vi.fn()}
      />
    )

    expect(html).toContain('Git Bash')
    expect(html).toContain('gwindows_logo.svg')
    expect(html).not.toContain('&gt;Git&lt;')
    expect(html).not.toContain('>Git<')
  })

  it('labels PowerShell 7 as recommended when it is installed, without an install prompt', () => {
    setCapabilities({ pwshAvailable: true })
    installState.supported = true
    const html = renderToStaticMarkup(
      <WindowsTerminalStep settings={createSettings()} updateSettings={vi.fn()} />
    )

    expect(html).toContain('PowerShell 7')
    expect(html).toContain('Recommended')
    expect(html).not.toContain('Install PowerShell 7')
  })

  it('recommends installing PowerShell 7 when it is missing', () => {
    installState.supported = true
    const html = renderToStaticMarkup(
      <WindowsTerminalStep settings={createSettings()} updateSettings={vi.fn()} />
    )

    expect(html).toContain('Recommended')
    expect(html).toContain('PowerShell 7 is recommended')
    expect(html).toContain('Install PowerShell 7')
    expect(html).toContain('data-pwsh-install-state="not-installed"')
  })

  it('does not flash the install prompt while capabilities are still loading', () => {
    installState.supported = true
    setCapabilities({ isLoading: true })
    const html = renderToStaticMarkup(
      <WindowsTerminalStep settings={createSettings()} updateSettings={vi.fn()} />
    )
    expect(html).not.toContain('Install PowerShell 7')
  })
})
