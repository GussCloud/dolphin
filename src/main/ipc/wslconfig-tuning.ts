import { ipcMain } from 'electron'
import { readFile } from 'node:fs/promises'
import { homedir, totalmem } from 'node:os'
import { join } from 'node:path'
import { copyFileDurable, durableWriteTempPath, writeFileDurable } from '../durable-file-write'
import {
  parseWslConfigDocument,
  serializeWslConfigDocument,
  type WslConfigDocument
} from '../wslconfig/wslconfig-ini-document'
import {
  applyWslConfigSuggestions,
  buildWslConfigSuggestions
} from '../wslconfig/wslconfig-suggestions'
import type {
  WslConfigAnalysis,
  WslConfigApplyResult,
  WslConfigSuggestionId
} from '../../shared/wslconfig-tuning-types'

const BYTES_PER_GB = 1024 ** 3
const SUGGESTION_IDS: readonly WslConfigSuggestionId[] = [
  'auto-memory-reclaim',
  'sparse-vhd',
  'memory-cap'
]

export function wslConfigPath(): string {
  return join(homedir(), '.wslconfig')
}

type LoadedWslConfig =
  | { kind: 'loaded'; document: WslConfigDocument; fileExists: boolean }
  | { kind: 'unreadable' }

async function loadWslConfig(path: string): Promise<LoadedWslConfig> {
  let raw: Buffer
  try {
    raw = await readFile(path)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { kind: 'loaded', document: parseWslConfigDocument(''), fileExists: false }
    }
    return { kind: 'unreadable' }
  }
  const isUtf16 =
    raw.length >= 2 &&
    ((raw[0] === 0xff && raw[1] === 0xfe) || (raw[0] === 0xfe && raw[1] === 0xff))
  if (isUtf16) {
    return { kind: 'unreadable' }
  }
  const text = raw.toString('utf-8').replace(/^\uFEFF/, '')
  return { kind: 'loaded', document: parseWslConfigDocument(text), fileExists: true }
}

export async function analyzeWslConfig(): Promise<WslConfigAnalysis> {
  if (process.platform !== 'win32') {
    return { state: 'unsupported' }
  }
  const configPath = wslConfigPath()
  const loaded = await loadWslConfig(configPath)
  if (loaded.kind === 'unreadable') {
    return { state: 'unreadable', configPath }
  }
  const totalMemoryBytes = totalmem()
  const suggestions = buildWslConfigSuggestions(loaded.document, totalMemoryBytes)
  const { document } = applyWslConfigSuggestions(
    loaded.document,
    suggestions,
    suggestions.map((suggestion) => suggestion.id)
  )
  return {
    state: 'ready',
    configPath,
    fileExists: loaded.fileExists,
    totalMemoryGb: Math.round(totalMemoryBytes / BYTES_PER_GB),
    suggestions,
    preview: serializeWslConfigDocument(document)
  }
}

export async function applyWslConfig(ids: unknown): Promise<WslConfigApplyResult> {
  if (process.platform !== 'win32') {
    return { ok: false, reason: 'unsupported', configPath: null }
  }
  const requested = Array.isArray(ids) ? SUGGESTION_IDS.filter((id) => ids.includes(id)) : []
  const configPath = wslConfigPath()
  // Why: re-read instead of trusting the preview so edits made since the analysis are kept.
  const loaded = await loadWslConfig(configPath)
  if (loaded.kind === 'unreadable') {
    return { ok: false, reason: 'unreadable', configPath }
  }
  const suggestions = buildWslConfigSuggestions(loaded.document, totalmem())
  const { document, appliedIds } = applyWslConfigSuggestions(
    loaded.document,
    suggestions,
    requested
  )
  if (appliedIds.length === 0) {
    return { ok: true, configPath, backupPath: null, appliedIds }
  }
  try {
    const backupPath = `${configPath}.dolphin-backup`
    const backedUp = loaded.fileExists ? await copyFileDurable(configPath, backupPath) : false
    await writeFileDurable(
      durableWriteTempPath(configPath),
      configPath,
      serializeWslConfigDocument(document)
    )
    return { ok: true, configPath, backupPath: backedUp ? backupPath : null, appliedIds }
  } catch {
    return { ok: false, reason: 'write-failed', configPath }
  }
}

/** Registers the on-demand `.wslconfig` analysis and apply channels; nothing runs until Settings asks. */
export function registerWslConfigTuningHandlers(): void {
  ipcMain.removeHandler('wslConfigTuning:analyze')
  ipcMain.handle('wslConfigTuning:analyze', (): Promise<WslConfigAnalysis> => analyzeWslConfig())
  ipcMain.removeHandler('wslConfigTuning:apply')
  ipcMain.handle('wslConfigTuning:apply', (_event, ids: unknown): Promise<WslConfigApplyResult> =>
    applyWslConfig(ids)
  )
}
