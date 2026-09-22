import { describe, expect, it } from 'vitest'
import { isBalancedLedger, ledgerDifference } from '@/lib/ledger'

describe('ledger', () => {
  it('rechaza ceros, importes no finitos y cuentas repetidas', () => {
    expect(isBalancedLedger([{ account_id: 'a', amount: 0 }, { account_id: 'b', amount: 0 }])).toBe(false)
    expect(isBalancedLedger([{ account_id: 'a', amount: NaN }, { account_id: 'b', amount: 1 }])).toBe(false)
    expect(isBalancedLedger([{ account_id: 'a', amount: 1 }, { account_id: 'a', amount: -1 }])).toBe(false)
  })
  it('acepta un asiento equilibrado de dos líneas', () => {
    const lines = [
      { account_id: 'asset', amount: -125000.25 },
      { account_id: 'expense', amount: 125000.25 },
    ]
    expect(isBalancedLedger(lines)).toBe(true)
    expect(ledgerDifference(lines)).toBe(0)
  })

  it('rechaza asientos incompletos o desbalanceados', () => {
    expect(isBalancedLedger([{ account_id: 'liability', amount: -50000 }])).toBe(false)
    expect(isBalancedLedger([
      { account_id: 'asset', amount: -50000 },
      { account_id: 'expense', amount: 49000 },
    ])).toBe(false)
  })
})
