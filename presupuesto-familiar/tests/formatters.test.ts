import { describe, expect, it } from 'vitest'
import {
  formatDate, getLocalDateInputValue, getMonthBounds, parseCurrencyInput, currencyNumberToInput,
} from '@/lib/formatters'

describe('formatters', () => {
  it('conserva los decimales de la base de datos al editar', () => {
    for (const amount of [100.5, 0.01, 1234567.89, 1000, 0]) {
      expect(parseCurrencyInput(currencyNumberToInput(amount))).toBe(amount)
    }
  })
  it('rechaza importes parcialmente válidos', () => {
    expect(parseCurrencyInput('12abc')).toBe(0)
    expect(parseCurrencyInput('1,2,3')).toBe(0)
    expect(parseCurrencyInput('Infinity')).toBe(0)
  })
  it('mantiene la fecha calendario local sin convertirla primero a UTC', () => {
    const localEvening = new Date(2026, 6, 16, 23, 30)
    expect(getLocalDateInputValue(localEvening)).toBe('2026-07-16')
    expect(formatDate('2026-07-16T17:00:00Z')).toBe('16/07/2026')
  })

  it('interpreta moneda con formato colombiano', () => {
    expect(parseCurrencyInput('1.234.567,89')).toBe(1234567.89)
    expect(parseCurrencyInput('')).toBe(0)
  })

  it('calcula correctamente el último día del mes', () => {
    expect(getMonthBounds('2028-02')).toEqual({ start: '2028-02-01', end: '2028-02-29' })
    expect(getMonthBounds('2027-02')).toEqual({ start: '2027-02-01', end: '2027-02-28' })
  })
})
