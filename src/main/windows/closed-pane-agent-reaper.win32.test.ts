import { createServer, request, type Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runProcess } from '../../shared/child-process/run-process'
import { windowsSystem32Binary } from '../../shared/child-process/windows-system-binary'
import { parseNetstatClientPid, resolveOrphanAgentRoot } from './closed-pane-agent-reaper'
import { readWindowsProcessIdentityTableFresh } from './windows-process-table'

/**
 * The reaper names a hook's process from the netstat row of its open loopback request, so
 * this reads the real `netstat -ano -p tcp` while a request is held, as the hook server does.
 * Runs only on win32; skipped elsewhere.
 */
const describeOnWindows = process.platform === 'win32' ? describe : describe.skip

describeOnWindows('closed-pane agent reaper on Windows', () => {
  let server: Server
  let release: () => void = () => {}
  let held: Promise<number> = Promise.resolve(0)

  beforeAll(async () => {
    let onHeld: (clientPort: number) => void = () => {}
    held = new Promise((resolve) => {
      onHeld = resolve
    })
    server = createServer((req, res) => {
      onHeld(req.socket.remotePort ?? 0)
      release = () => res.end()
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  })

  afterAll(async () => {
    release()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('finds this process as the client of a held loopback request', async () => {
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('test server has no TCP address')
    }
    const serverPort = address.port
    const pending = new Promise<void>((resolve) => {
      request({ host: '127.0.0.1', port: serverPort, method: 'POST' }, (res) => {
        res.resume()
        res.on('end', resolve)
      }).end('{}')
    })
    const clientPort = await held

    const netstat = await runProcess({
      program: windowsSystem32Binary('netstat.exe'),
      args: ['-ano', '-p', 'tcp'],
      timeoutMs: 10_000
    })
    release()
    await pending

    expect(parseNetstatClientPid(netstat.stdout, clientPort, serverPort)).toBe(process.pid)
  })

  it('refuses this live test process, whose parent still runs', async () => {
    const table = await readWindowsProcessIdentityTableFresh()
    expect(resolveOrphanAgentRoot(table, process.pid, 0)).toBeNull()
  })
})
