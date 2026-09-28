/** Executable entry for `dolphind`. See `./dolphind-entry.ts`. */
import process from 'node:process'
import { main, resolveDolphindExitCode } from './dolphind-entry'
import { runDolphindNativePreflight } from './dolphind-native-preflight'
import {
  DOLPHIND_PROFILE_PREFLIGHT_FLAG,
  DOLPHIND_STARTUP_PREFLIGHT_FLAG
} from '../../shared/dolphind-profile-preflight'
import {
  preflightBundledDolphindStartup,
  runDolphindProfilePreflight
} from './dolphind-profile-preflight'
import { handoffToBundledDolphind } from './dolphind-bundled-runtime'

// Why exit before the preflight: reaching this line means the whole module graph resolved
// under plain Node, which is all the build guard needs to prove. Probing natives or
// starting a server to prove it would bind a port and take a data-root lock on a build
// machine.
if (process.argv.includes('--dolphind-smoke-load-check')) {
  process.exit(0)
}

// Why here and not inside startDolphind: this must run before anything requires node-pty,
// and `dolphind-entry` reaches it through `await import('../ipc/pty')`. Static imports are
// evaluated before this statement, so the guarantee is that no module in the graph
// requires node-pty at import time — which the bundle's lazy `require("node-pty")` in
// local-pty-provider satisfies. See ./node-pty-precondition.ts for why a child process.
function failStartup(error: unknown): void {
  console.error('dolphind: failed to start:', error)
  // Why a resolved code and not a bare 1: a data-root or bind-address refusal is a
  // configuration fault that restarting cannot fix, and a supervisor needs to tell the two
  // apart to avoid restart-spinning on it.
  process.exit(resolveDolphindExitCode(error))
}

try {
  if (!handoffToBundledDolphind()) {
    const flag = process.argv[2]
    if (
      (flag === DOLPHIND_PROFILE_PREFLIGHT_FLAG || flag === DOLPHIND_STARTUP_PREFLIGHT_FLAG) &&
      process.argv.length === 4
    ) {
      void runDolphindProfilePreflight(process.argv[3], {
        nativeFeatures: flag === DOLPHIND_PROFILE_PREFLIGHT_FLAG
      }).catch(failStartup)
    } else {
      void preflightBundledDolphindStartup()
        .then(() => {
          runDolphindNativePreflight()
          return main()
        })
        .catch(failStartup)
    }
  }
} catch (error) {
  failStartup(error)
}
