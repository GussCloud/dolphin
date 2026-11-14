// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ClaudeLinkedFolders } from './ClaudeLinkedFolders'

const discoverFolders = vi.fn()
const linkFolder = vi.fn()
const pickFolder = vi.fn()

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  Object.assign(window, { api: { claudeAccounts: { discoverFolders, linkFolder, pickFolder } } })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.clearAllMocks()
})

async function render(
  runAction = vi.fn(async (_action: string, op: () => Promise<unknown>) => {
    await op()
  })
) {
  await act(async () => {
    root.render(
      <ClaudeLinkedFolders
        claudeAction="idle"
        runClaudeAccountAction={runAction}
        linkedAccountCount={0}
      />
    )
  })
  return runAction
}

function button(label: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((b) =>
    b.textContent?.includes(label)
  )
  if (!found) {
    throw new Error(`no button ${label}`)
  }
  return found
}

describe('ClaudeLinkedFolders', () => {
  it("lists the terminal menu's folders and links one as is", async () => {
    discoverFolders.mockResolvedValue({
      selectorFile: '/Users/me/.claude/contas.zsh',
      folders: [
        {
          configDir: '/Users/me/.claude-empresa',
          isDefault: false,
          email: 'me@corp.test',
          organizationName: null,
          organizationUuid: null,
          linkedAccountId: null
        },
        {
          configDir: '/Users/me/.claude',
          isDefault: true,
          email: 'me@personal.test',
          organizationName: null,
          organizationUuid: null,
          linkedAccountId: 'acct-1'
        }
      ]
    })
    linkFolder.mockResolvedValue({ accounts: [], activeAccountId: null })
    const runAction = await render()

    expect(container.textContent).toContain('/Users/me/.claude/contas.zsh')
    expect(container.textContent).toContain('me@corp.test')
    expect(container.textContent).toContain('Linked')

    await act(async () => button('Link').click())

    expect(runAction).toHaveBeenCalledWith('link:/Users/me/.claude-empresa', expect.any(Function))
    expect(linkFolder).toHaveBeenCalledWith({ configDir: '/Users/me/.claude-empresa' })
  })

  it('links a folder the user picks when nothing was detected', async () => {
    discoverFolders.mockResolvedValue({ selectorFile: null, folders: [] })
    pickFolder.mockResolvedValue('/Users/me/contas/trabalho')
    linkFolder.mockResolvedValue({ accounts: [], activeAccountId: null })
    await render()

    await act(async () => button('Choose folder').click())

    expect(linkFolder).toHaveBeenCalledWith({ configDir: '/Users/me/contas/trabalho' })
  })
})
