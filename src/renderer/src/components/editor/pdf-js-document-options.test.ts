import { describe, expect, it } from 'vitest'
import { buildPdfJsDocumentOptions } from './pdf-js-document-options'

describe('pdf.js document resource options', () => {
  it('resolves CMaps, standard fonts, and WASM beside the document', () => {
    expect(
      buildPdfJsDocumentOptions(new Uint8Array([1]), 'https://dolphin.test/web-index.html')
    ).toEqual({
      data: new Uint8Array([1]),
      cMapUrl: 'https://dolphin.test/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://dolphin.test/standard_fonts/',
      wasmUrl: 'https://dolphin.test/wasm/'
    })
  })
})
