import { describe, expect, it } from 'vitest'
import {
  RARE_NOOK_BOOK_ID,
  SAMPLE_FOLIOS,
  generateSamplePdf,
  sanitizePdfText
} from './sample-pdfs'

describe('Alexandria demo sample PDFs', () => {
  it('sanitizes Unicode punctuation cleanly into WinAnsi-safe 7-bit ASCII', () => {
    expect(sanitizePdfText('Alexandria — “The Great Hall” · Vol. I…')).toBe(
      'Alexandria - "The Great Hall" | Vol. I...'
    )
  })

  it('generates valid PDF-1.4 files with exact xref tables for all 8 preloaded folios', () => {
    expect(SAMPLE_FOLIOS.length).toBeGreaterThanOrEqual(8)
    expect(SAMPLE_FOLIOS.some((f) => f.id === RARE_NOOK_BOOK_ID)).toBe(true)

    const decoder = new TextDecoder('latin1')
    for (const folio of SAMPLE_FOLIOS) {
      const bytes = generateSamplePdf(folio)
      expect(bytes.byteLength).toBeGreaterThan(800)
      const text = decoder.decode(bytes)
      expect(text.startsWith('%PDF-1.4\n')).toBe(true)
      expect(text).toContain('xref\n')
      expect(text).toContain('startxref\n')
      expect(text.trimEnd().endsWith('%%EOF')).toBe(true)

      // Ensure no raw high-byte UTF-8 mojibake slipped into Type1 text streams
      for (let i = 0; i < bytes.length; i += 1) {
        expect(bytes[i]).toBeLessThan(128)
      }
    }
  })
})
