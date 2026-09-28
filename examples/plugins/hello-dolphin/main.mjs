// Sample Dolphin plugin worker entry. Runs inside the out-of-process plugin
// worker (plain Node, no Electron), forked lazily on the first trigger. The
// default export receives the `dolphin` API: command registration, event
// handlers, and the capability-gated host API.
export default function activate(dolphin) {
  dolphin.commands.register('hello-ping', async (args) => {
    const stored = await dolphin.host.call('storage.get', { key: 'pings' })
    const count = (typeof stored?.value === 'number' ? stored.value : 0) + 1
    await dolphin.host.call('storage.set', { key: 'pings', value: count })
    return { pong: true, count, args: args ?? null }
  })

  dolphin.events.on('worktree.created', async (payload) => {
    dolphin.log(`worktree created: ${payload.worktreeId} at ${payload.path}`)
    await dolphin.host.call('notifications.show', {
      title: 'Worktree created',
      body: payload.path
    })
  })

  dolphin.events.on('agent.status.changed', (payload) => {
    dolphin.log(`agent status: ${payload.state} in ${payload.worktreeId ?? 'unknown worktree'}`)
  })
}
