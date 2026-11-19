import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ptyOwnership } from '../provider/ownership-state'
import { interactiveOutputCharsByPty, lastInputAtByPty } from '../delivery/visibility-state'
import { createPtyWriteInput } from './write-input'

const PTY_ID = 'pty-user-clock'

const { provider } = vi.hoisted(() => ({
  provider: { write: vi.fn(), hasPty: vi.fn(() => true) }
}))

vi.mock('../provider/registry', () => ({
  tryGetProviderForPty: (id: string) => (id === PTY_ID ? provider : undefined)
}))

function writers(): ReturnType<typeof createPtyWriteInput> {
  return createPtyWriteInput({})
}

beforeEach(() => {
  ptyOwnership.set(PTY_ID, null)
  provider.write.mockReset()
})

afterEach(() => {
  ptyOwnership.delete(PTY_ID)
  lastInputAtByPty.delete(PTY_ID)
  interactiveOutputCharsByPty.delete(PTY_ID)
})

describe('renderer pty input clock', () => {
  it.each(['writePtyInput', 'writePtyInputAccepted'] as const)(
    '%s forwards terminal reports without counting them as user input',
    async (name) => {
      const write = writers()[name]
      interactiveOutputCharsByPty.set(PTY_ID, 500)
      await write({ id: PTY_ID, data: '\x1b[I\x1b[?997;2n' })
      await write({ id: PTY_ID, data: '\x1b[24;80R' })
      expect(provider.write).toHaveBeenCalledTimes(2)
      expect(lastInputAtByPty.has(PTY_ID)).toBe(false)
      expect(interactiveOutputCharsByPty.get(PTY_ID)).toBe(500)

      await write({ id: PTY_ID, data: 'y' })
      expect(lastInputAtByPty.get(PTY_ID)).toEqual(expect.any(Number))
      expect(interactiveOutputCharsByPty.get(PTY_ID)).toBe(0)
    }
  )
})
