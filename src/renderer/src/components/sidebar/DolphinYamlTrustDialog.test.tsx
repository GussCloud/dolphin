import { renderToStaticMarkup } from 'react-dom/server'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  state: {
    activeModal: 'confirm-dolphin-yaml-hooks' as string | null,
    modalData: {} as Record<string, unknown>,
    closeModal: vi.fn(),
    markDolphinHookScriptConfirmed: vi.fn(),
    markDolphinHookRepoAlwaysTrusted: vi.fn()
  }
}))

vi.mock('@/store', () => ({
  useAppStore: Object.assign(
    (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state),
    {
      getState: () => mocks.state
    }
  )
}))

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>
}))

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) => (
    <button {...props}>{children}</button>
  )
}))

// Why: fall back to English defaults so this test doesn't depend on locale files
// being loaded; the bug is missing JSX whitespace around those fragments.
vi.mock('@/i18n/i18n', () => ({
  translate: (_key: string, fallback: string) => fallback
}))

function decodeHtml(html: string): string {
  return html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

describe('DolphinYamlTrustDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.state.activeModal = 'confirm-dolphin-yaml-hooks'
    mocks.state.modalData = {
      repoId: 'repo-1',
      repoName: 'dolphin',
      scriptKind: 'setup',
      scriptContent: 'node config/scripts/run-internal-dev-setup.mjs\npnpm install',
      contentHash: 'hash-1',
      previouslyApproved: false
    }
  })

  it('keeps spaces around dolphin.yaml and the repo name in the first-run copy', async () => {
    const { default: DolphinYamlTrustDialog } = await import('./DolphinYamlTrustDialog')
    const text = decodeHtml(renderToStaticMarkup(<DolphinYamlTrustDialog />)).replace(
      /<[^>]+>/g,
      ''
    )

    expect(text).toContain("This repository's dolphin.yaml runs on your machine")
    expect(text).toContain('Only run if you trust dolphin.')
    expect(text).toContain('Always trust dolphin.yaml in dolphin')
    expect(text).not.toContain("repository'sdolphin.yaml")
    expect(text).not.toContain('trustdolphin')
    expect(text).not.toContain('trustdolphin.yaml')
    expect(text).not.toContain('indolphin')
  })

  it('keeps spaces around dolphin.yaml when the script changed since last approval', async () => {
    mocks.state.modalData = {
      ...mocks.state.modalData,
      previouslyApproved: true
    }
    const { default: DolphinYamlTrustDialog } = await import('./DolphinYamlTrustDialog')
    const text = decodeHtml(renderToStaticMarkup(<DolphinYamlTrustDialog />)).replace(
      /<[^>]+>/g,
      ''
    )

    expect(text).toContain('dolphin.yaml changed since you last approved')
    expect(text).toContain('Always trust dolphin.yaml in dolphin')
    expect(text).not.toContain('Always trustdolphin.yaml')
    expect(text).not.toContain('indolphin')
  })
})
