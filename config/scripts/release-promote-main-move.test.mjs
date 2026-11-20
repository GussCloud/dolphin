import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { parse } from 'yaml'
import { afterEach, describe, expect, it } from 'vitest'

// Runs the promote workflow's real "Move main" script against real git repositories. Only GitHub's
// refusal of GITHUB_TOKEN pushes that touch .github/workflows is reproduced, by a pre-receive hook.
const step = parse(readFileSync('.github/workflows/release-promote.yml', 'utf8')).jobs[
  'fast-forward-main'
].steps.find((candidate) => candidate.name === 'Move main to the promoted commit')

const WORKFLOWS_REFUSAL = `#!/bin/sh
while read old new ref; do
  if [ "$ref" = refs/heads/main ] &&
    git diff --name-only "$old" "$new" | grep -q '^.github/workflows/'; then
    echo 'refusing to allow a GitHub App to create or update workflow \`.github/workflows/ci.yml\` without \`workflows\` permission' >&2
    exit 1
  fi
done
`

let root
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()

function commit(cwd, file, message) {
  mkdirSync(dirname(join(cwd, file)), { recursive: true })
  writeFileSync(join(cwd, file), message)
  git(cwd, 'add', '-A')
  git(cwd, 'commit', '-q', '-m', message)
  return git(cwd, 'rev-parse', 'HEAD')
}

function setup(hook) {
  root = mkdtempSync(join(tmpdir(), 'promote-main-'))
  const remote = join(root, 'remote.git')
  const seed = join(root, 'seed')
  git(root, 'init', '-q', '--bare', remote)
  git(root, 'init', '-q', '-b', 'main', seed)
  git(seed, 'config', 'user.email', 'test@example.com')
  git(seed, 'config', 'user.name', 'test')
  commit(seed, 'app.txt', 'released')
  git(seed, 'remote', 'add', 'origin', remote)
  git(seed, 'push', '-q', 'origin', 'main')
  git(seed, 'checkout', '-q', '-b', 'develop')
  if (hook) {
    writeFileSync(join(remote, 'hooks', 'pre-receive'), hook)
    chmodSync(join(remote, 'hooks', 'pre-receive'), 0o755)
  }
  return { remote, seed }
}

function moveMain(remote, target) {
  const work = join(root, 'work')
  git(root, 'clone', '-q', '--branch', 'develop', remote, work)
  const summary = join(root, 'summary.md')
  writeFileSync(summary, '')
  const result = spawnSync('bash', ['-c', step.run], {
    cwd: work,
    encoding: 'utf8',
    env: { ...process.env, DESKTOP_SHA: target, MOBILE_SHA: '', GITHUB_STEP_SUMMARY: summary }
  })
  return { ...result, summary: readFileSync(summary, 'utf8') }
}

afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('promote moves main', () => {
  it('fast-forwards main to the promoted commit', () => {
    const { remote, seed } = setup(WORKFLOWS_REFUSAL)
    const target = commit(seed, 'app.txt', 'rc')
    git(seed, 'push', '-q', 'origin', 'develop')

    const result = moveMain(remote, target)

    expect(result.status).toBe(0)
    expect(git(remote, 'rev-parse', 'main')).toBe(target)
  })

  it('leaves main behind with a warning when the range edits workflows', () => {
    const { remote, seed } = setup(WORKFLOWS_REFUSAL)
    const before = git(remote, 'rev-parse', 'main')
    const target = commit(seed, '.github/workflows/ci.yml', 'ci change')
    git(seed, 'push', '-q', 'origin', 'develop')

    const result = moveMain(remote, target)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('::warning::The release IS published')
    expect(result.summary).toContain('main NOT moved')
    expect(git(remote, 'rev-parse', 'main')).toBe(before)
  })

  it('merges into a main that has a sync merge commit develop lacks', () => {
    const { remote, seed } = setup()
    const synced = commit(seed, 'app.txt', 'rc 1')
    git(seed, 'push', '-q', 'origin', 'develop')
    git(seed, 'checkout', '-q', 'main')
    git(seed, 'merge', '-q', '--no-ff', '-m', 'sync PR', synced)
    git(seed, 'push', '-q', 'origin', 'main')
    git(seed, 'checkout', '-q', 'develop')
    const target = commit(seed, 'app.txt', 'rc 2')
    git(seed, 'push', '-q', 'origin', 'develop')

    const result = moveMain(remote, target)

    expect(result.status).toBe(0)
    expect(
      spawnSync('git', ['merge-base', '--is-ancestor', target, 'main'], { cwd: remote }).status
    ).toBe(0)
  })

  it('fails on any other rejection', () => {
    const { remote, seed } = setup(
      '#!/bin/sh\nwhile read old new ref; do [ "$ref" = refs/heads/main ] && echo "protected branch hook declined" >&2 && exit 1; done\nexit 0\n'
    )
    const target = commit(seed, 'app.txt', 'rc')
    git(seed, 'push', '-q', 'origin', 'develop')

    const result = moveMain(remote, target)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain('::error::The release IS published')
  })
})
