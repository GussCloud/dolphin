import { describe, expect, it } from 'vitest'
import {
  isAzureDevOpsCloneMissingSignIn,
  isAzureDevOpsCloneSignInFailure
} from './git-clone-azure-sign-in-failure'
import { getGitCloneFailureMessage } from './git-clone-failure-message'

const AZURE_URL = 'https://evup@dev.azure.com/evup/P/_git/app'
const NO_PASSWORD = "Cloning into 'app'...\nfatal: unable to get password from user\n"

describe('Azure DevOps clone sign-in failures', () => {
  it.each([
    'fatal: unable to get password from user',
    "fatal: could not read Username for 'https://dev.azure.com': terminal prompts disabled",
    "fatal: Authentication failed for 'https://dev.azure.com/evup/P/_git/app/'",
    "fatal: unable to access 'https://dev.azure.com/evup/P/_git/app/': The requested URL returned error: 401"
  ])('recognises %s on an Azure DevOps https URL', (stderr) => {
    expect(isAzureDevOpsCloneSignInFailure(AZURE_URL, stderr)).toBe(true)
    expect(isAzureDevOpsCloneSignInFailure('https://org.visualstudio.com/P/_git/app', stderr)).toBe(
      true
    )
  })

  it('ignores other hosts, SSH URLs and non-auth failures', () => {
    expect(isAzureDevOpsCloneSignInFailure('https://github.com/acme/app.git', NO_PASSWORD)).toBe(
      false
    )
    expect(
      isAzureDevOpsCloneSignInFailure('git@ssh.dev.azure.com:v3/evup/P/app', NO_PASSWORD)
    ).toBe(false)
    expect(isAzureDevOpsCloneSignInFailure(AZURE_URL, 'fatal: repository not found')).toBe(false)
  })

  it('tells a local clone to sign in and keeps the git line', () => {
    const message = getGitCloneFailureMessage(NO_PASSWORD, {
      azureDevOps: { cloneUrl: AZURE_URL, signInHost: 'this-computer' }
    })
    expect(message).toBe(
      'Azure DevOps did not accept the sign-in for this clone. Sign in to Azure DevOps and try again. Git reported: fatal: unable to get password from user'
    )
    expect(isAzureDevOpsCloneSignInFailure(AZURE_URL, `Clone failed: ${message}`)).toBe(true)
  })

  it('tells an SSH clone to set up git credentials there, once, after main re-parses it', () => {
    const relayMessage = `Clone failed: ${getGitCloneFailureMessage(NO_PASSWORD, {
      azureDevOps: { cloneUrl: AZURE_URL, signInHost: 'ssh-host' }
    })}`
    const reparsed = getGitCloneFailureMessage(relayMessage, {
      clonePath: '/srv/app',
      azureDevOps: { cloneUrl: AZURE_URL, signInHost: 'ssh-host' }
    })
    expect(reparsed).toContain('git credential helper or a personal access token')
    expect(reparsed).not.toContain('az login')
    expect(reparsed).toContain('Git reported: fatal: unable to get password from user')
    expect(reparsed.match(/did not accept the sign-in/g)).toHaveLength(1)
  })

  it("classifies an older relay's raw git line in main", () => {
    const reparsed = getGitCloneFailureMessage(`Clone failed: ${NO_PASSWORD}`, {
      azureDevOps: { cloneUrl: AZURE_URL, signInHost: 'ssh-host' }
    })
    expect(reparsed).toContain('git credential helper or a personal access token')
  })

  it('tells a runtime clone to sign in to the Azure CLI on the server', () => {
    const message = getGitCloneFailureMessage(NO_PASSWORD, {
      azureDevOps: { cloneUrl: AZURE_URL, signInHost: 'runtime-host' }
    })
    expect(message).toContain('sign in to Azure DevOps there (for example with az login)')
  })

  it('treats a 403 as a failure a new sign-in cannot fix', () => {
    const forbidden = `Clone failed: ${getGitCloneFailureMessage(
      "fatal: unable to access 'https://dev.azure.com/evup/P/_git/app/': The requested URL returned error: 403",
      { azureDevOps: { cloneUrl: AZURE_URL, signInHost: 'this-computer' } }
    )}`
    expect(forbidden).toContain('did not accept the sign-in')
    expect(isAzureDevOpsCloneMissingSignIn(AZURE_URL, forbidden)).toBe(false)
    const unauthorized = forbidden.replace('error: 403', 'error: 401')
    expect(isAzureDevOpsCloneMissingSignIn(AZURE_URL, unauthorized)).toBe(true)
    expect(isAzureDevOpsCloneMissingSignIn(AZURE_URL, `Clone failed: ${NO_PASSWORD}`)).toBe(true)
  })

  it('leaves the message unchanged when the caller passes no clone URL', () => {
    expect(getGitCloneFailureMessage(NO_PASSWORD)).toBe('fatal: unable to get password from user')
  })
})
