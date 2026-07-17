import { describe, expect, it } from 'vitest'
import {
  dateInputToIso, formatDate, getLocalDateInputValue,
  getMonthBounds, parseCurrencyInput,
} from '@/lib/formatters'

describe('formatters', () => {
  it('mantiene la fecha calendario local sin convertirla primero a UTC', () => {
    const localEvening = new Date(2026, 6, 16, 23, 30)
    expect(getLocalDateInputValue(localEvening)).toBe('2026-07-16')
    expect(dateInputToIso('2026-07-16')).toBe('2026-07-16T12:00:00-05:00')
    expect(formatDate('2026-07-16T17:00:00Z')).toBe('16/07/2026')
  })

  it('interpreta moneda con formato colombiano', () => {
    expect(parseCurrencyInput('1.234.567,89')).toBe(1234567.89)
    expect(parseCurrencyInput('')).toBe(0)
  })

  it('calcula correctamente el último día del mes', () => {
    expect(getMonthBounds('2028-02').end).toContain('2028-02-29')
    expect(getMonthBounds('2027-02').end).toContain('2027-02-28')
  })
})
