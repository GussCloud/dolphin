import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { resolvePnpmCliInvocation } from './pnpm-cli-invocation.mjs'

// Root and mobile/ are separate pnpm projects with their own lockfiles.
export const DEFAULT_PROJECTS = ['.', 'mobile']
export const DEFAULT_ALLOWLIST = 'config/security/dependency-audit-allowlist.json'
const BLOCKING_SEVERITIES = new Set(['high', 'critical'])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/** Normalizes `pnpm audit --json` into one finding per advisory and package. */
export function parseAuditReport(report) {
  if (!report || typeof report !== 'object' || typeof report.advisories !== 'object') {
    // An error payload must never read as "no advisories".
    const detail = report && typeof report === 'object' ? JSON.stringify(report).slice(0, 300) : ''
    throw new Error(`pnpm audit returned no advisories object ${detail}`.trim())
  }
  const findings = new Map()
  for (const advisory of Object.values(report.advisories ?? {})) {
    const id = advisory.github_advisory_id || String(advisory.id)
    const key = `${id}\0${advisory.module_name}`
    if (findings.has(key)) {
      continue
    }
    findings.set(key, {
      id,
      numericId: String(advisory.id),
      package: advisory.module_name,
      severity: advisory.severity,
      title: advisory.title,
      url: advisory.url,
      vulnerableVersions: advisory.vulnerable_versions
    })
  }
  return [...findings.values()]
}

/** Validates allowlist entries; malformed entries are errors, never silent passes. */
export function validateAllowlist(allowlist) {
  const errors = []
  const entries = Array.isArray(allowlist?.advisories) ? allowlist.advisories : null
  if (!entries) {
    return { entries: [], errors: ['allowlist must be an object with an "advisories" array'] }
  }
  entries.forEach((entry, index) => {
    const where = `allowlist entry ${index} (${entry?.id ?? '?'} ${entry?.package ?? '?'})`
    for (const field of ['id', 'package', 'reason', 'expires']) {
      if (typeof entry?.[field] !== 'string' || entry[field].trim() === '') {
        errors.push(`${where}: missing "${field}"`)
      }
    }
    if (typeof entry?.expires === 'string' && !ISO_DATE.test(entry.expires)) {
      errors.push(`${where}: "expires" must be YYYY-MM-DD`)
    }
  })
  return { entries, errors }
}

function matchesEntry(finding, entry) {
  return (
    entry.package === finding.package &&
    (entry.id === finding.id || entry.id === finding.numericId)
  )
}

/**
 * Splits blocking findings into failures and allowlisted ones. `today` is YYYY-MM-DD; an entry
 * expires at the end of its `expires` day.
 */
export function evaluateAudit({ findingsByProject, allowlist, today }) {
  const { entries, errors } = validateAllowlist(allowlist)
  const failures = []
  const allowed = []
  const used = new Set()
  for (const [project, findings] of Object.entries(findingsByProject)) {
    for (const finding of findings) {
      if (!BLOCKING_SEVERITIES.has(finding.severity)) {
        continue
      }
      const entry = entries.find((candidate) => matchesEntry(finding, candidate))
      if (!entry) {
        failures.push({ project, finding, cause: 'not allowlisted' })
        continue
      }
      used.add(entry)
      if (entry.expires < today) {
        failures.push({ project, finding, cause: `allowlist entry expired ${entry.expires}` })
      } else {
        allowed.push({ project, finding, entry })
      }
    }
  }
  // Expired entries fail even when the advisory is gone, so the file cannot rot.
  for (const entry of entries) {
    if (!used.has(entry) && typeof entry.expires === 'string' && entry.expires < today) {
      errors.push(`allowlist entry ${entry.id} ${entry.package} expired ${entry.expires}; remove it`)
    }
  }
  const stale = entries.filter((entry) => !used.has(entry) && !(entry.expires < today))
  return { failures, allowed, stale, errors }
}

export function formatResult({ failures, allowed, stale, errors }) {
  const lines = []
  for (const error of errors) {
    lines.push(`::error title=Dependency audit allowlist::${error}`)
  }
  for (const { project, finding, cause } of failures) {
    lines.push(
      `::error title=Dependency audit (${project})::${finding.severity} ${finding.id} in ${finding.package} ` +
        `(${finding.vulnerableVersions}): ${finding.title} — ${cause}. ${finding.url}`
    )
  }
  for (const entry of stale) {
    lines.push(`::warning title=Dependency audit allowlist::${entry.id} ${entry.package} no longer reported; remove it`)
  }
  lines.push(
    `Dependency audit: ${failures.length} blocking, ${allowed.length} allowlisted, ` +
      `${stale.length} stale allowlist entries, ${errors.length} allowlist errors.`
  )
  return lines.join('\n')
}

function runPnpmAudit(projectDir) {
  const pnpm = resolvePnpmCliInvocation()
  // pnpm audit exits non-zero whenever advisories exist; the JSON is the verdict.
  const result = spawnSync(pnpm.command, [...pnpm.prefixArgs, 'audit', '--json'], {
    cwd: projectDir,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    shell: pnpm.shell,
    windowsHide: true
  })
  if (result.error) {
    throw result.error
  }
  try {
    return JSON.parse(result.stdout)
  } catch {
    throw new Error(
      `pnpm audit in ${projectDir} did not print JSON (exit ${result.status}): ${result.stderr.slice(0, 500)}`
    )
  }
}

function parseArgs(argv) {
  const options = { allowlist: DEFAULT_ALLOWLIST, projects: [], reports: new Map(), today: null }
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const value = argv[index + 1]
    if (arg === '--allowlist') {
      options.allowlist = value
    } else if (arg === '--project') {
      options.projects.push(value)
    } else if (arg === '--report') {
      // --report <project>=<file> reads a saved `pnpm audit --json` instead of querying.
      const split = value.indexOf('=')
      options.reports.set(value.slice(0, split), value.slice(split + 1))
    } else if (arg === '--today') {
      options.today = value
    } else {
      throw new Error(`Unknown argument: ${arg}`)
    }
    index += 1
  }
  if (options.projects.length === 0) {
    options.projects = options.reports.size > 0 ? [...options.reports.keys()] : DEFAULT_PROJECTS
  }
  return options
}

export function main(argv = process.argv.slice(2), root = process.cwd()) {
  const options = parseArgs(argv)
  const today = options.today ?? new Date().toISOString().slice(0, 10)
  const allowlist = JSON.parse(readFileSync(path.resolve(root, options.allowlist), 'utf8'))
  const findingsByProject = {}
  for (const project of options.projects) {
    const reportFile = options.reports.get(project)
    const report = reportFile
      ? JSON.parse(readFileSync(path.resolve(root, reportFile), 'utf8'))
      : runPnpmAudit(path.resolve(root, project))
    findingsByProject[project] = parseAuditReport(report)
  }
  const result = evaluateAudit({ findingsByProject, allowlist, today })
  console.log(formatResult(result))
  return result.failures.length > 0 || result.errors.length > 0 ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main()
}
