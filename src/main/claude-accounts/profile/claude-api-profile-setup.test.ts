import { describe, expect, it } from 'vitest'
import { stripClaudeCredentialSettings } from './claude-api-profile-setup'

describe('stripClaudeCredentialSettings', () => {
  it.each([
    'apiKeyHelper',
    'forceLoginMethod',
    'forceLoginOrgUUID',
    'awsAuthRefresh',
    'awsCredentialExport',
    'gcpAuthRefresh'
  ])('drops the top-level %s setting', (key) => {
    expect(stripClaudeCredentialSettings({ [key]: 'x', model: 'opus' })).toEqual({ model: 'opus' })
  })

  it.each([
    'ANTHROPIC_API_KEY',
    'anthropic_base_url',
    'CLAUDE_CODE_OAUTH_TOKEN',
    'CLAUDE_CODE_USE_BEDROCK',
    'CLAUDE_CODE_USE_VERTEX',
    'AWS_ACCESS_KEY_ID',
    'AWS_PROFILE',
    'GOOGLE_APPLICATION_CREDENTIALS',
    'VERTEX_REGION_CLAUDE_3_5_SONNET',
    'CLOUD_ML_REGION'
  ])('drops the env key %s', (key) => {
    expect(stripClaudeCredentialSettings({ env: { [key]: 'x', KEEP: '1' } })).toEqual({
      env: { KEEP: '1' }
    })
  })

  it('keeps every other setting and env key', () => {
    const settings = {
      model: 'opus',
      permissions: { allow: ['Bash(ls)'] },
      env: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: '8000', HTTPS_PROXY: 'http://proxy', KEEP: '1' }
    }
    expect(stripClaudeCredentialSettings(settings)).toEqual(settings)
  })
})
