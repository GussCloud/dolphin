import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { Dialog } from '@/components/ui/dialog'
import { TooltipProvider } from '@/components/ui/tooltip'
import { CreateStep } from './AddRepoCreateStep'
import type { GitAvailability } from './create-project-defaults'

function renderCreateStep({
  createName = '',
  gitAvailability = 'available',
  createParent = '/Users/alice/dolphin/projects',
  parentDefaultPending = false,
  identity,
  sshTargetId = null,
  advancedOpen = identity !== undefined
}: {
  createName?: string
  gitAvailability?: GitAvailability
  createParent?: string
  parentDefaultPending?: boolean
  identity?: { name: string; email: string }
  sshTargetId?: string | null
  advancedOpen?: boolean
} = {}): string {
  return renderToStaticMarkup(
    <TooltipProvider>
      <Dialog open>
        <CreateStep
          createName={createName}
          createParent={createParent}
          createError={null}
          isCreating={false}
          defaultParent="/Users/alice/dolphin/projects"
          gitAvailability={gitAvailability}
          runtimeParentStatus="idle"
          parentDefaultPending={parentDefaultPending}
          onNameChange={vi.fn()}
          onParentChange={vi.fn()}
          onPickParent={vi.fn()}
          onCreate={vi.fn()}
          manualParentEntry={advancedOpen}
          sshTargetId={sshTargetId}
          commitIdentity={identity ? { draft: identity, onChange: vi.fn() } : undefined}
        />
      </Dialog>
    </TooltipProvider>
  )
}

function createButtonDisabled(html: string): boolean {
  const end = html.indexOf('>Create project</button>')
  return html.slice(html.lastIndexOf('<button', end), end).includes('disabled=""')
}

describe('CreateStep', () => {
  it('renders the name-first create UI with advanced controls collapsed', () => {
    const html = renderCreateStep()

    expect(html).toContain('Create a new project')
    expect(html).toContain('Name')
    expect(html).toContain('Git repository in ~/dolphin/projects')
    // The summary card itself is the collapsed disclosure for the uncommon settings.
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Project kind')
    expect(html).not.toContain('Location</span>')
    expect(html).not.toContain('aria-label="Browse host filesystem"')
  })

  it('shows the Git-required explanation in the collapsed summary', () => {
    const html = renderCreateStep({
      createName: 'demo-project',
      gitAvailability: 'unavailable'
    })

    expect(html).toContain('Git repository in ~/dolphin/projects')
    expect(html).toContain('Git is required to create a project.')
    expect(html).toContain('disabled=""')
  })

  it('disables create while an auto-filled parent belongs to a previous target', () => {
    const html = renderCreateStep({
      createName: 'demo-project',
      parentDefaultPending: true
    })

    expect(html).toContain('disabled=""')
  })

  it('offers the commit author with the advanced settings and blocks a half-filled one', () => {
    const blank = renderCreateStep({ createName: 'demo', identity: { name: '', email: '' } })
    expect(blank).toContain('Commit author')
    expect(createButtonDisabled(blank)).toBe(false)

    const half = renderCreateStep({ createName: 'demo', identity: { name: 'Dev', email: '' } })
    expect(createButtonDisabled(half)).toBe(true)
  })

  it('hides the commit author for SSH hosts', () => {
    const html = renderCreateStep({
      createName: 'demo',
      identity: { name: 'Dev', email: '' },
      sshTargetId: 'ssh-1'
    })
    expect(html).not.toContain('Commit author')
  })

  it('names a half-filled author next to the disabled button while settings are collapsed', () => {
    const collapsed = renderCreateStep({
      createName: 'demo',
      identity: { name: 'Dev', email: '' },
      advancedOpen: false
    })
    expect(collapsed).toContain('The commit author is incomplete or invalid.')
    expect(createButtonDisabled(collapsed)).toBe(true)

    const valid = renderCreateStep({
      createName: 'demo',
      identity: { name: 'Dev', email: 'dev@example.test' },
      advancedOpen: false
    })
    expect(valid).not.toContain('The commit author is incomplete or invalid.')
  })
})
