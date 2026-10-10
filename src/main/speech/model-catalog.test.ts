import { describe, expect, it } from 'vitest'
import {
  getAvailableSpeechModelCatalog,
  getCatalogModel,
  SPEECH_MODEL_CATALOG
} from './model-catalog'
import { isLocalSpeechRuntimeSupported } from './local-speech-runtime-support'

describe('SPEECH_MODEL_CATALOG', () => {
  it('includes the Japanese Parakeet TDT-CTC model with a valid manifest', () => {
    const manifest = getCatalogModel('parakeet-tdt-ctc-0.6b-ja-int8')

    expect(manifest).toBeDefined()
    expect(manifest?.type).toBe('nemo-ctc')
    expect(manifest?.provider).toBe('local')
    expect(manifest?.language).toBe('ja')
    expect(manifest?.streaming).toBe(false)
    expect(manifest?.sampleRate).toBe(16000)
    expect(manifest?.files).toEqual(['model.int8.onnx', 'tokens.txt'])
    expect(manifest?.sizeBytes).toBe(655_571_161)
    expect(manifest?.downloadFiles?.map(({ name }) => name)).toEqual([
      'model.int8.onnx',
      'tokens.txt'
    ])
  })

  it('has unique ids across the catalog', () => {
    const ids = SPEECH_MODEL_CATALOG.map((m) => m.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  it('registers SenseVoice as a non-streaming local model', () => {
    const model = getCatalogModel('sense-voice-zh-en-ja-ko-yue')
    expect(model).toBeDefined()
    expect(model?.type).toBe('senseVoice')
    expect(model?.provider).toBe('local')
    expect(model?.language).toBe('multilingual')
    expect(model?.streaming).toBe(false)
  })

  it('ships the single-file SenseVoice model layout the loader resolves', () => {
    const model = getCatalogModel('sense-voice-zh-en-ja-ko-yue')
    expect(model?.files).toEqual(['model.int8.onnx', 'tokens.txt'])
  })

  it('downloads only the pinned SenseVoice runtime files', () => {
    const model = getCatalogModel('sense-voice-zh-en-ja-ko-yue')
    expect(model?.sizeBytes).toBe(239_549_735)
    expect(model?.downloadFiles).toHaveLength(2)
    expect(model?.downloadFiles?.map(({ name }) => name)).toEqual(['model.int8.onnx', 'tokens.txt'])
  })

  it('offers only cloud models where no on-device speech addon exists', () => {
    expect(getAvailableSpeechModelCatalog(true)).toBe(SPEECH_MODEL_CATALOG)
    const cloudOnly = getAvailableSpeechModelCatalog(false)
    expect(cloudOnly.length).toBeGreaterThan(0)
    expect(cloudOnly.every((manifest) => manifest.provider === 'openai')).toBe(true)
  })

  it('treats only Windows arm64 as lacking on-device speech', () => {
    expect(isLocalSpeechRuntimeSupported('win32', 'arm64')).toBe(false)
    expect(isLocalSpeechRuntimeSupported('win32', 'x64')).toBe(true)
    expect(isLocalSpeechRuntimeSupported('linux', 'arm64')).toBe(true)
    expect(isLocalSpeechRuntimeSupported('darwin', 'arm64')).toBe(true)
  })
})
