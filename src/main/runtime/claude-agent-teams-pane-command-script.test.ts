import { existsSync } from 'node:fs'
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { runProcess } from '../../shared/child-process/run-process'
import { resolveGitBashPath } from '../git-bash'
import {
  buildPaneCommandScript,
  quotePosixShellWord,
  sweepStalePaneCommandScripts,
  toGitBashPath,
  writePaneCommandScript
} from './claude-agent-teams-pane-command-script'

let dir: string

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'agent-teams-pane-cmds-'))
})

afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('toGitBashPath', () => {
  it('maps drive paths to Git Bash mount paths', () => {
    expect(toGitBashPath('C:\\Users\\Me\\.dolphin\\x.sh')).toBe('/c/Users/Me/.dolphin/x.sh')
    expect(toGitBashPath('d:/work dir/x.sh')).toBe('/d/work dir/x.sh')
  })

  it('passes POSIX paths through and refuses UNC and relative paths', () => {
    expect(toGitBashPath('/tmp/x.sh')).toBe('/tmp/x.sh')
    expect(toGitBashPath('\\\\server\\share\\x.sh')).toBeNull()
    expect(toGitBashPath('x.sh')).toBeNull()
  })
})

describe('quotePosixShellWord', () => {
  it('single-quotes and escapes embedded quotes', () => {
    expect(quotePosixShellWord("/c/Users/O'Neil/x.sh")).toBe("'/c/Users/O'\\''Neil/x.sh'")
  })
})

describe('writePaneCommandScript', () => {
  it('writes a self-deleting script and types only a short source line', async () => {
    const command = "cd 'C:\\repo' && env SECRET='s3cr3t' 'C:\\claude.exe' --agent-id a"
    const written = await writePaneCommandScript(dir, command)
    const gitBashPath = toGitBashPath(written.filePath)!

    expect(written.typedCommand).toBe(`. '${gitBashPath}'`)
    expect(written.typedCommand).not.toContain('s3cr3t')
    await expect(readFile(written.filePath, 'utf8')).resolves.toBe(
      buildPaneCommandScript(gitBashPath, command)
    )
    await expect(readdir(dir)).resolves.toHaveLength(1)
  })
})

describe('sweepStalePaneCommandScripts', () => {
  it('removes only stale scripts', async () => {
    const stale = join(dir, 'stale.sh')
    const fresh = join(dir, 'fresh.sh')
    const other = join(dir, 'keep.txt')
    await Promise.all([writeFile(stale, ''), writeFile(fresh, ''), writeFile(other, '')])
    const old = new Date(Date.now() - 60 * 60 * 1000)
    await Promise.all([utimes(stale, old, old), utimes(other, old, old)])

    await sweepStalePaneCommandScripts(dir, Date.now())

    expect(existsSync(stale)).toBe(false)
    expect(existsSync(fresh)).toBe(true)
    expect(existsSync(other)).toBe(true)
  })
})

describe('sourced pane command script', () => {
  const bash =
    process.platform === 'win32'
      ? resolveGitBashPath()
      : existsSync('/bin/bash')
        ? '/bin/bash'
        : null
  const shellPath = (filePath: string): string =>
    process.platform === 'win32' ? toGitBashPath(filePath)! : filePath

  async function source(command: string): Promise<{ stdout: string; code: number | null }> {
    const filePath = join(dir, 'pane.sh')
    await writeFile(filePath, buildPaneCommandScript(shellPath(filePath), command))
    const result = await runProcess({
      program: bash!,
      args: ['-c', `. ${quotePosixShellWord(shellPath(filePath))}; echo shell-kept-running`],
      timeoutMs: 30_000
    })
    expect(existsSync(filePath)).toBe(false)
    return { stdout: result.stdout, code: result.code }
  }

  it.runIf(bash)('deletes itself, runs the whole command, then ends the shell', async () => {
    const result = await source("echo first && echo 'second line'")

    expect(result.stdout).toBe('first\nsecond line\n')
    expect(result.code).toBe(0)
  })

  it.runIf(bash)('ends the shell with the command status', async () => {
    const result = await source("cd '/definitely/missing' && echo unreachable")

    expect(result.stdout).toBe('')
    expect(result.code).not.toBe(0)
  })
})
