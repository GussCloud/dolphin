import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const projectDir = resolve(import.meta.dirname, '../..')

describe('release blocker safeguards', () => {
  // Why its own line: Dolphin updates only from its own releases.
  it('keeps the root package version on the fork release line', () => {
    const packageJson = JSON.parse(readFileSync(resolve(projectDir, 'package.json'), 'utf8'))
    const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(packageJson.version)
    expect(match).not.toBeNull()
    const version = match.slice(1, 4).map(Number)
    const isAtLeastStable = version[0] > 0 || version[1] >= 1
    expect(isAtLeastStable).toBe(true)
  })

  it('passes the staging confirmation through the step environment', () => {
    const workflow = parse(
      readFileSync(
        resolve(projectDir, '.github/workflows/cloud-prove-relay-asia-staging.yml'),
        'utf8'
      )
    )
    const step = workflow.jobs.prove.steps.find(
      ({ name }) => name === 'Validate the exact staging proof request'
    )

    expect(step.env.CONFIRMATION).toBe('${{ inputs.confirmation }}')
    expect(step.run).toContain('test "${CONFIRMATION}" = PROVE_ASIA_STAGING')
    expect(step.run).not.toContain('${{ inputs.confirmation }}')
  })
})
