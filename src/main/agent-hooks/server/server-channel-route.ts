import type { IncomingMessage, ServerResponse } from 'node:http'
import { readRequestBody } from '../../../shared/agent-hook-listener/request-body'

/** Handles authenticated `/channel/*` posts from agent-side channel servers (e.g. Claude Code channels). */
export type AgentHookChannelRouteHandler = (request: {
  pathname: string
  /** `paneKey` in it is proven: the caller holds that pane's launch token. */
  body: unknown
  /** Aborts when the client drops the connection, so a held long-poll can be released. */
  signal: AbortSignal
}) => Promise<{ status: number; json?: unknown }>

/** Checks the caller's launch token against the pane's committed one. */
export type AgentHookChannelPaneAuthorizer = (paneKey: string, launchToken: string) => boolean

export const AGENT_HOOK_CHANNEL_PATH_PREFIX = '/channel/'

export function isAgentHookChannelPath(pathname: string): boolean {
  return pathname.startsWith(AGENT_HOOK_CHANNEL_PATH_PREFIX)
}

// Why: the hook token is in every PTY's env, so it alone would let any pane act as any other.
function isAuthorizedForPane(body: unknown, authorize: AgentHookChannelPaneAuthorizer): boolean {
  if (!body || typeof body !== 'object' || !('paneKey' in body) || !('launchToken' in body)) {
    return false
  }
  const { paneKey, launchToken } = body
  return (
    typeof paneKey === 'string' &&
    typeof launchToken === 'string' &&
    authorize(paneKey, launchToken)
  )
}

export async function serveAgentHookChannelRoute(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  route: { handler: AgentHookChannelRouteHandler | null; authorize: AgentHookChannelPaneAuthorizer }
): Promise<void> {
  if (!route.handler) {
    res.writeHead(404)
    res.end()
    return
  }
  let body: unknown
  try {
    body = await readRequestBody(req)
  } catch {
    if (!res.headersSent && !res.destroyed) {
      res.writeHead(400)
      res.end()
    }
    return
  }
  if (!isAuthorizedForPane(body, route.authorize)) {
    res.writeHead(401)
    res.end()
    return
  }
  // Why: the slowloris cap bounds the upload only; a long-poll legitimately holds the socket idle.
  req.setTimeout(0)
  const abort = new AbortController()
  res.on('close', () => abort.abort())
  let result: { status: number; json?: unknown }
  try {
    result = await route.handler({ pathname, body, signal: abort.signal })
  } catch (error) {
    console.error('[agent-hooks] channel route failed', error)
    result = { status: 500 }
  }
  if (res.destroyed || res.headersSent) {
    return
  }
  if (result.json === undefined) {
    res.writeHead(result.status)
    res.end()
    return
  }
  res.writeHead(result.status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(result.json))
}
