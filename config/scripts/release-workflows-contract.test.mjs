import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const workflow = (name) => parse(readFileSync(`.github/workflows/${name}.yml`, 'utf8'))
const PLATFORM_WORKFLOWS = [
  'dolphin-windows-release',
  'dolphin-android-release',
  'dolphin-ios-release'
]
const CALLS = {
  desktop: './.github/workflows/dolphin-windows-release.yml',
  android: './.github/workflows/dolphin-android-release.yml',
  ios: './.github/workflows/dolphin-ios-release.yml'
}

describe('release workflows', () => {
  it.each(PLATFORM_WORKFLOWS)('%s is never started by a push', (name) => {
    const on = workflow(name).on
    expect(on.push).toBeUndefined()
    expect(on.workflow_call).toBeDefined()
  })

  it('leaves no manual path to a published desktop release', () => {
    expect(workflow('dolphin-windows-release').on.workflow_dispatch).toBeUndefined()
  })

  it('builds every desktop leg in parallel into one draft, published only after all uploaded', () => {
    const { jobs, on } = workflow('dolphin-windows-release')
    const createDraft = jobs.draft.steps.find(
      (step) => step.name === 'Create the draft GitHub release'
    )
    expect(createDraft.run).toContain('create-draft-release.mjs')
    for (const leg of ['build-win', 'build-win-arm64', 'build-mac']) {
      expect(jobs[leg].needs, leg).toBe('draft')
      expect(jobs[leg].env.TAG, leg).toBe('${{ needs.draft.outputs.tag }}')
    }
    expect(jobs.publish.needs).toEqual(['draft', 'build-win', 'build-win-arm64', 'build-mac'])
    expect(jobs.publish.if).toContain('inputs.publish')
    expect(on.workflow_call.inputs.publish.default).toBe(true)
    expect(jobs.publish.steps.at(-1).uses).toBe('./.github/actions/publish-desktop-release')
    const action = parse(readFileSync('.github/actions/publish-desktop-release/action.yml', 'utf8'))
    const steps = action.runs.steps.map((step) => step.run ?? '').join('\n')
    expect(steps).toContain(
      'verify-release-required-assets.mjs "$TAG" --platforms=mac,win,win-arm64'
    )
    expect(steps).toContain('--prerelease --latest=false')
  })

  it.each([
    ['release-beta', true],
    ['release-promote', false]
  ])('%s calls the platform workflows (prerelease=%s)', (name, prerelease) => {
    const { jobs, on } = workflow(name)
    expect(Object.keys(on).sort()).toEqual(
      name === 'release-beta' ? ['push', 'workflow_dispatch'] : ['workflow_dispatch']
    )
    expect(on.workflow_dispatch.inputs.app.options).toEqual(['desktop', 'mobile', 'both'])
    for (const [job, uses] of Object.entries(CALLS)) {
      expect(jobs[job].uses).toBe(uses)
      expect(jobs[job].secrets).toBe('inherit')
    }
    expect(jobs.desktop.with.prerelease).toBe(prerelease)
    expect(jobs.android.with.prerelease).toBe(prerelease)
  })

  it('gates every promote build behind the production environment', () => {
    const { jobs } = workflow('release-promote')
    expect(jobs.approve.environment).toBe('production')
    for (const job of Object.keys(CALLS)) {
      expect(jobs[job].needs).toContain('approve')
    }
    const resolve = jobs.resolve.steps.map((step) => step.run ?? '').join('\n')
    expect(
      resolve.match(/verify-release-commit\.mjs "\$sha" --branch develop --require-checks/g)
    ).toHaveLength(2)
    // Why: a tests- or CI-only merge cuts no rc; the promote must still run develop's tests.
    expect(
      resolve.match(/beta-release-scope\.mjs --promotion-commit (desktop|mobile)/g)
    ).toHaveLength(2)
    expect(jobs.resolve.steps[0].with['fetch-depth']).toBe(0)
  })

  it('passes every input a called workflow requires', () => {
    for (const name of ['release-beta', 'release-promote']) {
      const { jobs } = workflow(name)
      for (const [job, uses] of Object.entries(CALLS)) {
        const called = workflow(uses.replace('./.github/workflows/', '').replace('.yml', ''))
        const required = Object.entries(called.on.workflow_call.inputs)
          .filter(([, input]) => input.required)
          .map(([key]) => key)
        for (const key of required) {
          expect(jobs[job].with, `${name} ${job} ${key}`).toHaveProperty(key)
        }
      }
    }
  })

  it('cuts a beta on every push to develop and on no other branch', () => {
    const { on, concurrency, jobs } = workflow('release-beta')
    expect(on.push).toEqual({ branches: ['develop'] })
    expect(concurrency.cancel_in_progress ?? concurrency['cancel-in-progress']).toBe(false)
    const resolve = jobs.resolve.steps.map((step) => step.run ?? '').join('\n')
    expect(resolve).toContain('verify-release-commit.mjs "$sha" --branch develop')
    const commit = jobs.resolve.steps.find((step) => step.id === 'commit')
    expect(commit.env.REF).toContain("github.event_name == 'push' && github.sha")
  })

  it('gates each beta build on the scope script', () => {
    const { jobs } = workflow('release-beta')
    const scope = jobs.resolve.steps.find((step) => step.id === 'scope')
    expect(scope.run).toContain('beta-release-scope.mjs "$SHA"')
    expect(scope.run).toContain('beta-release-scope.mjs --app "$APP"')
    expect(jobs.resolve.outputs.desktop).toBe('${{ steps.scope.outputs.desktop }}')
    expect(jobs.resolve.outputs.mobile).toBe('${{ steps.scope.outputs.mobile }}')
    expect(jobs.desktop.if).toBe("needs.resolve.outputs.desktop == 'true'")
    expect(jobs.android.if).toBe("needs.resolve.outputs.mobile == 'true'")
    expect(jobs.ios.if).toBe("needs.resolve.outputs.mobile == 'true'")
    const versionSteps = jobs.resolve.steps.filter(
      (step) => step.id === 'desktop' || step.id === 'mobile'
    )
    expect(versionSteps.map((step) => step.if)).toEqual([
      "steps.scope.outputs.desktop == 'true'",
      "steps.scope.outputs.mobile == 'true'"
    ])
  })

  it('publishes nothing from a promote until the whole e2e suite passed on the promoted commit', () => {
    const { jobs } = workflow('release-promote')
    expect(jobs.e2e.uses).toBe('./.github/workflows/e2e.yml')
    expect(jobs.e2e.with).toEqual({ ref: '${{ needs.resolve.outputs.target_sha }}', retries: '1' })
    expect(jobs.e2e_wsl.uses).toBe('./.github/workflows/windows-wsl-e2e.yml')
    expect(jobs.e2e_wsl.with.retries).toBe('1')
    // Why the builds may run beside the suite: they only stage, never publish.
    expect(jobs.desktop.with.publish).toBe(false)
    expect(jobs.android.with.publish_github_release).toBe(false)
    expect(jobs.ios.with).not.toHaveProperty('distribute_external')
    const publishers = {
      'desktop-publish': 'desktop',
      'android-publish': 'android',
      'ios-distribute': 'ios'
    }
    for (const [job, build] of Object.entries(publishers)) {
      expect(jobs[job].needs, job).toEqual(expect.arrayContaining(['e2e', 'e2e_wsl', build]))
      // Why no condition: always() or !failure() would run it after a failed suite or build.
      expect(jobs[job].if, job).toBeUndefined()
    }
    const distribute = jobs['ios-distribute'].steps.map((step) => step.run ?? '').join('\n')
    expect(distribute).toContain('fastlane ios distribute_testflight')
    const androidPublish = jobs['android-publish'].steps.map((step) => step.uses ?? '')
    expect(androidPublish).toContain('./.github/actions/publish-android-release')
  })

  it('beta still publishes inside the platform workflows', () => {
    const { jobs } = workflow('release-beta')
    expect(jobs.desktop.with).not.toHaveProperty('publish')
    expect(jobs.android.with).not.toHaveProperty('publish_github_release')
    const android = workflow('dolphin-android-release').jobs['build-android'].steps
    expect(android.find((step) => step.name === 'Publish GitHub release').uses).toBe(
      './.github/actions/publish-android-release'
    )
  })

  it('runs the whole suite on every develop merge and reports failures and flaky tests', () => {
    const nightly = workflow('e2e-develop')
    expect(nightly.on.schedule).toEqual([{ cron: '13 6,16 * * *' }])
    expect(nightly.on.push).toEqual({ branches: ['develop'] })
    expect(nightly.jobs.suite.uses).toBe('./.github/workflows/e2e.yml')
    // Why no test_files: an empty list is what makes e2e.yml run every shard and lane.
    // Why decide's sha: schedules fire from main, where github.sha is main, not develop.
    expect(nightly.jobs.suite.with).toEqual({
      ref: '${{ needs.decide.outputs.sha }}',
      retries: '1'
    })
    expect(nightly.jobs.wsl.uses).toBe('./.github/workflows/windows-wsl-e2e.yml')
    expect(nightly.jobs.wsl.with).toEqual({ ref: '${{ needs.decide.outputs.sha }}', retries: '1' })
    const flakyRun = nightly.jobs.flaky.steps.map((step) => step.run ?? '').join('\n')
    expect(flakyRun).toContain('select(.title == "Flaky e2e")')
    const decideRun = nightly.jobs.decide.steps.map((step) => step.run ?? '').join('\n')
    expect(decideRun).toContain('commits/develop')
    expect(JSON.stringify(nightly)).not.toContain('github.sha')
    expect(nightly.jobs.record.needs).toEqual(['decide', 'suite', 'wsl'])
    expect(nightly.jobs.report.permissions).toEqual({ contents: 'read', issues: 'write' })
    expect(nightly.concurrency).toEqual({ group: 'e2e-develop', 'cancel-in-progress': false })
  })

  it('retries only in the full-suite runs, and reports each retried pass as flaky', () => {
    for (const name of ['e2e', 'windows-wsl-e2e']) {
      const { env, on } = workflow(name)
      expect(env.DOLPHIN_E2E_RETRIES, name).toBe("${{ inputs.retries || '0' }}")
      expect(on.workflow_call.inputs.retries.required, name).toBe(false)
    }
    // Why PRs stay at 0: a spec a PR writes or edits must pass on its first attempt.
    expect(JSON.stringify(workflow('pr'))).not.toContain('retries')
    const config = readFileSync('tests/playwright.config.ts', 'utf8')
    expect(config).toContain("process.env.DOLPHIN_E2E_RETRIES ?? '0'")
    expect(config).toContain('./e2e/flaky-annotation-reporter.ts')
    const reporter = readFileSync('tests/e2e/flaky-annotation-reporter.ts', 'utf8')
    expect(reporter).toContain("test.outcome() !== 'flaky'")
    expect(reporter).toContain('::warning title=Flaky e2e::')
  })

  it('moves main after a promote, never by force', () => {
    const { jobs } = workflow('release-promote')
    const job = jobs['fast-forward-main']
    // Why e2e in needs: a failed suite skips the publish jobs, and a skipped job is not a failure.
    expect(job.needs).toEqual([
      'resolve',
      'e2e',
      'e2e_wsl',
      'desktop-publish',
      'android-publish',
      'ios-distribute'
    ])
    expect(job.permissions).toEqual({ contents: 'write' })
    const run = job.steps.map((step) => step.run ?? '').join('\n')
    expect(run).toContain('git push origin "$new_main:refs/heads/main"')
    expect(run).not.toMatch(/--force|\s-f\b|\+\$target|\+refs/)
    expect(run).toContain('::error::The release IS published, but main was not moved')
  })
})
