import { join } from 'node:path'
import { asJsonObject, updateJsonObjectFile } from '../claude-accounts/profile/claude-profile-json'

// Why: Claude Code asks "Detected a custom API key in your environment" with No as the default, and
// answering Yes stores the key's last 20 characters here. Captured on Claude Code 2.1.332:
// src/main/runtime/__fixtures__/claude-api-key-{detected-prompt,preapproved-ready}.txt.
const APPROVAL_KEY = 'customApiKeyResponses'
const KEY_SUFFIX_LENGTH = 20

export function claudeApiKeyApprovalSuffix(apiKey: string): string {
  return apiKey.trim().slice(-KEY_SUFFIX_LENGTH)
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

/**
 * Records `apiKey` as approved in the profile's `.claude.json`, so Claude Code does not stop at its
 * "use this API key?" question. Stores only the suffix the CLI itself keeps; idempotent.
 */
export async function preapproveClaudeApiKeyInProfile(
  profileDir: string,
  apiKey: string,
  /** The key this one replaces; its approval is dropped so a revoked key is not pre-approved. */
  replacedKey?: string | null
): Promise<void> {
  const suffix = claudeApiKeyApprovalSuffix(apiKey)
  if (!suffix) {
    return
  }
  const replacedSuffix = replacedKey ? claudeApiKeyApprovalSuffix(replacedKey) : ''
  await updateJsonObjectFile(join(profileDir, '.claude.json'), (current) => {
    const responses = asJsonObject(current[APPROVAL_KEY])
    const approved = asStringList(responses.approved).filter(
      (entry) => entry !== suffix && (!replacedSuffix || entry !== replacedSuffix)
    )
    // Why drop it from rejected: a user who once answered No would otherwise stay rejected.
    const rejected = asStringList(responses.rejected).filter((entry) => entry !== suffix)
    return {
      ...current,
      [APPROVAL_KEY]: { ...responses, approved: [...approved, suffix], rejected }
    }
  })
}
