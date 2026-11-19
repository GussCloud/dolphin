/** A composer launch whose first prompt is not the composed one; absent is an ordinary create. */
export type ComposerLaunchOverride = {
  kind: 'autonomous-goal' | 'design'
  /** Delivered in argv, replacing the linked work item prompt and its draft. */
  prompt: string
}

export type ComposerLaunchPolicy = {
  /** Coordinator env (auto-compaction off) for a pane the goal host rotates and measures. */
  coordinatorEnv: boolean
  /** Skip structured native chat: a coordinator is reset in place, a design agent runs `dolphin`. */
  pinTerminalTui: boolean
  /** Host pre-accepts Claude's folder trust dialog, which would swallow the argv prompt.
   *  Sent as `autonomousGoalWorkspace` for designs too: on the wire that flag only means this. */
  preAcceptFolderTrust: boolean
}

export function composerLaunchPolicy(
  launch: ComposerLaunchOverride | undefined
): ComposerLaunchPolicy {
  return {
    coordinatorEnv: launch?.kind === 'autonomous-goal',
    pinTerminalTui: launch !== undefined,
    preAcceptFolderTrust: launch !== undefined
  }
}
