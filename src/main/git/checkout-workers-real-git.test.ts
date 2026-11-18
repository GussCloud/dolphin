import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { addWorktree } from './worktree'

let root = ''
let repo = ''

function git(cwd: string, args: string[]): void {
  execFileSync('git', args, { cwd, stdio: ['pipe', 'pipe', 'pipe'] })
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dolphin-checkout-workers-'))
  repo = join(root, 'repo')
  execFileSync('git', ['init', '--quiet', repo])
  git(repo, ['symbolic-ref', 'HEAD', 'refs/heads/main'])
  git(repo, ['config', 'user.email', 'test@example.com'])
  git(repo, ['config', 'user.name', 'Test User'])
  await writeFile(join(repo, 'file.txt'), 'one\n')
  git(repo, ['add', 'file.txt'])
  git(repo, ['commit', '--quiet', '-m', 'initial'])
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await rm(root, { recursive: true, force: true })
})

describe('checkout.workers on worktree creation', () => {
  it('checks out with one worker per core unless checkout.workers is configured', async () => {
    const trace = join(root, 'trace2.jsonl')
    vi.stubEnv('GIT_CONFIG_GLOBAL', join(root, 'empty-global-config'))
    vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1')
    vi.stubEnv('GIT_TRACE2_CONFIG_PARAMS', 'checkout.workers')
    vi.stubEnv('GIT_TRACE2_EVENT', trace)
    const checkoutWorkersSeenByAdd = async (branch: string): Promise<string | undefined> => {
      await rm(trace, { force: true })
      await addWorktree(repo, join(root, branch), branch, 'main', false, false)
      const events: { event?: string; name?: string; sid?: string; value?: string }[] = (
        await readFile(trace, 'utf8')
      )
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line))
      const addSid = events.find((e) => e.event === 'cmd_name' && e.name === 'worktree')?.sid
      return events.find((e) => e.event === 'def_param' && e.sid === addSid)?.value
    }

    expect(await checkoutWorkersSeenByAdd('parallel')).toBe('0')
    git(repo, ['config', 'checkout.workers', '2'])
    expect(await checkoutWorkersSeenByAdd('configured')).toBe('2')
  })
})
