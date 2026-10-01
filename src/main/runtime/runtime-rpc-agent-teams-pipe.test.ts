import { mkdtempSync } from 'node:fs'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { DolphinRuntimeService } from './dolphin-runtime'
import * as runtimeMetadataModule from './runtime-metadata'
import { DolphinRuntimeRpcServer } from './runtime-rpc'

function sendLine(endpoint: string, line: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = connect(endpoint)
    let buffer = ''
    socket.setEncoding('utf8')
    socket.on('error', reject)
    socket.on('data', (chunk: string) => {
      buffer += chunk
      if (buffer.includes('\n')) {
        socket.end()
        resolve(buffer.trim())
      }
    })
    socket.write(`${line}\n`)
  })
}

describe.runIf(process.platform === 'win32')('runtime RPC Agent Teams pipe', () => {
  it('publishes the pipe while running and withdraws it on stop', async () => {
    const runtime = new DolphinRuntimeService()
    const setEndpoint = vi.spyOn(runtime, 'setClaudeAgentTeamsPipeEndpoint')
    const server = new DolphinRuntimeRpcServer({
      runtime,
      userDataPath: mkdtempSync(join(tmpdir(), 'dolphin-agent-teams-pipe-')),
      enableAgentTeamsPipe: true
    })
    await server.start()
    try {
      const endpoint = setEndpoint.mock.calls[0]?.[0]
      expect(endpoint).toMatch(/^\\\\\.\\pipe\\dolphin-agent-teams-[0-9]+-[0-9a-f]{32}$/)
      const reply = JSON.parse(
        await sendLine(endpoint!, JSON.stringify({ id: 'x', method: 'status.get', params: {} }))
      )
      expect(reply).toMatchObject({ id: 'x', exitCode: 1, stderr: expect.stringMatching(/^tmux:/) })
    } finally {
      await server.stop()
    }
    expect(setEndpoint).toHaveBeenLastCalledWith(null)
  })

  it('withdraws the pipe when metadata publication fails during startup', async () => {
    const runtime = new DolphinRuntimeService()
    const setEndpoint = vi.spyOn(runtime, 'setClaudeAgentTeamsPipeEndpoint')
    const writeMetadata = vi
      .spyOn(runtimeMetadataModule, 'writeRuntimeMetadata')
      .mockImplementationOnce(() => {
        throw new Error('write failed')
      })
    const server = new DolphinRuntimeRpcServer({
      runtime,
      userDataPath: mkdtempSync(join(tmpdir(), 'dolphin-agent-teams-pipe-')),
      enableAgentTeamsPipe: true
    })
    try {
      await expect(server.start()).rejects.toThrow('write failed')
      expect(setEndpoint.mock.calls[0]?.[0]).toMatch(/dolphin-agent-teams-/)
      expect(setEndpoint).toHaveBeenLastCalledWith(null)
    } finally {
      writeMetadata.mockRestore()
    }
  })

  it('starts no pipe unless the host runtime opts in', async () => {
    const runtime = new DolphinRuntimeService()
    const setEndpoint = vi.spyOn(runtime, 'setClaudeAgentTeamsPipeEndpoint')
    const server = new DolphinRuntimeRpcServer({
      runtime,
      userDataPath: mkdtempSync(join(tmpdir(), 'dolphin-agent-teams-pipe-'))
    })
    await server.start()
    await server.stop()
    expect(setEndpoint).not.toHaveBeenCalled()
  })
})
