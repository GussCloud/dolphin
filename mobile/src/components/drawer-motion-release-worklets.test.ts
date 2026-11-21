import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const nodeRequire = createRequire(import.meta.url)
const expoPreset = nodeRequire.resolve('babel-preset-expo', {
  paths: [nodeRequire.resolve('expo/package.json')]
})
// Why resolved through the preset: mobile does not declare @babel/core; the preset's own copy is the one Metro runs.
const babel: {
  transformSync: (code: string, options: Record<string, unknown>) => { code?: string | null } | null
} = nodeRequire(nodeRequire.resolve('@babel/core', { paths: [expoPreset] }))

type Captured = { callback?: unknown }

/**
 * drawer-motion.ts compiled exactly as an Android release bundle compiles it (babel-preset-expo with
 * the real worklets plugin), with only withTiming swapped to capture what it is handed. The plugin's
 * output is the layer under test: a release build gives the UI thread a non-worklet callback as an
 * uncallable object, and the frame that finishes the animation crashes calling it.
 */
function loadReleaseDrawerMotion(captured: Captured) {
  const filename = join(import.meta.dirname, 'drawer-motion.ts')
  const compiled = babel.transformSync(readFileSync(filename, 'utf8'), {
    babelrc: false,
    configFile: false,
    filename,
    envName: 'production',
    presets: [expoPreset],
    caller: { name: 'metro', platform: 'android', isDev: false, bundler: 'metro', engine: 'hermes' }
  })?.code
  if (!compiled) {
    throw new Error('drawer-motion.ts did not compile')
  }
  const reanimated = {
    Easing: { bezier: () => ({ factory: () => (t: number) => t }) },
    ReduceMotion: { Never: 'never', System: 'system' },
    cancelAnimation: () => {},
    withSpring: () => 0,
    withTiming: (_to: number, _config: unknown, callback?: unknown) => {
      captured.callback = callback
      return 0
    }
  }
  const fakeRequire = (id: string): unknown => {
    if (id === 'react-native-reanimated') {
      return reanimated
    }
    if (id === 'react-native-worklets') {
      return { scheduleOnRN: () => {} }
    }
    return nodeRequire(id)
  }
  const exports: Record<string, unknown> = {}
  const module = { exports }
  new Function('require', 'module', 'exports', compiled)(fakeRequire, module, exports)
  const drawerProgressTiming: unknown = module.exports.drawerProgressTiming
  if (typeof drawerProgressTiming !== 'function') {
    throw new Error('drawer-motion.ts no longer exports drawerProgressTiming')
  }
  return (to: number, ms: number, done?: () => void): unknown => drawerProgressTiming(to, ms, done)
}

describe('drawerProgressTiming in a release build', () => {
  it('hands withTiming a worklet callback, never the plain function it was given', () => {
    const captured: Captured = {}
    const onHidden = (): void => {}
    loadReleaseDrawerMotion(captured)(0, 180, onHidden)

    expect(captured.callback).not.toBe(onHidden)
    expect(captured.callback).toHaveProperty('__workletHash')
  })
})
