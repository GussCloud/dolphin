import './dolphin-runtime-test-lifecycle.spec'
import { describe, expect, it, vi } from 'vitest'
import type { RuntimeStore } from './runtime-store-contract'
import { DolphinRuntimeService } from './dolphin-runtime-test-mocks.spec'
import { createMobileCreateTestNotifier } from './dolphin-runtime-test-scenario-builders.spec'
import {
  HEADLESS_LEAF_ID,
  HEADLESS_SECOND_LEAF_ID,
  TEST_WORKTREE_ID,
  makeHeadlessTerminalLayout,
  makeRuntimeStoreWithWorkspaceSession,
  makeWorkspaceSessionWithHeadlessTerminal
} from './dolphin-runtime-test-fixtures.spec'

// Repro for the paired split-pane ghost: a client's reconnect recovery activates the leaf whose
// shell just exited while the host is still persisting that leaf's retirement. The host must not
// respawn under the exited session id, or the retired leaf returns to the layout on a fresh shell.
const SURVIVOR_SESSION_ID = 'survivor-session'
const EXITED_SESSION_ID = 'exited-session'

describe('activating a split leaf whose exit is still being retired', () => {
  it('refuses to materialize it and lets the retirement drop the leaf', async () => {
    const session = makeWorkspaceSessionWithHeadlessTerminal({
      tabsByWorktree: {
        [TEST_WORKTREE_ID]: [
          {
            id: 'host-tab',
            ptyId: SURVIVOR_SESSION_ID,
            worktreeId: TEST_WORKTREE_ID,
            title: 'Terminal',
            customTitle: null,
            color: null,
            sortOrder: 0,
            createdAt: 1
          }
        ]
      },
      terminalLayoutsByTabId: {
        'host-tab': makeHeadlessTerminalLayout({
          [HEADLESS_LEAF_ID]: SURVIVOR_SESSION_ID,
          [HEADLESS_SECOND_LEAF_ID]: EXITED_SESSION_ID
        })
      }
    })
    const { runtimeStore } = makeRuntimeStoreWithWorkspaceSession(session)
    // Holds the retirement's durable write open, as a slow disk does on the host.
    let holdDisk = false
    let releaseDisk = (): void => {}
    const diskHeld = new Promise<void>((held) => {
      Object.assign(runtimeStore, {
        flushPendingOrThrowAsync: async () => {
          if (holdDisk) {
            held()
            await new Promise<void>((resolve) => {
              releaseDisk = resolve
            })
          }
        }
      })
    })
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The shared fixture supplies RuntimeStore methods; its legacy Mock return type loses callable signatures.
    const runtime = new DolphinRuntimeService(runtimeStore as RuntimeStore)
    runtime.setNotifier(createMobileCreateTestNotifier(vi.fn()))
    const spawn = vi.fn(async (args: { sessionId?: string }) => ({ id: args.sessionId ?? 'fresh' }))
    runtime.setPtyController({
      spawn,
      write: () => true,
      kill: () => true,
      getForegroundProcess: async () => null,
      listProcesses: async () => []
    })
    runtime.syncWindowGraph(0, { tabs: [], leaves: [] })
    const worktree = `id:${TEST_WORKTREE_ID}`
    for (const leafId of [HEADLESS_LEAF_ID, HEADLESS_SECOND_LEAF_ID]) {
      await runtime.activateMobileSessionTab(worktree, `host-tab::${leafId}`, undefined, {
        notifyClients: false
      })
    }
    expect(spawn.mock.calls.map(([args]) => args.sessionId)).toEqual([
      SURVIVOR_SESSION_ID,
      EXITED_SESSION_ID
    ])

    holdDisk = true
    const retirement = runtime.onPtyExit(EXITED_SESSION_ID, 0, undefined, {
      providerExitObserved: true,
      cause: { kind: 'exited', exitCode: 0 }
    })
    const activation = runtime.activateMobileSessionTab(
      worktree,
      `host-tab::${HEADLESS_SECOND_LEAF_ID}`,
      undefined,
      { notifyClients: false, navigation: 'caller', intent: 'automatic' }
    )
    const activationOutcome = activation.then(
      () => 'materialized',
      (error: unknown) => (error instanceof Error ? error.message : String(error))
    )
    await diskHeld
    // Lets the activation run up to its spawn decision while the retirement is still on disk.
    await new Promise((resolve) => setTimeout(resolve, 50))
    releaseDisk()
    await retirement
    expect(await activationOutcome).toBe('tab_not_found')

    expect(spawn).toHaveBeenCalledTimes(2)
    expect(runtime.getPtyLivenessVerdict(EXITED_SESSION_ID)?.status).toBe('exited')
    const tabs = (await runtime.listMobileSessionTabs(worktree)).tabs
    expect(
      tabs
        .filter((tab) => tab.type === 'terminal')
        .map((tab) => tab.type === 'terminal' && tab.leafId)
    ).toEqual([HEADLESS_LEAF_ID])
  })
})
