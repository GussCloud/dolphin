import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { collectAptPackageSets, INSTALL_APT_PACKAGES_ACTION } from './ci-apt-package-sets.mjs'

const read = (path) => parse(readFileSync(path, 'utf8'))
const action = read('.github/actions/install-apt-packages/action.yml')
const e2e = read('.github/workflows/e2e.yml')
const pr = read('.github/workflows/pr.yml')
const warmup = read('.github/workflows/ci-cache-warmup.yml')
const cleanup = read('.github/workflows/ci-cache-cleanup.yml')

describe('CI apt package sets', () => {
  it('warms every lane set, including the Playwright WebKit dependencies', () => {
    const sets = collectAptPackageSets()
    expect(sets).toContainEqual({
      runner: 'ubuntu-latest',
      packages:
        'build-essential fonts-noto-cjk openbox openssh-client python3 ripgrep x11-utils xvfb zsh',
      'playwright-browser': '',
      'no-install-recommends': 'false'
    })
    expect(sets).toContainEqual({
      runner: 'ubuntu-latest',
      packages: '',
      'playwright-browser': 'webkit',
      'no-install-recommends': 'true'
    })
    // The warm-up's own matrix step must not become a set of literal expressions.
    expect(sets.some((set) => set.packages.includes('${{'))).toBe(false)
    expect(new Set(sets.map((set) => JSON.stringify(set))).size).toBe(sets.length)
  })

  it('keeps the slow-mirror lanes on the cached installer', () => {
    // A raw apt-get here would download from the stalled mirror again with no wall-clock bound.
    for (const [name, job] of Object.entries(e2e.jobs)) {
      for (const step of job.steps ?? []) {
        expect(step.run ?? '', name).not.toMatch(/apt-get/)
      }
    }
    const webkit = pr.jobs.mobile_web_app.steps.find((step) => step.id === 'webkit')
    expect(webkit.uses).toBe(INSTALL_APT_PACKAGES_ACTION)
    expect(webkit.with['playwright-browser']).toBe('webkit')
    expect(pr.jobs.mobile_web_app['timeout-minutes']).toBeGreaterThan(0)
  })

  it('bounds every apt call and saves archives only after a successful install', () => {
    const install = action.runs.steps.find((step) => step.name === 'Install apt packages')
    expect(install.run).toMatch(/timeout \d+ sudo apt-get update/)
    expect(install.run).toContain('timeout "$INSTALL_TIMEOUT" sudo apt-get install')
    const names = action.runs.steps.map((step) => step.name)
    expect(names.indexOf('Restore apt archives')).toBeLessThan(
      names.indexOf('Install apt packages')
    )
    expect(names.indexOf('Install apt packages')).toBeLessThan(names.indexOf('Save apt archives'))
    const save = action.runs.steps.find((step) => step.name === 'Save apt archives')
    expect(save.uses).toBe('actions/cache/save@v5')
    expect(save.if).toContain("steps.restore.outputs.cache-hit != 'true'")
  })

  it('warms on main and deletes only closed pull request caches', () => {
    expect(warmup.on.push.branches).toEqual(['main'])
    expect(warmup.on.schedule).toBeDefined()
    expect(warmup.jobs.warm.strategy.matrix.include).toBe(
      '${{ fromJSON(needs.discover.outputs.sets) }}'
    )
    expect(cleanup.on.pull_request.types).toEqual(['closed'])
    expect(cleanup.permissions.actions).toBe('write')
    expect(cleanup.jobs.cleanup.steps[0].run).toContain('refs/pull/$PR_NUMBER/merge')
  })
})
