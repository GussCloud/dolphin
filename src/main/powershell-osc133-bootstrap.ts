import { getPowerShellOmpShellWrapper } from './pty/omp-shell-wrapper'
import { getPowerShellCodexShellLaunchPreflight } from './pty/codex-shell-launch-preflight'
export { encodePowerShellCommand } from '../shared/powershell-command-encoding'

/**
 * Why every PTY site delivers this payload through an environment variable.
 *
 * Windows Defender holds `CreateProcessW` for ~5s on a `powershell.exe` whose command
 * line carries a script, whether as `-EncodedCommand` or inline `-Command`, and it
 * caches the verdict per exact command line. This payload is not static --
 * providers/windows-shell-args.ts appends the PTY cwd and the queued startup command
 * -- so every terminal paid the full hold. A constant stub that reads the script from
 * {@link POWERSHELL_BOOTSTRAP_ENV} measured 35-57ms on the same host.
 *
 * Why not dot-source a temp `.ps1` like VS Code: dot-sourcing is execution-policy
 * gated; inline text is not. Measured on Windows 11:
 *
 *   policy        dot-source .ps1   -Command inline   -EncodedCommand
 *   Restricted    blocked           runs              runs
 *   AllSigned     blocked           runs              runs
 *   RemoteSigned  runs              runs              runs
 *
 * A function built from the env text is inline text, so it keeps running on the
 * locked-down fleets where a file would silently drop OSC 133. The env channel is
 * also quoting-proof, which #7978 found node-pty's argv escaping is not.
 */
const POWERSHELL_OSC133_BOOTSTRAP = `# Dolphin OSC 133 shell integration for PowerShell.
# Profiles have already loaded normally by the time this bootstrap runs.
# Restore managed ownership before the shell-integration compatibility guard.
if ($env:DOLPHIN_OPENCODE_CONFIG_DIR) { $env:OPENCODE_CONFIG_DIR = $env:DOLPHIN_OPENCODE_CONFIG_DIR }
if ($env:DOLPHIN_MIMOCODE_HOME) { $env:MIMOCODE_HOME = $env:DOLPHIN_MIMOCODE_HOME }
if ($env:DOLPHIN_CODEX_HOME) { $env:CODEX_HOME = $env:DOLPHIN_CODEX_HOME }

if ($ExecutionContext.SessionState.LanguageMode -eq "FullLanguage" -and
    ((-not (Test-Path variable:global:__DolphinOsc133State)) -or
     $null -eq $Global:__DolphinOsc133State.OriginalPrompt)) {
    # Wrap the user's final prompt/readline state; do not source profiles here.

    # Preserve Windows CJK output by keeping ConPTY on UTF-8 without bypassing
    # profile loading or execution-policy checks.
    try {
        [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
        [Console]::InputEncoding = [System.Text.UTF8Encoding]::new()
        $OutputEncoding = [Console]::OutputEncoding
    } catch { Write-Error $_ -ErrorAction Continue }

${getPowerShellOmpShellWrapper()}
${getPowerShellCodexShellLaunchPreflight()}

    $Global:__DolphinOsc133State = @{
        OriginalPrompt = $function:prompt
        OriginalReadLine = $function:PSConsoleHostReadLine
        HasSeenPrompt = $false
        HasPSReadLine = $null -ne (Get-Module -Name PSReadLine)
        Esc = [char]27
        Bel = [char]7
    }

    function Global:prompt {
        # Capture FIRST; any other expression can clobber PowerShell's success bit.
        $fakeExitCode = [int](!$global:?)
        Set-StrictMode -Off
        $result = ""

        # Emit D from prompt, not readline state. Some profile setups bypass
        # PSConsoleHostReadLine; the consumer only needs completion.
        if ($Global:__DolphinOsc133State.HasSeenPrompt) {
            $result += "$($Global:__DolphinOsc133State.Esc)]133;D;$fakeExitCode$($Global:__DolphinOsc133State.Bel)"
        }
        $Global:__DolphinOsc133State.HasSeenPrompt = $true

        $result += "$($Global:__DolphinOsc133State.Esc)]133;A$($Global:__DolphinOsc133State.Bel)"
        # Preserve the previous success/failure value for prompts that inspect it.
        if ($fakeExitCode -ne 0) { Write-Error "failure" -ea ignore }
        $result += $Global:__DolphinOsc133State.OriginalPrompt.Invoke()
        $result += "$($Global:__DolphinOsc133State.Esc)]133;B$($Global:__DolphinOsc133State.Bel)"
        $result
    }

    if ($Global:__DolphinOsc133State.HasPSReadLine -and
        $null -ne $Global:__DolphinOsc133State.OriginalReadLine) {
        function Global:PSConsoleHostReadLine {
            $commandLine = $Global:__DolphinOsc133State.OriginalReadLine.Invoke()
            [Console]::Write("$($Global:__DolphinOsc133State.Esc)]133;C$($Global:__DolphinOsc133State.Bel)")
            return $commandLine
        }
    }
}
`

