import { escapeHtml } from './html-escape.js'

export type AuthorizeParams = {
  client_id: string
  redirect_uri: string
  state: string
  nonce: string
  code_challenge: string
  local_profile_id: string
}

/** Minimal self-contained sign-in page; no external assets, so it works behind any proxy. */
export function renderAuthorizePage(params: AuthorizeParams, error?: string): string {
  const hidden = Object.entries(params)
    .map(([k, v]) => `<input type="hidden" name="${k}" value="${escapeHtml(v)}">`)
    .join('')
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in to Dolphin</title>
<style>body{font-family:system-ui,sans-serif;background:#0f1115;color:#e6e6e6;display:grid;place-items:center;min-height:100vh;margin:0}
form{background:#171a21;padding:32px;border-radius:12px;width:min(360px,90vw);display:grid;gap:12px}
input{padding:10px;border-radius:8px;border:1px solid #333;background:#0f1115;color:inherit}
button{padding:10px;border-radius:8px;border:0;cursor:pointer}.primary{background:#3b82f6;color:#fff}
.error{color:#f87171}</style></head><body>
<form method="post"><h1>Sign in to Dolphin</h1>${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
${hidden}<input name="email" type="email" placeholder="Email" autocomplete="username" required>
<input name="password" type="password" placeholder="Password" autocomplete="current-password" required>
<button class="primary" type="submit" name="action" value="login">Sign in</button>
<button type="submit" name="action" value="cancel" formnovalidate>Cancel</button></form></body></html>`
}
