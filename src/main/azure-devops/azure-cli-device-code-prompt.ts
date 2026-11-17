// Reads the line `az login --use-device-code` prints to stderr, e.g.
// "To sign in, use a web browser to open the page https://login.microsoft.com/device and enter
// the code FU3HPB3RT to authenticate." The page varies by az version, so it is parsed, not assumed.

export type ParsedDeviceCodePrompt = { verificationUrl: string; userCode: string }

// Why an allowlist: the URL is relayed to the user's phone, so a forged one would phish them.
const DEVICE_LOGIN_HOSTS = new Set(['login.microsoft.com', 'login.microsoftonline.com'])
const DEVICE_LOGIN_PATH_HOSTS = new Set(['microsoft.com', 'www.microsoft.com'])

const URL_PATTERN = /https:\/\/[^\s"'<>]+/gi
const CODE_PATTERN = /\bcode\s+([A-Z0-9]{8,12})\b/

function parseVerificationUrl(raw: string): URL | null {
  let url: URL
  try {
    url = new URL(raw.replace(/[.,;:)]+$/, ''))
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return null
  }
  const host = url.hostname.toLowerCase()
  if (DEVICE_LOGIN_HOSTS.has(host)) {
    return url
  }
  return DEVICE_LOGIN_PATH_HOSTS.has(host) && url.pathname.toLowerCase() === '/devicelogin'
    ? url
    : null
}

function parsePromptLine(line: string): ParsedDeviceCodePrompt | null {
  const userCode = CODE_PATTERN.exec(line)?.[1]
  if (!userCode) {
    return null
  }
  for (const match of line.matchAll(URL_PATTERN)) {
    const url = parseVerificationUrl(match[0])
    if (url) {
      return { verificationUrl: url.href, userCode }
    }
  }
  return null
}

/** The first line carrying both a Microsoft device-login page and a well-formed code, or null. */
export function parseAzureCliDeviceCodePrompt(text: string): ParsedDeviceCodePrompt | null {
  // Why per line: az may print a WARNING with its own link before the prompt.
  for (const line of text.split(/\r?\n/)) {
    const prompt = parsePromptLine(line)
    if (prompt) {
      return prompt
    }
  }
  return null
}
