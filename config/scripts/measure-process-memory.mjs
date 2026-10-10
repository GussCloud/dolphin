#!/usr/bin/env node
// Per-process RAM/CPU census of a built Dolphin under scripted load: idle, terminals,
// browser pages, and hidden worktrees with browser pages. Answers "which process type
// does each terminal / browser page / hidden worktree actually cost?".
//
// Prereq: `VITE_EXPOSE_STORE=true electron-vite build` (the renderer store drives the load).
// Usage:  node config/scripts/measure-process-memory.mjs [--settle-ms 30000] [--title-churn]
//         [--cpu-window-ms 60000] [--heavy-url https://github.com] [--no-heavy] [--out file.json]
// The app runs hidden (DOLPHIN_E2E_HEADLESS + DOLPHIN_BACKGROUND_LAUNCH) in a throwaway
// profile; only the process tree this script spawns is killed. "private" is commit
// (PrivatePageCount) on Windows and RSS elsewhere; use it for "what would we free" — a
// browser guest's working set is ~4x its private bytes because it counts shared pages.

import { _electron as electron } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createCompletedOnboardingProfile } from './windows-apphang-repro/wsl-workspace-fixture.mjs'

const rootDir = path.resolve(import.meta.dirname, '..', '..')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const toMB = (bytes) => Math.round((bytes / 1048576) * 10) / 10

function parseArgs(argv) {
  const options = {
    settleMs: 30_000,
    cpuWindowMs: 60_000,
    heavyUrl: 'https://github.com',
    titleChurn: false,
    out: null
  }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--settle-ms') {
      options.settleMs = Number(argv[++i])
    } else if (arg === '--cpu-window-ms') {
      options.cpuWindowMs = Number(argv[++i])
    } else if (arg === '--heavy-url') {
      options.heavyUrl = argv[++i]
    } else if (arg === '--title-churn') {
      options.titleChurn = true
    } else if (arg === '--no-heavy') {
      options.heavyUrl = null
    } else if (arg === '--out') {
      options.out = argv[++i]
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
  }
  return options
}

// Why short: Windows MAX_PATH breaks deep worktree and profile paths under %TEMP%.
const shortRoot = path.join(os.tmpdir(), 'dpmem')

function git(cwd, ...args) {
  execFileSync('git', args, { cwd, stdio: 'pipe' })
}

function createRepoFixture() {
  mkdirSync(shortRoot, { recursive: true })
  const baseDir = mkdtempSync(path.join(shortRoot, 'fx-'))
  const repoPath = path.join(baseDir, 'repo')
  mkdirSync(repoPath)
  git(repoPath, 'init', '--initial-branch=main')
  git(repoPath, 'config', 'user.email', 'bench@dolphin.local')
  git(repoPath, 'config', 'user.name', 'Dolphin Bench')
  writeFileSync(path.join(repoPath, 'README.md'), '# process memory fixture\n')
  git(repoPath, 'add', '.')
  git(repoPath, 'commit', '-m', 'init', '--no-gpg-sign')
  return { baseDir, repoPath: realpathSync.native(repoPath) }
}

