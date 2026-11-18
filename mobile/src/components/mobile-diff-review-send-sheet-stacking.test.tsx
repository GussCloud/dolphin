import { createElement, type ReactNode } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type DrawerProps = {
  visible: boolean
  onClose: () => void
  onAfterClose?: () => void
  children: ReactNode
}

vi.mock('react-native', () => ({
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios },
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFillObject: {} },
  Text: 'Text',
  TextInput: 'TextInput',
  View: 'View'
}))
vi.mock('lucide-react-native', () => ({
  Check: 'Check',
  Copy: 'Copy',
  Edit3: 'Edit3',
  FileText: 'FileText',
  Plus: 'Plus',
  Send: 'Send',
  Trash2: 'Trash2',
  X: 'X'
}))
vi.mock('../platform/keyboard-occlusion', () => ({ useKeyboardAvoidingPadding: () => 0 }))
vi.mock('./mobile-diff-review-screen-styles', () => ({ mobileDiffReviewStyles: {} }))
vi.mock('./ConfirmModal', () => ({ ConfirmModal: () => null }))
// Why: render only shown drawers so each test sees which sheet iOS would present.
vi.mock('./BottomDrawer', () => ({
  BottomDrawer: (props: DrawerProps) =>
    props.visible ? createElement('Drawer', { drawer: props }, props.children) : null
}))

import { MobileDiffReviewDrawers } from './MobileDiffReviewDrawers'

function fakeController(overrides: Record<string, unknown>) {
  return {
    showOverflow: false,
    setShowOverflow: vi.fn(),
    sendSheet: null,
    setSendSheet: vi.fn(),
    discardTarget: null,
    setDiscardTarget: vi.fn(),
    composer: null,
    composerBody: '',
    showCompletion: false,
    setShowCompletion: vi.fn(),
    openSendSheet: vi.fn(async () => {}),
    unsentComments: [{ id: 'c1' }],
    reviewedUnstagedCount: 0,
    busyAction: null,
    currentItem: null,
    queue: [],
    screenState: { kind: 'ready', comments: [{ id: 'c1' }] },
    ...overrides
  }
}

function render(controller: ReturnType<typeof fakeController>): ReactTestRenderer {
  let renderer: ReactTestRenderer | null = null
  act(() => {
    renderer = create(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the fake covers every controller field these drawers read.
      createElement(MobileDiffReviewDrawers, { controller: controller as never })
    )
  })
  if (!renderer) {
    throw new Error('Review drawers did not render')
  }
  return renderer
}

function shownDrawer(renderer: ReactTestRenderer): DrawerProps {
  const drawers = renderer.root.findAll((node) => String(node.type) === 'Drawer')
  expect(drawers).toHaveLength(1)
  return drawers[0].props.drawer
}

function pressByText(renderer: ReactTestRenderer, label: string): void {
  const pressable = renderer.root
    .findAll((node) => String(node.type) === 'Pressable')
    .find(
      (node: ReactTestInstance) =>
        node.findAll((child) => child.children.includes(label)).length > 0
    )
  if (!pressable) {
    throw new Error(`No pressable labelled ${label}`)
  }
  act(() => pressable.props.onPress())
}

describe('review sheets open Send Notes only after their own sheet closes', () => {
  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('defers Send Unsent Notes until the Review Actions sheet has closed', () => {
    const controller = fakeController({ showOverflow: true })
    const renderer = render(controller)
    pressByText(renderer, 'Send Unsent Notes')
    expect(controller.setShowOverflow).toHaveBeenCalledWith(false)
    expect(controller.openSendSheet).not.toHaveBeenCalled()

    act(() => shownDrawer(renderer).onAfterClose?.())
    expect(controller.openSendSheet).toHaveBeenCalledTimes(1)
  })

  it('defers Review Complete > Send Notes until that drawer has closed', () => {
    const controller = fakeController({ showCompletion: true })
    const renderer = render(controller)
    pressByText(renderer, 'Send Notes')
    expect(controller.setShowCompletion).toHaveBeenCalledWith(false)
    expect(controller.openSendSheet).not.toHaveBeenCalled()

    act(() => shownDrawer(renderer).onAfterClose?.())
    expect(controller.openSendSheet).toHaveBeenCalledTimes(1)
  })

  it('does not open Send Notes when Review Complete is dismissed', () => {
    const controller = fakeController({ showCompletion: true })
    const renderer = render(controller)
    const drawer = shownDrawer(renderer)
    act(() => drawer.onClose())
    act(() => drawer.onAfterClose?.())
    expect(controller.openSendSheet).not.toHaveBeenCalled()
  })
})
