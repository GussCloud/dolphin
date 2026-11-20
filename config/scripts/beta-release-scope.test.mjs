import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  appNeedsBeta,
  detectBetaScope,
  isDesktopReleasePath,
  isMobileReleasePath,
  isTestPath,
  nearestReleaseTag,
  scopeForApp
} from './beta-release-scope.mjs'

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim()
}

function withGitRepo(run) {
  const dir = mkdtempSync(join(tmpdir(), 'dolphin-beta-scope-'))
  try {
    git(dir, ['init', '--initial-branch=develop'])
    git(dir, ['config', 'user.name', 'Test Bot'])
    git(dir, ['config', 'user.email', 'test@example.com'])
    git(dir, ['config', 'commit.gpgsign', 'false'])
    git(dir, ['config', 'tag.gpgsign', 'false'])
    run(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

function commitFile(cwd, file) {
  const path = join(cwd, file)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${file}\n${Math.random()}\n`)
  git(cwd, ['add', '--all'])
  git(cwd, ['commit', '-m', `change ${file}`])
  return git(cwd, ['rev-parse', 'HEAD'])
}

const quiet = { log: () => {} }

describe('beta release paths', () => {
  it('treats test files and fixtures as test-only', () => {
    expect(isTestPath('src/main/a.test.ts')).toBe(true)
    expect(isTestPath('tests/e2e/x.spec.ts')).toBe(true)
    expect(isTestPath('src/shared/__fixtures__/x.json')).toBe(true)
    expect(isTestPath('mobile/src/a.test.tsx')).toBe(true)
    expect(isTestPath('src/main/testing.ts')).toBe(false)
  })

  it('counts desktop paths that are not docs, tests or mobile', () => {
    expect(isDesktopReleasePath('src/main/index.ts')).toBe(true)
    expect(isDesktopReleasePath('package.json')).toBe(true)
    expect(isDesktopReleasePath('docs/reference/release-process.md')).toBe(false)
    expect(isDesktopReleasePath('README.md')).toBe(false)
    expect(isDesktopReleasePath('src/main/index.test.ts')).toBe(false)
    expect(isDesktopReleasePath('mobile/app.json')).toBe(false)
    // CI and release-pipeline changes ship nothing new to desktop users.
    expect(isDesktopReleasePath('.github/workflows/pr.yml')).toBe(false)
    expect(isDesktopReleasePath('.github/workflows/release-beta.yml')).toBe(false)
    expect(isDesktopReleasePath('config/scripts/verify-pr-local.mjs')).toBe(false)
    expect(isDesktopReleasePath('config/electron-builder.config.cjs')).toBe(true)
    expect(isDesktopReleasePath('resources/build/icon.png')).toBe(true)
  })

  it('counts mobile paths that are not docs or tests', () => {
    expect(isMobileReleasePath('mobile/app.json')).toBe(true)
    expect(isMobileReleasePath('mobile/src/App.tsx')).toBe(true)
    expect(isMobileReleasePath('mobile/README.md')).toBe(false)
    expect(isMobileReleasePath('mobile/docs/i18n.md')).toBe(false)
    expect(isMobileReleasePath('mobile/src/App.test.tsx')).toBe(false)
    expect(isMobileReleasePath('src/main/index.ts')).toBe(false)
  })

  it('counts an app with no release tag as changed', () => {
    expect(appNeedsBeta('desktop', null)).toBe(true)
    expect(appNeedsBeta('desktop', [])).toBe(false)
    expect(appNeedsBeta('mobile', ['docs/x.md', 'src/a.ts'])).toBe(false)
  })

  it('maps a dispatch app choice to both outputs', () => {
    expect(scopeForApp('desktop')).toEqual({ desktop: true, mobile: false })
    expect(scopeForApp('mobile')).toEqual({ desktop: false, mobile: true })
    expect(scopeForApp('both')).toEqual({ desktop: true, mobile: true })
    expect(() => scopeForApp('')).toThrow(/desktop, mobile or both/)
  })
})

describe('detectBetaScope', () => {
  it('cuts both apps when neither has a release tag', () => {
    withGitRepo((repo) => {
      const sha = commitFile(repo, 'docs/readme.md')
      expect(detectBetaScope(sha, { cwd: repo, ...quiet })).toEqual({
        desktop: true,
        mobile: true
      })
    })
  })

  it('diffs each app from its own nearest tag, rc or stable', () => {
    withGitRepo((repo) => {
      commitFile(repo, 'src/main/a.ts')
      git(repo, ['tag', 'mobile-android-v0.0.65'])
      commitFile(repo, 'mobile/src/App.tsx')
      git(repo, ['tag', 'v0.2.56-rc.1'])
      const sha = commitFile(repo, 'docs/notes.md')

      expect(detectBetaScope(sha, { cwd: repo, ...quiet })).toEqual({
        desktop: false,
        mobile: true
      })
    })
  })

  it('cuts nothing when only docs and tests changed since both tags', () => {
    withGitRepo((repo) => {
      commitFile(repo, 'src/main/a.ts')
      git(repo, ['tag', 'v0.2.55'])
      git(repo, ['tag', 'mobile-android-v0.0.65'])
      commitFile(repo, 'src/main/a.test.ts')
      commitFile(repo, 'mobile/README.md')
      const sha = commitFile(repo, 'tests/e2e/x.spec.ts')

      expect(detectBetaScope(sha, { cwd: repo, ...quiet })).toEqual({
        desktop: false,
        mobile: false
      })
    })
  })

  it('ignores mobile-android-latest as a version boundary', () => {
    withGitRepo((repo) => {
      commitFile(repo, 'mobile/src/App.tsx')
      git(repo, ['tag', 'mobile-android-v0.0.65'])
      const sha = commitFile(repo, 'mobile/src/Other.tsx')
      git(repo, ['tag', 'mobile-android-latest'])

      expect(nearestReleaseTag('mobile', sha, { cwd: repo })).toBe('mobile-android-v0.0.65')
      expect(detectBetaScope(sha, { cwd: repo, ...quiet }).mobile).toBe(true)
    })
  })

  it('fails on an unknown commit instead of cutting a beta', () => {
    withGitRepo((repo) => {
      commitFile(repo, 'src/main/a.ts')
      expect(() => detectBetaScope('0'.repeat(40), { cwd: repo, ...quiet })).toThrow()
    })
  })
})