// Small but non-trivial page: some DOM and a timer, like a local dev server's app shell.
function startLocalPageServer(titleChurn) {
  const server = http.createServer((req, res) => {
    const rows = Array.from({ length: 200 }, (_, i) => `<li>row ${i}</li>`).join('')
    // --title-churn: a per-second title update, like a dev server's live clock or HMR status.
    const tick = titleChurn ? 'document.title' : 'document.body.dataset.t'
    res.writeHead(200, { 'content-type': 'text/html' })
    res.end(
      `<!doctype html><title>${req.url}</title><h1>${req.url}</h1><ul>${rows}</ul>` +
        `<script>setInterval(()=>{${tick}=String(Date.now())},1000)</script>`
    )
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

// ─── OS process sweep ────────────────────────────────────────────────

function sweepProcesses() {
  if (process.platform !== 'win32') {
    const out = execFileSync('ps', ['-eo', 'pid=,ppid=,rss=,time=,comm='], { encoding: 'utf8' })
    return out
      .trim()
      .split('\n')
      .map((line) => {
        const [pid, ppid, rss, time, ...name] = line.trim().split(/\s+/)
        const [h, m, s] = time.split(':').map(Number)
        return {
          pid: Number(pid),
          ppid: Number(ppid),
          name: name.join(' '),
          workingSet: Number(rss) * 1024,
          privateBytes: Number(rss) * 1024,
          cpuSeconds: (h || 0) * 3600 + (m || 0) * 60 + (s || 0)
        }
      })
  }
  const script =
    'Get-CimInstance Win32_Process | ForEach-Object { "{0}|{1}|{2}|{3}|{4}|{5}|{6}" -f ' +
    '$_.ProcessId,$_.ParentProcessId,$_.Name,$_.WorkingSetSize,$_.PrivatePageCount,' +
    '($_.UserModeTime + $_.KernelModeTime),($_.CommandLine -replace "[|\r\n]"," ") }'
  const out = execFileSync(
    'powershell.exe',
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      encoding: 'utf8',
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024
    }
  )
  return out
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [pid, ppid, name, ws, priv, ticks, commandLine = ''] = line.split('|')
      return {
        commandLine,
        pid: Number(pid),
        ppid: Number(ppid),
        name,
        workingSet: Number(ws),
        privateBytes: Number(priv),
        cpuSeconds: Number(ticks) / 1e7
      }
    })
}

function descendants(rows, rootPid) {
  const childrenOf = new Map()
  for (const row of rows) {
    const list = childrenOf.get(row.ppid) ?? []
    list.push(row)
    childrenOf.set(row.ppid, list)
  }
  const result = []
  const stack = [...(childrenOf.get(rootPid) ?? [])]
  const seen = new Set([rootPid])
  while (stack.length) {
    const row = stack.pop()
    if (seen.has(row.pid)) {
      continue
    }
    seen.add(row.pid)
    result.push(row)
    stack.push(...(childrenOf.get(row.pid) ?? []))
  }
  return result
}

// ─── App introspection ───────────────────────────────────────────────

async function readMainProcessView(app) {
  return app.evaluate(({ app: electronApp, webContents }) => {
    const metrics = electronApp.getAppMetrics().map((m) => ({
      pid: m.pid,
      type: m.type,
      serviceName: m.serviceName ?? null,
      name: m.name ?? null
    }))
    const contents = webContents
      .getAllWebContents()
      .filter((wc) => !wc.isDestroyed())
      .map((wc) => ({
        pid: wc.getOSProcessId(),
        type: wc.getType(),
        url: wc.getURL()
      }))
    const heap = process.memoryUsage()
    return { metrics, contents, mainHeapUsed: heap.heapUsed, mainRss: heap.rss }
  })
}

async function readDaemonPid(page) {
  return page.evaluate(async () => {
    const snapshot = await window.api.memory.getSnapshot()
    return snapshot?.daemon?.pid ?? null
  })
}

const SHELL_NAMES = new Set([
  'powershell.exe',
  'pwsh.exe',
  'cmd.exe',
  'bash.exe',
  'wsl.exe',
  'bash',
  'zsh',
  'sh',
  'fish'
])
const CONSOLE_HOST_NAMES = new Set(['openconsole.exe', 'conhost.exe'])

function describeHelper(row, byPid, shellPids, daemonPid) {
  const name = row.name.toLowerCase()
  if (row.pid === daemonPid || /daemon-entry/.test(row.commandLine)) {
    return 'terminal:daemon'
  }
  if (CONSOLE_HOST_NAMES.has(name)) {
    return 'terminal:console-host'
  }
  if (shellPids.has(row.pid)) {
    return 'terminal:shell'
  }
  for (let parent = byPid.get(row.ppid); parent; parent = byPid.get(parent.ppid)) {
    if (shellPids.has(parent.pid)) {
      return `terminal:shell-child(${row.name})`
    }
  }
  const typeFlag = /--type=([\w-]+)/.exec(row.commandLine)?.[1]
  const script = /([\w-]+)\.(?:c?js|mjs)/.exec(row.commandLine)?.[1]
  return `helper:${row.name}${typeFlag ? `(--type=${typeFlag})` : script ? `(${script})` : ''}`
}

