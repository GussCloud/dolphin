import { createRequire } from 'node:module'
import { expect, it } from 'vitest'

const { assertWindowsProcessTreeCreationTime } = createRequire(import.meta.url)(
  './windows-process-tree-creation-time.cjs'
)

it('rejects a previously patched binary that has table creation times but no synchronous getter', () => {
  expect(() =>
    assertWindowsProcessTreeCreationTime({
      platform: 'win32',
      module: { supportedProcessDataFlags: 7 }
    })
  ).toThrow('synchronous identity getter')
})

it('accepts the compiled capability only when both readers are available', () => {
  expect(() =>
    assertWindowsProcessTreeCreationTime({
      platform: 'win32',
      module: { supportedProcessDataFlags: 15, getProcessCreationTime: () => undefined }
    })
  ).not.toThrow()
})

it('rejects a binary built before resource counters existed so it is rebuilt', () => {
  expect(() =>
    assertWindowsProcessTreeCreationTime({
      platform: 'win32',
      module: { supportedProcessDataFlags: 7, getProcessCreationTime: () => undefined }
    })
  ).toThrow('ResourceUsage support')
})

it('still rejects a binary without table creation-time support', () => {
  expect(() =>
    assertWindowsProcessTreeCreationTime({
      platform: 'win32',
      module: { getProcessCreationTime: () => undefined }
    })
  ).toThrow('CreationTime support')
})

it('does not require Windows native capabilities on another platform', () => {
  expect(() => assertWindowsProcessTreeCreationTime({ platform: 'darwin' })).not.toThrow()
})
