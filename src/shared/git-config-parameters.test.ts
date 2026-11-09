import { describe, expect, it } from 'vitest'
import {
  appendGitConfigParameters,
  quoteGitConfigParameter,
  scopedCredentialHelperEntries
} from './git-config-parameters'

describe('GIT_CONFIG_PARAMETERS', () => {
  it("sq-quotes like git, including a value that contains '", () => {
    expect(quoteGitConfigParameter(['user.name', "Ana O'Dev"])).toBe("'user.name=Ana O'\\''Dev'")
  })

  it('appends after inherited entries so the project entries are applied last', () => {
    expect(
      appendGitConfigParameters("'core.editor=vim'", [
        ['user.email', 'ana@corp.example'],
        ['credential.https://github.com.helper', '']
      ])
    ).toBe(
      "'core.editor=vim' 'user.email=ana@corp.example' 'credential.https://github.com.helper='"
    )
    expect(appendGitConfigParameters(undefined, [['user.name', 'Ana']])).toBe("'user.name=Ana'")
  })

  it('resets every earlier helper for each URL before adding the project helper', () => {
    expect(scopedCredentialHelperEntries(['https://a', 'https://b'], '!h')).toEqual([
      ['credential.https://a.helper', ''],
      ['credential.https://a.helper', '!h'],
      ['credential.https://b.helper', ''],
      ['credential.https://b.helper', '!h']
    ])
  })
})
