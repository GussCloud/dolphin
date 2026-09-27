import { serve } from '@hono/node-server'
import { createAuthApp } from './app.js'
import { readAuthConfig } from './config.js'
import { loadSigningKey } from './signing-key.js'
import { AuthStore } from './store.js'

const config = readAuthConfig()
const store = new AuthStore(config.dataDir)
const key = await loadSigningKey(config.dataDir, config.signingKeyPem)
const app = createAuthApp({ store, config, key })

setInterval(() => store.pruneExpired(Date.now()), 60 * 60 * 1000).unref()

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`[dolphin-auth] listening on :${info.port} as ${config.issuer} (kid ${key.kid})`)
})
