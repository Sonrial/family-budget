'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

function TransactionForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  
  const [description, setDescription] = useState(searchParams.get('desc') || '')
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState(searchParams.get('amount') || '') 
  const [type, setType] = useState(searchParams.get('type') || 'GASTO') 
  const [scope, setScope] = useState(searchParams.get('scope') || 'PERSONAL')
  
  const [selectedAsset, setSelectedAsset] = useState('') 
  const [selectedDestination, setSelectedDestination] = useState(searchParams.get('cat') || '')
  
  const [assets, setAssets] = useState<any[]>([])     // Origen (De donde sale)
  const [destinations, setDestinations] = useState<any[]>([]) // Destino (A donde va)
  
  useEffect(() => {
    const loadAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. CARGAR ORIGEN (Siempre es una cuenta tipo ASSET)
      // Si es APORTE, el origen SIEMPRE es PERSONAL (yo pongo la plata)
      const currentScope = type === 'APORTE' ? 'PERSONAL' : scope
      
      let queryOrigin = supabase.from('accounts').select('*').eq('scope', currentScope).eq('type', 'ASSET')
      if (currentScope === 'PERSONAL') queryOrigin = queryOrigin.eq('user_id', user.id)
      const { data: originData } = await queryOrigin
      
      if (originData) setAssets(originData)

      // 2. CARGAR DESTINO (Depende del TIPO)
      let queryDest = supabase.from('accounts').select('*')
      
      if (type === 'APORTE') {
         // Si es Aporte, el destino son CUENTAS (Assets) FAMILIARES (Shared)
         queryDest = queryDest.eq('scope', 'SHARED').eq('type', 'ASSET')
      } else {
         // Si es Gasto/Ingreso, el destino depende del scope seleccionado
         queryDest = queryDest.eq('scope', scope)
         if (scope === 'PERSONAL') queryDest = queryDest.eq('user_id', user.id)
      }

      const { data: destData } = await queryDest
      
      if (destData) {
        setDestinations(destData.filter(a => {
          if (type === 'INGRESO') return a.type === 'INCOME'
          if (type === 'APORTE') return true // Mostramos todas las cuentas familiares
          // Gasto
          return a.type === 'EXPENSE' || a.type === 'LIABILITY'
        }))
      }
    }
    loadAccounts()
  }, [scope, type])

  // Formato de miles
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '')
    if (!rawValue) { setAmount(''); return }
    const formatted = new Intl.NumberFormat('es-CO').format(parseInt(rawValue))
    setAmount(formatted)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const cleanAmount = amount.replace(/\./g, '')
    const val = parseFloat(cleanAmount)

    if (!val || !selectedAsset || !selectedDestination) {
        alert('Completa los campos obligatorios'); setLoading(false); return;
    }

    // 1. Crear Transacción
    // Si es APORTE, la guardamos como SHARED para que la familia la vea, 
    // pero internamente sabemos que vino de ti.
    const finalScope = type === 'APORTE' ? 'SHARED' : scope

    const { data: tx, error: txError } = await supabase.from('transactions').insert({
      description: type === 'APORTE' ? (description || 'Aporte a la Familia') : description,
      notes,
      type, 
      scope: finalScope, 
      date: new Date().toISOString(),
      created_by: user.id
    }).select().single()

    if (txError) { alert('Error creando TX'); setLoading(false); return }

    // 2. Lógica Contable (EL CORAZÓN DEL CAMBIO)
    const lines = []
    
    if (type === 'GASTO') {
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: val }) // Gasto (+)
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: -val })      // Banco (-)
    } 
    else if (type === 'INGRESO') {
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: val })       // Banco (+)
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: -val }) // Ingreso (-)
    } 
    else if (type === 'APORTE') {
      // APORTE: Sale de TU cuenta (-), Entra a la cuenta FAMILIAR (+)
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: val })  // Familiar (+)
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: -val })       // Personal (-)
    }

    const { error: linesError } = await supabase.from('transaction_lines').insert(lines)
    
    if (linesError) alert('Error en líneas contables')
    else {
      if (searchParams.get('cat')) router.push('/dashboard/obligaciones')
      else router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl text-center">Registrar Movimiento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* SCOPE (Oculto si es APORTE, porque aporte siempre mezcla scopes) */}
          {type !== 'APORTE' && (
            <div className="space-y-2">
                <Label>¿De quién?</Label>
                <Tabs defaultValue={scope} onValueChange={setScope}>
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="PERSONAL">👤 Personal</TabsTrigger><TabsTrigger value="SHARED">🏠 Familiar</TabsTrigger></TabsList>
                </Tabs>
            </div>
          )}

          {/* TIPO DE TRANSACCIÓN (3 BOTONES) */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
                <div onClick={() => setType('GASTO')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'GASTO' ? 'bg-red-100 border-red-500 text-red-700 font-bold' : 'border-gray-200 opacity-60'}`}>📉 Gasto</div>
                <div onClick={() => setType('INGRESO')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'INGRESO' ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'border-gray-200 opacity-60'}`}>📈 Ingreso</div>
                <div onClick={() => setType('APORTE')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'APORTE' ? 'bg-blue-100 border-blue-500 text-blue-700 font-bold' : 'border-gray-200 opacity-60'}`}>🤝 Aporte</div>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input placeholder={type === 'APORTE' ? "Aporte mensual..." : "Descripción..."} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Monto (COP)</Label>
              <Input type="text" placeholder="0" className="text-lg font-mono" value={amount} onChange={handleAmountChange} />
            </div>

            <div className="space-y-2">
              <Label className="text-blue-600">📝 Notas / Detalles</Label>
              <Textarea placeholder="Detalles..." value={notes} onChange={e => setNotes(e.target.value)} className="resize-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ORIGEN */}
              <div className="space-y-2">
                <Label>{type === 'APORTE' ? 'Desde (Tu cuenta)' : 'Cuenta Origen'}</Label>
                <Select onValueChange={setSelectedAsset} value={selectedAsset}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* DESTINO */}
              <div className="space-y-2">
                <Label>{type === 'APORTE' ? 'Hacia (Fondo Familiar)' : 'Categoría / Destino'}</Label>
                <Select onValueChange={setSelectedDestination} value={selectedDestination}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{destinations.map(a => <SelectItem key={a.id} value={a.id}>{a.icon || '🔹'} {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <Button disabled={loading} type="submit" className="w-full text-lg py-6 bg-blue-800 hover:bg-blue-900">
            {loading ? 'Guardando...' : '💾 Guardar Transacción'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export default function NuevaTransaccionPage() {
  return (
    <div className="max-w-xl mx-auto py-6">
      <Link href="/dashboard" className="flex items-center text-sm text-gray-500 mb-4 hover:text-blue-600">
        <ArrowLeft className="w-4 h-4 mr-1" /> Volver al Dashboard
      </Link>
      <Suspense fallback={<div className="text-center p-10">Cargando...</div>}>
        <TransactionForm />
      </Suspense>
    </div>
  )
}