export function getPowerShellOsc133Bootstrap(): string {
  return POWERSHELL_OSC133_BOOTSTRAP
}

/** Carries the PTY bootstrap script; profiles still see it, but the stub deletes it before children started after the stub. */
export const POWERSHELL_BOOTSTRAP_ENV = 'DOLPHIN_PS_BOOTSTRAP'

// Why under 32,767: that is Windows' per-variable ceiling, name and `=` included.
const POWERSHELL_BOOTSTRAP_ENV_MAX_CHARS = 30_000

const POWERSHELL_BOOTSTRAP_FUNCTION = 'Function:__DolphinPsBootstrap'

// Why constant and quote-free: Defender caches its verdict per exact command line, and
// node-pty backslash-escapes argv quotes. Why a function, not [scriptblock]::Create:
// ConstrainedLanguage blocks that method call but allows Set-Item on Function:.
export const POWERSHELL_BOOTSTRAP_ENV_STUB = `if ($env:${POWERSHELL_BOOTSTRAP_ENV}) { Set-Item ${POWERSHELL_BOOTSTRAP_FUNCTION} $env:${POWERSHELL_BOOTSTRAP_ENV}; Remove-Item Env:${POWERSHELL_BOOTSTRAP_ENV}; . __DolphinPsBootstrap }`

// Why first: the function would otherwise outlive a long-running startup command.
const POWERSHELL_BOOTSTRAP_FUNCTION_CLEANUP = `Remove-Item ${POWERSHELL_BOOTSTRAP_FUNCTION}\n`

export type PowerShellBootstrapLaunch = {
  args: string[]
  /** Entries the spawn env must carry for these args to run the script. */
  env: Record<string, string>
}

/** False when appending to `script` would push the env var past Windows' per-variable ceiling. */
export function fitsPowerShellBootstrapEnvBudget(script: string): boolean {
  return (
    POWERSHELL_BOOTSTRAP_FUNCTION_CLEANUP.length + script.length <=
    POWERSHELL_BOOTSTRAP_ENV_MAX_CHARS
  )
}

/** Args + env that dot-source `script` into the interactive shell after profiles load. */
export function buildPowerShellBootstrapLaunch(script: string): PowerShellBootstrapLaunch {
  return {
    args: ['-NoLogo', '-NoExit', '-Command', POWERSHELL_BOOTSTRAP_ENV_STUB],
    env: { [POWERSHELL_BOOTSTRAP_ENV]: `${POWERSHELL_BOOTSTRAP_FUNCTION_CLEANUP}${script}` }
  }
}

export function isPowerShellExecutableName(shellName: string): boolean {
  const normalized = shellName.toLowerCase()
  return (
    normalized === 'pwsh' ||
    normalized === 'pwsh.exe' ||
    normalized === 'powershell' ||
    normalized === 'powershell.exe'
  )
}
