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
import { ArrowLeft, Users, User, CalendarIcon } from 'lucide-react'
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
  
  // FECHA
  const [date, setDate] = useState(() => {
    const now = new Date()
    return now.toISOString().split('T')[0] 
  })
  
  // Lógica de Transferencia
  const [transferMode, setTransferMode] = useState('POOL')
  const [targetUserId, setTargetUserId] = useState('')
  
  const [selectedAsset, setSelectedAsset] = useState('') 
  const [selectedDestination, setSelectedDestination] = useState(searchParams.get('cat') || '')
  
  // Listas
  const [originAccounts, setOriginAccounts] = useState<any[]>([]) // Cuentas de Origen     
  const [destOptions, setDestOptions] = useState<any[]>([])       // Opciones de Destino
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [myProfile, setMyProfile] = useState<any>(null) 

  // Carga inicial de usuarios y mi perfil
  useEffect(() => {
    const loadFamily = async () => {
        const { data } = await supabase.from('profiles').select('*')
        if (data) setFamilyMembers(data)

        const { data: { user } } = await supabase.auth.getUser()
        if (user && data) {
            const me = data.find(p => p.id === user.id)
            setMyProfile(me)
        }
    }
    loadFamily()
  }, [])

  // CARGA DE CUENTAS (Con corrección de filtros)
  useEffect(() => {
    const loadAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. CARGAR CUENTAS DE ORIGEN (Izquierda)
      let queryOrigin = supabase.from('accounts').select('*').eq('type', 'ASSET')

      if (type === 'APORTE') {
        // Si es TRANSFERENCIA, el dinero sale de MI bolsillo (Personal)
        queryOrigin = queryOrigin.eq('user_id', user.id)
      } else {
        // Si es Gasto/Ingreso normal, respetamos la pestaña (Scope)
        if (scope === 'PERSONAL') {
            queryOrigin = queryOrigin.eq('scope', 'PERSONAL').eq('user_id', user.id)
        } else {
            // Si es FAMILIAR, mostramos cuentas compartidas (sin importar quién las creó)
            queryOrigin = queryOrigin.eq('scope', 'SHARED')
        }
      }
      
      const { data: originData } = await queryOrigin
      if (originData) setOriginAccounts(originData)


      // 2. CARGAR DESTINOS (Derecha)
      let queryDest = supabase.from('accounts').select('*')

      if (type === 'GASTO') {
        queryDest = queryDest.eq('scope', scope)
        if (scope === 'PERSONAL') queryDest = queryDest.eq('user_id', user.id)
        queryDest = queryDest.in('type', ['EXPENSE', 'LIABILITY'])
      } 
      else if (type === 'INGRESO') {
        queryDest = queryDest.eq('scope', scope)
        if (scope === 'PERSONAL') queryDest = queryDest.eq('user_id', user.id)
        queryDest = queryDest.eq('type', 'INCOME')
      } 
      else if (type === 'APORTE') {
        if (transferMode === 'POOL') {
            queryDest = queryDest.eq('scope', 'SHARED').eq('type', 'ASSET')
        } else if (transferMode === 'MEMBER') {
            if (targetUserId) {
                queryDest = queryDest.eq('user_id', targetUserId).eq('type', 'ASSET')
            } else {
                setDestOptions([])
                return
            }
        }
      }

      const { data: destData } = await queryDest
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

    let finalDescription = description
    
    if (type === 'APORTE') {
        if (!description || description.trim() === '') {
            const myName = myProfile?.email?.split('@')[0] || 'Mí'
            if (transferMode === 'POOL') {
                finalDescription = `Transferencia: ${myName} ➔ Fondo Común`
            } else {
                const targetUser = familyMembers.find(m => m.id === targetUserId)
                const targetName = targetUser?.email?.split('@')[0] || 'Destinatario'
                finalDescription = `Transferencia: ${myName} ➔ ${targetName}`
            }
        }
    } else {
        if (!finalDescription) finalDescription = type === 'GASTO' ? 'Gasto General' : 'Ingreso'
    }

    const finalDateISO = new Date(date + 'T12:00:00').toISOString()
    const finalScope = type === 'APORTE' ? 'SHARED' : scope

    const { data: tx, error: txError } = await supabase.from('transactions').insert({
      description: finalDescription,
      notes,
      type, 
      scope: finalScope, 
      date: finalDateISO,
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
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: val })  
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: -val })       
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
          
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
                <div onClick={() => setType('GASTO')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'GASTO' ? 'bg-red-100 border-red-500 text-red-700 font-bold' : 'border-gray-200 opacity-60'}`}>📉 Gasto</div>
                <div onClick={() => setType('INGRESO')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'INGRESO' ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'border-gray-200 opacity-60'}`}>📈 Ingreso</div>
                <div onClick={() => setType('APORTE')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'APORTE' ? 'bg-blue-100 border-blue-500 text-blue-700 font-bold' : 'border-gray-200 opacity-60'}`}>🔄 Transferir</div>
            </div>
          </div>

          {type !== 'APORTE' && (
            <div className="space-y-2">
                <Label>Ámbito</Label>
                <Tabs defaultValue={scope} onValueChange={setScope}>
                <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="PERSONAL">👤 Personal</TabsTrigger><TabsTrigger value="SHARED">🏠 Familiar</TabsTrigger></TabsList>
                </Tabs>
            </div>
          )}

          {type === 'APORTE' && (
             <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 space-y-4">
                <Label className="text-blue-800 font-bold">¿Hacia dónde va el dinero?</Label>
                <Tabs defaultValue="POOL" onValueChange={(v) => {setTransferMode(v); setSelectedDestination(''); }}>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="POOL" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"><Users className="w-4 h-4 mr-2"/> Fondo Común</TabsTrigger>
                        <TabsTrigger value="MEMBER" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"><User className="w-4 h-4 mr-2"/> Miembro Familia</TabsTrigger>
                    </TabsList>
                </Tabs>
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
               <Label>Fecha del Movimiento</Label>
               <div className="relative">
                  <Input 
                    type="date" 
                    value={date} 
                    onChange={(e) => setDate(e.target.value)}
                    className="pl-10 text-lg font-medium" 
                  />
                  <CalendarIcon className="w-5 h-5 absolute left-3 top-3 text-gray-500 pointer-events-none"/>
               </div>
            </div>

            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input 
                placeholder={type === 'APORTE' ? "(Opcional) Ej. Para el arriendo" : "Descripción del gasto..."} 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
              />
              {type === 'APORTE' && !description && (
                  <p className="text-xs text-blue-600 animate-pulse">
                     💡 Se guardará como: "Transferencia: {myProfile?.email?.split('@')[0] || 'Yo'} ➔ {transferMode === 'POOL' ? 'Fondo Común' : (familyMembers.find(m => m.id === targetUserId)?.email?.split('@')[0] || '...')}"
                  </p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Monto (COP)</Label>
              <Input type="text" placeholder="0" className="text-lg font-mono" value={amount} onChange={handleAmountChange} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* --- SELECTOR DE ORIGEN ESTILIZADO (BADGES) --- */}
              <div className="space-y-2">
                <Label>{type === 'APORTE' ? 'Desde (Tu cuenta)' : 'Cuenta Origen'}</Label>
                <Select onValueChange={setSelectedAsset} value={selectedAsset}>
                  <SelectTrigger>
                     <SelectValue placeholder="Seleccionar...">
                        {selectedAsset && originAccounts.find(a => a.id === selectedAsset) ? (
                            <div className="flex items-center">
                                <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-gray-100 border border-gray-200 font-bold text-xs text-gray-700 mr-2">
                                    {originAccounts.find(a => a.id === selectedAsset).icon}
                                </span>
                                <span>{originAccounts.find(a => a.id === selectedAsset).name}</span>
                            </div>
                        ) : "Seleccionar..."}
                     </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                      {originAccounts.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                            <div className="flex items-center">
                                <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-gray-100 border border-gray-200 font-bold text-xs text-gray-700 mr-2">
                                    {a.icon}
                                </span>
                                <span className="font-medium">{a.name}</span>
                            </div>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* --- SELECTOR DE DESTINO ESTILIZADO (BADGES) --- */}
              <div className="space-y-2">
                <Label>
                    {type === 'APORTE' 
                        ? (transferMode === 'MEMBER' ? 'Cuenta de Él/Ella' : 'Cuenta del Fondo') 
                        : 'Categoría / Destino'}
                </Label>
                <Select onValueChange={setSelectedDestination} value={selectedDestination} disabled={type === 'APORTE' && transferMode === 'MEMBER' && !targetUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar...">
                        {selectedDestination && destOptions.find(a => a.id === selectedDestination) ? (
                            <div className="flex items-center">
                                <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-gray-100 border border-gray-200 font-bold text-xs text-gray-700 mr-2">
                                    {destOptions.find(a => a.id === selectedDestination).icon}
                                </span>
                                <span>{destOptions.find(a => a.id === selectedDestination).name}</span>
                            </div>
                        ) : "Seleccionar..."}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {destOptions.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                            <div className="flex items-center">
                                <span className="inline-flex items-center justify-center w-8 h-6 rounded bg-gray-100 border border-gray-200 font-bold text-xs text-gray-700 mr-2">
                                    {a.icon}
                                </span>
                                <span className="font-medium">{a.name}</span>
                            </div>
                        </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
             
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