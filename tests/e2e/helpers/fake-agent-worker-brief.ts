import path from 'node:path'

const BUILT_CLI_PATH = path.join(process.cwd(), 'out', 'cli', 'index.js')

/**
 * Source for a fake agent CLI: `fakeAgentLaunchBriefInput()` returns the worker's brief shaped as
 * the submitted bracketed paste it used to receive on stdin, or null when argv carries no pointer.
 * Why: workers launch with a one-line pointer in argv, so a fake agent must run
 * `orchestration worker-brief` like a real one; that fetch is what settles the worker's start.
 */
export const FAKE_AGENT_WORKER_BRIEF_SOURCE = `
function fakeAgentLaunchBriefInput() {
  const dispatchId = process.argv.slice(2).join(' ').match(/worker-brief --dispatch (\\S+)/)?.[1]
  if (!dispatchId) return null
  const brief = require('node:child_process').execFileSync(
    process.execPath,
    [${JSON.stringify(BUILT_CLI_PATH)}, 'orchestration', 'worker-brief', '--dispatch', dispatchId],
    { encoding: 'utf8', windowsHide: true }
  )
  return '\\x1b[200~' + brief.trimEnd() + '\\x1b[201~\\r'
}
`
