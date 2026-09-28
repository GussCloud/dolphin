/**
 * Activate installed bytes only after the candidate proves healthy. A rejected candidate
 * allows restarting the incumbent only when profile state is provably unchanged; otherwise
 * preserve current state and the prelaunch snapshot for explicit recovery.
 */
import type { SshConnection } from './ssh-connection'
import { DOLPHIND_STARTUP_READINESS_TIMEOUT_MS } from '../../shared/dolphind-profile-preflight'
import { execCommand } from './ssh-relay-deploy-helpers'
import { DOLPHIND_INSTALL_MODEL } from './remote-install-model'
import { writeRelayFile } from './ssh-relay-install-transfers'
import { computeRemoteInstallDir, readLocalFullVersion } from './ssh-relay-versioned-install'
import { RELAY_REMOTE_DIR } from './relay-protocol'
import {
  DOLPHIND_STATE_SNAPSHOT_DIR,
  serializeDolphindActivationRecord,
  withActivatedVersion,
  type DolphindActivationRecord,
  type DolphindStateSnapshot
} from './dolphind-activation-record'
import {
  dolphindActivationPath,
  readDolphindActivationRecord
} from './dolphind-activation-record-store'
import {
  evaluateDolphindActivation,
  type DolphindActivationVerdict
} from './dolphind-activation-gate'
import { planDolphindUpdate, type DolphindTerminalCensus } from './dolphind-update-plan'
import {
  DOLPHIND_LOG_FILENAME,
  dolphindLaunchCommand,
  parseDolphindReadinessOutput,
  readDolphindReadinessCommand
} from './dolphind-remote-launch'
import {
  rejectedDolphindStateRecoveryRefusal,
  stopOutgoingDolphind
} from './dolphind-remote-deploy-stop'
import {
  captureDolphindStateSnapshotCommand,
  dolphindSnapshotDirName,
  parseDolphindSnapshotCapture
} from './dolphind-state-snapshot'
import {
  dolphindStopFreedTheHost,
  parseDolphindStopOutcome,
  stopDolphindCommand
} from './dolphind-remote-process-control'
import { joinRemotePath, type RemoteHostPlatform } from './ssh-remote-platform'
import { computeLocalDolphindBuildHash } from './dolphind-local-build-hash'
import { preflightInstalledDolphind } from './dolphind-remote-preflight'
import { assertPosixDolphindHost } from './dolphind-remote-host-support'
import { installDolphindBundle } from './dolphind-remote-install'
import { materializeDolphindArtifact } from './dolphind-artifact-materializer'
import { resolveDolphindDeploymentTarget } from './dolphind-deployment-target'

export type DolphindDeployOptions = {
  conn: SshConnection
  host: RemoteHostPlatform
  remoteHome: string
  /** An already assembled bundle; otherwise materialize the packaged template for this host. */
  localDolphindDir?: string
  nodePath: string
  userDataDir: string
  bindHost: string
  port: number
  /**
   * Live-terminal counts, supplied by the caller from the runtime it is already connected
   * to. Not probed here: counting the daemon's sessions needs its protocol, and a deploy
   * that guessed zero from silence would be the "loss of contact means death" mistake.
   */
  census: DolphindTerminalCensus
  force?: boolean
  readinessTimeoutMs?: number
  now?: () => Date
  sleep?: (ms: number) => Promise<void>
  signal?: AbortSignal
}

export type DolphindDeployResult =
  | { outcome: 'installed-and-activated'; fullVersion: string; verdict: DolphindActivationVerdict }
  | { outcome: 'already-active'; fullVersion: string }
  | { outcome: 'installed-not-activated'; fullVersion: string; code: string; reason: string }

const READINESS_POLL_MS = 500
const STOP_WAIT_SECONDS = 20

function exec(options: DolphindDeployOptions, command: string): Promise<string> {
  return execCommand(options.conn, command, {
    wrapCommand: options.host.commandDialect !== 'powershell',
    signal: options.signal
  })
}

function baseDir(options: DolphindDeployOptions): string {
  return joinRemotePath(options.host, options.remoteHome, RELAY_REMOTE_DIR)
}