function classify(rows, mainPid, daemonPid, view, hiddenWorktreeTags) {
  const byPid = new Map(rows.map((row) => [row.pid, row]))
  const contentsByPid = new Map()
  for (const wc of view.contents) {
    const list = contentsByPid.get(wc.pid) ?? []
    list.push(wc)
    contentsByPid.set(wc.pid, list)
  }
  const entries = []
  const seen = new Set()
  const add = (pid, category, extra = {}) => {
    const row = byPid.get(pid)
    if (!row || seen.has(pid)) {
      return
    }
    seen.add(pid)
    entries.push({ ...row, category, ...extra })
  }

  for (const metric of view.metrics) {
    const type = String(metric.type).toLowerCase()
    if (type === 'browser') {
      add(metric.pid, 'electron:main')
    } else if (type === 'gpu') {
      add(metric.pid, 'electron:gpu')
    } else if (type === 'utility') {
      add(metric.pid, `electron:utility(${metric.serviceName ?? metric.name ?? '?'})`)
    } else if (type === 'renderer' || type === 'tab') {
      const contents = contentsByPid.get(metric.pid) ?? []
      const guest = contents.find((wc) => wc.type === 'webview')
      if (guest) {
        const hidden = hiddenWorktreeTags.some((tag) => guest.url.includes(tag))
        add(metric.pid, hidden ? 'browser-page:hidden-worktree' : 'browser-page:visible-worktree', {
          url: guest.url
        })
      } else if (contents.some((wc) => wc.type === 'window')) {
        add(metric.pid, 'electron:app-renderer')
      } else {
        add(metric.pid, 'electron:other-renderer')
      }
    } else {
      add(metric.pid, `electron:${type}`)
    }
  }
  // Why both roots: the terminal daemon may run detached from the app's process tree.
  const helpers = [...descendants(rows, mainPid)]
  if (daemonPid && byPid.has(daemonPid)) {
    helpers.push(byPid.get(daemonPid), ...descendants(rows, daemonPid))
  }
  const shellPids = new Set()
  for (const row of helpers) {
    if (SHELL_NAMES.has(row.name.toLowerCase())) {
      shellPids.add(row.pid)
    }
  }
  for (const row of helpers) {
    add(row.pid, describeHelper(row, byPid, shellPids, daemonPid))
  }
  return entries
}

function summarize(entries) {
  const byCategory = {}
  for (const entry of entries) {
    const bucket = (byCategory[entry.category] ??= {
      count: 0,
      privateMB: 0,
      workingSetMB: 0
    })
    bucket.count += 1
    bucket.privateMB += entry.privateBytes / 1048576
    bucket.workingSetMB += entry.workingSet / 1048576
  }
  for (const bucket of Object.values(byCategory)) {
    bucket.privateMB = Math.round(bucket.privateMB * 10) / 10
    bucket.workingSetMB = Math.round(bucket.workingSetMB * 10) / 10
  }
  const totalPrivate = entries.reduce((sum, entry) => sum + entry.privateBytes, 0)
  const totalWorkingSet = entries.reduce((sum, entry) => sum + entry.workingSet, 0)
  return {
    byCategory,
    processCount: entries.length,
    totalPrivateMB: toMB(totalPrivate),
    totalWorkingSetMB: toMB(totalWorkingSet)
  }
}

function cpuByCategory(before, after, windowMs) {
  const beforeByPid = new Map(before.map((entry) => [entry.pid, entry]))
  const result = {}
  let total = 0
  for (const entry of after) {
    const prior = beforeByPid.get(entry.pid)
    if (!prior) {
      continue
    }
    // Percent of one core over the window.
    const percent = ((entry.cpuSeconds - prior.cpuSeconds) / (windowMs / 1000)) * 100
    result[entry.category] = Math.round(((result[entry.category] ?? 0) + percent) * 100) / 100
    total += percent
  }
  return { byCategory: result, totalPercentOfOneCore: Math.round(total * 100) / 100 }
}

