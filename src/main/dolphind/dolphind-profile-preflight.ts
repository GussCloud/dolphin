import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { preflightProfileStateRuntime } from '../persistence/profile-state/profile-state-runtime-preflight'
import {
  DOLPHIND_STARTUP_PREFLIGHT_FLAG,
  DOLPHIND_PROFILE_PREFLIGHT_TIMEOUT_MS,
  parseDolphindProfilePreflight,
  dolphindProfilePreflightResponseSchema,
  type DolphindProfilePreflightResponse
} from '../../shared/dolphind-profile-preflight'
import { readDolphindArtifactIdentity } from './dolphind-artifact-identity'
import { resolveDolphindInstallRoot } from './dolphind-app-paths'
import {
  DOLPHIND_VERSION_FILENAME,
  dolphindBunRuntimeFilename
} from '../../shared/dolphind-artifacts'
import { DOLPHIND_BUN_VERSION } from '../../shared/dolphind-bun-runtime'
import { runProcess } from '../../shared/child-process/run-process'
import { preflightDolphindBunNativeRuntime } from './dolphind-bun-native-preflight'
import { DolphindBundledRuntimeError } from './dolphind-bundled-runtime'

/** Check every packaged start before a profile index, data-root lock or import is touched. */
export async function preflightBundledDolphindStartup(): Promise<void> {
  if (!process.versions.bun) {
    return
  }
  const directory = resolveDolphindInstallRoot()
  const identity = await readInstalledVersion(directory)
  const nonce = randomUUID()
  // Keep disposable SQLite ownership and native state out of the serving process.
  const result = await runProcess({
    program: join(directory, dolphindBunRuntimeFilename(process.platform)),
    args: [join(directory, 'dolphind.js'), DOLPHIND_STARTUP_PREFLIGHT_FLAG, nonce],
    env: { ...process.env, DOLPHIN_BACKGROUND_LAUNCH: '1' },
    timeoutMs: DOLPHIND_PROFILE_PREFLIGHT_TIMEOUT_MS,
    maxOutputBytes: 64 * 1024,
    terminationBarrier: true
  })
  if (result.code !== 0 || result.timedOut || result.outputTruncated) {
    const Failure = result.code === 78 ? DolphindBundledRuntimeError : Error
    throw new Failure(`The bundled Dolphin runtime failed readiness: ${result.stderr}`)
  }
  try {
    parseDolphindProfilePreflight(result.stdout, nonce, DOLPHIND_BUN_VERSION, identity)
  } catch (cause) {
    throw new DolphindBundledRuntimeError(
      'The bundled runtime returned invalid readiness identity',
      {
        cause
      }
    )
  }
}

/** Only disposable state is opened; no server, profile index or host adapters are installed. */
export async function runDolphindProfilePreflight(
  nonce: string | undefined,
  options: { nativeFeatures?: boolean } = {}
): Promise<void> {
  const checkedNonce = z.string().uuid().parse(nonce)
  let artifactVersion: string
  try {
    artifactVersion = await readDolphindArtifactIdentity(resolveDolphindInstallRoot())
  } catch (cause) {
    throw new DolphindBundledRuntimeError(
      'The bundled Dolphin artifacts are incomplete or altered',
      {
        cause
      }
    )
  }
  const result = await preflightProfileStateRuntime()
  if (process.versions.bun) {
    await preflightDolphindBunNativeRuntime(options)
  }
  const response: DolphindProfilePreflightResponse = {
    type: 'dolphin_profile_state_ready',
    nonce: checkedNonce,
    runtime: process.versions.bun ? 'bun' : 'node',
    runtimeVersion: process.versions.bun ?? process.versions.node,
    artifactVersion,
    ...result
  }
  console.log(JSON.stringify(response))
}

async function readInstalledVersion(directory: string): Promise<string> {
  try {
    return dolphindProfilePreflightResponseSchema.shape.artifactVersion.parse(
      (await readFile(join(directory, DOLPHIND_VERSION_FILENAME), 'utf8')).trim()
    )
  } catch (cause) {
    throw new DolphindBundledRuntimeError(
      'The installed Dolphin artifact version is missing or invalid',
      {
        cause
      }
    )
  }
}
