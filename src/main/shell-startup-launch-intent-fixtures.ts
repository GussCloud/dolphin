/**
 * The two launch intents Dolphin's call sites choose between, resolved through the
 * real selector so tests cannot drift from the decision production makes.
 *
 * Test support only; nothing under src/main imports this at runtime.
 */
import { selectShellStartupFeatures } from './shell-startup-features'

/** A pane Dolphin will write a startup command into. */
export const STARTUP_COMMAND_FEATURES = selectShellStartupFeatures({
  shellPath: 'zsh',
  env: {},
  hasStartupCommand: true,
  waitsForShellReady: true,
  emitsStartupIdentity: true
})

/** A pane carrying a Dolphin overlay but no startup command. */
export const OVERLAY_ONLY_FEATURES = selectShellStartupFeatures({
  shellPath: 'zsh',
  env: { DOLPHIN_CODEX_HOME: '/tmp/dolphin-codex-home' },
  hasStartupCommand: false,
  waitsForShellReady: false,
  emitsStartupIdentity: false
})
