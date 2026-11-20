import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

// Why: the security job is a required check; dropping one of its scans would keep `verify`
// green while silently removing the protection it exists for.
const workflow = parse(readFileSync('.github/workflows/pr.yml', 'utf8'))
const job = workflow.jobs.security
const stepRuns = () => job.steps.map((step) => step.run ?? '').join('\n')

describe('PR security gate', () => {
  it('is required by verify and runs read-only', () => {
    expect(workflow.jobs.verify.needs).toContain('security')
    expect(workflow.jobs.verify.steps[0].run).toContain('check_job security "$SECURITY"')
    expect(job.permissions).toEqual({ contents: 'read' })
    expect(job['timeout-minutes']).toBeGreaterThan(0)
  })

  it('scans the PR commits for secrets with the repo config, bounded in time', () => {
    const scan = job.steps.find((step) => step.name === 'Scan PR commits for secrets')
    expect(scan.run).toContain('--config config/security/gitleaks.toml')
    expect(scan.run).toContain('$BASE_SHA..$HEAD_SHA')
    // A stalled blob fetch on the partial clone must fail fast, not hold the required check.
    expect(scan['timeout-minutes']).toBeGreaterThan(0)
    expect(scan['timeout-minutes']).toBeLessThan(job['timeout-minutes'])
  })

  it('verifies every downloaded scanner before running it', () => {
    const install = job.steps.find((step) => step.name === 'Install gitleaks')
    expect(install.env.GITLEAKS_SHA256).toMatch(/^[0-9a-f]{64}$/)
    expect(install.run).toContain('sha256sum -c')
    expect(stepRuns()).toMatch(/pip" install --quiet semgrep==\d+\.\d+\.\d+/)
  })

  it('audits dependencies and checks Semgrep findings against the baseline', () => {
    expect(stepRuns()).toContain('node config/scripts/dependency-audit-gate.mjs')
    expect(stepRuns()).toContain('node config/scripts/semgrep-baseline-gate.mjs check')
  })

  it('pins every third-party action by commit', () => {
    for (const step of job.steps.filter((candidate) => candidate.uses)) {
      expect(step.uses).toMatch(/@[0-9a-f]{40}$/)
    }
  })
})
