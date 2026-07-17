'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowRight, ArrowRightLeft, ArrowUpRight, Plus, TrendingUp, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/finance/page-header'
import { ScopeToggle } from '@/components/finance/scope-toggle'
import { EmptyState, LoadingState } from '@/components/finance/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getFinanceContext, getFinanceErrorMessage } from '@/lib/finance'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { getBrowserClient } from '@/lib/supabase/client'
import type { AccountBalance, ScopeType, Transaction } from '@/lib/types'

const typeMeta = {
  GASTO: { label: 'Gasto', icon: ArrowDownRight, className: 'text-red-600 bg-red-50' },
  INGRESO: { label: 'Ingreso', icon: ArrowUpRight, className: 'text-emerald-700 bg-emerald-50' },
  APORTE: { label: 'Transferencia', icon: ArrowRightLeft, className: 'text-blue-700 bg-blue-50' },
  AJUSTE: { label: 'Ajuste', icon: ArrowRightLeft, className: 'text-amber-700 bg-amber-50' },
} as const

export default function DashboardPage() {
  const [scope, setScope] = useState<ScopeType>('PERSONAL')
  const [accounts, setAccounts] = useState<AccountBalance[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadDashboard() {
      try {
        const client = getBrowserClient()
        const context = await getFinanceContext(client)
        let accountQuery = client.from('account_balances_v2').select('*')
          .eq('scope', scope).eq('type', 'ASSET').is('archived_at', null)
        let transactionQuery = client.from('transactions')
          .select('*, created_by_profile:profiles(email)')
          .eq('scope', scope).eq('is_reversal', false)
          .order('date', { ascending: false }).limit(8)

        if (scope === 'PERSONAL') {
          accountQuery = accountQuery.eq('user_id', context.userId)
          transactionQuery = transactionQuery.eq('created_by', context.userId)
        } else if (context.householdId) {
          accountQuery = accountQuery.eq('household_id', context.householdId)
          transactionQuery = transactionQuery.eq('household_id', context.householdId)
        } else {
          if (!cancelled) {
            setAccounts([])
            setTransactions([])
            setLoading(false)
          }
          return
        }

        const [accountResult, transactionResult] = await Promise.all([
          accountQuery.returns<AccountBalance[]>(),
          transactionQuery.returns<Transaction[]>(),
        ])
        if (accountResult.error) throw accountResult.error
        if (transactionResult.error) throw transactionResult.error
        if (!cancelled) {
          setAccounts(accountResult.data ?? [])
          setTransactions(transactionResult.data ?? [])
          setLoading(false)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getFinanceErrorMessage(error))
          setLoading(false)
        }
      }
    }
    void loadDashboard()
    return () => { cancelled = true }
  }, [scope])

  const total = accounts.reduce((sum, account) => sum + Number(account.current_balance), 0)
  const changeScope = (next: ScopeType) => {
    setLoading(true)
    setScope(next)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Resumen" description="Una vista clara de saldos y actividad reciente."
        actions={<Button asChild><Link href="/dashboard/transaccion"><Plus /> Nueva transacción</Link></Button>} />
      <ScopeToggle value={scope} onChange={changeScope} />

      {loading ? <LoadingState label="Calculando saldos…" /> : (
        <>
          <Card className="overflow-hidden border-0 bg-gradient-to-br from-blue-950 via-blue-800 to-blue-600 text-white shadow-xl shadow-blue-950/15">
            <CardContent className="relative p-6 sm:p-8">
              <div className="absolute -right-12 -top-12 size-48 rounded-full bg-white/8" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-2 text-sm text-blue-100">
                  <TrendingUp className="size-4" aria-hidden="true" />
                  {scope === 'PERSONAL' ? 'Patrimonio personal disponible' : 'Fondo familiar disponible'}
                </div>
                <p className="metric-value text-3xl font-bold sm:text-4xl">{formatCurrency(total)}</p>
                <p className="mt-2 text-sm text-blue-100/80">Suma de {accounts.length} cuenta{accounts.length === 1 ? '' : 's'} activa{accounts.length === 1 ? '' : 's'}</p>
              </div>
            </CardContent>
          </Card>

          <section aria-labelledby="accounts-title">
            <div className="mb-3 flex items-center justify-between">
              <h2 id="accounts-title" className="text-lg font-semibold">Cuentas</h2>
              <Button variant="ghost" size="sm" asChild><Link href="/dashboard/cuentas">Gestionar <ArrowRight /></Link></Button>
            </div>
            {accounts.length === 0 ? (
              <EmptyState icon={WalletCards} title="Todavía no hay cuentas" description="Crea una cuenta de banco o efectivo para comenzar a registrar movimientos." />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {accounts.map((account) => (
                  <Card key={account.id}>
                    <CardContent className="flex items-center justify-between p-5">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 font-mono text-xs font-bold text-primary">
                          {account.icon || account.name.slice(0, 3).toUpperCase()}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{account.name}</p>
                          <p className="text-xs text-muted-foreground">Disponible</p>
                        </div>
                      </div>
                      <p className="metric-value ms-3 text-sm font-bold">{formatCurrency(Number(account.current_balance))}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-4">
              <div><CardTitle>Movimientos recientes</CardTitle><CardDescription>Última actividad registrada.</CardDescription></div>
              <Button variant="outline" size="sm" asChild><Link href="/dashboard/movimientos">Ver historial</Link></Button>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <EmptyState title="Sin movimientos" description="Los movimientos nuevos aparecerán aquí." />
              ) : (
                <div className="divide-y">
                  {transactions.map((transaction) => {
                    const meta = typeMeta[transaction.type]
                    const Icon = meta.icon
                    return (
                      <Link key={transaction.id} href={`/dashboard/movimiento/${transaction.id}`}
                        className="flex items-center gap-3 py-3 transition-colors hover:bg-muted/40 sm:px-2">
                        <span className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${meta.className}`}>
                          <Icon className="size-4" aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{transaction.description}</span>
                          <span className="block text-xs text-muted-foreground">{formatDate(transaction.date)} · {transaction.created_by_profile?.email?.split('@')[0] ?? 'Usuario'}</span>
                        </span>
                        <Badge variant={transaction.voided_at ? 'destructive' : 'secondary'}>{transaction.voided_at ? 'Anulado' : meta.label}</Badge>
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
