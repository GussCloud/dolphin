import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { gzipSync } from 'node:zlib'
import { readRendererBootGraph, RENDERER_BUILD_DIR } from './renderer-boot-graph.mjs'

export const RENDERER_BUNDLE_BUDGET_PATH = path.join('config', 'renderer-bundle-budget.json')

export const RENDERER_BUNDLE_METRICS = [
  { key: 'bootJs', label: 'boot JS (entry + modulepreload)' },
  { key: 'entryCss', label: 'entry CSS' },
  { key: 'totalJs', label: 'all JS chunks' },
  { key: 'totalCss', label: 'all CSS' }
]

// Level 9 keeps the gzip figure independent of zlib's default-level tuning across Node versions.
function sizesOf(files) {
  let raw = 0
  let gzip = 0
  for (const file of files) {
    const bytes = fs.readFileSync(file)
    raw += bytes.length
    gzip += gzipSync(bytes, { level: 9 }).length
  }
  return { raw, gzip, files: files.length }
}

function listAssets(rendererDir, pattern) {
  const assetsDir = path.join(rendererDir, 'assets')
  return fs
    .readdirSync(assetsDir)
    .filter((name) => pattern.test(name))
    .map((name) => path.join(assetsDir, name))
}

function entryStylesheets(rendererDir) {
  const html = fs.readFileSync(path.join(rendererDir, 'index.html'), 'utf8')
  return [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((match) =>
    path.join(rendererDir, match[1].replace(/^\.?\//, ''))
  )
}

export function measureRendererBundle(rendererDir = RENDERER_BUILD_DIR) {
  if (!fs.existsSync(path.join(rendererDir, 'index.html'))) {
    throw new Error(`${rendererDir}/index.html not found; run build:electron-vite first`)
  }
  return {
    bootJs: sizesOf(readRendererBootGraph(rendererDir).chunks.map((chunk) => chunk.file)),
    entryCss: sizesOf(entryStylesheets(rendererDir)),
    totalJs: sizesOf(listAssets(rendererDir, /\.m?js$/)),
    totalCss: sizesOf(listAssets(rendererDir, /\.css$/))
  }
}

export function compareRendererBundle(measured, budget) {
  const tolerance = budget.tolerance ?? 0.05
  const rows = []
  for (const { key, label } of RENDERER_BUNDLE_METRICS) {
    for (const kind of ['raw', 'gzip']) {
      const limit = budget.metrics?.[key]?.[kind]
      if (typeof limit !== 'number') {
        // Fail closed: a renamed metric must not silently drop out of the gate.
        rows.push({
          metric: `${label} ${kind}`,
          actual: measured[key][kind],
          budget: null,
          ok: false
        })
        continue
      }
      const actual = measured[key][kind]
      rows.push({
        metric: `${label} ${kind}`,
        actual,
        budget: limit,
        ceiling: Math.floor(limit * (1 + tolerance)),
        ok: actual <= limit * (1 + tolerance)
      })
    }
  }
  return { tolerance, rows, ok: rows.every((row) => row.ok) }
}

const kib = (bytes) => (bytes === null ? 'missing' : `${(bytes / 1024).toFixed(1)} KiB`)

export function formatRendererBundleTable({ tolerance, rows }) {
  const header = [
    'metric',
    'actual',
    'budget',
    `ceiling (+${Math.round(tolerance * 100)}%)`,
    'delta',
    ''
  ]
  const body = rows.map((row) => [
    row.metric,
    kib(row.actual),
    kib(row.budget),
    row.ceiling === undefined ? '-' : kib(row.ceiling),
    row.budget ? `${(((row.actual - row.budget) / row.budget) * 100).toFixed(1)}%` : '-',
    row.ok ? 'ok' : 'OVER'
  ])
  const widths = header.map((_, column) =>
    Math.max(...[header, ...body].map((line) => line[column].length))
  )
  return [header, ...body]
    .map((line) =>
      line
        .map((cell, column) => cell.padEnd(widths[column]))
        .join('  ')
        .trimEnd()
    )
    .join('\n')
}

export function budgetFromMeasurement(measured, tolerance = 0.05) {
  return {
    tolerance,
    metrics: Object.fromEntries(
      RENDERER_BUNDLE_METRICS.map(({ key }) => [
        key,
        { raw: measured[key].raw, gzip: measured[key].gzip }
      ])
    )
  }
}

export function runRendererBundleBudget({
  argv = process.argv.slice(2),
  rendererDir = RENDERER_BUILD_DIR,
  budgetPath = RENDERER_BUNDLE_BUDGET_PATH,
  log = console.log,
  logError = console.error
} = {}) {
  const measured = measureRendererBundle(rendererDir)
  if (argv.includes('--write')) {
    const current = fs.existsSync(budgetPath) ? JSON.parse(fs.readFileSync(budgetPath, 'utf8')) : {}
    const next = budgetFromMeasurement(measured, current.tolerance)
    fs.writeFileSync(budgetPath, `${JSON.stringify(next, null, 2)}\n`)
    log(`Wrote ${budgetPath}`)
    return 0
  }
  const result = compareRendererBundle(measured, JSON.parse(fs.readFileSync(budgetPath, 'utf8')))
  log(formatRendererBundleTable(result))
  if (result.ok) {
    return 0
  }
  logError(
    `Renderer bundle exceeds ${budgetPath}. Shrink the bundle (lazy-load the addition), or, ` +
      'if the growth is intended, rerun with --write and commit the new budget with a reason.'
  )
  return 1
}

if (process.argv[1] === import.meta.filename) {
  process.exit(runRendererBundleBudget())
}
