import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import {
  RuntimeMobileNotificationController,
  type MobileNotificationEvent
} from './runtime-mobile-notification-controller'

const paths: string[] = []
afterEach(() => {
  paths.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true }))
})

function controllerAt(path: string): RuntimeMobileNotificationController {
  const controller = new RuntimeMobileNotificationController()
  controller.configureDismissalStore(path)
  return controller
}

// Reads rebuild ids for turns that never alerted; each forwarded one was a silent push and a store slot.
it('clears on the phone only alerts that reached it, including ones sent before a restart', async () => {
  const path = mkdtempSync(join(tmpdir(), 'dolphin-clear-delivered-'))
  paths.push(path)
  controllerAt(path).dispatch({
    type: 'notification',
    source: 'agent-task-complete',
    title: 'Done',
    body: '',
    notificationId: 'agent:sent'
  })
  // Let the async persist land before the restarted controller reads the file.
  await new Promise((resolve) => setTimeout(resolve, 100))

  const restarted = controllerAt(path)
  const events: MobileNotificationEvent[] = []
  restarted.onDispatched((event) => events.push(event))
  restarted.dismiss('agent:never-sent')
  restarted.dismiss('agent:sent')
  restarted.dismiss('agent:sent')
  expect(events.map((event) => [event.type, event.notificationId])).toEqual([
    ['dismiss', 'agent:sent']
  ])
})

it('still forwards a clear when no dismissal store is configured', () => {
  const controller = new RuntimeMobileNotificationController()
  const events: MobileNotificationEvent[] = []
  controller.onDispatched((event) => events.push(event))
  controller.dismiss('agent:unknown')
  expect(events.map((event) => event.type)).toEqual(['dismiss'])
})
