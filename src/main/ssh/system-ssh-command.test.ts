import type * as ChildProcessModule from 'node:child_process'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }))
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof ChildProcessModule>()),
  spawn: spawnMock
}))
vi.mock('./system-ssh-binary', () => ({ findSystemSsh: () => '/usr/bin/ssh' }))

import { spawnSystemSshCommand } from './system-ssh-command'

const target = {
  id: 'target-1',
  label: 'host',
  host: 'example.invalid',
  port: 22,
  username: 'user'
}

// Like Windows OpenSSH: the child exits only once its stdin reaches EOF, after stdout drains.
function fakeSshProcessExitingOnStdinEnd(stdout: string) {
  const proc = Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    kill: vi.fn()
  })
  spawnMock.mockReturnValue(proc)
  proc.stdin.resume()
  proc.stdout.once('end', () => proc.emit('close', 0))
  proc.stdin.on('finish', () => proc.stdout.end(stdout))
  return proc
}

function readUntilClose(channel: EventEmitter): Promise<string> {
  return new Promise((resolve) => {
    let received = ''
    channel.on('data', (data: Buffer) => {
      received += data.toString()
    })
    channel.once('close', () => resolve(received))
  })
}

beforeEach(() => {
  spawnMock.mockReset()
})

describe('spawnSystemSshCommand stdin', () => {
  it('ends the ssh child input for a command that sends none', async () => {
    const proc = fakeSshProcessExitingOnStdinEnd('answer')

    const channel = spawnSystemSshCommand(target, 'probe', { closeStdin: true })

    await expect(readUntilClose(channel)).resolves.toBe('answer')
    expect(proc.stdin.writableFinished).toBe(true)
  })

  it('keeps the input open for commands that stream to the remote', async () => {
    const proc = fakeSshProcessExitingOnStdinEnd('')

    spawnSystemSshCommand(target, 'cat > file')
    await new Promise((resolve) => setImmediate(resolve))

    expect(proc.stdin.writableEnded).toBe(false)
  })
})
