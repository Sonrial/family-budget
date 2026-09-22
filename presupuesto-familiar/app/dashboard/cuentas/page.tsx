'use client'

import { useEffect, useRef, useState } from 'react'
import { Archive, Banknote, Landmark, Pencil, Plus, ReceiptText } from 'lucide-react'
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

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface DraftAccount { name: string; icon: string }

function AccountSection({ title, description, icon: Icon, accounts, draft, onDraftChange, onCreate, onArchive, onEdit, saving }: {
  title: string
  description: string
  icon: typeof Landmark
  accounts: Account[]
  draft: DraftAccount
  onDraftChange: (draft: DraftAccount) => void
  onCreate: () => void
  onArchive: (account: Account) => void
  onEdit: (account: Account) => void
  saving: boolean
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
        <details className="rounded-xl border bg-muted/20 p-3">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md text-sm font-semibold focus-visible:outline-2 focus-visible:outline-ring"><Plus className="size-4" aria-hidden="true" /> Agregar nuevo elemento</summary>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor={`${title}-name`}>Nombre</Label>
            <Input id={`${title}-name`} value={draft.name} maxLength={80} placeholder="Ej. Cuenta principal"
              onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${title}-icon`}>Sigla</Label>
            <Input id={`${title}-icon`} value={draft.icon} maxLength={4} placeholder="CTA"
              onChange={(event) => onDraftChange({ ...draft, icon: event.target.value.toUpperCase() })} />
          </div>
          <Button onClick={onCreate} disabled={saving || !draft.name.trim()}><Plus /> Agregar</Button>
        </div>
        </details>

        <div className="divide-y rounded-xl border">
          {accounts.length === 0 ? (
            <p className="p-5 text-center text-sm text-muted-foreground">No hay elementos activos.</p>
          ) : accounts.map((account) => (
            <div key={account.id} className="flex items-center gap-3 p-3">
              <span className="flex size-9 items-center justify-center rounded-lg bg-muted font-mono text-[11px] font-bold text-muted-foreground">
                {account.icon || account.name.slice(0, 3).toUpperCase()}
              </span>
              <p className="min-w-0 flex-1 break-words text-sm font-medium">{account.name}</p>
              <Button variant="outline" size="icon" disabled={saving} aria-label={`Editar ${account.name}`} title="Editar nombre y sigla" onClick={() => onEdit(account)}><Pencil /></Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon-sm" disabled={saving} aria-label={`Archivar ${account.name}`}><Archive /></Button>
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
  const [activeType, setActiveType] = useState('ASSET')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Account | null>(null)
  const [editDraft, setEditDraft] = useState(emptyDraft)
  const [saving, setSaving] = useState(false)
  const busy = useRef(false)

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
        if (!cancelled) { setAccounts([]); setContext(null); toast.error(getFinanceErrorMessage(error)); setLoading(false) }
      }
    }
    void loadAccounts()
    return () => { cancelled = true }
  }, [scope, refreshKey])

  const createAccount = async (draft: DraftAccount, type: AccountType, clear: () => void) => {
    if (!context || !draft.name.trim() || busy.current) return
    busy.current = true; setSaving(true)
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
    finally { busy.current = false; setSaving(false) }
  }

  const archiveAccount = async (account: Account) => {
    if (busy.current) return
    busy.current = true; setSaving(true)
    try {
      const { error } = await getBrowserClient().rpc('archive_account', { p_account_id: account.id })
      if (error) throw error
      setRefreshKey((key) => key + 1)
      toast.success('Cuenta archivada; el historial se conservó.')
    } catch (error) { toast.error(getFinanceErrorMessage(error)) }
    finally { busy.current = false; setSaving(false) }
  }

  const openEditor = (account: Account) => { setEditing(account); setEditDraft({ name: account.name, icon: account.icon ?? '' }) }
  const renameAccount = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!editing || !editDraft.name.trim() || busy.current) return
    busy.current = true; setSaving(true)
    try {
      const { error } = await getBrowserClient().rpc('rename_account', {
        p_account_id: editing.id, p_name: editDraft.name.trim(), p_icon: editDraft.icon.trim(),
        p_expected_name: editing.name, p_expected_icon: editing.icon,
      })
      if (error) throw error
      setEditing(null); setRefreshKey((key) => key + 1)
      toast.success('Nombre actualizado. Tus movimientos y saldos se conservaron.')
    } catch (error) { toast.error(getFinanceErrorMessage(error)) }
    finally { busy.current = false; setSaving(false) }
  }

  const changeScope = (next: ScopeType) => { setLoading(true); setScope(next); setSearch('') }
  const filtered = (type: AccountType) => accounts.filter((account) => account.type === type && account.name.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es')))

  return (
    <div className="space-y-6">
      <PageHeader title="Cuentas y categorías" description="Organiza dónde guardas dinero y cómo clasificas ingresos y gastos." actions={<ScopeToggle value={scope} onChange={changeScope} />} />
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <strong>Tu historial se conserva.</strong> Cambiar nombres y siglas no altera saldos ni movimientos. El nuevo nombre aparecerá también en el historial.{scope === 'SHARED' && ' Los cambios son visibles para todo el hogar.'}
      </div>
      <Tabs value={activeType} onValueChange={(value) => { setActiveType(value); setSearch('') }}>
        <TabsList className="grid h-auto w-full grid-cols-3 p-1 md:w-fit">
          <TabsTrigger value="ASSET" className="py-3">Cuentas ({accounts.filter((a) => a.type === 'ASSET').length})</TabsTrigger>
          <TabsTrigger value="EXPENSE" className="py-3">Gastos ({accounts.filter((a) => a.type === 'EXPENSE').length})</TabsTrigger>
          <TabsTrigger value="INCOME" className="py-3">Ingresos ({accounts.filter((a) => a.type === 'INCOME').length})</TabsTrigger>
        </TabsList>
      <Input aria-label="Buscar cuentas o categorías" placeholder="Buscar por nombre…" value={search} onChange={(event) => setSearch(event.target.value)} />
      {loading ? <LoadingState /> : (
        <div className="space-y-5">
          <TabsContent value="ASSET"><AccountSection title="Cuentas y efectivo" description="Bancos, billeteras y efectivo disponible." icon={Landmark}
            accounts={filtered('ASSET')} draft={assetDraft} onDraftChange={setAssetDraft}
            onCreate={() => createAccount(assetDraft, 'ASSET', () => setAssetDraft(emptyDraft()))} onArchive={archiveAccount} onEdit={openEditor} saving={saving || !context || (scope === 'SHARED' && !context.householdId)} /></TabsContent>
          <TabsContent value="EXPENSE"><AccountSection title="Categorías de gasto" description="Clasificaciones para analizar el consumo." icon={ReceiptText}
            accounts={filtered('EXPENSE')} draft={expenseDraft} onDraftChange={setExpenseDraft}
            onCreate={() => createAccount(expenseDraft, 'EXPENSE', () => setExpenseDraft(emptyDraft()))} onArchive={archiveAccount} onEdit={openEditor} saving={saving || !context || (scope === 'SHARED' && !context.householdId)} /></TabsContent>
          <TabsContent value="INCOME"><AccountSection title="Fuentes de ingreso" description="Salarios, ventas y otras entradas." icon={Banknote}
            accounts={filtered('INCOME')} draft={incomeDraft} onDraftChange={setIncomeDraft}
            onCreate={() => createAccount(incomeDraft, 'INCOME', () => setIncomeDraft(emptyDraft()))} onArchive={archiveAccount} onEdit={openEditor} saving={saving || !context || (scope === 'SHARED' && !context.householdId)} /></TabsContent>
        </div>
      )}
      </Tabs>
      <Dialog open={editing !== null} onOpenChange={(open) => { if (!open && !saving) setEditing(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar nombre y sigla</DialogTitle><DialogDescription>Se conserva el mismo identificador. No se borran movimientos, saldos ni pagos asociados.</DialogDescription></DialogHeader>
          <form onSubmit={renameAccount} className="space-y-5">
            <div className="space-y-2"><Label htmlFor="edit-name">Nombre</Label><Input id="edit-name" autoFocus value={editDraft.name} maxLength={80} required disabled={saving} onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="edit-icon">Sigla o emoji</Label><Input id="edit-icon" value={editDraft.icon} maxLength={4} disabled={saving} onChange={(event) => setEditDraft({ ...editDraft, icon: event.target.value })} /><p className="text-xs text-muted-foreground">Opcional. Hasta 4 caracteres.</p></div>
            <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setEditing(null)}>Cancelar</Button><Button type="submit" disabled={saving || !editDraft.name.trim()}>{saving ? 'Guardando…' : 'Guardar cambios'}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
