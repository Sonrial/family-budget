'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowDownRight, ArrowRightLeft, ArrowUpRight, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import AccountSelect, { type AccountOption } from '@/components/AccountSelect'
import { PageHeader } from '@/components/finance/page-header'
import { ScopeToggle } from '@/components/finance/scope-toggle'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getFinanceContext, getFinanceErrorMessage, postTransaction } from '@/lib/finance'
import {
  formatCurrencyInput, getLocalDateInputValue,
  getLocalMonthInputValue, parseCurrencyInput,
} from '@/lib/formatters'
import { getBrowserClient } from '@/lib/supabase/client'
import type { Account, FinanceContext, Profile, ScopeType, TransactionType } from '@/lib/types'

type TransferMode = 'POOL' | 'MEMBER'

const transactionTypes = [
  { value: 'GASTO' as const, label: 'Gasto', description: 'Salida de dinero', icon: ArrowDownRight },
  { value: 'INGRESO' as const, label: 'Ingreso', description: 'Entrada de dinero', icon: ArrowUpRight },
  { value: 'APORTE' as const, label: 'Transferencia', description: 'Entre cuentas u hogar', icon: ArrowRightLeft },
]

function TransactionForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialType = (searchParams.get('type') as TransactionType | null) ?? 'GASTO'
  const initialScope = (searchParams.get('scope') as ScopeType | null) ?? 'PERSONAL'
  const [context, setContext] = useState<FinanceContext | null>(null)
  const [description, setDescription] = useState(searchParams.get('desc') ?? '')
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState(searchParams.get('amount') ?? '')
  const [type, setType] = useState<TransactionType>(initialType)
  const [scope, setScope] = useState<ScopeType>(initialScope)
  const [date, setDate] = useState(getLocalDateInputValue)
  const [transferMode, setTransferMode] = useState<TransferMode>('POOL')
  const [targetUserId, setTargetUserId] = useState('')
  const [selectedAsset, setSelectedAsset] = useState('')
  const [selectedDestination, setSelectedDestination] = useState(searchParams.get('cat') ?? '')
  const [originAccounts, setOriginAccounts] = useState<AccountOption[]>([])
  const [destinationAccounts, setDestinationAccounts] = useState<AccountOption[]>([])
  const [familyMembers, setFamilyMembers] = useState<Profile[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadContext() {
      try {
        const client = getBrowserClient()
        const nextContext = await getFinanceContext(client)
        const { data, error } = await client.rpc('get_family_profiles')
        if (error) throw error
        if (!cancelled) {
          setContext(nextContext)
          setFamilyMembers((data as Profile[] | null) ?? [])
        }
      } catch (error) {
        if (!cancelled) toast.error(getFinanceErrorMessage(error))
      }
    }
    void loadContext()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!context) return
    const financeContext = context
    let cancelled = false
    async function loadAccounts() {
      try {
        const client = getBrowserClient()
        if ((scope === 'SHARED' || type === 'APORTE') && !financeContext.householdId) {
          if (!cancelled) {
            setOriginAccounts([])
            setDestinationAccounts([])
            setLoadingAccounts(false)
          }
          return
        }
        let originQuery = client.from('accounts').select('*').eq('type', 'ASSET').is('archived_at', null)
        if (type === 'APORTE' || scope === 'PERSONAL') {
          originQuery = originQuery.eq('scope', 'PERSONAL').eq('user_id', financeContext.userId)
        } else {
          originQuery = originQuery.eq('scope', 'SHARED').eq('household_id', financeContext.householdId)
        }

        let destinationPromise: PromiseLike<{ data: AccountOption[] | null; error: unknown }>
        if (type === 'GASTO') {
          let query = client.from('accounts').select('*').eq('scope', scope)
            .in('type', ['EXPENSE', 'LIABILITY']).is('archived_at', null)
          query = scope === 'PERSONAL' ? query.eq('user_id', financeContext.userId) : query.eq('household_id', financeContext.householdId)
          destinationPromise = query.returns<Account[]>()
        } else if (type === 'INGRESO') {
          let query = client.from('accounts').select('*').eq('scope', scope).eq('type', 'INCOME').is('archived_at', null)
          query = scope === 'PERSONAL' ? query.eq('user_id', financeContext.userId) : query.eq('household_id', financeContext.householdId)
          destinationPromise = query.returns<Account[]>()
        } else if (transferMode === 'POOL') {
          destinationPromise = client.from('accounts').select('*').eq('scope', 'SHARED').eq('household_id', financeContext.householdId)
            .eq('type', 'ASSET').is('archived_at', null).returns<Account[]>()
        } else if (targetUserId) {
          destinationPromise = client.rpc('get_transfer_destinations', { p_target_user_id: targetUserId })
        } else {
          destinationPromise = Promise.resolve({ data: [], error: null })
        }

        const [originResult, destinationResult] = await Promise.all([
          originQuery.returns<Account[]>(), destinationPromise,
        ])
        if (originResult.error) throw originResult.error
        if (destinationResult.error) throw destinationResult.error
        if (!cancelled) {
          setOriginAccounts((originResult.data ?? []).map(({ id, name, icon }) => ({ id, name, icon })))
          setDestinationAccounts((destinationResult.data ?? []).map(({ id, name, icon }) => ({ id, name, icon })))
          setLoadingAccounts(false)
        }
      } catch (error) {
        if (!cancelled) { toast.error(getFinanceErrorMessage(error)); setLoadingAccounts(false) }
      }
    }
    void loadAccounts()
    return () => { cancelled = true }
  }, [context, scope, targetUserId, transferMode, type])

  const changeType = (nextType: TransactionType) => {
    setType(nextType)
    setSelectedAsset('')
    setSelectedDestination('')
    setLoadingAccounts(true)
  }
  const changeScope = (nextScope: ScopeType) => {
    setScope(nextScope)
    setSelectedAsset('')
    setSelectedDestination('')
    setLoadingAccounts(true)
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const numericAmount = parseCurrencyInput(amount)
    if (!context || numericAmount <= 0 || !selectedAsset || !selectedDestination) {
      toast.error('Completa el monto y selecciona las dos cuentas.')
      return
    }
    if (selectedAsset === selectedDestination) {
      toast.error('La cuenta de origen y destino deben ser diferentes.')
      return
    }

    setSubmitting(true)
    try {
      const currentUser = familyMembers.find((member) => member.id === context.userId)?.email.split('@')[0] ?? 'Yo'
      const target = familyMembers.find((member) => member.id === targetUserId)?.email.split('@')[0] ?? 'fondo familiar'
      const finalDescription = description.trim() || (type === 'APORTE'
        ? `Transferencia: ${currentUser} → ${transferMode === 'POOL' ? 'Fondo común' : target}`
        : type === 'GASTO' ? 'Gasto general' : 'Ingreso')
      const finalScope: ScopeType = type === 'APORTE' ? 'SHARED' : scope
      const lines = type === 'INGRESO'
        ? [{ account_id: selectedAsset, amount: numericAmount }, { account_id: selectedDestination, amount: -numericAmount }]
        : [{ account_id: selectedDestination, amount: numericAmount }, { account_id: selectedAsset, amount: -numericAmount }]

      const client = getBrowserClient()
      const billId = searchParams.get('bill')
      await postTransaction(client, {
        description: finalDescription,
        notes,
        type,
        scope: finalScope,
        date,
        householdId: finalScope === 'SHARED' ? context.householdId : null,
        lines,
        billId,
        billPeriod: billId ? `${getLocalMonthInputValue()}-01` : null,
      })

      toast.success('Movimiento registrado y asiento equilibrado.')
      router.replace(billId ? '/dashboard/obligaciones' : '/dashboard')
    } catch (error) {
      toast.error(getFinanceErrorMessage(error))
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Nueva transacción" description="Cada movimiento se guarda como un asiento contable equilibrado." />

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card>
          <CardHeader><CardTitle>Tipo de movimiento</CardTitle><CardDescription>Elige qué representa esta operación.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {transactionTypes.map(({ value, label, description: helper, icon: Icon }) => (
              <Button key={value} type="button" variant={type === value ? 'default' : 'outline'} className="h-auto justify-start p-4 text-left" onClick={() => changeType(value)}>
                <Icon className="size-5" aria-hidden="true" />
                <span><span className="block font-semibold">{label}</span><span className="block text-xs opacity-75">{helper}</span></span>
              </Button>
            ))}
          </CardContent>
        </Card>

        {type !== 'APORTE' ? (
          <ScopeToggle value={scope} onChange={changeScope} />
        ) : (
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-2">
              <Button type="button" variant={transferMode === 'POOL' ? 'default' : 'outline'} onClick={() => { setTransferMode('POOL'); setSelectedDestination(''); setLoadingAccounts(true) }}>Al fondo familiar</Button>
              <Button type="button" variant={transferMode === 'MEMBER' ? 'default' : 'outline'} onClick={() => { setTransferMode('MEMBER'); setSelectedDestination(''); setLoadingAccounts(true) }}>A otro integrante</Button>
              {transferMode === 'MEMBER' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>Integrante destinatario</Label>
                  <Select value={targetUserId} onValueChange={(value) => { setTargetUserId(value); setSelectedDestination(''); setLoadingAccounts(true) }}>
                    <SelectTrigger aria-label="Integrante destinatario"><SelectValue placeholder="Selecciona un integrante" /></SelectTrigger>
                    <SelectContent>{familyMembers.filter((member) => member.id !== context?.userId).map((member) => (
                      <SelectItem key={member.id} value={member.id}>{member.email}</SelectItem>
                    ))}</SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Detalle</CardTitle><CardDescription>Información que aparecerá en el historial.</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="description">Descripción</Label><Input id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ej. Mercado semanal" /></div>
            <div className="space-y-2"><Label htmlFor="amount">Monto</Label><Input id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^0-9.,]/g, ''))} onBlur={() => setAmount(formatCurrencyInput(amount))} placeholder="0" required /></div>
            <div className="space-y-2"><Label htmlFor="date">Fecha</Label><Input id="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div>
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="notes">Notas</Label><Textarea id="notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Información opcional" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cuentas del asiento</CardTitle><CardDescription>{type === 'INGRESO' ? 'Indica dónde entra el dinero y de qué fuente proviene.' : 'Indica de dónde sale el dinero y su destino.'}</CardDescription></CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2"><Label>{type === 'INGRESO' ? 'Cuenta que recibe' : 'Cuenta de origen'}</Label><AccountSelect label={type === 'INGRESO' ? 'Cuenta que recibe' : 'Cuenta de origen'} accounts={originAccounts} value={selectedAsset} onChange={setSelectedAsset} disabled={loadingAccounts} /></div>
            <div className="space-y-2"><Label>{type === 'GASTO' ? 'Categoría o deuda' : type === 'INGRESO' ? 'Fuente del ingreso' : 'Cuenta de destino'}</Label><AccountSelect label={type === 'GASTO' ? 'Categoría o deuda' : type === 'INGRESO' ? 'Fuente del ingreso' : 'Cuenta de destino'} accounts={destinationAccounts} value={selectedDestination} onChange={setSelectedDestination} disabled={loadingAccounts} /></div>
          </CardContent>
        </Card>

        {type === 'GASTO' && destinationAccounts.some((account) => account.id === selectedDestination) && (
          <Alert><ArrowDownRight /><AlertTitle>Clasificación contable</AlertTitle><AlertDescription>Los pagos dirigidos a una deuda reducirán el pasivo y se mostrarán separados de los gastos de consumo.</AlertDescription></Alert>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={submitting || loadingAccounts}>
          {submitting ? <Loader2 className="animate-spin" /> : <Send />}{submitting ? 'Registrando…' : 'Registrar movimiento'}
        </Button>
      </form>
    </div>
  )
}

export default function TransactionPage() {
  return <Suspense fallback={<div className="p-8 text-center text-sm text-muted-foreground">Preparando formulario…</div>}><TransactionForm /></Suspense>
}
