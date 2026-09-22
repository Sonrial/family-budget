import { expect, it } from 'vitest'
import { getFinanceErrorMessage } from '@/lib/finance'

it('muestra los errores de objetos devueltos por Supabase', () => {
  expect(getFinanceErrorMessage({ message: 'ACCOUNT_CHANGED', code: 'P0001' })).toContain('Otra persona')
  expect(getFinanceErrorMessage(new Error('ACCOUNT_ARCHIVED'))).toContain('archivada')
  expect(getFinanceErrorMessage(null)).toContain('No se pudo')
})
