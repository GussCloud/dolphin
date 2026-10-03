// Streams large RPC responses onto the bulk lane in chunks instead of one
// JSON-RPC frame, so a big reply cannot head-of-line-block interactive pty.data
// echo on the shared SSH channel. Mirrors the fs read-stream credit-window
// pattern (see fs-handler-file-read.ts) but the payload is an in-memory
// serialized string rather than a file handle.
//
// ONE REGISTRY PER RELAY. The `git.*` method names below are the shipped wire
// spelling and are permanent, the way an opcode number is, so a second handler
// that needs streaming (`fs.listFiles` is the first) shares this instance rather
// than minting its own. A second registry is not an option: a client keys
// reassembly on `streamId` alone, so two would hand out the same id and
// cross-feed each other's chunks, and only the handler that registers
// `git.responseAck` can credit the ack window a pump parks on — the other's
// streams would stall at STREAM_ACK_WINDOW_CHUNKS forever. See
// `relay-runtime-services.ts` for the wiring.
import type { RelayDispatcher, RequestContext } from './dispatcher'
import { TooManyStreamsError } from './fs-stream-registry'
import {
  GIT_RESPONSE_CHUNK_SIZE,
  GIT_RESPONSE_STREAM_ACK_STALL_DEADLINE_MS,
  GIT_RESPONSE_STREAM_THRESHOLD,
  MAX_CONCURRENT_GIT_RESPONSE_STREAMS,
  RelayErrorCode,
  STREAM_ACK_WINDOW_CHUNKS,
  STREAM_ACK_STALL_RECHECK_MS,
  type GitResponseStreamMarker
} from './protocol'

type GitResponseStreamEntry = {
  ownerClientId: number
  aborted: boolean
  /** Highest chunk seq the client acknowledged (in-order; -1 = none yet). */
  ackedThroughSeq: number
  ackWaiters: Set<() => void>
  /** Serialized reply; null once the stream ends so a parked pump pins nothing. */
  payload: Buffer | null
  chunkBytes: number
}

/** The reader stopped acknowledging while still attached; its payload was dropped. */
export class GitResponseAckStallError extends Error {
  readonly code = RelayErrorCode.StreamProtocolError
  constructor(streamId: number, stalledMs: number) {
    super(`Git response stream ${streamId} stalled: no ack for ${stalledMs}ms`)
  }
}

type AckCreditOutcome = 'credited' | 'stale' | 'aborted' | 'stalled'

export class GitResponseStreamRegistry {
  private streams = new Map<number, GitResponseStreamEntry>()
  private nextId = 1

  private register(ownerClientId: number, payload: Buffer): number {
    if (this.streams.size >= MAX_CONCURRENT_GIT_RESPONSE_STREAMS) {
      throw new TooManyStreamsError()
    }
    const streamId = this.nextId++
    this.streams.set(streamId, {
      ownerClientId,
      aborted: false,
      ackedThroughSeq: -1,
      ackWaiters: new Set(),
      payload,
      chunkBytes: GIT_RESPONSE_CHUNK_SIZE
    })
    return streamId
  }

  recordAck(streamId: number, seq: number, clientId: number): void {
    const entry = this.streams.get(streamId)
    if (
      !entry ||
      entry.ownerClientId !== clientId ||
      typeof seq !== 'number' ||
      !Number.isFinite(seq)
    ) {
      return
    }
    if (seq > entry.ackedThroughSeq) {
      entry.ackedThroughSeq = seq
    }
    this.wake(entry)
  }

  abort(streamId: number, clientId: number): void {
    const entry = this.streams.get(streamId)
    if (entry?.ownerClientId === clientId) {
      entry.aborted = true
      this.wake(entry)
    }
  }

  /** Wake every parked pump so it re-checks staleness — used when a client
   * detaches and its acks will never arrive. */
  wakeAll(): void {
    for (const entry of this.streams.values()) {
      this.wake(entry)
    }
  }

  size(): number {
    return this.streams.size
  }

  private wake(entry: GitResponseStreamEntry): void {
    for (const waiter of Array.from(entry.ackWaiters)) {
      waiter()
    }
  }

  private release(streamId: number, entry: GitResponseStreamEntry): void {
    entry.payload = null
    if (this.streams.get(streamId) === entry) {
      this.streams.delete(streamId)
    }
  }

  private waitForAck(streamId: number): Promise<void> {
    const entry = this.streams.get(streamId)
    if (!entry || entry.aborted) {
      return Promise.resolve()
    }
    return new Promise<void>((resolve) => {
      let settled = false
      const finish = (): void => {
        if (settled) {
          return
        }
        settled = true
        clearTimeout(timer)
        entry.ackWaiters.delete(finish)
        resolve()
      }
      const timer = setTimeout(finish, STREAM_ACK_STALL_RECHECK_MS)
      timer.unref?.()
      entry.ackWaiters.add(finish)
    })
  }

  /** Parks until `seq` fits the ack window. The stall clock starts when the pump
   * parks and restarts on every ack advance, so time spent in a saturated
   * notifyBulk never counts against a reader that is still acknowledging. */
  private async awaitAckCredit(
    streamId: number,
    entry: GitResponseStreamEntry,
    seq: number,
    context: RequestContext
  ): Promise<AckCreditOutcome> {
    let progressAt = Date.now()
    let lastAcked = entry.ackedThroughSeq
    while (seq - entry.ackedThroughSeq > STREAM_ACK_WINDOW_CHUNKS) {
      if (context.isStale()) {
        return 'stale'
      }
      if (entry.aborted) {
        return 'aborted'
      }
      if (entry.ackedThroughSeq !== lastAcked) {
        lastAcked = entry.ackedThroughSeq
        progressAt = Date.now()
      } else if (Date.now() - progressAt >= GIT_RESPONSE_STREAM_ACK_STALL_DEADLINE_MS) {
        return 'stalled'
      }
      await this.waitForAck(streamId)
    }
    if (context.isStale()) {
      return 'stale'
    }
    return entry.aborted ? 'aborted' : 'credited'
  }

