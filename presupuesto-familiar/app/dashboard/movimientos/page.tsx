'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowDownRight, ArrowRight, ArrowRightLeft, ArrowUpRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/finance/page-header'
import { ScopeToggle } from '@/components/finance/scope-toggle'
import { EmptyState, LoadingState } from '@/components/finance/states'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getFinanceContext, getFinanceErrorMessage } from '@/lib/finance'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { getBrowserClient } from '@/lib/supabase/client'
import type { ScopeType, Transaction, TransactionLine, TransactionType } from '@/lib/types'

type HistoryTransaction = Transaction & { lines: TransactionLine[] }
const PAGE_SIZE = 20

function recentMonths() {
  const now = new Date()
  return Array.from({ length: 24 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const label = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(date)
    return { value, label: label.charAt(0).toUpperCase() + label.slice(1) }
  })
}

const typeLabels: Record<TransactionType, string> = {
  GASTO: 'Gasto', INGRESO: 'Ingreso', APORTE: 'Transferencia', AJUSTE: 'Ajuste',
}

const typeIcons = { GASTO: ArrowDownRight, INGRESO: ArrowUpRight, APORTE: ArrowRightLeft, AJUSTE: ArrowRightLeft }

export default function MovementsPage() {
  const [scope, setScope] = useState<ScopeType>('PERSONAL')
  const [monthFilter, setMonthFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL')
  const [transactions, setTransactions] = useState<HistoryTransaction[]>([])
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [months] = useState(recentMonths)

  useEffect(() => {
    let cancelled = false
    async function loadTransactions() {
      try {
        const client = getBrowserClient()
        const context = await getFinanceContext(client)
        if (scope === 'SHARED' && !context.householdId) {
          if (!cancelled) {
            setTransactions([])
            setHasMore(false)
            setLoading(false)
            setLoadingMore(false)
          }
          return
        }
        let query = client.from('transactions')
          .select('*, created_by_profile:profiles(email), lines:transaction_lines(*, account:accounts(id,name,icon,type))')
          .eq('scope', scope).eq('is_reversal', false)
          .order('date', { ascending: false })
          .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

        query = scope === 'PERSONAL'
          ? query.eq('created_by', context.userId)
          : query.eq('household_id', context.householdId)
        if (typeFilter !== 'ALL') query = query.eq('type', typeFilter)
        if (monthFilter !== 'ALL') {
          const [year, month] = monthFilter.split('-').map(Number)
          const lastDay = new Date(year, month, 0).getDate()
          query = query.gte('date', `${monthFilter}-01`)
            .lte('date', `${monthFilter}-${String(lastDay).padStart(2, '0')}`)
        }

        const { data, error } = await query.returns<HistoryTransaction[]>()
        if (error) throw error
        if (!cancelled) {
          const next = data ?? []
          setTransactions((current) => page === 0 ? next : [...current, ...next])
          setHasMore(next.length === PAGE_SIZE)
          setLoading(false)
          setLoadingMore(false)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getFinanceErrorMessage(error))
          setLoading(false)
          setLoadingMore(false)
        }
      }
    }
    void loadTransactions()
    return () => { cancelled = true }
  }, [monthFilter, page, scope, typeFilter])

  const resetAnd = (action: () => void) => {
    setLoading(true)
    setPage(0)
    action()
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Historial" description="Consulta movimientos, correcciones y anulaciones sin perder trazabilidad." />
      <Card>
        <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <ScopeToggle value={scope} onChange={(next) => resetAnd(() => setScope(next))} />
          <div className="grid gap-3 sm:grid-cols-2 lg:w-[440px]">
            <Select value={monthFilter} onValueChange={(next) => resetAnd(() => setMonthFilter(next))}>
              <SelectTrigger aria-label="Filtrar por mes"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todos los meses</SelectItem>{months.map((month) => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(next) => resetAnd(() => setTypeFilter(next as 'ALL' | TransactionType))}>
              <SelectTrigger aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ALL">Todos los tipos</SelectItem>{Object.entries(typeLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {loading ? <LoadingState label="Consultando movimientos…" /> : transactions.length === 0 ? (
        <EmptyState title="No hay resultados" description="Ajusta los filtros o registra un nuevo movimiento." />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader><TableRow><TableHead>Movimiento</TableHead><TableHead className="hidden md:table-cell">Fecha</TableHead><TableHead className="hidden sm:table-cell">Tipo</TableHead><TableHead className="text-right">Monto</TableHead><TableHead><span className="sr-only">Abrir</span></TableHead></TableRow></TableHeader>
            <TableBody>{transactions.map((transaction) => {
              const representativeLine = transaction.lines.find((line) => Number(line.amount) > 0)
                ?? transaction.lines.find((line) => Number(line.amount) !== 0)
              const amount = Math.abs(Number(representativeLine?.amount ?? 0))
              const Icon = typeIcons[transaction.type]
              const status = transaction.legacy_incomplete
                ? { label: 'Histórico incompleto', variant: 'outline' as const }
                : transaction.voided_at
                  ? { label: 'Anulado', variant: 'destructive' as const }
                  : { label: typeLabels[transaction.type], variant: 'secondary' as const }
              return (
                <TableRow key={transaction.id} className={transaction.voided_at ? 'opacity-60' : undefined}>
                  <TableCell><div className="flex items-center gap-3"><span className="flex size-9 items-center justify-center rounded-lg bg-muted"><Icon className="size-4" /></span><div><p className="font-medium">{transaction.description}</p><p className="text-xs text-muted-foreground md:hidden">{formatDate(transaction.date)}</p></div></div></TableCell>
                  <TableCell className="hidden md:table-cell">{formatDate(transaction.date)}</TableCell>
                  <TableCell className="hidden sm:table-cell"><Badge variant={status.variant}>{status.label}</Badge></TableCell>
                  <TableCell className="metric-value text-right font-semibold">{formatCurrency(amount)}</TableCell>
                  <TableCell className="w-12"><Button variant="ghost" size="icon-sm" asChild><Link href={`/dashboard/movimiento/${transaction.id}`} aria-label={`Abrir ${transaction.description}`}><ArrowRight /></Link></Button></TableCell>
                </TableRow>
              )
            })}</TableBody>
          </Table>
          {hasMore && <div className="border-t p-4 text-center"><Button variant="outline" disabled={loadingMore} onClick={() => { setLoadingMore(true); setPage((current) => current + 1) }}>{loadingMore && <Loader2 className="animate-spin" />} Cargar más</Button></div>}
        </Card>
      )}
    </div>
  )
}
