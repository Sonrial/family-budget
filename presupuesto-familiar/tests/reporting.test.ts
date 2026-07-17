import { describe, expect, it } from 'vitest'
import { buildMonthlyReport, type ReportTransaction } from '@/lib/reporting'

const base = {
  id: 'tx', description: 'Movimiento', notes: null, scope: 'PERSONAL' as const,
  date: '2026-07-01T12:00:00-05:00', created_by: 'user', household_id: null,
}

describe('monthly reporting', () => {
  it('separa consumo, ingresos y capital de deuda', () => {
    const transactions: ReportTransaction[] = [
      { ...base, id: 'income', type: 'INGRESO', amount: [
        { amount: 3000000, account: { name: 'Banco', type: 'ASSET' } },
        { amount: -3000000, account: { name: 'Salario', type: 'INCOME' } },
      ] },
      { ...base, id: 'expense', type: 'GASTO', description: 'Mercado', amount: [
        { amount: 500000, account: { name: 'Alimentación', type: 'EXPENSE' } },
        { amount: -500000, account: { name: 'Banco', type: 'ASSET' } },
      ] },
      { ...base, id: 'debt', type: 'GASTO', description: 'Abono crédito', amount: [
        { amount: 400000, account: { name: 'Crédito', type: 'LIABILITY' } },
        { amount: -400000, account: { name: 'Banco', type: 'ASSET' } },
      ] },
    ]

    const report = buildMonthlyReport(transactions)
    expect(report.kpis.income).toBe(3000000)
    expect(report.kpis.expense).toBe(500000)
    expect(report.kpis.debtPayments).toBe(400000)
    expect(report.kpis.savings).toBe(2500000)
    expect(report.categories[0].name).toBe('Alimentación')
  })

  it('ignora movimientos anulados y reversiones en los indicadores', () => {
    const transaction: ReportTransaction = {
      ...base, type: 'GASTO', voided_at: '2026-07-02',
      amount: [{ amount: 100, account: { name: 'Otros', type: 'EXPENSE' } }],
    }
    expect(buildMonthlyReport([transaction]).kpis.expense).toBe(0)
  })

  it('conserva pero excluye movimientos históricos incompletos', () => {
    const transaction: ReportTransaction = {
      ...base,
      type: 'GASTO',
      legacy_incomplete: true,
      legacy_difference: -100,
      amount: [{ amount: 100, account: { name: 'Otros', type: 'EXPENSE' } }],
    }
    expect(buildMonthlyReport([transaction]).kpis.expense).toBe(0)
  })
})