async function measure(label, ctx, { cpuWindowMs = 0, hiddenWorktreeTags = [] } = {}) {
  const daemonPid = await readDaemonPid(ctx.page)
  const capture = async () => {
    const view = await readMainProcessView(ctx.app)
    const rows = sweepProcesses()
    return { view, entries: classify(rows, ctx.mainPid, daemonPid, view, hiddenWorktreeTags) }
  }
  const first = await capture()
  let cpu = null
  let final = first
  if (cpuWindowMs > 0) {
    await sleep(cpuWindowMs)
    final = await capture()
    cpu = cpuByCategory(first.entries, final.entries, cpuWindowMs)
  }
  const summary = summarize(final.entries)
  const result = {
    label,
    ...summary,
    mainHeapUsedMB: toMB(final.view.mainHeapUsed),
    webContents: final.view.contents.map((wc) => ({ type: wc.type, pid: wc.pid, url: wc.url })),
    cpu,
    processes: final.entries.map((entry) => ({
      pid: entry.pid,
      category: entry.category,
      name: entry.name,
      ppid: entry.ppid,
      privateMB: toMB(entry.privateBytes),
      workingSetMB: toMB(entry.workingSet),
      commandLine: entry.commandLine?.slice(0, 240),
      ...(entry.url ? { url: entry.url } : {})
    }))
  }
  printSummary(result)
  return result
}

function printSummary(result) {
  console.log(`\n=== ${result.label} ===`)
  console.log(
    `processes=${result.processCount} private=${result.totalPrivateMB}MB ws=${result.totalWorkingSetMB}MB mainHeap=${result.mainHeapUsedMB}MB`
  )
  const rows = Object.entries(result.byCategory).sort((a, b) => b[1].privateMB - a[1].privateMB)
  for (const [category, bucket] of rows) {
    const cpu = result.cpu?.byCategory?.[category]
    console.log(
      `  ${category.padEnd(44)} n=${String(bucket.count).padStart(2)} private=${String(bucket.privateMB).padStart(7)}MB ws=${String(bucket.workingSetMB).padStart(7)}MB${cpu === undefined ? '' : ` cpu=${cpu}%`}`
    )
  }
  if (result.cpu) {
    console.log(`  idle CPU total: ${result.cpu.totalPercentOfOneCore}% of one core`)
  }
}

// ─── Load drivers ────────────────────────────────────────────────────

async function launchApp(userDataDir) {
  const isolatedHome = path.join(userDataDir, 'home')
  mkdirSync(isolatedHome, { recursive: true })
  const env = { ...process.env }
  for (const key of ['ELECTRON_RUN_AS_NODE', 'CODEX_HOME', 'DOLPHIN_CODEX_HOME']) {
    delete env[key]
  }
  Object.assign(env, {
    NODE_ENV: 'development',
    HOME: isolatedHome,
    USERPROFILE: isolatedHome,
    DOLPHIN_E2E_USER_DATA_DIR: userDataDir,
    DOLPHIN_E2E_HOME_DIR: isolatedHome,
    DOLPHIN_E2E_HEADLESS: '1',
    DOLPHIN_BACKGROUND_LAUNCH: '1'
  })
  const app = await electron.launch({ args: [rootDir], env, cwd: rootDir })
  const page = await app.firstWindow()
  // Why: a fresh profile opens a feature announcement dialog; Escape dismisses it.
  setTimeout(() => page.keyboard.press('Escape').catch(() => undefined), 5000)
  page.on('crash', () => console.error('[measure] app renderer crashed'))
  await page.waitForFunction(
    () => {
      const state = window.__store?.getState?.()
      return Boolean(state?.workspaceSessionReady && state?.hydrationSucceeded && window.api)
    },
    null,
    { timeout: 60_000 }
  )
  return { app, page, mainPid: app.process().pid }
}

function killTree(pid) {
  if (!pid) {
    return
  }
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(pid), '/t', '/f'], { stdio: 'ignore' })
    } else {
      process.kill(pid, 'SIGKILL')
    }
  } catch {}
}

