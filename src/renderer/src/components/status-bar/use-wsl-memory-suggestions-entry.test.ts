// @vitest-environment happy-dom

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { openSettingsTarget, isWindowsUserAgent, isWebClientLocation } = vi.hoisted(() => ({
  openSettingsTarget: vi.fn(),
  isWindowsUserAgent: vi.fn(() => true),
  isWebClientLocation: vi.fn(() => false)
}))

vi.mock('../../store', () => ({
  useAppStore: (selector: (state: { openSettingsTarget: typeof openSettingsTarget }) => unknown) =>
    selector({ openSettingsTarget })
}))
vi.mock('@/components/terminal-pane/pane-helpers', () => ({ isWindowsUserAgent }))
vi.mock('@/lib/web-client-location', () => ({ isWebClientLocation }))

import { useWslMemorySuggestionsEntry } from './use-wsl-memory-suggestions-entry'

const analyze = vi.fn()

beforeEach(() => {
  Object.assign(window, { api: { wslConfigTuning: { analyze } } })
  analyze.mockResolvedValue({
    state: 'ready',
    configPath: 'C:\\Users\\me\\.wslconfig',
    fileExists: false,
    totalMemoryGb: 32,
    suggestions: [{ id: 'auto-memory-reclaim' }, { id: 'sparse-vhd' }],
    preview: ''
  })
})

afterEach(() => {
  vi.clearAllMocks()
  isWindowsUserAgent.mockReturnValue(true)
})

describe('useWslMemorySuggestionsEntry', () => {
  it('analyzes only while the popover is open', async () => {
    const setOpen = vi.fn()
    const { result, rerender } = renderHook(
      ({ open }) => useWslMemorySuggestionsEntry(open, setOpen),
      { initialProps: { open: false } }
    )
    expect(analyze).not.toHaveBeenCalled()
    rerender({ open: true })
    await waitFor(() => expect(result.current.suggestionCount).toBe(2))
  })

  it('skips the IPC off Windows', () => {
    isWindowsUserAgent.mockReturnValue(false)
    const { result } = renderHook(() => useWslMemorySuggestionsEntry(true, vi.fn()))
    expect(analyze).not.toHaveBeenCalled()
    expect(result.current.suggestionCount).toBe(0)
  })

  it('closes the popover and opens the Performance pane', async () => {
    const setOpen = vi.fn()
    const { result } = renderHook(() => useWslMemorySuggestionsEntry(false, setOpen))
    act(() => result.current.openPerformanceSettings())
    expect(setOpen).toHaveBeenCalledWith(false)
    await waitFor(() =>
      expect(openSettingsTarget).toHaveBeenCalledWith({ pane: 'performance', repoId: null })
    )
  })
})
