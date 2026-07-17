import type { AccountType, ReportKPIs, Transaction } from '@/lib/types'

export interface ReportLine {
  amount: number
  account: { name: string; type: AccountType } | null
}

export interface ReportTransaction extends Transaction {
  amount: ReportLine[]
}

export interface PieDatum {
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
  const byCategory: Record<string, number> = {}
  const expenses: ExpenseDatum[] = []

  for (const transaction of transactions) {
    if (transaction.voided_at || transaction.is_reversal || transaction.legacy_incomplete) continue

    if (transaction.type === 'INGRESO') {
      const assetLine = transaction.amount.find(
        (line) => Number(line.amount) > 0 && line.account?.type === 'ASSET',
      )
      income += Number(assetLine?.amount ?? 0)
    }

    if (transaction.type === 'GASTO') {
      const positiveLine = transaction.amount.find((line) => Number(line.amount) > 0)
      const value = Number(positiveLine?.amount ?? 0)
      if (positiveLine?.account?.type === 'LIABILITY') {
        debtPayments += value
      } else if (positiveLine?.account?.type === 'EXPENSE') {
        const category = positiveLine.account.name || 'Otros'
        expense += value
        byCategory[category] = (byCategory[category] ?? 0) + value
        expenses.push({
          description: transaction.description,
          amount: value,
          date: transaction.date,
          category,
        })
      }
    }
  }

  const categories = Object.entries(byCategory)
    .map(([name, value]) => ({ name, value, percent: expense ? value / expense * 100 : 0 }))
    .sort((left, right) => right.value - left.value)
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
