#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

const forkIdentity = createRequire(import.meta.url)('../../src/shared/fork-identity.json')

export function shouldReuseCompiledWindowsCliLauncher(
  outputPath,
  sourcePaths,
  { reuseCached = false } = {}
) {
  if (!existsSync(outputPath)) {
    return false
  }
  // Why reuseCached: Actions cache keys already hash the C# source, but restore
  // does not preserve mtimes, so a hit would look stale and recompile anyway.
  if (reuseCached) {
    return true
  }
  const outputMtimeMs = statSync(outputPath).mtimeMs
  return [sourcePaths].flat().every((sourcePath) => outputMtimeMs >= statSync(sourcePath).mtimeMs)
}

/** Every C# source of the launcher; csc compiles them into one image. */
export function windowsCliLauncherSourcePaths(projectRoot) {
  const sourceDirectory = join(projectRoot, 'native', 'windows-cli-launcher')
  return readdirSync(sourceDirectory)
    .filter((name) => name.endsWith('.cs'))
    .sort()
    .map((name) => join(sourceDirectory, name))
}

function launcherBuildDirectory(projectRoot) {
  return join(projectRoot, 'native', 'windows-cli-launcher', '.build')
}

function defaultOutputPath(projectRoot) {
  return join(launcherBuildDirectory(projectRoot), `${forkIdentity.cliCommandName}.exe`)
}

// Why: the same launcher switches to Claude Agent Teams tmux-shim mode when its file is named
// tmux.exe; building it under that name avoids copying our signed image at runtime (EDR T1036).
export function agentTeamsTmuxShimOutputPath(projectRoot) {
  return join(launcherBuildDirectory(projectRoot), 'agent-teams', 'tmux.exe')
}

function findFrameworkCompiler(env) {
  const windowsDirectory = env.WINDIR ?? env.SystemRoot
  if (!windowsDirectory) {
    return null
  }
  const candidates = [
    join(windowsDirectory, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe'),
    join(windowsDirectory, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
  ]
  return candidates.find((candidate) => existsSync(candidate)) ?? null
}

function readArg(name) {
  const index = process.argv.indexOf(name)
  return index !== -1 ? process.argv[index + 1] : undefined
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.platform !== 'win32') {
    // Why: electron-builder treats a skipped native build like success and can
    // continue toward a Windows package whose declared CLI launcher exe does not exist.
    throw new Error(
      'Windows CLI launcher compilation requires a Windows host; refusing to package without it.'
    )
  }

  const repoRoot = resolve(import.meta.dirname, '../..')
  const sourcePaths = windowsCliLauncherSourcePaths(repoRoot)
  const explicitOutput = readArg('--output')
  const outputPaths = explicitOutput
    ? [explicitOutput]
    : [defaultOutputPath(repoRoot), agentTeamsTmuxShimOutputPath(repoRoot)]
  const compilerPath = findFrameworkCompiler(process.env)

  if (!compilerPath) {
    throw new Error('Unable to find the .NET Framework C# compiler required for the CLI launcher.')
  }

  for (const outputPath of outputPaths) {
    mkdirSync(dirname(outputPath), { recursive: true })
    if (
      shouldReuseCompiledWindowsCliLauncher(outputPath, sourcePaths, {
        reuseCached: process.env.DOLPHIN_REUSE_WINDOWS_CLI_LAUNCHER === '1'
      })
    ) {
      console.log(`[native-build] reusing Windows CLI launcher at ${outputPath}`)
      continue
    }
    const result = spawnSync(
      compilerPath,
      [
        '/nologo',
        '/target:exe',
        '/optimize+',
        '/warnaserror+',
        `/out:${outputPath}`,
        ...sourcePaths
      ],
      { cwd: repoRoot, stdio: 'inherit' }
    )

    if (result.signal) {
      process.kill(process.pid, result.signal)
    }
    if (result.error) {
      throw result.error
    }
    if (result.status !== 0) {
      process.exit(result.status ?? 1)
    }
  }
}
