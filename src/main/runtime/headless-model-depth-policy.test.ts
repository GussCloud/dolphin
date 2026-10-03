import { afterEach, describe, expect, it } from 'vitest'
import { DolphinRuntimeService } from './dolphin-runtime'
import {
  DepthGrowingHeadlessEmulator,
  DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS,
  PANE_LESS_HEADLESS_MODEL_SCROLLBACK_ROWS,
  headlessModelScrollbackRows
} from './headless-model-depth-policy'
import { serializeBudgetedRequestedSnapshot } from './rpc/methods/terminal/terminal-snapshot-publication'
import { MAX_TERMINAL_READ_LIMIT } from './terminal-tail-limits'
import { DESKTOP_TERMINAL_SCROLLBACK_ROWS_DEFAULT } from '../../shared/terminal-scrollback-policy'

const PTY_ID = 'pty-depth'

type HeadlessInternals = {
  headlessTerminals: Map<
    string,
    { emulator: DepthGrowingHeadlessEmulator; writeChain: Promise<void> }
  >
}

function internalsOf(runtime: DolphinRuntimeService): HeadlessInternals {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: test reads the runtime's private per-PTY model map.
  return runtime as unknown as HeadlessInternals
}

function rows(from: number, to: number): string {
  let out = ''
  for (let index = from; index < to; index += 1) {
    out += `row-${index}\r\n`
  }
  return out
}

function oldestRetainedRow(text: string): number {
  const indices = [...text.matchAll(/row-(\d+)/g)].map((match) => Number(match[1]))
  return Math.min(...indices)
}

function bindDesktopPane(runtime: DolphinRuntimeService): void {
  runtime.attachWindow(1)
  runtime.syncWindowGraph(1, {
    tabs: [
      { tabId: 'tab-1', worktreeId: 'wt-1', title: 'Shell', activeLeafId: 'pane:1', layout: null }
    ],
    leaves: [
      {
        tabId: 'tab-1',
        worktreeId: 'wt-1',
        leafId: 'pane:1',
        paneRuntimeId: 1,
        ptyId: PTY_ID,
        paneTitle: null
      }
    ]
  })
}

async function feed(
  runtime: DolphinRuntimeService,
  data: string
): Promise<DepthGrowingHeadlessEmulator> {
  runtime.onPtyData(PTY_ID, data, 100)
  const state = internalsOf(runtime).headlessTerminals.get(PTY_ID)!
  await state.writeChain
  return state.emulator
}

describe('headless model depth policy', () => {
  it('covers every pane-less reader and the default desktop scrollback', () => {
    expect(PANE_LESS_HEADLESS_MODEL_SCROLLBACK_ROWS).toBeGreaterThanOrEqual(MAX_TERMINAL_READ_LIMIT)
    expect(DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS).toBe(
      DESKTOP_TERMINAL_SCROLLBACK_ROWS_DEFAULT
    )
    expect(headlessModelScrollbackRows('pane-less')).toBe(PANE_LESS_HEADLESS_MODEL_SCROLLBACK_ROWS)
    expect(headlessModelScrollbackRows('desktop-bound')).toBe(
      DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS
    )
  })
})

describe('DepthGrowingHeadlessEmulator', () => {
  let emulator: DepthGrowingHeadlessEmulator | undefined
  afterEach(() => emulator?.dispose())

  it('keeps retained rows when raised and ignores lower depths', async () => {
    emulator = new DepthGrowingHeadlessEmulator({ cols: 80, rows: 24, scrollback: 100 })
    await emulator.write(rows(0, 90))

    emulator.growScrollbackRows(500)
    emulator.growScrollbackRows(50)
    await emulator.write(rows(90, 400))

    expect(emulator.scrollbackRows).toBe(500)
    expect(oldestRetainedRow(emulator.getSnapshot({ scrollbackRows: 1000 }).snapshotAnsi)).toBe(0)
  })
})

describe('runtime headless model depth', () => {
  let runtime: DolphinRuntimeService | undefined
  afterEach(() => runtime?.onPtyExit(PTY_ID, 0))

  it('creates a pane-less model at the pane-less depth', async () => {
    runtime = new DolphinRuntimeService()
    const emulator = await feed(runtime, 'hello\r\n')
    expect(emulator.scrollbackRows).toBe(PANE_LESS_HEADLESS_MODEL_SCROLLBACK_ROWS)
  })

  it('creates a desktop-bound model at the desktop depth', async () => {
    runtime = new DolphinRuntimeService()
    bindDesktopPane(runtime)
    const emulator = await feed(runtime, 'hello\r\n')
    expect(emulator.scrollbackRows).toBe(DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS)
  })

  it('raises the model when a desktop pane binds and keeps it raised', async () => {
    runtime = new DolphinRuntimeService()
    const emulator = await feed(runtime, 'hello\r\n')

    bindDesktopPane(runtime)
    expect(emulator.scrollbackRows).toBe(DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS)

    runtime.syncWindowGraph(1, { tabs: [], leaves: [] })
    expect(emulator.scrollbackRows).toBe(DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS)
  })

  it('restores a hidden pane bound after creation with the full desktop depth', async () => {
    runtime = new DolphinRuntimeService()
    await feed(runtime, 'started pane-less\r\n')
    bindDesktopPane(runtime)
    const total = DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS + 1000
    await feed(runtime, rows(0, total))

    const snapshot = await runtime.serializeHiddenOutputRecoveryBuffer(PTY_ID, {
      scrollbackRows: DESKTOP_TERMINAL_SCROLLBACK_ROWS_DEFAULT
    })

    const text = `${snapshot?.scrollbackAnsi ?? ''}${snapshot?.data ?? ''}`
    expect(text).toContain(`row-${total - 1}`)
    // Screen rows plus the full desktop scrollback, far past the pane-less depth.
    expect(total - oldestRetainedRow(text)).toBeGreaterThan(
      DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS
    )
  })

  it('serves a pane-less remote subscribe that asks for more than the model holds', async () => {
    runtime = new DolphinRuntimeService()
    const total = PANE_LESS_HEADLESS_MODEL_SCROLLBACK_ROWS + 1000
    await feed(runtime, rows(0, total))

    const snapshot = await serializeBudgetedRequestedSnapshot(
      runtime,
      PTY_ID,
      DESKTOP_TERMINAL_SCROLLBACK_ROWS_DEFAULT
    )

    expect(snapshot).not.toBeNull()
    expect(snapshot!.data).toContain(`row-${total - 1}`)
    const retained = total - oldestRetainedRow(snapshot!.data)
    expect(retained).toBeGreaterThan(PANE_LESS_HEADLESS_MODEL_SCROLLBACK_ROWS)
    expect(retained).toBeLessThanOrEqual(PANE_LESS_HEADLESS_MODEL_SCROLLBACK_ROWS + 24)
  })
})
