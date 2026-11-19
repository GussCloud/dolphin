import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { getActiveRuntimeTarget } from '@/runtime/runtime-client-target'
import { RuntimeRpcCallError } from '@/runtime/runtime-rpc-result'
import { settingsForRepoOwner } from '@/store/slices/worktrees/listing/worktree-owner-settings'
import type { ComposerLaunchOverride } from '@/hooks/composer-state/composer-launch-override'
import type { QuickSubmitOptions } from '@/hooks/composer-state/composer-submit-model'
import type { Design } from '../../../shared/design-types'
import type { TuiAgent } from '../../../shared/tui-agent'

type DesignCreateResult = { design: Design; launchPrompt: string }

export type SubmitDesignInput = {
  repoId: string
  name: string
  request: string
  agent: TuiAgent
  submitQuick: (
    agent: TuiAgent | null,
    launch?: ComposerLaunchOverride,
    options?: QuickSubmitOptions
  ) => Promise<void>
  options?: QuickSubmitOptions
}

function describeDesignCreateError(error: unknown): string {
  if (error instanceof RuntimeRpcCallError && error.code === 'method_not_found') {
    return translate(
      'auto.components.ComposerDesign.hostTooOld',
      'This host does not support designs yet. Update Dolphin on it and try again.'
    )
  }
  return error instanceof Error ? error.message : String(error)
}

/**
 * Records the design on the host that will run its worktree, then creates the worktree with the
 * host's launch prompt. A failed record creates nothing, so no agent starts without its design.
 */
export async function submitDesignFromComposer(input: SubmitDesignInput): Promise<boolean> {
  // Why the worktree's own routing: `createWorktree` picks its host the same way, so the record
  // lives where the agent's `dolphin design start` runs.
  const target = getActiveRuntimeTarget(settingsForRepoOwner(useAppStore.getState(), input.repoId))
  let result: DesignCreateResult
  try {
    result = await callRuntimeRpc<DesignCreateResult>(target, 'design.create', {
      name: input.name.trim(),
      request: input.request.trim(),
      agent: input.agent,
      repoId: input.repoId
    })
    if (typeof result?.launchPrompt !== 'string' || result.launchPrompt.length === 0) {
      throw new Error('design.create returned no launch prompt')
    }
  } catch (error) {
    toast.error(
      translate('auto.components.ComposerDesign.createFailed', 'Could not create the design'),
      { description: describeDesignCreateError(error) }
    )
    return false
  }
  await input.submitQuick(
    input.agent,
    { kind: 'design', prompt: result.launchPrompt },
    input.options
  )
  return true
}
