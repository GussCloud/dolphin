import { existsSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import {
  isolateClaudeProfileDir,
  seedClaudeProfileState
} from '../pinned-config-dir/claude-pinned-config-layout'
import { isDefaultClaudeConfigDir } from '../claude-account-config-dir'
import { importIntoClaudeProfile, listClaudeProfileImportItems } from './claude-profile-import'
import { asJsonObject, updateJsonObjectFile, type JsonObject } from './claude-profile-json'

/** Top-level settings that pick credentials, a login or a cloud provider for Claude Code. */
const CREDENTIAL_SETTINGS_KEYS = [
  'apiKeyHelper',
  'forceLoginMethod',
  'forceLoginOrgUUID',
  'awsAuthRefresh',
  'awsCredentialExport',
  'gcpAuthRefresh'
] as const

const CREDENTIAL_ENV_PREFIXES = [
  'ANTHROPIC_',
  'CLAUDE_CODE_USE_',
  'AWS_',
  'GOOGLE_',
  'VERTEX_',
  'CLOUD_ML_'
] as const

function isCredentialEnvKey(key: string): boolean {
  const upper = key.toUpperCase()
  return (
    upper === 'CLAUDE_CODE_OAUTH_TOKEN' ||
    CREDENTIAL_ENV_PREFIXES.some((prefix) => upper.startsWith(prefix))
  )
}

/**
 * Copied settings minus a denylist, so the API account's launch cannot reach other credentials:
 * top-level apiKeyHelper, forceLoginMethod, forceLoginOrgUUID, awsAuthRefresh,
 * awsCredentialExport, gcpAuthRefresh; env CLAUDE_CODE_OAUTH_TOKEN and every env key starting
 * with ANTHROPIC_, CLAUDE_CODE_USE_, AWS_, GOOGLE_, VERTEX_ or CLOUD_ML_ (case-insensitive).
 * Every other setting and env key is kept.
 */
export function stripClaudeCredentialSettings(settings: JsonObject): JsonObject {
  const next: JsonObject = { ...settings }
  for (const key of CREDENTIAL_SETTINGS_KEYS) {
    delete next[key]
  }
  if ('env' in next) {
    next.env = Object.fromEntries(
      Object.entries(asJsonObject(next.env)).filter(([key]) => !isCredentialEnvKey(key))
    )
  }
  return next
}

/** The `.claude.json` beside a config dir; `~/.claude` keeps it in the home dir instead. */
export function claudeStatePathForConfigDir(configDir: string, home: string = homedir()): string {
  return isDefaultClaudeConfigDir(configDir, home)
    ? join(home, '.claude.json')
    : join(configDir, '.claude.json')
}

/**
 * Prepares the isolated profile of a new API account. `copyFromConfigDir` seeds it with that
 * profile's instructions, settings and tools through the import positive list, so credentials and
 * the OAuth identity never travel.
 */
export async function setupClaudeApiProfile(args: {
  profileDir: string
  /** The user's own Claude dir: IDE lock files and harmless defaults come from it. */
  userConfigDir: string
  userStatePath: string
  copyFromConfigDir: string | null
}): Promise<void> {
  isolateClaudeProfileDir(args.profileDir, args.userConfigDir)
  const sourceStatePath = args.copyFromConfigDir
    ? claudeStatePathForConfigDir(args.copyFromConfigDir)
    : args.userStatePath
  if (args.copyFromConfigDir) {
    const paths = {
      userConfigDir: args.copyFromConfigDir,
      userStatePath: sourceStatePath,
      profileDir: args.profileDir
    }
    await importIntoClaudeProfile(
      paths,
      listClaudeProfileImportItems(paths).map((entry) => entry.id)
    )
    const settingsPath = join(args.profileDir, 'settings.json')
    if (
      existsSync(settingsPath) &&
      !(await updateJsonObjectFile(settingsPath, stripClaudeCredentialSettings))
    ) {
      // Why: a file that is not JSON cannot be cleaned, and could still name other credentials.
      rmSync(settingsPath, { force: true })
    }
  }
  await seedClaudeProfileState({
    profileConfigPath: join(args.profileDir, '.claude.json'),
    userConfigPath: sourceStatePath,
    oauthAccount: null
  })
}
