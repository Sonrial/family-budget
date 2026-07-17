'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, CheckCircle2, Loader2, Save, Undo2 } from 'lucide-react'
import { toast } from 'sonner'
import { LoadingState } from '@/components/finance/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { getFinanceErrorMessage } from '@/lib/finance'
import { dateInputToIso, formatCurrency, formatCurrencyInput, parseCurrencyInput } from '@/lib/formatters'
import { getBrowserClient } from '@/lib/supabase/client'
import type { Transaction, TransactionLine } from '@/lib/types'

type DetailedTransaction = Transaction & { transaction_lines: TransactionLine[] }

export default function MovementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [transaction, setTransaction] = useState<DetailedTransaction | null>(null)
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadTransaction() {
      try {
        const { data, error } = await getBrowserClient().from('transactions')
          .select('*, transaction_lines(*, account:accounts(id,name,icon,type))')
          .eq('id', id).single<DetailedTransaction>()
        if (error) throw error
        const positiveLine = data.transaction_lines.find((line) => Number(line.amount) > 0)
        if (!cancelled) {
          setTransaction(data)
          setNotes(data.notes ?? '')
          setDate(data.date.slice(0, 10))
          setAmount(formatCurrencyInput(String(positiveLine?.amount ?? '')))
          setLoading(false)
        }
      } catch (error) {
        if (!cancelled) {
          toast.error(getFinanceErrorMessage(error))
          router.replace('/dashboard/movimientos')
        }
      }
    }
    void loadTransaction()
    return () => { cancelled = true }
  }, [id, router])

  const correctTransaction = async () => {
    const numericAmount = parseCurrencyInput(amount)
    if (numericAmount <= 0 || !date) { toast.error('Ingresa un monto y una fecha válidos.'); return }
    setSaving(true)
    try {
      const { data, error } = await getBrowserClient().rpc('correct_transaction', {
        p_transaction_id: id,
        p_notes: notes,
        p_date: dateInputToIso(date),
        p_amount: numericAmount,
      })
      if (error) throw error
      toast.success('Se creó una corrección y el asiento anterior quedó anulado.')
      router.replace(`/dashboard/movimiento/${data as string}`)
      router.refresh()
    } catch (error) {
      toast.error(getFinanceErrorMessage(error))
      setSaving(false)
    }
  }

  const voidTransaction = async () => {
    try {
      const { error } = await getBrowserClient().rpc('void_transaction', {
        p_transaction_id: id,
        p_reason: 'Anulación solicitada desde la aplicación',
      })
      if (error) throw error
      toast.success('Movimiento anulado mediante asiento reverso.')
      router.replace('/dashboard/movimientos')
      router.refresh()
    } catch (error) { toast.error(getFinanceErrorMessage(error)) }
  }

  if (loading || !transaction) return <LoadingState label="Cargando movimiento…" />
  const positiveLine = transaction.transaction_lines.find((line) => Number(line.amount) > 0)
  const negativeLine = transaction.transaction_lines.find((line) => Number(line.amount) < 0)
  const isVoided = Boolean(transaction.voided_at)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Button variant="ghost" asChild><Link href="/dashboard/movimientos"><ArrowLeft /> Volver al historial</Link></Button>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight">{transaction.description}</h1><p className="mt-1 text-sm text-muted-foreground">Detalle y trazabilidad del asiento.</p></div>
        <Badge variant={isVoided ? 'destructive' : 'secondary'}>{isVoided ? 'Anulado' : transaction.type}</Badge>
      </div>

      {isVoided && <Alert variant="destructive"><Undo2 /><AlertTitle>Movimiento anulado</AlertTitle><AlertDescription>El registro permanece como evidencia y un asiento reverso neutralizó sus saldos.</AlertDescription></Alert>}
      {!isVoided && <Alert><CheckCircle2 /><AlertTitle>Correcciones con trazabilidad</AlertTitle><AlertDescription>Cambiar el monto crea una reversión y un asiento nuevo; nunca sobrescribe el historial original.</AlertDescription></Alert>}

      <Card>
        <CardHeader><CardTitle>Asiento contable</CardTitle><CardDescription>Origen y destino registrados.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {[{ label: 'Origen / crédito', line: negativeLine }, { label: 'Destino / débito', line: positiveLine }].map(({ label, line }) => (
            <div key={label} className="rounded-xl border bg-muted/25 p-4">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 font-semibold">{line?.account?.name ?? 'Cuenta no disponible'}</p>
              <p className="metric-value mt-2 text-sm">{formatCurrency(Math.abs(Number(line?.amount ?? 0)))}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Corrección</CardTitle><CardDescription>Disponible mientras el movimiento esté activo.</CardDescription></CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="amount">Monto</Label><Input id="amount" inputMode="decimal" value={amount} disabled={isVoided} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))} onBlur={() => setAmount(formatCurrencyInput(amount))} /></div>
          <div className="space-y-2"><Label htmlFor="date">Fecha</Label><Input id="date" type="date" value={date} disabled={isVoided} onChange={(event) => setDate(event.target.value)} /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notas</Label><Textarea id="notes" value={notes} disabled={isVoided} onChange={(event) => setNotes(event.target.value)} /></div>
          <Button className="sm:col-span-2" onClick={correctTransaction} disabled={saving || isVoided}>{saving ? <Loader2 className="animate-spin" /> : <Save />}{saving ? 'Guardando corrección…' : 'Guardar como corrección'}</Button>
        </CardContent>
      </Card>

      {!isVoided && (
        <Card className="border-destructive/30">
          <CardHeader><CardTitle className="text-destructive">Anular movimiento</CardTitle><CardDescription>Conserva el registro y crea automáticamente su reversión.</CardDescription></CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button variant="destructive"><Undo2 /> Anular mediante reversión</Button></AlertDialogTrigger>
              <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Anular este movimiento?</AlertDialogTitle><AlertDialogDescription>Los saldos se neutralizarán con un asiento reverso. Esta operación deja trazabilidad y no borra datos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={voidTransaction}>Crear reversión</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
