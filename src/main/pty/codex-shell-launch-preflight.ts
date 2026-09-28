import { accessSync, constants, statSync } from 'node:fs'
import { join } from 'node:path'
import { DEV_CLI_COMMAND_NAME as DEV_COMMAND_NAME } from '../../shared/cli-command-names'
import { getBundledLauncherPath } from '../cli/bundled-cli-launcher-path'

const DEV_LAUNCHER_DIR = ['cli', 'bin']

export type CodexShellLaunchPreflightCommandOptions = {
  hooksEnabled: boolean
  isPackaged: boolean
  isWsl?: boolean
  managedHomePath: string | null
  /** Where the dev launcher is written; `join(userDataPath, 'cli', 'bin')` is also what managed dev PTYs prepend to PATH. */
  userDataPath: string
  /** Packaged app resources root; the bundled launcher lives under it. */
  resourcesPath?: string | null
  /** Test seam. */
  platform?: NodeJS.Platform
}

/** Absolute path of the Dolphin CLI the preflight must execute, or null to skip it.
 *
 *  Why absolute: the value rides in DOLPHIN_CODEX_LAUNCH_PREFLIGHT and is invoked
 *  from the codex() wrapper, which shell-ready emits *after* the user's profile
 *  scripts run. Those scripts routinely rewrite PATH, so an unqualified name
 *  would be resolved against a PATH Dolphin neither controls nor can predict —
 *  handing Dolphin's managed Codex environment to an unidentified program. When no
 *  path verifies, skipping the preflight is the predictable degradation. */
export function resolveCodexShellLaunchPreflightCommand(
  options: CodexShellLaunchPreflightCommandOptions
): string | null {
  if (!options.hooksEnabled || !options.managedHomePath) {
    return null
  }
  const platform = options.platform ?? process.platform
  const candidate = options.isPackaged
    ? options.resourcesPath
      ? getBundledLauncherPath(platform, options.resourcesPath)
      : null
    : join(
        options.userDataPath,
        ...DEV_LAUNCHER_DIR,
        platform === 'win32' ? `${DEV_COMMAND_NAME}.cmd` : DEV_COMMAND_NAME
      )
  if (!candidate || !isExecutableFileOnDisk(candidate, platform)) {
    return null
  }
  if (!options.isWsl) {
    return candidate
  }
  // Why: WSLENV /p translates the verified Windows launcher with the distro's configured automount root.
  return platform === 'win32' && options.isPackaged ? candidate : null
}

function isExecutableFileOnDisk(path: string, platform: NodeJS.Platform): boolean {
  try {
    if (!statSync(path).isFile()) {
      return false
    }
    // Why: Windows has no exec bit, so a readable launcher file is the strongest signal available.
    accessSync(path, platform === 'win32' ? constants.R_OK : constants.X_OK)
    return true
  } catch {
    return false
  }
}

export function getPosixCodexShellLaunchPreflight(): string {
  return `# Why: a typed alias expands inside the shell, after pane launch prep.
# Why unalias inside the substitution: an alias named codex makes command -v
# report the alias text, and the subshell leaves the user's own alias intact.
# Why || : twice — zsh alone aborts inside the substitution, but every shell's
# assignment adopts its exit status, so an absent codex trips set -e in bash too.
__dolphin_codex_binary="$(unalias codex 2>/dev/null || :; command -v codex 2>/dev/null || :)"
if [[ -n "\${DOLPHIN_CODEX_LAUNCH_PREFLIGHT:-}" && -x "\${DOLPHIN_CODEX_LAUNCH_PREFLIGHT}" && -n "\${__dolphin_codex_binary:-}" && -x "\${__dolphin_codex_binary}" ]]; then
  # Why the function reserved word: it suppresses alias expansion of the name,
  # which otherwise rewrites this header at parse time and aborts the whole file.
  function codex {
    "\${DOLPHIN_CODEX_LAUNCH_PREFLIGHT}" agent hooks prepare-codex >/dev/null 2>&1 || :
    command codex "$@"
  }
fi
unset __dolphin_codex_binary
`
}

export function getFishCodexShellLaunchPreflight(): string {
  return `# Why captured: an unquoted (type -t codex) expands to zero words when codex is
# absent, leaving "test = file" — fish then errors instead of failing closed.
# Quoting in place is not the fix; fish never substitutes inside double quotes.
set -l __dolphin_codex_type (type -t codex 2>/dev/null)
if test -x "$DOLPHIN_CODEX_LAUNCH_PREFLIGHT"; and test "$__dolphin_codex_type" = file
  function codex
    command "$DOLPHIN_CODEX_LAUNCH_PREFLIGHT" agent hooks prepare-codex >/dev/null 2>&1; or true
    command codex $argv
  end
end
set -e __dolphin_codex_type`
}

export function getPowerShellCodexShellLaunchPreflight(): string {
  return `$dolphinCodexCommand = Get-Command codex -ErrorAction SilentlyContinue | Select-Object -First 1
if ($env:DOLPHIN_CODEX_LAUNCH_PREFLIGHT -and $dolphinCodexCommand -and
    $dolphinCodexCommand.CommandType -in @("Application", "ExternalScript")) {
    function Global:codex {
        try {
            & $env:DOLPHIN_CODEX_LAUNCH_PREFLIGHT agent hooks prepare-codex *> $null
        } catch {
        }
        $dolphinCodexExecutable = Get-Command codex -CommandType Application,ExternalScript -ErrorAction SilentlyContinue | Select-Object -First 1
        if (-not $dolphinCodexExecutable) {
            Write-Error "codex executable not found"
            $global:LASTEXITCODE = 127
            return
        }
        & $dolphinCodexExecutable.Source @args
        $global:LASTEXITCODE = $LASTEXITCODE
    }
}
Remove-Variable dolphinCodexCommand -ErrorAction SilentlyContinue`
}
