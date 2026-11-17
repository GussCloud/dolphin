import { describe, expect, it } from 'vitest'
import { TelegramActionRoutes } from './telegram-action-routes'
import { TelegramReplyRoutes } from './telegram-reply-routes'

function makeRoutes(capacity: number) {
  let next = 0
  const holder: { actions?: TelegramActionRoutes } = {}
  const routes = new TelegramReplyRoutes(
    capacity,
    () => `Route${String((next += 1)).padStart(3, '0')}`,
    (routeId) => holder.actions?.forget(routeId)
  )
  const actions = new TelegramActionRoutes(() => routes)
  holder.actions = actions
  return { routes, actions }
}

const handler = { handleCallback: async () => ({ ok: true as const }) }

describe('TelegramActionRoutes', () => {
  it('drops the handler with its route on dispose', () => {
    const { routes, actions } = makeRoutes(10)
    const { route, dispose } = actions.create(handler)
    expect(actions.handlerFor(route.routeId)).toBe(handler)
    dispose()
    expect(actions.handlerFor(route.routeId)).toBeUndefined()
    expect(routes.get(route.routeId)).toBeUndefined()
  })

  it('drops the handler when the registry evicts its route', () => {
    const { routes, actions } = makeRoutes(1)
    const { route } = actions.create(handler)
    routes.register({ paneKey: 'pane-2' })
    expect(routes.get(route.routeId)).toBeUndefined()
    expect(actions.handlerFor(route.routeId)).toBeUndefined()
  })
})
