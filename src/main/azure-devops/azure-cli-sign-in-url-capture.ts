import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

// Captures the URL `az login` would open: Python's `webbrowser` honors `BROWSER`, so
// pointing it at Dolphin's own binary in node mode writes the URL to a file instead.

const CAPTURE_SCRIPT =
  "const fs=require('fs');const out=process.argv[3];" +
  "fs.writeFileSync(out+'.part',process.argv[2]);fs.renameSync(out+'.part',out)\n"

const POLL_INTERVAL_MS = 250
export const URL_CAPTURE_TIMEOUT_MS = 30_000

const MICROSOFT_SIGN_IN_HOSTS = [
  'login.microsoftonline.com',
  'login.microsoft.com',
  'login.live.com'
]

export const SYSTEM_BROWSER_HINT = 'Try signing in with the system browser instead.'

export class AzureCliSignInCaptureError extends Error {
  constructor(message: string) {
    super(`${message} ${SYSTEM_BROWSER_HINT}`)
    this.name = 'AzureCliSignInCaptureError'
  }
}

/** Quotes one argument for Python `shlex.split` (POSIX mode), which `webbrowser` uses on `BROWSER`. */
export function quoteForPythonShlex(value: string): string {
  // Why only these two: inside double quotes shlex keeps any other backslash literally.
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`
}

/**
 * `webbrowser` splits `BROWSER` on the path separator and substitutes `%s` in every
 * argument, so a path containing either cannot be passed through it intact.
 */
export function findUnsafeBrowserArgument(
  args: readonly string[],
  delimiter: string = path.delimiter
): string | null {
  return args.find((arg) => arg.includes(delimiter) || arg.includes('%s')) ?? null
}

export function buildCaptureBrowserCommand(
  execPath: string,
  scriptPath: string,
  outFile: string,
  delimiter: string = path.delimiter
): string {
  const unsafe = findUnsafeBrowserArgument([execPath, scriptPath, outFile], delimiter)
  if (unsafe) {
    throw new AzureCliSignInCaptureError(
      `Dolphin cannot capture the sign-in page because "${unsafe}" contains "${delimiter}".`
    )
  }
  return [
    quoteForPythonShlex(execPath),
    quoteForPythonShlex(scriptPath),
    '%s',
    quoteForPythonShlex(outFile)
  ].join(' ')
}

/** Accepts only the Microsoft identity platform, so a hijacked `az` cannot steer the window. */
export function parseMicrosoftSignInUrl(raw: string): URL | null {
  try {
    const url = new URL(raw.trim())
    const host = url.hostname.toLowerCase()
    const trusted = MICROSOFT_SIGN_IN_HOSTS.some(
      (allowed) => host === allowed || host.endsWith(`.${allowed}`)
    )
    return url.protocol === 'https:' && trusted ? url : null
  } catch {
    return null
  }
}

/** Port of the `http://localhost:<port>` redirect `az login` listens on, if any. */
export function readLoopbackRedirectPort(signInUrl: URL): number | null {
  try {
    const redirect = new URL(signInUrl.searchParams.get('redirect_uri') ?? '')
    const loopback = redirect.hostname === 'localhost' || redirect.hostname === '127.0.0.1'
    const port = Number(redirect.port)
    return redirect.protocol === 'http:' && loopback && Number.isInteger(port) && port > 0
      ? port
      : null
  } catch {
    return null
  }
}

export type SignInUrlCapture = {
  env: NodeJS.ProcessEnv
  waitForUrl: (signal: AbortSignal) => Promise<string | null>
  dispose: () => Promise<void>
}

export async function prepareSignInUrlCapture(execPath: string): Promise<SignInUrlCapture> {
  const dir = await mkdtemp(path.join(tmpdir(), 'dolphin-az-sign-in-'))
  const dispose = (): Promise<void> => rm(dir, { recursive: true, force: true })
  try {
    const scriptPath = path.join(dir, 'capture.cjs')
    const outFile = path.join(dir, 'url.txt')
    await writeFile(scriptPath, CAPTURE_SCRIPT, { mode: 0o600 })
    const browser = buildCaptureBrowserCommand(execPath, scriptPath, outFile)
    return {
      env: { BROWSER: browser, ELECTRON_RUN_AS_NODE: '1' },
      waitForUrl: (signal) => pollForFile(outFile, signal),
      dispose
    }
  } catch (error) {
    await dispose()
    throw error
  }
}

async function pollForFile(file: string, signal: AbortSignal): Promise<string | null> {
  const deadline = Date.now() + URL_CAPTURE_TIMEOUT_MS
  while (!signal.aborted && Date.now() < deadline) {
    try {
      return await readFile(file, 'utf-8')
    } catch {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
    }
  }
  return null
}
