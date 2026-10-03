import { describe, expect, it } from 'vitest'
import {
  buildPowerShellBootstrapLaunch,
  encodePowerShellCommand,
  fitsPowerShellBootstrapEnvBudget,
  getPowerShellOsc133Bootstrap,
  POWERSHELL_BOOTSTRAP_ENV,
  POWERSHELL_BOOTSTRAP_ENV_STUB
} from './powershell-osc133-bootstrap'
import { readPowerShellBootstrapScript } from './powershell-osc133-bootstrap.test-fixture'
import { getShellLaunchConfig } from './daemon/shell-ready'
import { getShellLaunchConfig as getLocalShellLaunchConfig } from './providers/local-pty-shell-ready'
import { resolveWindowsShellLaunchArgs } from './providers/windows-shell-args'
import { STARTUP_COMMAND_FEATURES } from './shell-startup-launch-intent-fixtures'

describe('PowerShell OSC 133 bootstrap', () => {
  it('wraps prompt/readline without bypassing profiles or execution policy', () => {
    const script = getPowerShellOsc133Bootstrap()

    expect(script).toContain('[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()')
    expect(script).toContain('DOLPHIN_OPENCODE_CONFIG_DIR')
    expect(script).toContain('DOLPHIN_MIMOCODE_HOME')
    expect(script).not.toContain('DOLPHIN_PI_CODING_AGENT_DIR')
    expect(script).not.toContain('DOLPHIN_OMP_CODING_AGENT_DIR')
    expect(script).toContain('DOLPHIN_OMP_STATUS_EXTENSION')
    expect(script).toContain('function Global:omp')
    expect(script).toContain('--extension $env:DOLPHIN_OMP_STATUS_EXTENSION')
    expect(script).toContain('DOLPHIN_CODEX_HOME')
    expect(script).toContain('DOLPHIN_CODEX_LAUNCH_PREFLIGHT')
    expect(script).toContain('function Global:codex')
    expect(script).not.toContain('$Global:__DolphinCodexExecutable')
    expect(script).toContain('function Global:prompt')
    expect(script).toContain('function Global:PSConsoleHostReadLine')
    expect(script).toContain('Esc = [char]27')
    expect(script).toContain('Bel = [char]7')
    expect(script).toContain(')]133;D;$fakeExitCode$(')
    expect(script).toContain(')]133;A$(')
    expect(script).toContain(')]133;B$(')
    expect(script).toContain(')]133;C$(')
    expect(script).not.toContain('`e]133')
    expect(script).not.toContain('$PROFILE')
    expect(script).not.toContain('ExecutionPolicy')
    expect(script).not.toContain('NoProfile')

    const codexHomeRestore = script.indexOf('if ($env:DOLPHIN_CODEX_HOME)')
    expect(codexHomeRestore).toBeGreaterThan(-1)
    expect(codexHomeRestore).toBeLessThan(script.indexOf('Test-Path variable:global:'))
    expect(codexHomeRestore).toBeLessThan(script.indexOf('LanguageMode -eq "FullLanguage"'))
  })

  it('encodes commands as UTF-16LE base64 for PowerShell -EncodedCommand', () => {
    expect(encodePowerShellCommand('Write-Output ok')).toBe(
      Buffer.from('Write-Output ok', 'utf16le').toString('base64')
    )
  })

  describe('env-delivered launch', () => {
    it('keeps the argv stub constant, quote-free and payload-free', () => {
      const launch = buildPowerShellBootstrapLaunch('Write-Output "one"')
      expect(launch.args).toEqual(buildPowerShellBootstrapLaunch('Write-Output two').args)
      expect(launch.args).toEqual(['-NoLogo', '-NoExit', '-Command', POWERSHELL_BOOTSTRAP_ENV_STUB])
      expect(POWERSHELL_BOOTSTRAP_ENV_STUB).not.toContain('"')
      expect(POWERSHELL_BOOTSTRAP_ENV_STUB).not.toContain('one')
      expect(Object.keys(launch.env)).toEqual([POWERSHELL_BOOTSTRAP_ENV])
    })

    it('removes the env var before running, so children started after the stub never inherit it', () => {
      const stub = POWERSHELL_BOOTSTRAP_ENV_STUB
      expect(stub.indexOf(`Remove-Item Env:${POWERSHELL_BOOTSTRAP_ENV}`)).toBeGreaterThan(-1)
      expect(stub.indexOf(`Remove-Item Env:${POWERSHELL_BOOTSTRAP_ENV}`)).toBeLessThan(
        stub.indexOf('. __DolphinPsBootstrap')
      )
      // The script's first act removes the transient function it runs as.
      expect(buildPowerShellBootstrapLaunch('Write-Output ok').env[POWERSHELL_BOOTSTRAP_ENV]).toBe(
        'Remove-Item Function:__DolphinPsBootstrap\nWrite-Output ok'
      )
    })

    it('budgets the env var below the Windows per-variable ceiling', () => {
      expect(fitsPowerShellBootstrapEnvBudget('x'.repeat(29_000))).toBe(true)
      expect(fitsPowerShellBootstrapEnvBudget('x'.repeat(30_000))).toBe(false)
    })
  })

  // Why pinned: any delivery shape must still hand PowerShell this payload byte for
  // byte -- comments, quotes, `$` and newlines included -- and never on argv.
  describe.each([
    [
      'daemon shell-ready',
      () => {
        const config = getShellLaunchConfig('powershell.exe', STARTUP_COMMAND_FEATURES)
        return { args: config.args, env: config.env }
      }
    ],
    [
      'local shell-ready',
      () => {
        const config = getLocalShellLaunchConfig('pwsh', STARTUP_COMMAND_FEATURES)
        return { args: config.args, env: config.env }
      }
    ],
    [
      'windows shell args',
      () => {
        const launch = resolveWindowsShellLaunchArgs('pwsh.exe', 'C:\\repo', 'C:\\repo')
        return { args: launch.shellArgs, env: launch.shellEnv }
      }
    ]
  ])('%s PowerShell launch', (_name, getLaunch) => {
    it('delivers the bootstrap unmangled', () => {
      const { args, env } = getLaunch()
      const delivered = readPowerShellBootstrapScript(args, env)

      expect(args).not.toContain('-EncodedCommand')
      expect(args).not.toContain('-ExecutionPolicy')
      expect(delivered).toContain(`\n${getPowerShellOsc133Bootstrap()}`)
    })
  })
})
