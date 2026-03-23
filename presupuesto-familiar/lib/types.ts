// src/lib/types.ts

// --- Tipos Literales (Solo pueden ser estos valores) ---
export type TransactionType = 'GASTO' | 'INGRESO' | 'APORTE'
export type ScopeType = 'PERSONAL' | 'SHARED'
export type AccountType = 'ASSET' | 'EXPENSE' | 'INCOME' | 'LIABILITY'

// --- Interfaces de la Base de Datos ---

export interface Profile {
  id: string
  email: string
}

export interface Account {
  id: string
  created_at?: string
  name: string
  icon?: string
  type: AccountType
  scope: ScopeType
  user_id?: string
  current_balance?: number // Propiedad calculada, no está en la BD directamente
}

export interface TransactionLine {
  id?: string
  transaction_id: string
  account_id: string
  amount: number
  account?: Account // Para cuando hacemos 'JOIN' en Supabase
}

export interface Transaction {
  id: string
  created_at?: string
  description: string
  notes?: string
  type: TransactionType
  scope: ScopeType
  date: string
  created_by: string
  created_by_profile?: Profile // Para cuando hacemos 'JOIN'
  lines?: TransactionLine[]    // Relación con las líneas contables
}

// Interfaz para los KPIs del Reporte
export interface ReportKPIs {
    income: number
    expense: number
    savings: number
    savingsRate: number
}