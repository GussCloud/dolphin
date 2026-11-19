import { mkdtemp, open, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { DISPATCHER_CONTROL_QUEUE_MAX_BYTES } from './dispatcher-writer-admission'
import { prepareRemoteDesignCliInput } from './remote-design-cli-input'
import { shouldReadRemoteCliStdin } from './remote-cli-stdin'

const createdPaths: string[] = []

async function remoteFolder(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'dolphin-remote-design-'))
  createdPaths.push(path)
  return path
}

afterEach(async () => {
  await Promise.all(
    createdPaths.splice(0).map((path) => rm(path, { recursive: true, force: true }))
  )
})

describe('prepareRemoteDesignCliInput', () => {
  it('reads the canvas on the SSH host and rewrites the flag to stdin', async () => {
    const cwd = await remoteFolder()
    await writeFile(join(cwd, 'canvas.json'), '{"groups":[]}', 'utf8')

    await expect(
      prepareRemoteDesignCliInput(
        ['design', 'canvas-set', '--id', 'd1', '--file', 'canvas.json', '--json'],
        cwd
      )
    ).resolves.toEqual({
      argv: ['design', 'canvas-set', '--id', 'd1', '--file', '-', '--json'],
      stdin: '{"groups":[]}'
    })
    await expect(
      prepareRemoteDesignCliInput(
        ['design', 'canvas-set', `--file=${join(cwd, 'canvas.json')}`, '--id', 'd1'],
        '/elsewhere'
      )
    ).resolves.toEqual({
      argv: ['design', 'canvas-set', '--file=-', '--id', 'd1'],
      stdin: '{"groups":[]}'
    })
  })

  it('reads decide, reply, revise-decision and complete files on the SSH host too', async () => {
    const cwd = await remoteFolder()
    await writeFile(join(cwd, 'ask.json'), '{"decisions":[]}', 'utf8')
    for (const command of ['decide', 'reply', 'revise-decision', 'complete']) {
      await expect(
        prepareRemoteDesignCliInput(['design', command, '--id', 'd1', '--file', 'ask.json'], cwd)
      ).resolves.toEqual({
        argv: ['design', command, '--id', 'd1', '--file', '-'],
        stdin: '{"decisions":[]}'
      })
      expect(shouldReadRemoteCliStdin(['design', command, '--id', 'd1', '--file', '-'])).toBe(true)
      expect(shouldReadRemoteCliStdin(['design', command, '--file=-'])).toBe(true)
    }
    await expect(
      prepareRemoteDesignCliInput(['design', 'inbox', '--id', 'd1', '--file', 'ask.json'], cwd)
    ).resolves.toBeNull()
    expect(shouldReadRemoteCliStdin(['design', 'ack', '--items', 'a', '--file', '-'])).toBe(false)
  })

  it('leaves other commands, help and stdin input untouched', async () => {
    const cwd = await remoteFolder()
    await expect(
      prepareRemoteDesignCliInput(['design', 'show', '--file', 'x.json'], cwd)
    ).resolves.toBeNull()
    await expect(
      prepareRemoteDesignCliInput(['design', 'canvas-set', '--file', 'x.json', '--help'], cwd)
    ).resolves.toBeNull()
    await expect(
      prepareRemoteDesignCliInput(['design', 'canvas-set', '--file', '-'], cwd)
    ).resolves.toBeNull()
    expect(shouldReadRemoteCliStdin(['design', 'canvas-set', '--id', 'd1', '--file', '-'])).toBe(
      true
    )
    expect(shouldReadRemoteCliStdin(['design', 'canvas-set', '--file', 'c.json'])).toBe(false)
  })

  it('names a missing file and refuses one too large for the transport', async () => {
    const cwd = await remoteFolder()
    await expect(
      prepareRemoteDesignCliInput(['design', 'canvas-set', '--file', 'missing.json'], cwd)
    ).rejects.toThrow(/Cannot read --file .*missing\.json/)
    const handle = await open(join(cwd, 'big.json'), 'w')
    await handle.truncate(DISPATCHER_CONTROL_QUEUE_MAX_BYTES + 1)
    await handle.close()
    await expect(
      prepareRemoteDesignCliInput(['design', 'canvas-set', '--file', 'big.json'], cwd)
    ).rejects.toThrow(/too large/)
  })
})
