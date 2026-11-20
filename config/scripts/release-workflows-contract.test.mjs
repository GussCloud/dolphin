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

  it('publishes the desktop release only after every leg uploaded', () => {
    const { jobs } = workflow('dolphin-windows-release')
    expect(jobs.publish.needs).toEqual(['build-win', 'build-win-arm64', 'build-mac'])
    const steps = jobs.publish.steps.map((step) => step.run ?? '').join('\n')
    expect(steps).toContain(
      'verify-release-required-assets.mjs "$TAG" --platforms=mac,win,win-arm64'
    )
    expect(steps).toContain('--prerelease --latest=false')
    const createDraft = jobs['build-win'].steps.find(
      (step) => step.name === 'Create the draft GitHub release'
    )
    expect(createDraft.run).toContain('create-draft-release.mjs')
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
    expect(jobs.ios.with.distribute_external).toBe(true)
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

  it('fast-forwards main after a promote, never by force', () => {
    const { jobs } = workflow('release-promote')
    const job = jobs['fast-forward-main']
    expect(job.needs).toEqual(['resolve', 'desktop', 'android', 'ios'])
    expect(job.permissions).toEqual({ contents: 'write' })
    const run = job.steps.map((step) => step.run ?? '').join('\n')
    expect(run).toContain('git push origin "$target:refs/heads/main"')
    expect(run).not.toMatch(/--force|\s-f\b|\+\$target|\+refs/)
    expect(run).toContain('::error::The release IS published, but main was not moved')
  })
})
