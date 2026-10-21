// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { WslConfigAnalysis } from '../../../../shared/wslconfig-tuning-types'
import { WslConfigTuningSetting } from './WslConfigTuningSetting'

const readyAnalysis: WslConfigAnalysis = {
  state: 'ready',
  configPath: 'C:\\Users\\me\\.wslconfig',
  fileExists: false,
  totalMemoryGb: 32,
  suggestions: [
    {
      id: 'auto-memory-reclaim',
      section: 'experimental',
      key: 'autoMemoryReclaim',
      currentValue: null,
      suggestedValue: 'gradual'
    }
  ],
  preview: '[experimental]\nautoMemoryReclaim=gradual\n'
}

const analyze = vi.fn<() => Promise<WslConfigAnalysis>>()
const apply = vi.fn()

beforeEach(() => {
  Object.assign(window, { api: { wslConfigTuning: { analyze, apply } } })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('WslConfigTuningSetting', () => {
  it('does not ask main for an analysis off Windows', () => {
    const { container } = render(<WslConfigTuningSetting wslSupportedPlatform={false} />)
    expect(container.innerHTML).toBe('')
    expect(analyze).not.toHaveBeenCalled()
  })

  it('stays hidden when main reports the host unsupported', async () => {
    analyze.mockResolvedValue({ state: 'unsupported' })
    const { container } = render(<WslConfigTuningSetting wslSupportedPlatform />)
    await waitFor(() => expect(analyze).toHaveBeenCalled())
    expect(container.innerHTML).toBe('')
  })

  it('previews suggestions and applies them only after the button is pressed', async () => {
    analyze.mockResolvedValueOnce(readyAnalysis).mockResolvedValueOnce({
      ...readyAnalysis,
      fileExists: true,
      suggestions: [],
      preview: readyAnalysis.preview
    })
    apply.mockResolvedValue({
      ok: true,
      configPath: readyAnalysis.configPath,
      backupPath: null,
      appliedIds: ['auto-memory-reclaim']
    })
    render(<WslConfigTuningSetting wslSupportedPlatform />)

    const button = await screen.findByRole('button', { name: 'Apply to .wslconfig' })
    expect(
      screen.getByText('[experimental] autoMemoryReclaim=gradual', { selector: 'div' })
    ).toBeTruthy()
    expect(apply).not.toHaveBeenCalled()

    fireEvent.click(button)
    await waitFor(() => expect(apply).toHaveBeenCalledWith(['auto-memory-reclaim']))
    expect(await screen.findByText(/wsl --shutdown/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Apply to .wslconfig' })).toBeNull()
  })
})
