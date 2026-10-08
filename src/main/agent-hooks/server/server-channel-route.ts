import type { IncomingMessage, ServerResponse } from 'node:http'
import { readRequestBody } from '../../../shared/agent-hook-listener/request-body'

/** Handles authenticated `/channel/*` posts from agent-side channel servers (e.g. Claude Code channels). */
export type AgentHookChannelRouteHandler = (request: {
  pathname: string
  body: unknown
  /** Aborts when the client drops the connection, so a held long-poll can be released. */
  signal: AbortSignal
}) => Promise<{ status: number; json?: unknown }>

export const AGENT_HOOK_CHANNEL_PATH_PREFIX = '/channel/'

export function isAgentHookChannelPath(pathname: string): boolean {
  return pathname.startsWith(AGENT_HOOK_CHANNEL_PATH_PREFIX)
}

export async function serveAgentHookChannelRoute(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  handler: AgentHookChannelRouteHandler | null
): Promise<void> {
  if (!handler) {
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
  // Why: the slowloris cap bounds the upload only; a long-poll legitimately holds the socket idle.
  req.setTimeout(0)
  const abort = new AbortController()
  res.on('close', () => abort.abort())
  let result: { status: number; json?: unknown }
  try {
    result = await handler({ pathname, body, signal: abort.signal })
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