async function captureSnapshot(
  options: DolphindDeployOptions,
  fullVersion: string,
  outgoingVersion: string | null,
  takenAt: Date
): Promise<DolphindStateSnapshot | null> {
  // The caller has already stopped the outgoing runtime. This is required once profile state
  // includes SQLite: a tar of a live WAL, main database, and SHM file is not a SQLite backup.
  const dirName = dolphindSnapshotDirName(fullVersion, takenAt.getTime())
  const snapshotDir = joinRemotePath(
    options.host,
    baseDir(options),
    DOLPHIND_STATE_SNAPSHOT_DIR,
    dirName
  )
  const capture = parseDolphindSnapshotCapture(
    await exec(
      options,
      captureDolphindStateSnapshotCommand(options.host, options.userDataDir, snapshotDir)
    )
  )
  if (capture === 'failed') {
    throw new Error(
      `Could not snapshot ${options.userDataDir} before activating ${fullVersion}. Dolphin's ` +
        'persisted state carries no schema version, so without a snapshot a rollback has no ' +
        'way back. Refusing to activate.'
    )
  }
  // Empty profiles need no rollback snapshot.
  if (capture === 'empty') {
    return null
  }
  return {
    dirName,
    takenBeforeVersion: fullVersion,
    readableByVersion: outgoingVersion,
    takenAt: takenAt.toISOString()
  }
}

async function launchAndAwaitReadiness(
  options: DolphindDeployOptions,
  remoteInstallDir: string,
  fullVersion: string
): Promise<ReturnType<typeof parseDolphindReadinessOutput>> {
  await exec(
    options,
    dolphindLaunchCommand(options.host, { ...options, remoteInstallDir, fullVersion })
  )
  const deadline =
    Date.now() + (options.readinessTimeoutMs ?? DOLPHIND_STARTUP_READINESS_TIMEOUT_MS)
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  let last = parseDolphindReadinessOutput('')
  while (Date.now() < deadline) {
    options.signal?.throwIfAborted()
    last = parseDolphindReadinessOutput(
      await exec(options, readDolphindReadinessCommand(options.host, remoteInstallDir))
    )
    if (last.state !== 'pending') {
      return last
    }
    await sleep(READINESS_POLL_MS)
  }
  return last
}

/** Restart the incumbent only when the candidate left shared state unchanged. */
async function restoreIncumbent(
  options: DolphindDeployOptions,
  record: DolphindActivationRecord,
  candidateDir?: string,
  snapshot?: DolphindStateSnapshot | null
): Promise<string> {
  if (candidateDir) {
    const stopped = parseDolphindStopOutcome(
      await exec(
        options,
        stopDolphindCommand(options.host, candidateDir, {
          waitSeconds: STOP_WAIT_SECONDS,
          justLaunched: true
        })
      )
    )
    if (!dolphindStopFreedTheHost(stopped)) {
      return `The candidate itself did not stop (${stopped}); the host may still be serving the rejected build.`
    }
  }
  if (!record.active) {
    return 'No previous version was active, so this host is now serving nothing.'
  }
  if (candidateDir) {
    const snapshotDir = snapshot
      ? joinRemotePath(
          options.host,
          baseDir(options),
          DOLPHIND_STATE_SNAPSHOT_DIR,
          snapshot.dirName
        )
      : undefined
    const refusal = await rejectedDolphindStateRecoveryRefusal(options, record.active, snapshotDir)
    if (refusal) {
      return refusal
    }
  }
  const incumbentDir = computeRemoteInstallDir(
    DOLPHIND_INSTALL_MODEL,
    options.remoteHome,
    record.active
  )
  const parsed = await launchAndAwaitReadiness(options, incumbentDir, record.active)
  return parsed.state === 'ready'
    ? `dolphind ${record.active} was restarted and is serving again.`
    : `dolphind ${record.active} was relaunched but has not published readiness; this host may be down.`
}