async function stopApp(ctx) {
  const daemonPid = await readDaemonPid(ctx.page).catch(() => null)
  await Promise.race([ctx.app.close().catch(() => undefined), sleep(10_000)])
  killTree(ctx.mainPid)
  // Why: the daemon is detached from the app tree; it belongs to this throwaway profile only.
  killTree(daemonPid)
}

/** Adds the fixture repo; returns its main worktree id plus `extraWorktrees` app-created ones. */
async function registerRepo(page, fixture, extraWorktrees = 0) {
  return page.evaluate(
    async ({ repoPath, extra }) => {
      const store = window.__store
      await store.getState().fetchSettings?.()
      const added = await window.api.repos.add({ path: repoPath, kind: 'git' })
      if ('error' in added) {
        throw new Error(added.error)
      }
      await store.getState().fetchRepos()
      const repo = store.getState().repos.find((r) => r.path === repoPath) ?? added.repo
      await store.getState().fetchWorktrees(repo.id, { requireAuthoritative: true })
      const main = (store.getState().worktreesByRepo[repo.id] ?? []).find((w) => w.isMainWorktree)
      if (!main) {
        throw new Error('Main worktree not listed')
      }
      const ids = [main.id]
      for (let i = 0; i < extra; i++) {
        const result = await store
          .getState()
          .createWorktree(repo.id, `wt-${i + 1}`, undefined, 'skip')
        ids.push(result.worktree.id)
      }
      await store.getState().fetchWorktrees(repo.id)
      return ids
    },
    { repoPath: fixture.repoPath, extra: extraWorktrees }
  )
}

async function activateWorktree(page, worktreeId) {
  await page.evaluate((id) => {
    const state = window.__store.getState()
    state.setActiveView?.('terminal')
    state.setActiveWorktree(id)
  }, worktreeId)
  await page.waitForFunction((id) => window.__store.getState().activeWorktreeId === id, worktreeId)
}

async function countSessions(page, worktreeId) {
  return page.evaluate(async (id) => {
    const snapshot = await window.api.memory.getSnapshot()
    const bucket = snapshot.worktrees.find((w) => w.worktreeId === id)
    return bucket?.sessions.filter((s) => s.pid > 0).length ?? 0
  }, worktreeId)
}

/** Tops the worktree up to `count` terminal tabs and waits for their PTYs. */
async function ensureTerminals(page, worktreeId, count) {
  await page.evaluate(
    ({ id, target }) => {
      const state = window.__store.getState()
      const existing = (state.tabsByWorktree[id] ?? []).length
      for (let i = existing; i < target; i++) {
        const tab = window.__store
          .getState()
          .createTab(id, undefined, undefined, { pendingActivationSpawn: true })
        window.__store.getState().setActiveTab(tab.id)
      }
      window.__store.getState().setActiveTabType('terminal', id)
    },
    { id: worktreeId, target: count }
  )
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if ((await countSessions(page, worktreeId)) >= count) {
      return
    }
    // Why: inactive terminal tabs only spawn once mounted; cycle through them.
    await page.evaluate((id) => {
      const state = window.__store.getState()
      for (const tab of state.tabsByWorktree[id] ?? []) {
        window.__store.getState().setActiveTab(tab.id)
      }
    }, worktreeId)
    await sleep(1000)
  }
  const debug = await page.evaluate(
    async (id) => ({
      tabs: (window.__store.getState().tabsByWorktree[id] ?? []).map((t) => t.id),
      snapshot: await window.api.memory.getSnapshot()
    }),
    worktreeId
  )
  console.error(JSON.stringify(debug, null, 1).slice(0, 4000))
  throw new Error(`Timed out waiting for ${count} PTYs in ${worktreeId}`)
}

async function closeAllTerminals(page, worktreeId) {
  await page.evaluate((id) => {
    const state = window.__store.getState()
    for (const tab of state.tabsByWorktree[id] ?? []) {
      window.__store.getState().closeTab(tab.id)
    }
  }, worktreeId)
}

