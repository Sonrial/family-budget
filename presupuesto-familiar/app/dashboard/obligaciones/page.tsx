'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Archive, CalendarClock, CheckCircle2, CreditCard, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/finance/page-header'
import { ScopeToggle } from '@/components/finance/scope-toggle'
import { EmptyState, LoadingState } from '@/components/finance/states'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getFinanceContext, getFinanceErrorMessage } from '@/lib/finance'
import { formatCurrency, getLocalMonthInputValue, parseCurrencyInput } from '@/lib/formatters'
import { getBrowserClient } from '@/lib/supabase/client'
import type { Account, AccountBalance, FinanceContext, RecurringBill, ScopeType } from '@/lib/types'

export default function ObligationsPage() {
  const [scope, setScope] = useState<ScopeType>('PERSONAL')
  const [context, setContext] = useState<FinanceContext | null>(null)
  const [debts, setDebts] = useState<AccountBalance[]>([])
  const [bills, setBills] = useState<RecurringBill[]>([])
  const [categories, setCategories] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [debtDialog, setDebtDialog] = useState(false)
  const [debtName, setDebtName] = useState('')
  const [debtAmount, setDebtAmount] = useState('')
  const [billDraft, setBillDraft] = useState({ title: '', amount: '', payDay: '', categoryId: '' })
  const currentPeriod = `${getLocalMonthInputValue()}-01`

  useEffect(() => {
    let cancelled = false
    async function loadObligations() {
      try {
        const client = getBrowserClient()
        const nextContext = await getFinanceContext(client)
        if (scope === 'SHARED' && !nextContext.householdId) {
          if (!cancelled) {
            setContext(nextContext)
            setDebts([])
            setBills([])
            setCategories([])
            setLoading(false)
          }
          return
        }
        const ownerColumn = scope === 'PERSONAL' ? 'user_id' : 'household_id'
        const ownerId = scope === 'PERSONAL' ? nextContext.userId : nextContext.householdId
        const createdColumn = scope === 'PERSONAL' ? 'created_by' : 'household_id'

        const [debtResult, billResult, categoryResult] = await Promise.all([
          client.from('account_balances_v2').select('*').eq('type', 'LIABILITY').eq('scope', scope)
            .eq(ownerColumn, ownerId).is('archived_at', null).order('name').returns<AccountBalance[]>(),
          client.from('recurring_bills').select('*, category:accounts(name,icon), payments:recurring_bill_payments(period,transaction_id,voided_at)')
            .eq('scope', scope).eq(createdColumn, ownerId).is('archived_at', null).order('pay_day').returns<RecurringBill[]>(),
          client.from('accounts').select('*').eq('type', 'EXPENSE').eq('scope', scope)
            .eq(ownerColumn, ownerId).is('archived_at', null).order('name').returns<Account[]>(),
        ])
        if (debtResult.error) throw debtResult.error
        if (billResult.error) throw billResult.error
        if (categoryResult.error) throw categoryResult.error
        if (!cancelled) {
          setContext(nextContext)
          setDebts(debtResult.data ?? [])
          setBills(billResult.data ?? [])
          setCategories(categoryResult.data ?? [])
          setLoading(false)
        }
      } catch (error) {
        if (!cancelled) { toast.error(getFinanceErrorMessage(error)); setLoading(false) }
      }
    }
    void loadObligations()
    return () => { cancelled = true }
  }, [refreshKey, scope, currentPeriod])

  const createDebt = async () => {
    if (!context || !debtName.trim()) return
    try {
      const { error } = await getBrowserClient().rpc('create_liability_account', {
        p_name: debtName.trim(), p_initial_amount: parseCurrencyInput(debtAmount),
        p_scope: scope, p_household_id: scope === 'SHARED' ? context.householdId : null,
      })
      if (error) throw error
      setDebtName(''); setDebtAmount(''); setDebtDialog(false); setRefreshKey((key) => key + 1)
      toast.success('Deuda creada con un asiento inicial equilibrado.')
    } catch (error) { toast.error(getFinanceErrorMessage(error)) }
  }

  const createBill = async () => {
    if (!context || !billDraft.title.trim() || !billDraft.categoryId) return
    const amount = parseCurrencyInput(billDraft.amount)
    const payDay = Number.parseInt(billDraft.payDay, 10)
    if (amount <= 0 || payDay < 1 || payDay > 31) { toast.error('Ingresa un monto y un día entre 1 y 31.'); return }
    try {
      const { error } = await getBrowserClient().from('recurring_bills').insert({
        title: billDraft.title.trim(), amount, pay_day: payDay,
        category_id: billDraft.categoryId, scope, created_by: context.userId,
        household_id: scope === 'SHARED' ? context.householdId : null,
      })
      if (error) throw error
      setBillDraft({ title: '', amount: '', payDay: '', categoryId: '' })
      setRefreshKey((key) => key + 1)
      toast.success('Pago recurrente creado.')
    } catch (error) { toast.error(getFinanceErrorMessage(error)) }
  }

  const archive = async (kind: 'account' | 'bill', id: string) => {
    try {
      const functionName = kind === 'account' ? 'archive_account' : 'archive_recurring_bill'
      const params = kind === 'account' ? { p_account_id: id } : { p_bill_id: id }
      const { error } = await getBrowserClient().rpc(functionName, params)
      if (error) throw error
      setRefreshKey((key) => key + 1)
      toast.success('Elemento archivado; el historial permanece intacto.')
    } catch (error) { toast.error(getFinanceErrorMessage(error)) }
  }

  const changeScope = (next: ScopeType) => { setLoading(true); setScope(next) }

  return (
    <div className="space-y-6">
      <PageHeader title="Deudas y pagos" description="Controla obligaciones sin mezclar abonos de capital con gastos de consumo." actions={<ScopeToggle value={scope} onChange={changeScope} />} />
      {loading ? <LoadingState /> : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Deudas</h2>
              <Dialog open={debtDialog} onOpenChange={setDebtDialog}>
                <DialogTrigger asChild><Button size="sm"><Plus /> Nueva deuda</Button></DialogTrigger>
                <DialogContent><DialogHeader><DialogTitle>Nueva deuda</DialogTitle><DialogDescription>El saldo inicial se compensará contra patrimonio inicial para conservar la doble partida.</DialogDescription></DialogHeader>
                  <div className="space-y-4"><div className="space-y-2"><Label htmlFor="debt-name">Nombre</Label><Input id="debt-name" value={debtName} onChange={(event) => setDebtName(event.target.value)} placeholder="Ej. Crédito del vehículo" /></div><div className="space-y-2"><Label htmlFor="debt-amount">Saldo inicial</Label><Input id="debt-amount" inputMode="decimal" value={debtAmount} onChange={(event) => setDebtAmount(event.target.value)} placeholder="0" /></div></div>
                  <DialogFooter><Button variant="outline" onClick={() => setDebtDialog(false)}>Cancelar</Button><Button onClick={createDebt}>Crear deuda</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            {debts.length === 0 ? <EmptyState icon={CreditCard} title="Sin deudas activas" description="Cuando registres una obligación aparecerá aquí." /> : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{debts.map((debt) => (
                <Card key={debt.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>{debt.name}</CardTitle><CardDescription>Saldo pendiente</CardDescription></div><ArchiveAction name={debt.name} onConfirm={() => archive('account', debt.id)} /></div></CardHeader><CardContent><p className="metric-value text-2xl font-bold text-red-600">{formatCurrency(Math.abs(Number(debt.current_balance)))}</p><Button asChild className="mt-4 w-full" variant="outline"><Link href={`/dashboard/transaccion?${new URLSearchParams({ desc: `Abono a ${debt.name}`, cat: debt.id, scope: debt.scope, type: 'GASTO' })}`}>Registrar abono</Link></Button></CardContent></Card>
              ))}</div>
            )}
          </section>

          <section className="space-y-3"><h2 className="text-lg font-semibold">Pagos recurrentes</h2>
            <Card><CardHeader><CardTitle>Agregar pago recurrente</CardTitle><CardDescription>Configura el recordatorio y la categoría contable.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-[1.2fr_1fr_100px_1fr_auto] md:items-end">
              <div className="space-y-2"><Label htmlFor="bill-title">Nombre</Label><Input id="bill-title" value={billDraft.title} onChange={(event) => setBillDraft({ ...billDraft, title: event.target.value })} placeholder="Ej. Internet" /></div>
              <div className="space-y-2"><Label htmlFor="bill-amount">Monto</Label><Input id="bill-amount" inputMode="decimal" value={billDraft.amount} onChange={(event) => setBillDraft({ ...billDraft, amount: event.target.value })} /></div>
              <div className="space-y-2"><Label htmlFor="bill-day">Día</Label><Input id="bill-day" type="number" min={1} max={31} value={billDraft.payDay} onChange={(event) => setBillDraft({ ...billDraft, payDay: event.target.value })} /></div>
              <div className="space-y-2"><Label>Categoría</Label><Select value={billDraft.categoryId} onValueChange={(categoryId) => setBillDraft({ ...billDraft, categoryId })}><SelectTrigger aria-label="Categoría del pago recurrente"><SelectValue placeholder="Seleccionar" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
              <Button onClick={createBill}><Plus /> Agregar</Button>
            </CardContent></Card>

            {bills.length === 0 ? <EmptyState icon={CalendarClock} title="Sin pagos recurrentes" description="Agrega servicios, arriendo u otras obligaciones periódicas." /> : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{bills.map((bill) => {
                const paid = bill.payments?.some((payment) => !payment.voided_at && payment.period.slice(0, 10) === currentPeriod) ?? false
                return <Card key={bill.id}><CardHeader><div className="flex items-start justify-between gap-3"><div><div className="mb-2 flex items-center gap-2"><CardTitle>{bill.title}</CardTitle>{paid && <Badge className="bg-emerald-100 text-emerald-800"><CheckCircle2 /> Pagado</Badge>}</div><CardDescription>Vence el día {bill.pay_day} · {bill.category?.name}</CardDescription></div><ArchiveAction name={bill.title} onConfirm={() => archive('bill', bill.id)} /></div></CardHeader><CardContent><p className="metric-value text-xl font-bold">{formatCurrency(Number(bill.amount))}</p><Button asChild className="mt-4 w-full" disabled={paid}><Link aria-disabled={paid} href={paid ? '#' : `/dashboard/transaccion?${new URLSearchParams({ desc: bill.title, amount: String(bill.amount), cat: bill.category_id, scope: bill.scope, type: 'GASTO', bill: bill.id })}`}>{paid ? 'Pagado este mes' : 'Registrar pago'}</Link></Button></CardContent></Card>
              })}</div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function ArchiveAction({ name, onConfirm }: { name: string; onConfirm: () => void }) {
  return <AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Archivar ${name}`}><Archive /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Archivar “{name}”?</AlertDialogTitle><AlertDialogDescription>Se ocultará de la operación diaria, pero sus movimientos seguirán disponibles.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={onConfirm}>Archivar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
}
