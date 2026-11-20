import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { evaluateAudit, main, parseAuditReport, validateAllowlist } from './dependency-audit-gate.mjs'

const FIXTURE = path.join(import.meta.dirname, '__fixtures__', 'dependency-audit', 'pnpm-audit-report.json')
const report = JSON.parse(readFileSync(FIXTURE, 'utf8'))

const entry = (id, pkg, expires = '2026-12-20') => ({ id, package: pkg, reason: 'pre-existing', expires })

describe('parseAuditReport', () => {
  it('collapses version-range duplicates of one GHSA into one finding', () => {
    const findings = parseAuditReport(report)
    expect(findings.map((finding) => `${finding.severity} ${finding.id} ${finding.package}`)).toEqual([
      'moderate GHSA-rpw4-54j3-4h4q ip-address',
      'high GHSA-rfgv-xxqx-mfg5 undici',
      'critical GHSA-jqcg-44mw-7w3h proxy-addr'
    ])
  })

  it('treats an error payload as a failure, never as a clean audit', () => {
    expect(() => parseAuditReport({ error: { code: 'ERR_PNPM_AUDIT_BAD_RESPONSE' } })).toThrow(
      /no advisories object/
    )
    expect(() => parseAuditReport(null)).toThrow()
  })

  it('accepts a clean report', () => {
    expect(parseAuditReport({ advisories: {}, metadata: {} })).toEqual([])
  })
})

describe('evaluateAudit', () => {
  const findingsByProject = { '.': parseAuditReport(report) }

  it('fails high and critical advisories missing from the allowlist and ignores moderate', () => {
    const result = evaluateAudit({ findingsByProject, allowlist: { advisories: [] }, today: '2026-11-20' })
    expect(result.failures.map(({ finding }) => finding.package)).toEqual(['undici', 'proxy-addr'])
  })

  it('passes allowlisted advisories matched by GHSA or numeric id', () => {
    const result = evaluateAudit({
      findingsByProject,
      allowlist: { advisories: [entry('GHSA-rfgv-xxqx-mfg5', 'undici'), entry('1241210', 'proxy-addr')] },
      today: '2026-11-20'
    })
    expect(result.failures).toEqual([])
    expect(result.allowed).toHaveLength(2)
  })

  it('does not let an entry for one package excuse the same id in another', () => {
    const result = evaluateAudit({
      findingsByProject,
      allowlist: { advisories: [entry('GHSA-rfgv-xxqx-mfg5', 'not-undici'), entry('1241210', 'proxy-addr')] },
      today: '2026-11-20'
    })
    expect(result.failures.map(({ finding }) => finding.package)).toEqual(['undici'])
  })

  it('keeps an entry valid through its expiry day and fails it the day after', () => {
    const allowlist = {
      advisories: [entry('GHSA-rfgv-xxqx-mfg5', 'undici'), entry('GHSA-jqcg-44mw-7w3h', 'proxy-addr')]
    }
    expect(evaluateAudit({ findingsByProject, allowlist, today: '2026-12-20' }).failures).toEqual([])
    const expired = evaluateAudit({ findingsByProject, allowlist, today: '2026-12-21' })
    expect(expired.failures.map(({ cause }) => cause)).toEqual([
      'allowlist entry expired 2026-12-20',
      'allowlist entry expired 2026-12-20'
    ])
  })

  it('errors on an expired entry whose advisory is gone and warns on a live stale one', () => {
    const result = evaluateAudit({
      findingsByProject: { '.': [] },
      allowlist: { advisories: [entry('GHSA-old', 'left-pad', '2026-01-01'), entry('GHSA-new', 'leftpad')] },
      today: '2026-11-20'
    })
    expect(result.errors).toEqual(['allowlist entry GHSA-old left-pad expired 2026-01-01; remove it'])
    expect(result.stale.map((stale) => stale.id)).toEqual(['GHSA-new'])
  })
})

describe('validateAllowlist', () => {
  it('requires every field and an ISO expiry date', () => {
    const { errors } = validateAllowlist({
      advisories: [{ id: 'GHSA-x', package: 'p', reason: '', expires: '20/12/2026' }]
    })
    expect(errors).toEqual([
      'allowlist entry 0 (GHSA-x p): missing "reason"',
      'allowlist entry 0 (GHSA-x p): "expires" must be YYYY-MM-DD'
    ])
  })

  it('rejects a file without an advisories array', () => {
    expect(validateAllowlist({}).errors).toHaveLength(1)
  })
})

describe('main', () => {
  let dir
  afterEach(() => {
    vi.restoreAllMocks()
    if (dir) rmSync(dir, { recursive: true, force: true })
  })

  it('exits non-zero for an unlisted advisory read from a saved report', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'dependency-audit-'))
    writeFileSync(path.join(dir, 'allow.json'), JSON.stringify({ advisories: [entry('1241210', 'proxy-addr')] }))
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const code = main(['--allowlist', 'allow.json', '--report', `.=${FIXTURE}`, '--today', '2026-11-20'], dir)
    expect(code).toBe(1)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('GHSA-rfgv-xxqx-mfg5 in undici'))
  })

  it('accepts the checked-in allowlist as well-formed', () => {
    const allowlist = JSON.parse(
      readFileSync(path.join(import.meta.dirname, '..', 'security', 'dependency-audit-allowlist.json'), 'utf8')
    )
    expect(validateAllowlist(allowlist).errors).toEqual([])
  })
})
