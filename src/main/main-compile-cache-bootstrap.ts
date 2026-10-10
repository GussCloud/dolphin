// Built as out/main/index.js: the V8 compile cache must be enabled before the
// multi-megabyte main bundle is compiled, so the app itself loads from main-app.js.
import { app } from 'electron'
import * as nodeModule from 'node:module'
import { FORK_IDENTITY } from '../shared/fork-identity'
import { resolveMainCompileCacheDir, startMainCompileCache } from './startup/main-compile-cache'

function resolveCacheDir(): string | null {
  try {
    return resolveMainCompileCacheDir({
      isPackaged: app.isPackaged,
      appDataPath: app.getPath('appData'),
      userDataDirName: FORK_IDENTITY.userDataDirName,
      env: process.env
    })
  } catch {
    return null
  }
}

const flushMainCompileCache = startMainCompileCache(resolveCacheDir(), nodeModule)
// Why: a runtime require keeps Rollup from inlining the app into this entry.
nodeModule.createRequire(import.meta.url)('./main-app.js')
flushMainCompileCache()
