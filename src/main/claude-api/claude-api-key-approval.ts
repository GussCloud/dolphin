import { join } from 'node:path'
import { asJsonObject, updateJsonObjectFile } from '../claude-accounts/profile/claude-profile-json'

// UNVERIFIED: the key name and the 20-character suffix come from Claude Code's documented
// "custom API key" prompt, not from a captured transcript. Replace or confirm this with a capture
// (docs/reference/agent-pty-transcript-capture.md) before any rule depends on that screen.
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
  apiKey: string
): Promise<void> {
  const suffix = claudeApiKeyApprovalSuffix(apiKey)
  if (!suffix) {
    return
  }
  await updateJsonObjectFile(join(profileDir, '.claude.json'), (current) => {
    const responses = asJsonObject(current[APPROVAL_KEY])
    const approved = asStringList(responses.approved)
    const rejected = asStringList(responses.rejected)
    if (approved.includes(suffix) && !rejected.includes(suffix)) {
      return current
    }
    return {
      ...current,
      [APPROVAL_KEY]: {
        ...responses,
        approved: approved.includes(suffix) ? approved : [...approved, suffix],
        rejected: rejected.filter((entry) => entry !== suffix)
      }
    }
  })
}