/** Activate on a healthy verdict; retain changed candidate state for explicit recovery. */
export async function deployDolphind(input: DolphindDeployOptions): Promise<DolphindDeployResult> {
  assertPosixDolphindHost(input.host)
  const options = {
    ...input,
    localDolphindDir:
      input.localDolphindDir ??
      (await materializeDolphindArtifact(await resolveDolphindDeploymentTarget(input), {
        signal: input.signal
      }))
  }
  const now = options.now ?? ((): Date => new Date())
  const fullVersion = readLocalFullVersion(options.localDolphindDir)
  const remoteDir = computeRemoteInstallDir(DOLPHIND_INSTALL_MODEL, options.remoteHome, fullVersion)
  const record = await readDolphindActivationRecord(options)

  await installDolphindBundle(options, fullVersion, remoteDir)

  const plan = planDolphindUpdate({
    record,
    candidateVersion: fullVersion,
    census: options.census,
    ...(options.force !== undefined ? { force: options.force } : {})
  })
  if (plan.action === 'noop') {
    return { outcome: 'already-active', fullVersion }
  }
  if (plan.action === 'defer') {
    return {
      outcome: 'installed-not-activated',
      fullVersion,
      code: plan.code,
      reason: plan.reason
    }
  }

  try {
    await preflightInstalledDolphind({
      ...options,
      remoteInstallDir: remoteDir,
      fullVersion
    })
  } catch (error) {
    options.signal?.throwIfAborted()
    return {
      outcome: 'installed-not-activated',
      fullVersion,
      code: 'dolphind_candidate_preflight_failed',
      reason: `Candidate profile preflight failed; the incumbent was not stopped: ${
        error instanceof Error ? error.message : String(error)
      }`
    }
  }

  if (record.active) {
    const stopped = await stopOutgoingDolphind(options, record.active)
    if (!dolphindStopFreedTheHost(stopped)) {
      return {
        outcome: 'installed-not-activated',
        fullVersion,
        code: 'dolphind_outgoing_stop_incomplete',
        reason:
          `Could not verify that dolphind ${record.active} exited (${stopped}). ` +
          'No snapshot was taken and the candidate was not started. Dolphin requires matching ' +
          'runtime readiness before signaling an incumbent and confirmed exit before snapshotting.'
      }
    }
  }

  // A live SQLite WAL is not a backup boundary: tar can observe the main file, WAL and SHM
  // at different points and restore a set SQLite cannot recover. Stop the incumbent first so
  // its final durable flush has completed before capturing the pre-activation state.
  let snapshot: DolphindStateSnapshot | null = null
  if (record.active) {
    try {
      snapshot = await captureSnapshot(options, fullVersion, record.active, now())
    } catch (error) {
      const restored = await restoreIncumbent(options, record).catch(
        (restartError: unknown) =>
          `The incumbent could not be restarted: ${
            restartError instanceof Error ? restartError.message : String(restartError)
          }`
      )
      throw new Error(
        `${error instanceof Error ? error.message : String(error)} The incumbent was stopped ` +
          `before snapshotting; ${restored}`
      )
    }
  }

  const parsed = await launchAndAwaitReadiness(options, remoteDir, fullVersion)
  const verdict = evaluateDolphindActivation(parsed.state === 'ready' ? parsed.readiness : null, {
    buildHash: computeLocalDolphindBuildHash(options.localDolphindDir),
    fullVersion
  })
  if (verdict.decision === 'reject') {
    const restored = await restoreIncumbent(options, record, remoteDir, snapshot)
    return {
      outcome: 'installed-not-activated',
      fullVersion,
      code: verdict.code,
      reason:
        `${verdict.reason} Candidate stderr is at ` +
        `${joinRemotePath(options.host, remoteDir, DOLPHIND_LOG_FILENAME)}. ${restored}`
    }
  }

  await writeRelayFile(
    options.conn,
    options.host,
    dolphindActivationPath(options.host, options.remoteHome),
    serializeDolphindActivationRecord(withActivatedVersion(record, fullVersion, snapshot, now())),
    { signal: options.signal }
  )
  return { outcome: 'installed-and-activated', fullVersion, verdict }
}
