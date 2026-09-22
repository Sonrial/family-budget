import type { SupabaseClient } from '@supabase/supabase-js'
import type { FinanceContext, LedgerLineInput, ScopeType, TransactionType } from '@/lib/types'
import { isBalancedLedger } from '@/lib/ledger'

export async function getFinanceContext(client: SupabaseClient): Promise<FinanceContext> {
  const { data: authData, error: authError } = await client.auth.getUser()
  if (authError || !authData.user) throw new Error('AUTH_REQUIRED')

  const { data: householdId, error: householdError } = await client.rpc('get_my_household_id')
  if (householdError) throw householdError

  return { userId: authData.user.id, householdId: (householdId as string | null) ?? null }
}

export async function postTransaction(
  client: SupabaseClient,
  input: {
    description: string
    notes: string
    type: TransactionType
    scope: ScopeType
    date: string
    householdId: string | null
    lines: LedgerLineInput[]
    billId?: string | null
    billPeriod?: string | null
  },
): Promise<string> {
  if (!isBalancedLedger(input.lines)) throw new Error('UNBALANCED_TRANSACTION')
  const transactionParams = {
    p_description: input.description,
    p_notes: input.notes,
    p_type: input.type,
    p_scope: input.scope,
    p_date: input.date,
    p_household_id: input.householdId,
    p_lines: input.lines,
  }
  const { data, error } = input.billId && input.billPeriod
    ? await client.rpc('post_bill_payment', {
      p_bill_id: input.billId,
      p_period: input.billPeriod,
      ...transactionParams,
    })
    : await client.rpc('post_transaction', transactionParams)
  if (error) throw error
  return data as string
}

const errorMessages: Record<string, string> = {
  ACCOUNT_CHANGED: 'Otra persona modificó este nombre. Recarga la página antes de editarlo.',
  INVALID_ACCOUNT_LABEL: 'Escribe un nombre de 1 a 80 caracteres y una sigla de hasta 4 caracteres.',
  INVALID_AMOUNT: 'Ingresa un importe válido mayor que cero.',
  INVALID_TRANSACTION_LINES: 'Revisa las cuentas y los importes del movimiento.',
  ONLY_TWO_LINE_CORRECTIONS_SUPPORTED: 'Este movimiento tiene varias líneas y requiere una revisión contable antes de corregirse.',
  ACCOUNT_ARCHIVED: 'Una de las cuentas fue archivada. Selecciona una cuenta activa.',
  ACCOUNT_BALANCE_NOT_ZERO: 'La cuenta todavía tiene saldo. Traslada o ajusta el saldo antes de archivarla.',
  ACCOUNT_ACCESS_DENIED: 'No tienes permiso para modificar esta cuenta.',
  AUTH_REQUIRED: 'Tu sesión venció. Inicia sesión nuevamente.',
  BILL_ALREADY_PAID: 'Este pago ya fue registrado para el mes seleccionado.',
  BILL_ACCESS_DENIED: 'No tienes permiso para modificar este pago recurrente.',
  HOUSEHOLD_ACCESS_DENIED: 'No perteneces al hogar seleccionado.',
  INVALID_OR_INACCESSIBLE_ACCOUNT: 'Una de las cuentas no existe, está archivada o no es accesible.',
  LEGACY_INCOMPLETE: 'Este movimiento histórico está incompleto y debe regularizarse con una revisión contable guiada.',
  TRANSACTION_ALREADY_VOIDED: 'Este movimiento ya fue anulado o reemplazado.',
  TRANSACTION_ACCESS_DENIED: 'No tienes permiso para modificar este movimiento.',
  UNBALANCED_TRANSACTION: 'El asiento no está equilibrado. Los débitos y créditos deben sumar cero.',
}

export function getFinanceErrorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error)
  const match = Object.keys(errorMessages).find((code) => message.includes(code))
  return match ? errorMessages[match] : 'No se pudo completar la operación. Intenta nuevamente.'
}
