import type { LedgerLineInput } from '@/lib/types'

export const ledgerDifference = (lines: LedgerLineInput[]): number =>
  Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100

export const isBalancedLedger = (lines: LedgerLineInput[]): boolean =>
  lines.length >= 2 &&
  lines.every((line) => line.account_id && Number.isFinite(line.amount) && Math.abs(line.amount) >= 0.01) &&
  new Set(lines.map((line) => line.account_id)).size === lines.length &&
  Math.abs(ledgerDifference(lines)) <= 0.005
