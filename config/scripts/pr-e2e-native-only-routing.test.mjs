import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  hasNativeImeSourceChange,
  selectChangedE2eSpecs,
  shouldRunChangedE2e,
  shouldRunReusablePrE2e
} from './pr-e2e-source-routing.mjs'

const workflow = parse(readFileSync('.github/workflows/pr.yml', 'utf8'))
const filterStep = workflow.jobs.code_paths.steps.find((step) => step.id === 'e2e_filter')

describe('native-only PR E2E routing', () => {
  it('avoids generic E2E allocation for native-only changes while preserving its IME lane', () => {
    for (const file of [
      'tests/e2e/terminal-ibus-hangul-native.spec.ts',
      'config/scripts/run-terminal-ibus-hangul-e2e.mjs'
    ]) {
      expect(hasNativeImeSourceChange([file])).toBe(true)
      expect(shouldRunReusablePrE2e([file])).toBe(false)
    }
    expect(shouldRunReusablePrE2e([])).toBe(false)
    for (const spec of [
      'tests/e2e/ssh-startup-exec-readiness.spec.ts',
      'tests/e2e/paired-startup-exec-readiness.spec.ts',
      'tests/e2e/terminal-ime-exact-byte.spec.ts',
      'tests/e2e/future.spec.ts'
    ]) {
      expect(shouldRunReusablePrE2e([spec])).toBe(true)
      expect(shouldRunReusablePrE2e(['tests/e2e/terminal-ibus-hangul-native.spec.ts', spec])).toBe(
        true
      )
    }
    expect(filterStep.run).toContain('pr-e2e-source-routing.mjs --changed-reusable')
    expect(filterStep.run).toContain('if [ "$SHOULD_RUN" = true ]; then')
  })

  it('runs the reusable workflow on a PR only for the specs it changed, never the native one', () => {
    expect(shouldRunChangedE2e(['tests/e2e/terminal-ibus-hangul-native.spec.ts'])).toBe(false)
    expect(shouldRunChangedE2e(['src/main/ssh/connection.ts'])).toBe(false)
    expect(shouldRunChangedE2e(['tests/e2e/future.spec.ts'])).toBe(true)
  })

  it('adds the specs that import a helper the PR changed', () => {
    const specs = () => [
      { path: 'tests/e2e/uses.spec.ts', source: "import { x } from './helpers/picker'" },
      { path: 'tests/e2e/other.spec.ts', source: "import { y } from './helpers/pickerish'" }
    ]
    expect(selectChangedE2eSpecs(['tests/e2e/helpers/picker.ts'], specs)).toEqual([
      'tests/e2e/uses.spec.ts'
    ])
    expect(selectChangedE2eSpecs(['src/main/x.ts'], specs)).toEqual([])
  })

  it('selects only the e2e files the PR changed, ignoring the source they cover', () => {
    expect(
      selectChangedE2eSpecs([
        'src/main/ssh/connection.ts',
        'tests/e2e/b.spec.ts',
        'tests/e2e/a.spec.ts',
        'tests/e2e/ssh-browser-network-execution-route.docker.unit.test.ts',
        'tests/e2e/helpers/app.ts',
        'tests/e2e/b.spec.ts'
      ])
    ).toEqual([
      'tests/e2e/a.spec.ts',
      'tests/e2e/b.spec.ts',
      'tests/e2e/ssh-browser-network-execution-route.docker.unit.test.ts'
    ])
  })
})
