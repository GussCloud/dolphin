import { describe, expect, it, vi } from 'vitest'
import {
  emitDolphindProfileStateAuthoritySelected,
  formatDolphindProfileStateAuthoritySelected,
  type DolphindProfileStateAuthoritySelection
} from './dolphind-profile-state-telemetry'

const selection: DolphindProfileStateAuthoritySelection = {
  backend: 'sqlite',
  classification: 'json-only',
  authority_mode: 'sqlite-established',
  runtime: 'dolphind',
  migrated: true
}

describe('dolphind profile-state telemetry', () => {
  it('formats a bounded machine-readable authority selection event', () => {
    expect(JSON.parse(formatDolphindProfileStateAuthoritySelected(selection).slice(18))).toEqual({
      event: 'profile_state_authority_selected',
      ...selection
    })
  })

  it('strips unexpected runtime fields before writing the record', () => {
    const selectionWithRuntimeFields = Object.assign({}, selection, {
      database_path: '/private/profile-state.db'
    })
    const line = formatDolphindProfileStateAuthoritySelected(selectionWithRuntimeFields)
    expect(line).not.toContain('database_path')
  })

  it('sends the event to the supplied sink', () => {
    const sink = vi.fn()
    emitDolphindProfileStateAuthoritySelected(selection, sink)
    expect(sink).toHaveBeenCalledOnce()
    expect(sink).toHaveBeenCalledWith(formatDolphindProfileStateAuthoritySelected(selection))
  })

  it('never lets a failing sink block startup', () => {
    expect(() =>
      emitDolphindProfileStateAuthoritySelected(selection, () => {
        throw new Error('closed stderr')
      })
    ).not.toThrow()
  })
})