  /**
   * Register a stream for `payload`, kick off the bulk-lane pump on a later
   * task (so the sentinel response reaches the client first), and return the
   * sentinel marker to send as the RPC result. Throws TooManyStreamsError when
   * the relay already holds MAX_CONCURRENT_GIT_RESPONSE_STREAMS payloads.
   */
  startStream(
    payload: Buffer,
    dispatcher: RelayDispatcher,
    context: RequestContext
  ): GitResponseStreamMarker {
    const streamId = this.register(context.clientId, payload)
    const base64Budget =
      dispatcher.producerDataBudget?.(
        'git.responseChunk',
        { streamId, seq: payload.length },
        context.clientId
      ) ?? Number.MAX_SAFE_INTEGER
    const sinkChunkBytes = Math.floor(Math.max(0, base64Budget) / 4) * 3
    if (sinkChunkBytes === 0) {
      this.streams.delete(streamId)
      throw new Error('Git response stream has no encoded producer capacity')
    }
    // Why: base64 is encoded per chunk at send time; encoding eagerly pinned a
    // second, 4/3-expanded copy of every parked reply until its final ack.
    const chunkBytes = Math.min(GIT_RESPONSE_CHUNK_SIZE, sinkChunkBytes)
    const entry = this.streams.get(streamId)
    if (entry) {
      entry.chunkBytes = chunkBytes
    }
    // Why: kick the pump off the response task so the client sees the sentinel
    // (and can subscribe/reassemble) before the first chunk frame arrives.
    setImmediate(() => {
      void this.pump(streamId, dispatcher, context)
    })
    return {
      __dolphinGitResponseStream: {
        streamId,
        totalBytes: payload.length,
        chunkCount: Math.ceil(payload.length / chunkBytes)
      }
    }
  }

  private async pump(
    streamId: number,
    dispatcher: RelayDispatcher,
    context: RequestContext
  ): Promise<void> {
    const entry = this.streams.get(streamId)
    if (!entry?.payload) {
      return
    }
    const clientId = context.clientId
    const totalBytes = entry.payload.length
    const chunkCount = Math.ceil(totalBytes / entry.chunkBytes)
    let endReason: AckCreditOutcome | 'end' = 'end'
    try {
      for (let seq = 0; seq < chunkCount; seq += 1) {
        // Why: credit window — the client acks each chunk, bounding how many
        // bulk bytes a keystroke echo can queue behind on the shared channel.
        const credit = await this.awaitAckCredit(streamId, entry, seq, context)
        if (credit === 'stalled') {
          throw new GitResponseAckStallError(streamId, GIT_RESPONSE_STREAM_ACK_STALL_DEADLINE_MS)
        }
        if (credit !== 'credited') {
          endReason = credit
          break
        }
        const payload = entry.payload
        if (!payload) {
          endReason = 'aborted'
          break
        }
        const offset = seq * entry.chunkBytes
        const data = payload
          .subarray(offset, Math.min(totalBytes, offset + entry.chunkBytes))
          .toString('base64')
        // Why: notifyBulk waits out sink saturation so chunk frames never pile
        // up in the outbound pipe ahead of interactive pty.data frames.
        await dispatcher.notifyBulk('git.responseChunk', { streamId, seq, data }, { clientId })
      }
      if (endReason === 'end') {
        this.release(streamId, entry)
        await dispatcher.notifyBulk('git.responseEnd', { streamId }, { clientId })
      }
    } catch (err) {
      // Why: drop the payload before reporting — the error send can itself park
      // on a saturated sink, and it must not keep the reply pinned meanwhile.
      this.release(streamId, entry)
      if (!context.isStale() && !entry.aborted) {
        try {
          await dispatcher.notifyBulk(
            'git.responseError',
            {
              streamId,
              message: err instanceof Error ? err.message : String(err),
              // Optional: clients predating it read only `message`.
              ...(err instanceof GitResponseAckStallError ? { code: err.code } : {})
            },
            { clientId }
          )
        } catch {
          // Why: the original failure may be the owning channel closing; a
          // second send failure must not escape this detached pump.
        }
      }
    } finally {
      this.release(streamId, entry)
    }
  }

  disposeAll(): void {
    for (const entry of this.streams.values()) {
      entry.aborted = true
      entry.payload = null
      this.wake(entry)
    }
    this.streams.clear()
  }
}

/**
 * Opt-in response streaming, shared by every handler that can answer with a
 * payload too large for one control-lane frame.
 *
 * `__streamResponse` is its own negotiation in both directions: an old client
 * never sends it and gets the plain result, and an old relay ignores it and
 * answers plainly, which the client detects by the sentinel marker being absent.
 * So there is no new method and no capability to advertise.
 */
export function maybeStreamRpcResponse(
  result: unknown,
  params: Record<string, unknown>,
  context: RequestContext | undefined,
  registry: GitResponseStreamRegistry,
  dispatcher: RelayDispatcher
): unknown {
  if (params.__streamResponse !== true || !context) {
    return result
  }
  const payload = Buffer.from(JSON.stringify(result ?? null), 'utf-8')
  if (payload.length <= GIT_RESPONSE_STREAM_THRESHOLD) {
    return result
  }
  return registry.startStream(payload, dispatcher, context)
}
