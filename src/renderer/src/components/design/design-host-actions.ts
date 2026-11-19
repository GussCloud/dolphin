import { createContext, useContext } from 'react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { activateAndRevealWorktree } from '@/lib/worktree-activation'
import { toRuntimeExecutionHostId } from '../../../../shared/execution-host'
import type { DesignComposerPrefill } from '../../../../shared/design-popout'

/** Actions the Design page cannot finish on its own: they need the main window's composer and workspaces. */
export type DesignHostActions = {
  /** `main` renders inside the app shell; `popout` is the standalone Design window. */
  surface: 'main' | 'popout'
  openComposer: (prefill?: DesignComposerPrefill) => void
  revealWorktree: (worktreeId: string, runtimeEnvironmentId: string | null) => void
}

export const mainWindowDesignHostActions: DesignHostActions = {
  surface: 'main',
  openComposer: (prefill) =>
    useAppStore.getState().openModal('new-workspace-composer', {
      designMode: true,
      ...(prefill?.name !== undefined ? { prefilledName: prefill.name } : {}),
      ...(prefill?.request !== undefined ? { designRequest: prefill.request } : {}),
      ...(prefill?.repoId ? { initialRepoId: prefill.repoId } : {})
    }),
  revealWorktree: (worktreeId, runtimeEnvironmentId) => {
    const opened = activateAndRevealWorktree(
      worktreeId,
      runtimeEnvironmentId
        ? { executionHostId: toRuntimeExecutionHostId(runtimeEnvironmentId) }
        : {}
    )
    if (opened === false) {
      toast.error(
        translate(
          'auto.components.design.detail.worktreeMissing',
          'The workspace for this design is no longer available.'
        )
      )
    }
  }
}

// Why: the main window keeps working without a provider; only the pop-out root overrides it.
export const DesignHostActionsContext = createContext<DesignHostActions>(
  mainWindowDesignHostActions
)

export function useDesignHostActions(): DesignHostActions {
  return useContext(DesignHostActionsContext)
}

/** The pop-out has no composer or workspace panes, so it hands both to the main window. */
export const popoutDesignHostActions: DesignHostActions = {
  surface: 'popout',
  openComposer: (prefill) =>
    void window.api.designs.openComposerInMain(prefill ? { designPrefill: prefill } : {}),
  revealWorktree: (worktreeId, runtimeEnvironmentId) =>
    void window.api.designs.revealWorktreeInMain({ worktreeId, runtimeEnvironmentId })
}
