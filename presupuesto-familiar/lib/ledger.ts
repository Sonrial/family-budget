import type { LedgerLineInput } from '@/lib/types'

export const ledgerDifference = (lines: LedgerLineInput[]): number =>
  Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100

export const isBalancedLedger = (lines: LedgerLineInput[]): boolean =>
  lines.length >= 2 && Math.abs(ledgerDifference(lines)) <= 0.005
