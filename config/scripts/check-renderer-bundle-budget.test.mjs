import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  budgetFromMeasurement,
  compareRendererBundle,
  formatRendererBundleTable,
  measureRendererBundle,
  RENDERER_BUNDLE_BUDGET_PATH,
  RENDERER_BUNDLE_METRICS,
  runRendererBundleBudget
} from './check-renderer-bundle-budget.mjs'

const tempDirs = []

function makeRendererDir({ bootBytes = 4000, lazyBytes = 2000, cssBytes = 1000 } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'renderer-budget-'))
  tempDirs.push(dir)
  const assets = path.join(dir, 'assets')
  fs.mkdirSync(assets)
  fs.writeFileSync(path.join(assets, 'index-a.js'), 'a'.repeat(bootBytes))
  fs.writeFileSync(path.join(assets, 'boot-b.js'), 'b'.repeat(bootBytes))
  fs.writeFileSync(path.join(assets, 'lazy-c.js'), 'c'.repeat(lazyBytes))
  fs.writeFileSync(path.join(assets, 'boot.css'), 'd'.repeat(cssBytes))
  fs.writeFileSync(path.join(assets, 'lazy.css'), 'e'.repeat(cssBytes))
  fs.writeFileSync(path.join(assets, 'font.woff2'), 'f'.repeat(9999))
  fs.writeFileSync(
    path.join(dir, 'index.html'),
    [
      '<script type="module" crossorigin src="./assets/index-a.js"></script>',
      '<link rel="modulepreload" crossorigin href="./assets/boot-b.js">',
      '<link rel="stylesheet" crossorigin href="./assets/boot.css">'
    ].join('\n')
  )
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('renderer bundle budget', () => {
  it('measures the boot graph, entry CSS and totals, ignoring non-code assets', () => {
    const measured = measureRendererBundle(makeRendererDir())
    expect(measured.bootJs).toMatchObject({ raw: 8000, files: 2 })
    expect(measured.entryCss).toMatchObject({ raw: 1000, files: 1 })
    expect(measured.totalJs).toMatchObject({ raw: 10000, files: 3 })
    expect(measured.totalCss).toMatchObject({ raw: 2000, files: 2 })
    expect(measured.bootJs.gzip).toBeGreaterThan(0)
    expect(measured.bootJs.gzip).toBeLessThan(measured.bootJs.raw)
  })

  it('passes within tolerance and fails above it', () => {
    const budget = budgetFromMeasurement(measureRendererBundle(makeRendererDir()), 0.05)
    const within = measureRendererBundle(makeRendererDir({ lazyBytes: 2400 }))
    expect(compareRendererBundle(within, budget).ok).toBe(true)
    const over = measureRendererBundle(makeRendererDir({ bootBytes: 4500 }))
    const result = compareRendererBundle(over, budget)
    expect(result.ok).toBe(false)
    expect(result.rows.find((row) => row.metric.startsWith('boot JS') && !row.ok)).toBeDefined()
    expect(formatRendererBundleTable(result)).toContain('OVER')
  })

  it('fails closed when the budget lacks a metric', () => {
    const measured = measureRendererBundle(makeRendererDir())
    const budget = budgetFromMeasurement(measured)
    delete budget.metrics.entryCss
    expect(compareRendererBundle(measured, budget).ok).toBe(false)
  })

  it('writes a budget with --write and gates against it', () => {
    const rendererDir = makeRendererDir()
    const budgetPath = path.join(rendererDir, 'budget.json')
    const quiet = { log: () => {}, logError: () => {} }
    expect(runRendererBundleBudget({ argv: ['--write'], rendererDir, budgetPath, ...quiet })).toBe(
      0
    )
    expect(runRendererBundleBudget({ argv: [], rendererDir, budgetPath, ...quiet })).toBe(0)
    fs.writeFileSync(path.join(rendererDir, 'assets', 'lazy-d.js'), 'x'.repeat(5000))
    expect(runRendererBundleBudget({ argv: [], rendererDir, budgetPath, ...quiet })).toBe(1)
  })

  it('reports a missing build instead of passing', () => {
    expect(() => measureRendererBundle(path.join(os.tmpdir(), 'no-such-renderer'))).toThrow(
      /build:electron-vite/
    )
  })

  it('ships a budget covering every metric', () => {
    const budget = JSON.parse(fs.readFileSync(RENDERER_BUNDLE_BUDGET_PATH, 'utf8'))
    expect(budget.tolerance).toBe(0.05)
    for (const { key } of RENDERER_BUNDLE_METRICS) {
      expect(budget.metrics[key].raw, key).toBeGreaterThan(budget.metrics[key].gzip)
    }
  })
})
