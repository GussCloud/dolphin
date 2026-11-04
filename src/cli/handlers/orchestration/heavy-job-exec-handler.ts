import type { CommandHandler } from '../../dispatch'
import { getOptionalPositiveIntegerFlag } from '../../flags'
import { RuntimeClientError } from '../../runtime-client'
import {
  HEAVY_JOB_DEFAULT_MAX_WAIT_MS,
  HEAVY_JOB_QUEUE_TIMEOUT_EXIT_CODE,
  HEAVY_JOB_WRONG_HOST_EXIT_CODE
} from '../../../shared/heavy-job-queue'
import {
  acquireHeavyJobSlot,
  releaseHeavyJobSlot,
  startHeavyJobHeartbeat
} from './heavy-job-lease-client'
import { resolveHeavyJobQueueKey } from './heavy-job-queue-key'
import { runHeavyJob } from './heavy-job-runner'

export const ORCHESTRATION_HEAVY_JOB_HANDLERS: Record<string, CommandHandler> = {
  'orchestration exec': async ({ flags, client, cwd, json, rawArgs }) => {
    const command = rawArgs ?? []
    if (command.length === 0) {
      throw new RuntimeClientError(
        'invalid_argument',
        'Pass the command after --, e.g. dolphin orchestration exec -- pnpm build'
      )
    }
    // Why: SSH and WSL bridges run this CLI on the Dolphin client, not where the worktree lives;
    // running the command here would build on the wrong machine.
    if (process.env.DOLPHIN_CLI_CWD) {
      process.stderr.write(
        'orchestration exec cannot run from an SSH or WSL terminal yet; nothing ran. Run the command directly.\n'
      )
      process.exitCode = HEAVY_JOB_WRONG_HOST_EXIT_CODE
      return
    }
    const maxWaitMs =
      getOptionalPositiveIntegerFlag(flags, 'max-wait-ms') ?? HEAVY_JOB_DEFAULT_MAX_WAIT_MS
    const slot = await acquireHeavyJobSlot(
      client,
      { queueKey: resolveHeavyJobQueueKey(cwd), command, maxWaitMs },
      (ahead) => process.stderr.write(`Queued behind ${ahead} heavy job(s).\n`)
    )
    if (slot.kind === 'timed_out') {
      process.stderr.write(
        `Heavy-job queue still busy after ${Math.round(slot.waitedMs / 1000)}s; nothing ran. Retry the same command, run in the background or with a longer timeout.\n`
      )
      process.exitCode = HEAVY_JOB_QUEUE_TIMEOUT_EXIT_CODE
      return
    }
    if (slot.kind === 'unavailable') {
      process.stderr.write(`Warning: running without the heavy-job queue (${slot.reason}).\n`)
    }
    const stopHeartbeat =
      slot.kind === 'granted' ? startHeavyJobHeartbeat(client, slot.ticket) : () => undefined
    let run: Awaited<ReturnType<typeof runHeavyJob>>
    try {
      run = await runHeavyJob(command, cwd)
    } finally {
      stopHeartbeat()
      if (slot.kind === 'granted') {
        await releaseHeavyJobSlot(client, slot.ticket)
      }
    }
    process.exitCode = run.exitCode
    const queuedMs = slot.kind === 'granted' ? slot.waitedMs : 0
    if (json) {
      process.stdout.write(`${JSON.stringify({ ...run, queuedMs, queued: slot.kind }, null, 2)}\n`)
      return
    }
    process.stdout.write(
      `exit ${run.exitCode} in ${Math.round(run.durationMs / 1000)}s (queued ${Math.round(queuedMs / 1000)}s); full log: ${run.logPath}\n${run.tail ? `${run.tail}\n` : ''}`
    )
  }
}
