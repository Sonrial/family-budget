import type { AccountType, ReportKPIs, Transaction } from '@/lib/types'

export interface ReportLine {
  amount: number
  account: { id?: string; name: string; type: AccountType } | null
}

export interface ReportTransaction extends Transaction {
  amount: ReportLine[]
}

export interface PieDatum {
  id: string
  name: string
  value: number
  percent: number
}

export interface ExpenseDatum {
  description: string
  amount: number
  date: string
  category: string
}

export interface MonthlyReport {
  kpis: ReportKPIs
  categories: PieDatum[]
  topExpenses: ExpenseDatum[]
}

export const emptyReportKpis: ReportKPIs = {
  income: 0,
  expense: 0,
  debtPayments: 0,
  savings: 0,
  savingsRate: 0,
}

export function buildMonthlyReport(transactions: ReportTransaction[]): MonthlyReport {
  let income = 0
  let expense = 0
  let debtPayments = 0
  const byCategory: Map<string, { name: string; value: number }> = new Map()
  const expenses: ExpenseDatum[] = []

  for (const transaction of transactions) {
    if (transaction.voided_at || transaction.is_reversal || transaction.legacy_incomplete) continue

    for (const line of transaction.amount) {
      const value = Number(line.amount)
      if (!Number.isFinite(value) || value <= 0) continue
      if (transaction.type === 'INGRESO' && line.account?.type === 'ASSET') income += value
      if (transaction.type !== 'GASTO') continue
      if (line.account?.type === 'LIABILITY') debtPayments += value
      if (line.account?.type === 'EXPENSE') {
        const category = line.account.name || 'Otros'
        const id = line.account.id ?? category
        expense += value
        const previous = byCategory.get(id)?.value ?? 0
        byCategory.set(id, { name: category, value: previous + value })
        expenses.push({ description: transaction.description, amount: value, date: transaction.date, category })
      }
    }
  }

  const categories = Array.from(byCategory, ([id, { name, value }]) => ({
    id, name, value, percent: expense ? value / expense * 100 : 0,
  })).sort((left, right) => right.value - left.value)
  const savings = income - expense

  return {
    categories,
    topExpenses: expenses.sort((left, right) => right.amount - left.amount).slice(0, 5),
    kpis: {
      income,
      expense,
      debtPayments,
      savings,
      savingsRate: income ? savings / income * 100 : 0,
    },
  }
}
