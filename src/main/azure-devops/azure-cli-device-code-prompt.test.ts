import { describe, expect, it } from 'vitest'
import { parseAzureCliDeviceCodePrompt } from './azure-cli-device-code-prompt'

const prompt = (url: string, code = 'FU3HPB3RT'): string =>
  `To sign in, use a web browser to open the page ${url} and enter the code ${code} to authenticate.\n`

describe('parseAzureCliDeviceCodePrompt', () => {
  it('reads the az 2.92 prompt', () => {
    expect(parseAzureCliDeviceCodePrompt(prompt('https://login.microsoft.com/device'))).toEqual({
      verificationUrl: 'https://login.microsoft.com/device',
      userCode: 'FU3HPB3RT'
    })
  })

  it('reads the older devicelogin page', () => {
    expect(parseAzureCliDeviceCodePrompt(prompt('https://microsoft.com/devicelogin'))).toEqual({
      verificationUrl: 'https://microsoft.com/devicelogin',
      userCode: 'FU3HPB3RT'
    })
  })

  it('skips a warning line with its own link before the prompt', () => {
    const text = `WARNING: retried after error code 80070005AB; see https://aka.ms/cli_ref for details.\n${prompt('https://login.microsoft.com/device')}`
    expect(parseAzureCliDeviceCodePrompt(text)).toEqual({
      verificationUrl: 'https://login.microsoft.com/device',
      userCode: 'FU3HPB3RT'
    })
  })

  it('rejects pages outside Microsoft device login', () => {
    for (const url of [
      'https://evil.example/device',
      'https://login.microsoft.com.evil.example/device',
      'http://login.microsoft.com/device',
      'https://microsoft.com/somewhere-else',
      'https://user@login.microsoft.com/device',
      'https://login.microsoft.com:8443/device'
    ]) {
      expect(parseAzureCliDeviceCodePrompt(prompt(url)), url).toBeNull()
    }
  })

  it('rejects malformed codes and unrelated output', () => {
    const page = 'https://login.microsoft.com/device'
    expect(parseAzureCliDeviceCodePrompt(prompt(page, 'abc'))).toBeNull()
    expect(parseAzureCliDeviceCodePrompt(prompt(page, 'fu3hpb3rt'))).toBeNull()
    expect(parseAzureCliDeviceCodePrompt(prompt(page, 'FU3HPB3RTFU3HPB'))).toBeNull()
    expect(parseAzureCliDeviceCodePrompt('ERROR: AADSTS50058: denied')).toBeNull()
    expect(parseAzureCliDeviceCodePrompt('')).toBeNull()
  })
})
