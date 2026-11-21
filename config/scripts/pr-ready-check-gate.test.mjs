import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { runProcess } from '../../src/shared/child-process/run-process'

const workflow = parse(readFileSync('.github/workflows/pr.yml', 'utf8'))
const gate = workflow.jobs.verify.steps.find((step) => step.name === 'Require successful checks')
const variable = (job) => job.replaceAll('-', '_').toUpperCase()
// Why from verify.needs: jobs gated outside pr-code-change-scope (e2e, windows_wsl) must count too.
const PR_CHECK_JOBS = workflow.jobs.verify.needs.filter((job) => job !== 'code_paths')

function requiredResults(shouldRun) {
  return Object.fromEntries(
    PR_CHECK_JOBS.flatMap((job) => [
      [variable(job), shouldRun ? 'success' : 'skipped'],
      [`${variable(job)}_SHOULD_RUN`, String(shouldRun)]
    ])
  )
}

async function verify(results) {
  return runProcess({
    program: 'bash',
    args: ['-c', gate.run],
    env: {
      ...process.env,
      DOLPHIN_BACKGROUND_LAUNCH: '1',
      CODE_PATHS: 'success',
      SHOULD_RUN: 'true',
      ...results
    },
    timeoutMs: 10_000
  })
}

// The aggregate runs as Bash on Linux; Windows has no required Bash installation.
describe.skipIf(process.platform === 'win32')(
  'readiness reuse through the real aggregate gate',
  () => {
    it('accepts completed required checks or skips authorized by exact-source evidence', async () => {
      expect((await verify(requiredResults(true))).code).toBe(0)
      expect((await verify(requiredResults(false))).code).toBe(0)
    })

    it('rejects every missing, failed or cancelled required result when reuse is unavailable', async () => {
      for (const job of PR_CHECK_JOBS) {
        for (const result of ['', 'skipped', 'failure', 'cancelled']) {
          const verdict = await verify({ ...requiredResults(true), [variable(job)]: result })
          expect(verdict.code, `${job}: ${result}`).toBe(1)
        }
      }
    })

    it('requires the detector to succeed even when every downstream job is skipped', async () => {
      for (const result of ['', 'skipped', 'failure', 'cancelled']) {
        expect((await verify({ ...requiredResults(false), CODE_PATHS: result })).code).toBe(1)
      }
    })

    it('rejects unexpected downstream execution when the proven plan requires skips', async () => {
      for (const job of PR_CHECK_JOBS) {
        const verdict = await verify({ ...requiredResults(false), [variable(job)]: 'success' })
        expect(verdict.code, job).toBe(1)
      }
    })
  }
)