async function openBrowserPages(app, page, worktreeId, urls) {
  const before = await countGuests(app)
  await page.evaluate(
    ({ id, list }) => {
      for (const url of list) {
        window.__store
          .getState()
          .createBrowserTab(id, url, { activate: true, focusAddressBar: false })
      }
    },
    { id: worktreeId, list: urls }
  )
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if ((await countGuests(app)) >= before + urls.length) {
      return
    }
    await sleep(500)
  }
  console.warn(`[measure] only ${(await countGuests(app)) - before}/${urls.length} guests mounted`)
}

async function countGuests(app) {
  return app.evaluate(
    ({ webContents }) =>
      webContents
        .getAllWebContents()
        .filter((wc) => !wc.isDestroyed() && wc.getType() === 'webview').length
  )
}

// ─── Scenarios ───────────────────────────────────────────────────────

async function runSingleWorktreeSession(options, pageServerUrl, results) {
  const fixture = createRepoFixture()
  const userDataDir = mkdtempSync(path.join(shortRoot, 'ud-'))
  createCompletedOnboardingProfile(userDataDir)
  const ctx = await launchApp(userDataDir)
  try {
    const [worktreeId] = await registerRepo(ctx.page, fixture)
    await activateWorktree(ctx.page, worktreeId)
    await sleep(3000)
    await closeAllTerminals(ctx.page, worktreeId)
    await sleep(options.settleMs)
    results.push(await measure('A: idle, 1 worktree', ctx, { cpuWindowMs: options.cpuWindowMs }))

    await ensureTerminals(ctx.page, worktreeId, 4)
    await sleep(options.settleMs)
    results.push(await measure('B: 4 idle terminals', ctx))

    const urls = [`${pageServerUrl}/a`, `${pageServerUrl}/b`, `${pageServerUrl}/c`]
    await openBrowserPages(ctx.app, ctx.page, worktreeId, urls)
    await sleep(options.settleMs)
    results.push(await measure('C: B + 3 local browser pages', ctx))

    if (options.heavyUrl) {
      await openBrowserPages(ctx.app, ctx.page, worktreeId, [options.heavyUrl])
      await sleep(options.settleMs)
      results.push(await measure(`C+: C + ${options.heavyUrl}`, ctx))
    }
  } finally {
    await stopApp(ctx)
  }
}

async function runMultiWorktreeSession(options, pageServerUrl, results) {
  const fixture = createRepoFixture()
  const userDataDir = mkdtempSync(path.join(shortRoot, 'ud-'))
  createCompletedOnboardingProfile(userDataDir)
  const ctx = await launchApp(userDataDir)
  try {
    const worktreeIds = await registerRepo(ctx.page, fixture, 2)
    for (const [index, worktreeId] of worktreeIds.entries()) {
      await activateWorktree(ctx.page, worktreeId)
      await ensureTerminals(ctx.page, worktreeId, 2)
      await openBrowserPages(ctx.app, ctx.page, worktreeId, [
        `${pageServerUrl}/wt${index}/p1`,
        `${pageServerUrl}/wt${index}/p2`
      ])
    }
    await activateWorktree(ctx.page, worktreeIds[0])
    await sleep(options.settleMs)
    results.push(
      await measure('D: 3 worktrees x (2 terminals + 2 pages), 2 hidden', ctx, {
        cpuWindowMs: options.cpuWindowMs,
        hiddenWorktreeTags: ['/wt1/', '/wt2/']
      })
    )
  } finally {
    await stopApp(ctx)
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (!existsSync(path.join(rootDir, 'out', 'main', 'index.js'))) {
    throw new Error('Missing out/main/index.js — run `VITE_EXPOSE_STORE=true electron-vite build`.')
  }
  const server = await startLocalPageServer(options.titleChurn)
  const pageServerUrl = `http://127.0.0.1:${server.address().port}`
  const results = []
  try {
    await runSingleWorktreeSession(options, pageServerUrl, results)
    await runMultiWorktreeSession(options, pageServerUrl, results)
  } finally {
    server.close()
  }
  const out =
    options.out ??
    path.join(shortRoot, `process-memory-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(
    out,
    `${JSON.stringify({ platform: process.platform, options, results }, null, 2)}\n`
  )
  console.log(`\nWrote ${out}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
