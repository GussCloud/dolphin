import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Automation, AutomationRun } from '../../shared/automations-types'

const order: string[] = []
let finalRun: AutomationRun

vi.mock('./automation-run-writer', () => ({
  createAutomationRunWriter: () => ({ updateRun: async () => finalRun })
}))
vi.mock('./run-usage-collection', () => ({
  writeAutomationRunUsage: async ({ run }: { run: AutomationRun }) => {
    order.push('usage')
    return run
  }
}))

function run(overrides: Partial<AutomationRun>): AutomationRun {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the fields the service reads here are set.
  return {
    id: 'run-1',
    automationId: 'auto-1',
    status: 'completed',
    workspaceId: 'repo::/work/app-run-1',
    usage: null,
    ...overrides
  } as AutomationRun
}

async function serviceFor(
  workspaceMode: Automation['workspaceMode'],
  remove: () => Promise<unknown>
) {
  const { AutomationService } = await import('./service')
  const store = {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the service reads only these fields here.
    listAutomations: () => [{ id: 'auto-1', workspaceMode } as Automation],
    listAutomationRuns: () => []
  }
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake store covers the methods markDispatchResult calls.
  return new AutomationService(store as never, { removeRunWorkspace: remove })
}

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the mocked run writer ignores the dispatch result.
const RESULT = {} as never

describe('per-run automation workspaces', () => {
  beforeEach(() => {
    order.length = 0
  })

  it('removes a completed run workspace after its usage is recorded', async () => {
    finalRun = run({})
    const remove = vi.fn(async () => {
      order.push('remove')
    })
    const service = await serviceFor('new_per_run', remove)

    await service.markDispatchResult(RESULT)
    await vi.waitFor(() => expect(remove).toHaveBeenCalledWith('id:repo::/work/app-run-1'))
    expect(order).toEqual(['usage', 'remove'])
  })

  it('keeps failed runs, existing-workspace automations, and a workspace with work in it', async () => {
    const remove = vi.fn(async () => {
      throw new Error('Worktree has uncommitted changes')
    })
    finalRun = run({ status: 'dispatch_failed' })
    await (await serviceFor('new_per_run', remove)).markDispatchResult(RESULT)
    finalRun = run({})
    await (await serviceFor('existing', remove)).markDispatchResult(RESULT)
    expect(remove).not.toHaveBeenCalled()

    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    await (await serviceFor('new_per_run', remove)).markDispatchResult(RESULT)
    await vi.waitFor(() => expect(info).toHaveBeenCalled())
    info.mockRestore()
  })
})
