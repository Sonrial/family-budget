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
import { ArrowLeft, Users, User } from 'lucide-react'
import Link from 'next/link'

function TransactionForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  
  // Datos básicos
  const [description, setDescription] = useState(searchParams.get('desc') || '')
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState(searchParams.get('amount') || '') 
  const [type, setType] = useState(searchParams.get('type') || 'GASTO') 
  const [scope, setScope] = useState(searchParams.get('scope') || 'PERSONAL')
  
  // Lógica de Transferencia
  const [transferMode, setTransferMode] = useState('POOL') // 'POOL' (Fondo comun) o 'MEMBER' (Persona)
  const [targetUserId, setTargetUserId] = useState('')
  
  const [selectedAsset, setSelectedAsset] = useState('') 
  const [selectedDestination, setSelectedDestination] = useState(searchParams.get('cat') || '')
  
  // Listas
  const [myAssets, setMyAssets] = useState<any[]>([])      // Mis cuentas origen
  const [destOptions, setDestOptions] = useState<any[]>([]) // Opciones destino
  const [familyMembers, setFamilyMembers] = useState<any[]>([]) // Lista de usuarios
  
  // Carga inicial de usuarios (para la lista desplegable)
  useEffect(() => {
    const loadFamily = async () => {
        const { data } = await supabase.from('profiles').select('*')
        if (data) setFamilyMembers(data)
    }
    loadFamily()
  }, [])

  // Carga de cuentas según selección
  useEffect(() => {
    const loadAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. ORIGEN: Siempre mis cuentas personales (ASSET)
      const { data: myAcc } = await supabase.from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'ASSET')
      if (myAcc) setMyAssets(myAcc)

      // 2. DESTINO: Depende del TIPO y del MODO
      let query = supabase.from('accounts').select('*')

      if (type === 'GASTO') {
        // Gastos Personales o Familiares
        query = query.eq('scope', scope)
        if (scope === 'PERSONAL') query = query.eq('user_id', user.id)
        query = query.in('type', ['EXPENSE', 'LIABILITY']) // Gastos o Deudas
      } 
      else if (type === 'INGRESO') {
        // Ingresos
        query = query.eq('scope', scope)
        if (scope === 'PERSONAL') query = query.eq('user_id', user.id)
        query = query.eq('type', 'INCOME')
      } 
      else if (type === 'APORTE') {
        // TRANSFERENCIA
        if (transferMode === 'POOL') {
            // A Fondo Común (Cuentas SHARED)
            query = query.eq('scope', 'SHARED').eq('type', 'ASSET')
        } else if (transferMode === 'MEMBER') {
            // A Otro Miembro (Cuentas PERSONAL de otro ID)
            if (targetUserId) {
                query = query.eq('user_id', targetUserId).eq('type', 'ASSET')
            } else {
                // Si no ha seleccionado usuario, no mostramos nada aún
                setDestOptions([])
                return
            }
        }
      }

      const { data: destData } = await query
      if (destData) setDestOptions(destData)
    }
    loadAccounts()
  }, [scope, type, transferMode, targetUserId])

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
        alert('Completa los campos'); setLoading(false); return;
    }

    // Definir Scope final
    // Si es transferencia entre personas, lo marcamos SHARED para que ambos lo vean en el historial familiar
    // o podríamos mantenerlo PERSONAL pero con permisos especiales. Por simplicidad, usemos SHARED.
    const finalScope = type === 'APORTE' ? 'SHARED' : scope

    const { data: tx, error: txError } = await supabase.from('transactions').insert({
      description: description || (type === 'APORTE' ? 'Transferencia' : 'Movimiento'),
      notes,
      type, 
      scope: finalScope, 
      date: new Date().toISOString(),
      created_by: user.id
    }).select().single()

    if (txError) { alert('Error creando TX'); setLoading(false); return }

    const lines = []
    
    if (type === 'GASTO') {
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: val }) 
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: -val })      
    } 
    else if (type === 'INGRESO') {
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: val })       
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: -val }) 
    } 
    else if (type === 'APORTE') {
      // Lógica Transferencia: Sale de MÍ (-), Entra al DESTINO (+)
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: val })  // Destino (+)
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: -val })       // Origen (-)
    }

    const { error: linesError } = await supabase.from('transaction_lines').insert(lines)
    
    if (linesError) alert('Error contable')
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
          
          {/* TIPO DE TRANSACCIÓN */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
                <div onClick={() => setType('GASTO')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'GASTO' ? 'bg-red-100 border-red-500 text-red-700 font-bold' : 'border-gray-200 opacity-60'}`}>📉 Gasto</div>
                <div onClick={() => setType('INGRESO')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'INGRESO' ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'border-gray-200 opacity-60'}`}>📈 Ingreso</div>
                <div onClick={() => setType('APORTE')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'APORTE' ? 'bg-blue-100 border-blue-500 text-blue-700 font-bold' : 'border-gray-200 opacity-60'}`}>🔄 Transferir</div>
            </div>
          </div>

          {/* SCOPE (Solo si NO es Transferencia) */}
          {type !== 'APORTE' && (
            <div className="space-y-2">
                <Label>Ámbito</Label>
                <Tabs defaultValue={scope} onValueChange={setScope}>
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="PERSONAL">👤 Personal</TabsTrigger><TabsTrigger value="SHARED">🏠 Familiar</TabsTrigger></TabsList>
                </Tabs>
            </div>
          )}

          {/* MENÚ ESPECIAL DE TRANSFERENCIA */}
          {type === 'APORTE' && (
             <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                <Label className="text-blue-800 font-bold">¿Hacia dónde va el dinero?</Label>
                <Tabs defaultValue="POOL" onValueChange={(v) => {setTransferMode(v); setSelectedDestination(''); }}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="POOL" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                            <Users className="w-4 h-4 mr-2"/> Fondo Común
                        </TabsTrigger>
                        <TabsTrigger value="MEMBER" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                            <User className="w-4 h-4 mr-2"/> Miembro Familia
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                {/* Si elige MIEMBRO, mostramos selector de usuarios */}
                {transferMode === 'MEMBER' && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <Label>Selecciona al familiar:</Label>
                        <Select onValueChange={setTargetUserId}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="¿A quién le envías?" /></SelectTrigger>
                            <SelectContent>
                                {familyMembers.map(m => (
                                    <SelectItem key={m.id} value={m.id}>{m.email?.split('@')[0] || 'Usuario'}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
             </div>
          )}

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input placeholder={type === 'APORTE' ? "Ej. Para el almuerzo..." : "Descripción..."} value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Monto (COP)</Label>
              <Input type="text" placeholder="0" className="text-lg font-mono" value={amount} onChange={handleAmountChange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* ORIGEN: Siempre muestra MIS bancos */}
              <div className="space-y-2">
                <Label>{type === 'APORTE' ? 'Desde (Tu cuenta)' : 'Cuenta Origen'}</Label>
                <Select onValueChange={setSelectedAsset} value={selectedAsset}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{myAssets.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>

              {/* DESTINO: Dinámico según lo seleccionado arriba */}
              <div className="space-y-2">
                <Label>
                    {type === 'APORTE' 
                        ? (transferMode === 'MEMBER' ? 'Cuenta de Él/Ella' : 'Cuenta del Fondo') 
                        : 'Categoría / Destino'}
                </Label>
                <Select onValueChange={setSelectedDestination} value={selectedDestination} disabled={type === 'APORTE' && transferMode === 'MEMBER' && !targetUserId}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{destOptions.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
             
             {/* Notas */}
             <div className="space-y-2">
                <Label className="text-gray-500">📝 Notas (Opcional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} className="resize-none h-20" />
            </div>
          </div>

          <Button disabled={loading} type="submit" className="w-full text-lg py-6 bg-blue-800 hover:bg-blue-900">
            {loading ? 'Procesando...' : (type === 'APORTE' ? '🚀 Enviar Dinero' : '💾 Guardar')}
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