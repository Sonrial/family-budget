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
import { Textarea } from "@/components/ui/textarea" // Asegúrate de tener este componente, si no usa Input
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'


function TransactionForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  
  const [description, setDescription] = useState(searchParams.get('desc') || '')
  const [notes, setNotes] = useState('')
  const [amount, setAmount] = useState(searchParams.get('amount') || '') // Aquí guardaremos el texto con puntos "1.000"
  const [type, setType] = useState(searchParams.get('type') || 'GASTO') 
  const [scope, setScope] = useState(searchParams.get('scope') || 'PERSONAL')
  
  const [selectedAsset, setSelectedAsset] = useState('') 
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('cat') || '')
  
  const [assets, setAssets] = useState<any[]>([]) 
  const [categories, setCategories] = useState<any[]>([]) 
  
  useEffect(() => {
    const loadAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase.from('accounts').select('*').eq('scope', scope)
      if (scope === 'PERSONAL') query = query.eq('user_id', user.id)
      
      const { data } = await query
      if (data) {
        setAssets(data.filter(a => a.type === 'ASSET'))
        setCategories(data.filter(a => {
          if (type === 'INGRESO') return a.type === 'INCOME'
          return a.type === 'EXPENSE' || a.type === 'LIABILITY'
        }))
      }
    }
    loadAccounts()
  }, [scope, type])

  // --- FUNCIÓN MAGICA PARA FORMATO DE MILES ---
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 1. Quitamos cualquier cosa que no sea número (puntos, letras)
    const rawValue = e.target.value.replace(/\D/g, '')
    
    // 2. Si está vacío, lo dejamos vacío
    if (!rawValue) {
      setAmount('')
      return
    }

    // 3. Formateamos con puntos (Ej. 1000 -> 1.000)
    const formatted = new Intl.NumberFormat('es-CO').format(parseInt(rawValue))
    setAmount(formatted)
  }
  // ---------------------------------------------

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // LIMPIEZA: Antes de guardar, quitamos los puntos para que sea un número real
    const cleanAmount = amount.replace(/\./g, '')
    const val = parseFloat(cleanAmount)

    if (!val || !selectedAsset || (!selectedCategory && type !== 'APORTE')) {
        alert('Completa los campos obligatorios'); setLoading(false); return;
    }

    const { data: tx, error: txError } = await supabase.from('transactions').insert({
      description,
      notes,
      type,
      scope,
      date: new Date().toISOString(),
      created_by: user.id
    }).select().single()

    if (txError) { alert('Error creando TX'); setLoading(false); return }

    const lines = []
    if (type === 'GASTO') {
      lines.push({ transaction_id: tx.id, account_id: selectedCategory, amount: val }) 
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: -val })   
    } else if (type === 'INGRESO') {
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: val })    
      lines.push({ transaction_id: tx.id, account_id: selectedCategory, amount: -val }) 
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>¿De quién?</Label>
                <Tabs defaultValue={scope} onValueChange={setScope}>
                  <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="PERSONAL">👤 Personal</TabsTrigger><TabsTrigger value="SHARED">🏠 Familiar</TabsTrigger></TabsList>
                </Tabs>
             </div>
             <div className="space-y-2">
                <Label>Tipo</Label>
                <div className="flex gap-2">
                  <div onClick={() => setType('GASTO')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'GASTO' ? 'bg-red-100 border-red-500 text-red-700 font-bold' : 'border-gray-200'}`}>📉 Gasto</div>
                  <div onClick={() => setType('INGRESO')} className={`flex-1 p-2 rounded border cursor-pointer text-center text-sm ${type === 'INGRESO' ? 'bg-green-100 border-green-500 text-green-700 font-bold' : 'border-gray-200'}`}>📈 Ingreso</div>
                </div>
             </div>
          </div>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Descripción Corta</Label>
              <Input placeholder="Ej. Arreglo Carro" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            
            <div className="space-y-2">
              <Label>Monto (COP)</Label>
              {/* CAMBIAMOS TYPE="NUMBER" POR TYPE="TEXT" */}
              <Input 
                type="text" 
                placeholder="0" 
                className="text-lg font-mono" // QUITAMOS EL FONT-BOLD
                value={amount} 
                onChange={handleAmountChange} 
              />
            </div>

            <div className="space-y-2">
              <Label className="text-blue-600">📝 Notas / Detalles (Opcional)</Label>
              <Textarea placeholder="Ej. Cambio de bujías..." value={notes} onChange={e => setNotes(e.target.value)} className="resize-none" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cuenta Origen</Label>
                <Select onValueChange={setSelectedAsset} value={selectedAsset}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{assets.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Categoría / Destino</Label>
                <Select onValueChange={setSelectedCategory} value={selectedCategory}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>{categories.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
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