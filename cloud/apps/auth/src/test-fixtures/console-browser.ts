type RequestableApp = { request: (path: string, init?: RequestInit) => Response | Promise<Response> }

export type BrowserPage = { res: Response; html: string }

/** Keeps cookies and the last page's CSRF token between console requests, like a browser tab. */
export class ConsoleBrowser {
  readonly cookies = new Map<string, string>()
  readonly setCookieHeaders: string[] = []
  csrf = ''
  private readonly app: RequestableApp

  constructor(app: RequestableApp) {
    this.app = app
  }

  get(path: string): Promise<BrowserPage> {
    return this.send(path, { method: 'GET' })
  }

  post(path: string, fields: Record<string, string>, options: { csrf?: boolean } = {}): Promise<BrowserPage> {
    const body = new URLSearchParams(options.csrf === false ? fields : { _csrf: this.csrf, ...fields })
    return this.send(path, { method: 'POST', body })
  }

  private async send(path: string, init: RequestInit): Promise<BrowserPage> {
    const cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ')
    const res = await this.app.request(path, { ...init, headers: cookie ? { cookie } : {} })
    for (const header of res.headers.getSetCookie()) {
      this.setCookieHeaders.push(header)
      const [pair = ''] = header.split(';')
      const [name = '', value = ''] = pair.split('=')
      if (!value || /max-age=0/i.test(header)) {
        this.cookies.delete(name)
      } else {
        this.cookies.set(name, value)
      }
    }
    const html = await res.text()
    const csrf = /name="_csrf" value="([^"]+)"/.exec(html)?.[1]
    if (csrf) {
      this.csrf = csrf
    }
    return { res, html }
  }
}
