'use client'

import { useEffect, useState } from 'react'
import { Archive, Banknote, Landmark, Plus, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/finance/page-header'
import { ScopeToggle } from '@/components/finance/scope-toggle'
import { LoadingState } from '@/components/finance/states'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getFinanceContext, getFinanceErrorMessage } from '@/lib/finance'
import { getBrowserClient } from '@/lib/supabase/client'
import type { Account, AccountType, FinanceContext, ScopeType } from '@/lib/types'

interface DraftAccount { name: string; icon: string }

function AccountSection({ title, description, icon: Icon, accounts, draft, onDraftChange, onCreate, onArchive }: {
  title: string
  description: string
  icon: typeof Landmark
  accounts: Account[]
  draft: DraftAccount
  onDraftChange: (draft: DraftAccount) => void
  onCreate: () => void
  onArchive: (account: Account) => void
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><Icon aria-hidden="true" /></span>
          <div><CardTitle>{title}</CardTitle><CardDescription>{description}</CardDescription></div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_100px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor={`${title}-name`}>Nombre</Label>
            <Input id={`${title}-name`} value={draft.name} placeholder="Ej. Cuenta principal"
              onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${title}-icon`}>Sigla</Label>
            <Input id={`${title}-icon`} value={draft.icon} maxLength={4} placeholder="CTA"
              onChange={(event) => onDraftChange({ ...draft, icon: event.target.value.toUpperCase() })} />
          </div>
          <Button onClick={onCreate} disabled={!draft.name.trim()}><Plus /> Agregar</Button>
        </div>

        <div className="divide-y rounded-xl border">
          {accounts.length === 0 ? (
            <p className="p-5 text-center text-sm text-muted-foreground">No hay elementos activos.</p>
          ) : accounts.map((account) => (
            <div key={account.id} className="flex items-center gap-3 p-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted font-mono text-[11px] font-bold text-muted-foreground">
                {account.icon || account.name.slice(0, 3).toUpperCase()}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{account.name}</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label={`Archivar ${account.name}`}><Archive /></Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Archivar “{account.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      El historial se conservará. Las cuentas de efectivo o deuda deben quedar en cero antes de archivarse.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => onArchive(account)}>Archivar</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

const emptyDraft = (): DraftAccount => ({ name: '', icon: '' })

export default function AccountsPage() {
  const [scope, setScope] = useState<ScopeType>('PERSONAL')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [context, setContext] = useState<FinanceContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [assetDraft, setAssetDraft] = useState(emptyDraft)
  const [expenseDraft, setExpenseDraft] = useState(emptyDraft)
  const [incomeDraft, setIncomeDraft] = useState(emptyDraft)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function loadAccounts() {
      try {
        const client = getBrowserClient()
        const nextContext = await getFinanceContext(client)
        if (scope === 'SHARED' && !nextContext.householdId) {
          if (!cancelled) {
            setContext(nextContext)
            setAccounts([])
            setLoading(false)
          }
          return
        }
        let query = client.from('accounts').select('*').eq('scope', scope).is('archived_at', null).order('name')
        query = scope === 'PERSONAL'
          ? query.eq('user_id', nextContext.userId)
          : query.eq('household_id', nextContext.householdId)
        const { data, error } = await query.returns<Account[]>()
        if (error) throw error
        if (!cancelled) {
          setContext(nextContext)
          setAccounts(data ?? [])
          setLoading(false)
        }
      } catch (error) {
        if (!cancelled) { toast.error(getFinanceErrorMessage(error)); setLoading(false) }
      }
    }
    void loadAccounts()
    return () => { cancelled = true }
  }, [scope, refreshKey])

  const createAccount = async (draft: DraftAccount, type: AccountType, clear: () => void) => {
    if (!context || !draft.name.trim()) return
    try {
      const { error } = await getBrowserClient().from('accounts').insert({
        name: draft.name.trim(),
        icon: draft.icon.trim() || draft.name.trim().slice(0, 3).toUpperCase(),
        type,
        scope,
        user_id: context.userId,
        household_id: scope === 'SHARED' ? context.householdId : null,
      })
      if (error) throw error
      clear()
      setRefreshKey((key) => key + 1)
      toast.success('Cuenta creada correctamente.')
    } catch (error) { toast.error(getFinanceErrorMessage(error)) }
  }

  const archiveAccount = async (account: Account) => {
    try {
      const { error } = await getBrowserClient().rpc('archive_account', { p_account_id: account.id })
      if (error) throw error
      setRefreshKey((key) => key + 1)
      toast.success('Cuenta archivada; el historial se conservó.')
    } catch (error) { toast.error(getFinanceErrorMessage(error)) }
  }

  const changeScope = (next: ScopeType) => { setLoading(true); setScope(next) }
  const filtered = (type: AccountType) => accounts.filter((account) => account.type === type)

  return (
    <div className="space-y-6">
      <PageHeader title="Cuentas y categorías" description="Organiza dónde guardas dinero y cómo clasificas ingresos y gastos." actions={<ScopeToggle value={scope} onChange={changeScope} />} />
      {loading ? <LoadingState /> : (
        <div className="grid gap-5 xl:grid-cols-2">
          <AccountSection title="Cuentas y efectivo" description="Bancos, billeteras y efectivo disponible." icon={Landmark}
            accounts={filtered('ASSET')} draft={assetDraft} onDraftChange={setAssetDraft}
            onCreate={() => createAccount(assetDraft, 'ASSET', () => setAssetDraft(emptyDraft()))} onArchive={archiveAccount} />
          <AccountSection title="Categorías de gasto" description="Clasificaciones para analizar el consumo." icon={ReceiptText}
            accounts={filtered('EXPENSE')} draft={expenseDraft} onDraftChange={setExpenseDraft}
            onCreate={() => createAccount(expenseDraft, 'EXPENSE', () => setExpenseDraft(emptyDraft()))} onArchive={archiveAccount} />
          <AccountSection title="Fuentes de ingreso" description="Salarios, ventas y otras entradas." icon={Banknote}
            accounts={filtered('INCOME')} draft={incomeDraft} onDraftChange={setIncomeDraft}
            onCreate={() => createAccount(incomeDraft, 'INCOME', () => setIncomeDraft(emptyDraft()))} onArchive={archiveAccount} />
        </div>
      )}
    </div>
  )
}
