import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { encodePowerShellCommand } from './powershell-osc133-bootstrap'
import { readPowerShellBootstrapScript } from './powershell-osc133-bootstrap.test-fixture'
import { resolveWindowsShellLaunchArgs } from './providers/windows-shell-args'

const WINDOWS_POWERSHELLS = ['powershell.exe', 'pwsh.exe'] as const
const PROFILE_CODEX_HOME = 'C:\\Profile Custom\\codex'
const MANAGED_CODEX_HOME = 'C:\\Dolphin Managed\\codex-runtime-home'

for (const shell of WINDOWS_POWERSHELLS) {
  describe.runIf(isAvailable(shell))(`${shell} managed home bootstrap`, () => {
    it.each(['FullLanguage', 'ConstrainedLanguage'] as const)(
      'restores CODEX_HOME and continues startup in %s mode',
      (languageMode) => {
        const cwd = mkdtempSync(join(tmpdir(), 'dolphin-powershell-clm-'))
        try {
          expect(runBootstrap(shell, languageMode, cwd)).toContain(
            `mode=${languageMode};codexHome=${MANAGED_CODEX_HOME};dolphinHome=${MANAGED_CODEX_HOME};startupCount=2;cwd=${cwd};bootstrapEnvRemoved=True;bootstrapFunctionLeft=False;errors=0`
          )
        } finally {
          rmSync(cwd, { recursive: true, force: true })
        }
      }
    )
  })
}

function runBootstrap(
  shell: (typeof WINDOWS_POWERSHELLS)[number],
  languageMode: 'FullLanguage' | 'ConstrainedLanguage',
  cwd: string
): string {
  const launch = resolveWindowsShellLaunchArgs(
    shell,
    cwd,
    process.env.USERPROFILE ?? cwd,
    undefined,
    '$env:DOLPHIN_TEST_STARTUP_COUNT = 1 + [int]$env:DOLPHIN_TEST_STARTUP_COUNT'
  )
  expect(launch.startupCommandDeliveredInShellArgs).toBe(true)
  readPowerShellBootstrapScript(launch.shellArgs, launch.shellEnv)
  const stub = launch.shellArgs.at(-1)
  expect(stub).toBeTruthy()

  return execFileSync(
    shell,
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', harness],
    {
      encoding: 'utf8',
      env: {
        ...process.env,
        CODEX_HOME: PROFILE_CODEX_HOME,
        DOLPHIN_CODEX_HOME: MANAGED_CODEX_HOME,
        ...launch.shellEnv,
        DOLPHIN_TEST_STUB: stub,
        DOLPHIN_TEST_LANGUAGE_MODE: languageMode
      },
      windowsHide: true
    }
  )
}

function isAvailable(shell: (typeof WINDOWS_POWERSHELLS)[number]): boolean {
  if (process.platform !== 'win32') {
    return false
  }
  try {
    execFileSync(shell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', '$null'], {
      stdio: 'ignore',
      windowsHide: true
    })
    return true
  } catch {
    return false
  }
}

const harness = encodePowerShellCommand(`
$initialState = [System.Management.Automation.Runspaces.InitialSessionState]::CreateDefault()
$initialState.LanguageMode = $env:DOLPHIN_TEST_LANGUAGE_MODE
$runspace = [System.Management.Automation.Runspaces.RunspaceFactory]::CreateRunspace($initialState)
$runspace.Open()
$runner = [System.Management.Automation.PowerShell]::Create()
$runner.Runspace = $runspace
$bootstrap = $env:DOLPHIN_PS_BOOTSTRAP
# Run the real argv stub, as the PTY would, so CLM covers the stub's own commands too.
$null = $runner.AddScript($env:DOLPHIN_TEST_STUB).Invoke()
$runner.Commands.Clear()
$bootstrapEnvRemoved = $null -eq $env:DOLPHIN_PS_BOOTSTRAP
$env:DOLPHIN_PS_BOOTSTRAP = $bootstrap
$null = $runner.AddScript($env:DOLPHIN_TEST_STUB).Invoke()
$runner.Commands.Clear()
$errors = $runner.Streams.Error.Count
$state = $runner.AddScript(
  '"mode=$($ExecutionContext.SessionState.LanguageMode);codexHome=$env:CODEX_HOME;dolphinHome=$env:DOLPHIN_CODEX_HOME;startupCount=$env:DOLPHIN_TEST_STARTUP_COUNT;cwd=$($PWD.Path)"'
).Invoke()
$runner.Commands.Clear()
$functionLeft = $runner.AddScript('Test-Path Function:__DolphinPsBootstrap').Invoke()
"$state;bootstrapEnvRemoved=$bootstrapEnvRemoved;bootstrapFunctionLeft=$functionLeft;errors=$errors"
$runner.Dispose()
$runspace.Dispose()
`)
