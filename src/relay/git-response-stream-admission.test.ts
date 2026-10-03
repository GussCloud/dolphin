import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RelayDispatcher, RequestContext } from './dispatcher'
import { TooManyStreamsError } from './fs-stream-registry'
import { GitResponseAckStallError, GitResponseStreamRegistry } from './git-response-stream'
import {
  GIT_RESPONSE_CHUNK_SIZE,
  GIT_RESPONSE_STREAM_ACK_STALL_DEADLINE_MS,
  MAX_CONCURRENT_GIT_RESPONSE_STREAMS,
  RelayErrorCode,
  STREAM_ACK_WINDOW_CHUNKS
} from './protocol'

const CLIENT_ID = 7
const context: RequestContext = { clientId: CLIENT_ID, isStale: () => false }

function createDispatcher(): { dispatcher: RelayDispatcher; notifyBulk: ReturnType<typeof vi.fn> } {
  const notifyBulk = vi.fn().mockResolvedValue(undefined)
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the registry only calls notifyBulk and the optional producerDataBudget.
  return { dispatcher: { notifyBulk } as unknown as RelayDispatcher, notifyBulk }
}

function windowOverflowPayload(): Buffer {
  return Buffer.alloc(GIT_RESPONSE_CHUNK_SIZE * (STREAM_ACK_WINDOW_CHUNKS * 3), 0x61)
}

function chunkData(params: unknown): string {
  if (typeof params === 'object' && params !== null && 'data' in params) {
    return typeof params.data === 'string' ? params.data : ''
  }
  return ''
}

function sentMethods(notifyBulk: ReturnType<typeof vi.fn>): string[] {
  return notifyBulk.mock.calls.map(([method]) => String(method))
}

describe('GitResponseStreamRegistry admission and ack stall deadline', () => {
  let registry: GitResponseStreamRegistry

  beforeEach(() => {
    vi.useFakeTimers()
    registry = new GitResponseStreamRegistry()
  })

  afterEach(() => {
    registry.disposeAll()
    vi.useRealTimers()
  })

  it('refuses a stream beyond the concurrent cap with the typed TooManyStreams error', async () => {
    const { dispatcher } = createDispatcher()
    for (let i = 0; i < MAX_CONCURRENT_GIT_RESPONSE_STREAMS; i += 1) {
      registry.startStream(windowOverflowPayload(), dispatcher, context)
    }
    await vi.advanceTimersByTimeAsync(0)
    expect(registry.size()).toBe(MAX_CONCURRENT_GIT_RESPONSE_STREAMS)

    let refusal: unknown
    try {
      registry.startStream(windowOverflowPayload(), dispatcher, context)
    } catch (err) {
      refusal = err
    }
    expect(refusal).toBeInstanceOf(TooManyStreamsError)
    expect(refusal).toMatchObject({ code: RelayErrorCode.TooManyStreams })
  })

  it('admits a new stream once a finished one frees its slot', async () => {
    const { dispatcher } = createDispatcher()
    const small = Buffer.from('{"ok":true}')
    for (let i = 0; i < MAX_CONCURRENT_GIT_RESPONSE_STREAMS; i += 1) {
      registry.startStream(small, dispatcher, context)
    }
    await vi.advanceTimersByTimeAsync(0)
    expect(registry.size()).toBe(0)
    expect(() => registry.startStream(small, dispatcher, context)).not.toThrow()
  })

  it('fails a stream whose reader stops acking and releases its slot', async () => {
    const { dispatcher, notifyBulk } = createDispatcher()
    const marker = registry.startStream(windowOverflowPayload(), dispatcher, context)
    const streamId = marker.__dolphinGitResponseStream.streamId
    await vi.advanceTimersByTimeAsync(0)
    expect(notifyBulk).toHaveBeenCalledTimes(STREAM_ACK_WINDOW_CHUNKS)

    await vi.advanceTimersByTimeAsync(GIT_RESPONSE_STREAM_ACK_STALL_DEADLINE_MS - 2_000)
    expect(sentMethods(notifyBulk)).not.toContain('git.responseError')
    expect(registry.size()).toBe(1)

    await vi.advanceTimersByTimeAsync(2_000)
    const errorCall = notifyBulk.mock.calls.find(([method]) => method === 'git.responseError')
    expect(errorCall?.[1]).toEqual({
      streamId,
      message: new GitResponseAckStallError(streamId, GIT_RESPONSE_STREAM_ACK_STALL_DEADLINE_MS)
        .message,
      code: RelayErrorCode.StreamProtocolError
    })
    expect(sentMethods(notifyBulk)).not.toContain('git.responseEnd')
    expect(registry.size()).toBe(0)
  })

  it('restarts the stall clock on every ack advance', async () => {
    const { dispatcher, notifyBulk } = createDispatcher()
    const marker = registry.startStream(windowOverflowPayload(), dispatcher, context)
    const streamId = marker.__dolphinGitResponseStream.streamId
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(GIT_RESPONSE_STREAM_ACK_STALL_DEADLINE_MS - 5_000)
    registry.recordAck(streamId, 0, CLIENT_ID)
    await vi.advanceTimersByTimeAsync(GIT_RESPONSE_STREAM_ACK_STALL_DEADLINE_MS - 5_000)

    expect(sentMethods(notifyBulk)).not.toContain('git.responseError')
    expect(registry.size()).toBe(1)
  })

  it('does not count slow sends against a reader that keeps acking', async () => {
    let releaseSend!: () => void
    const slowSend = new Promise<void>((resolve) => {
      releaseSend = resolve
    })
    const notifyBulk = vi
      .fn()
      .mockImplementationOnce(() => slowSend)
      .mockResolvedValue(undefined)
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the registry only calls notifyBulk.
    const dispatcher = { notifyBulk } as unknown as RelayDispatcher
    const marker = registry.startStream(windowOverflowPayload(), dispatcher, context)
    const streamId = marker.__dolphinGitResponseStream.streamId
    await vi.advanceTimersByTimeAsync(0)

    await vi.advanceTimersByTimeAsync(GIT_RESPONSE_STREAM_ACK_STALL_DEADLINE_MS * 2)
    releaseSend()
    await vi.advanceTimersByTimeAsync(0)
    registry.recordAck(streamId, 0, CLIENT_ID)
    await vi.advanceTimersByTimeAsync(1_000)

    expect(sentMethods(notifyBulk)).not.toContain('git.responseError')
  })

  it('streams chunks that reassemble to the original payload', async () => {
    const { dispatcher, notifyBulk } = createDispatcher()
    const payload = Buffer.from('é'.repeat(GIT_RESPONSE_CHUNK_SIZE), 'utf-8')
    const marker = registry.startStream(payload, dispatcher, context)
    const { streamId, chunkCount } = marker.__dolphinGitResponseStream
    await vi.advanceTimersByTimeAsync(0)
    registry.recordAck(streamId, chunkCount, CLIENT_ID)
    await vi.advanceTimersByTimeAsync(0)

    const chunks = notifyBulk.mock.calls
      .filter(([method]) => method === 'git.responseChunk')
      .map(([, params]) => Buffer.from(chunkData(params), 'base64'))
    expect(chunks).toHaveLength(chunkCount)
    expect(Buffer.concat(chunks).equals(payload)).toBe(true)
    expect(sentMethods(notifyBulk).at(-1)).toBe('git.responseEnd')
    expect(registry.size()).toBe(0)
  })
})
