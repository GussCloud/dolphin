import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAuthApp } from '../app.js'
import { readAuthConfig } from '../config.js'
import { hashPassword } from '../secrets.js'
import { loadSigningKey } from '../signing-key.js'
import { AuthStore } from '../store.js'
import { fakeAzureDevOps, type FakeAzureDevOpsOrg } from './fake-azure-devops.js'

export const TEST_ISSUER = 'https://auth.dolphin.example'
export const TEST_PASSWORD = 'correct horse battery'

/** An auth app on a throwaway SQLite dir, wired to a fake Azure DevOps. */
export async function createTestAuthApp(options: { orgs?: FakeAzureDevOpsOrg[]; env?: NodeJS.ProcessEnv } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'dolphin-auth-'))
  const config = readAuthConfig({ DOLPHIN_AUTH_ISSUER: TEST_ISSUER, DOLPHIN_AUTH_DATA_DIR: dataDir, ...options.env })
  const store = new AuthStore(dataDir)
  const azure = fakeAzureDevOps(options.orgs ?? [])
  const app = createAuthApp({ store, config, key: await loadSigningKey(dataDir, null), azureDevOpsFetch: azure.fetch })
  return {
    app,
    store,
    config,
    azure,
    createUser: async (id: string, email: string) =>
      store.createUser({ id, email, passwordHash: await hashPassword(TEST_PASSWORD) }),
    // Why close first: Windows refuses to delete an open SQLite file (EPERM).
    dispose: () => {
      store.close()
      rmSync(dataDir, { recursive: true, force: true })
    }
  }
}

/** Every text value in every table, for asserting a secret never reached the database. */
export function dumpDatabase(store: AuthStore): string {
  const tables = store.db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()
  return tables
    .map((table) => JSON.stringify(store.db.prepare(`SELECT * FROM "${String(table.name)}"`).all()))
    .join('\n')
}
