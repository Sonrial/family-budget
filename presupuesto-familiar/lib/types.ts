export type TransactionType = 'GASTO' | 'INGRESO' | 'APORTE' | 'AJUSTE'
export type ScopeType = 'PERSONAL' | 'SHARED'
export type AccountType = 'ASSET' | 'EXPENSE' | 'INCOME' | 'LIABILITY' | 'EQUITY'

export interface Profile {
  id: string
  email: string
}

export interface Account {
  id: string
  created_at?: string
  name: string
  icon: string | null
  type: AccountType
  scope: ScopeType
  user_id: string | null
  household_id: string | null
  archived_at?: string | null
}

export interface AccountBalance extends Account {
  current_balance: number
}

export interface TransactionLine {
  id: string
  transaction_id: string
  account_id: string
  amount: number
  account?: Pick<Account, 'id' | 'name' | 'icon' | 'type'> | null
}

export interface Transaction {
  id: string
  created_at?: string
  description: string
  notes: string | null
  type: TransactionType
  scope: ScopeType
  date: string
  created_by: string
  household_id: string | null
  voided_at?: string | null
  is_reversal?: boolean
  legacy_incomplete?: boolean
  legacy_difference?: number | null
  created_by_profile?: Pick<Profile, 'email'> | null
  lines?: TransactionLine[]
  transaction_lines?: TransactionLine[]
}

export interface RecurringBill {
  id: string
  title: string
  amount: number
  pay_day: number
  category_id: string
  scope: ScopeType
  created_by: string
  household_id: string | null
  archived_at: string | null
  category?: Pick<Account, 'name' | 'icon'> | null
  payments?: Array<{ period: string; transaction_id: string; voided_at: string | null }>
}

export interface ReportKPIs {
  income: number
  expense: number
  debtPayments: number
  savings: number
  savingsRate: number
}

export interface FinanceContext {
  userId: string
  householdId: string | null
}

export interface LedgerLineInput {
  account_id: string
  amount: number
}
