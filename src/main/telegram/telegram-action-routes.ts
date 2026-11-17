// Routes that own their button taps (not a pane), e.g. a "New code" button on a sign-in message.
import type { TelegramInboundHandler, TelegramPaneRoute } from './telegram-inbound'
import type { TelegramReplyRoutes } from './telegram-reply-routes'

export type TelegramActionHandler = Required<Pick<TelegramInboundHandler, 'handleCallback'>>

export class TelegramActionRoutes {
  private readonly handlers = new Map<string, TelegramActionHandler>()

  constructor(private readonly routes: () => TelegramReplyRoutes) {}

  /** The route lives until `dispose` or until the registry evicts it; either drops the handler. */
  create(handler: TelegramActionHandler): { route: TelegramPaneRoute; dispose: () => void } {
    const route = this.routes().register({ paneKey: '' })
    this.handlers.set(route.routeId, handler)
    return { route, dispose: () => this.routes().remove(route.routeId) }
  }

  handlerFor(routeId: string): TelegramActionHandler | undefined {
    return this.handlers.get(routeId)
  }

  /** Wired as the registry's `onForget`. */
  forget(routeId: string): void {
    this.handlers.delete(routeId)
  }
}
