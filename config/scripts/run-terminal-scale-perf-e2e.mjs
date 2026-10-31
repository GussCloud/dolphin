import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'

// Why node + cli.js: Node refuses to spawn a .cmd shim without a shell (EINVAL on Windows).
const playwrightCli = createRequire(import.meta.url).resolve('@playwright/test/cli')

const env = {
  ...process.env,
  DOLPHIN_E2E_OPENCODE_SCALE_PANES: process.env.DOLPHIN_E2E_OPENCODE_SCALE_PANES ?? '10,25,50,100',
  DOLPHIN_E2E_OPENCODE_SCALE_CROSS_WORKSPACE_PANES:
    process.env.DOLPHIN_E2E_OPENCODE_SCALE_CROSS_WORKSPACE_PANES ?? '10,25,50,100',
  DOLPHIN_E2E_OPENCODE_SCALE_PRESSURE_PANES:
    process.env.DOLPHIN_E2E_OPENCODE_SCALE_PRESSURE_PANES ?? '25,50',
  DOLPHIN_E2E_OPENCODE_SCALE_HIDDEN_PRESSURE_PANES:
    process.env.DOLPHIN_E2E_OPENCODE_SCALE_HIDDEN_PRESSURE_PANES ?? '25',
  DOLPHIN_E2E_OPENCODE_FRAME_COUNT: process.env.DOLPHIN_E2E_OPENCODE_FRAME_COUNT ?? '60'
}
const extraArgs = process.argv.slice(2)
if (extraArgs[0] === '--') {
  extraArgs.shift()
}

const child = spawn(
  process.execPath,
  [
    playwrightCli,
    'test',
    'tests/e2e/artificial-opencode-terminal-load.spec.ts',
    '--config',
    'tests/playwright.config.ts',
    '--project',
    'electron-headless',
    '--workers=1',
    ...extraArgs
  ],
  {
    stdio: 'inherit',
    env
  }
)

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }
  process.exit(code ?? 1)
})
