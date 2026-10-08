import { describe, expect, it } from 'vitest'
import { encodeTelegramCallbackData, TelegramReplyRoutes } from './telegram-reply-routes'

describe('TelegramReplyRoutes', () => {
  it('issues short alphanumeric ids and parses callback data back to the route', () => {
    const routes = new TelegramReplyRoutes()
    const route = routes.register({ paneKey: 'p1', connectionId: 'ssh-1' })
    expect(route.routeId).toMatch(/^[A-Za-z0-9]{8}$/)
    expect(routes.parseCallbackData(`${route.routeId}:opt:1`)).toEqual({ route, action: 'opt:1' })
    expect(routes.parseCallbackData('bad id:x')).toBeNull()
    expect(routes.parseCallbackData('nocolon')).toBeNull()
  })

  it('maps sent messages to routes and finds the newest per chat', () => {
    const routes = new TelegramReplyRoutes()
    const route = routes.register({ paneKey: 'p1' })
    routes.bindMessage(1, 10, route.routeId)
    routes.bindMessage(1, 12, route.routeId)
    routes.bindMessage(2, 11, route.routeId)
    expect(routes.resolveMessage(1, 10)).toBe(route)
    expect(routes.latestMessageFor(route.routeId, 1)).toBe(12)
    expect(routes.latestMessageFor(route.routeId, 3)).toBeUndefined()
  })

  it('evicts the oldest routes and their message bindings past capacity', () => {
    let n = 0
    const routes = new TelegramReplyRoutes(2, () => `Route00${n++}`)
    const first = routes.register({ paneKey: 'p1' })
    routes.bindMessage(1, 1, first.routeId)
    routes.register({ paneKey: 'p2' })
    routes.register({ paneKey: 'p3' })
    expect(routes.get(first.routeId)).toBeUndefined()
    expect(routes.resolveMessage(1, 1)).toBeUndefined()
  })

  it('refuses callback data over 64 bytes', () => {
    expect(encodeTelegramCallbackData('Abcdef12', 'y')).toBe('Abcdef12:y')
    expect(() => encodeTelegramCallbackData('Abcdef12', 'x'.repeat(60))).toThrow(/64 bytes/)
  })
})
