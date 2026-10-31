import { describe, expect, it } from 'vitest'
import {
  buildCaptureBrowserCommand,
  findUnsafeBrowserArgument,
  parseMicrosoftSignInUrl,
  quoteForPythonShlex,
  readLoopbackRedirectPort
} from './azure-cli-sign-in-url-capture'

// Mirrors Python shlex.split(posix=True) for a double-quoted token, which webbrowser uses.
function shlexUnquote(token: string): string {
  return token.slice(1, -1).replace(/\\([\\"])/g, '$1')
}

describe('quoteForPythonShlex', () => {
  it('round-trips Windows paths with spaces and backslashes', () => {
    const value = 'C:\\Program Files\\Dolphin\\Dolphin.exe'
    expect(shlexUnquote(quoteForPythonShlex(value))).toBe(value)
  })

  it('escapes quotes, trailing and UNC backslashes', () => {
    for (const value of ['a"b', 'C:\\dir\\', '\\\\server\\share', '/tmp/$HOME/`x`']) {
      expect(shlexUnquote(quoteForPythonShlex(value))).toBe(value)
    }
    // Why: shlex keeps `\$` as two characters, so `$` must stay unescaped.
    expect(quoteForPythonShlex('$x`y')).toBe('"$x`y"')
  })
})

describe('buildCaptureBrowserCommand', () => {
  it('leaves %s as the URL slot between script and out file', () => {
    expect(buildCaptureBrowserCommand('/opt/D d/app', '/t/c.cjs', '/t/u.txt', ':')).toBe(
      '"/opt/D d/app" "/t/c.cjs" %s "/t/u.txt"'
    )
  })

  it('refuses paths that webbrowser would split or substitute', () => {
    expect(() => buildCaptureBrowserCommand('C:\\a;b\\D.exe', 'C:\\s', 'C:\\o', ';')).toThrow(
      /system browser/
    )
    expect(findUnsafeBrowserArgument(['/a/%s/b'], ':')).toBe('/a/%s/b')
    expect(findUnsafeBrowserArgument(['C:\\ok\\path'], ';')).toBeNull()
  })
})

describe('parseMicrosoftSignInUrl', () => {
  it('accepts the Microsoft identity hosts over https', () => {
    const raw =
      'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?client_id=x&redirect_uri=http%3A%2F%2Flocalhost%3A53123'
    const url = parseMicrosoftSignInUrl(`${raw}\n`)
    expect(url?.host).toBe('login.microsoftonline.com')
    expect(url && readLoopbackRedirectPort(url)).toBe(53123)
    expect(parseMicrosoftSignInUrl('https://login.live.com/oauth20_authorize.srf')).not.toBeNull()
  })

  it('rejects other hosts, look-alikes and plain http', () => {
    expect(parseMicrosoftSignInUrl('https://evil.example/login.microsoftonline.com')).toBeNull()
    expect(parseMicrosoftSignInUrl('https://login.microsoftonline.com.evil.example/')).toBeNull()
    expect(parseMicrosoftSignInUrl('http://login.microsoftonline.com/')).toBeNull()
    expect(parseMicrosoftSignInUrl('not a url')).toBeNull()
  })

  it('ignores a redirect that is not az loopback', () => {
    const url = new URL('https://login.microsoftonline.com/?redirect_uri=https%3A%2F%2Fx.example')
    expect(readLoopbackRedirectPort(url)).toBeNull()
  })
})
