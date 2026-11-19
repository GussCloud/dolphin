import { useEffect } from 'react'
import type { DesignsApi } from '../../../../preload/api/designs-api'
import { mainWindowDesignHostActions, type DesignHostActions } from './design-host-actions'

type DesignPopoutCommandSource = Pick<
  DesignsApi,
  'onOpenComposerRequested' | 'onRevealWorktreeRequested'
>

/** Runs, in the main window, the actions the Design pop-out handed over. */
export function subscribeDesignPopoutCommands(
  source: DesignPopoutCommandSource,
  actions: Pick<DesignHostActions, 'openComposer' | 'revealWorktree'>
): () => void {
  const offComposer = source.onOpenComposerRequested((args) =>
    actions.openComposer(args.designPrefill)
  )
  const offReveal = source.onRevealWorktreeRequested((args) =>
    actions.revealWorktree(args.worktreeId, args.runtimeEnvironmentId ?? null)
  )
  return () => {
    offComposer()
    offReveal()
  }
}

/** Mounted once in the main window; the pop-out never mounts it. */
export function DesignPopoutCommandBridge(): null {
  useEffect(() => {
    const designs = window.api?.designs
    if (!designs?.onOpenComposerRequested) {
      return
    }
    return subscribeDesignPopoutCommands(designs, mainWindowDesignHostActions)
  }, [])
  return null
}
