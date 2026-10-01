import { readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'

export const INSTALL_APT_PACKAGES_ACTION = './.github/actions/install-apt-packages'

const defaultWorkflowsDir = resolve(import.meta.dirname, '../../.github/workflows')

/**
 * Every distinct install-apt-packages invocation across the workflows. The cache warm-up reads
 * this instead of a second list, so a lane's package set cannot drift from the set it warms.
 */
export function collectAptPackageSets(workflowsDir = defaultWorkflowsDir) {
  const sets = new Map()
  for (const file of readdirSync(workflowsDir).filter((name) => name.endsWith('.yml'))) {
    const workflow = parse(readFileSync(join(workflowsDir, file), 'utf8'))
    for (const job of Object.values(workflow.jobs ?? {})) {
      // Expression runners resolve at run time; the hosted default is what these lanes use.
      const runner = typeof job['runs-on'] === 'string' ? job['runs-on'] : 'ubuntu-latest'
      for (const step of job.steps ?? []) {
        // Expression inputs are the warm-up's own matrix, not a lane's package set.
        if (
          step.uses !== INSTALL_APT_PACKAGES_ACTION ||
          Object.values(step.with ?? {}).some((value) => String(value).includes('${{'))
        ) {
          continue
        }
        const set = {
          runner,
          packages: String(step.with?.packages ?? '')
            .split(/\s+/)
            .filter(Boolean)
            .toSorted()
            .join(' '),
          'playwright-browser': String(step.with?.['playwright-browser'] ?? ''),
          'no-install-recommends': String(step.with?.['no-install-recommends'] ?? 'false')
        }
        sets.set(JSON.stringify(set), set)
      }
    }
  }
  return [...sets.values()]
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.stdout.write(`sets=${JSON.stringify(collectAptPackageSets())}\n`)
}
