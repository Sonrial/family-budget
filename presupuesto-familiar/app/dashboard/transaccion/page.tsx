'use client'
import { useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Dentro de src/app/dashboard/transaccion/page.tsx

export default function NuevaTransaccion() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()

  const [loading, setLoading] = useState(false)

  // --- BLOQUE DE ESTADOS (Corregido) ---
  const [description, setDescription] = useState(searchParams.get('desc') || '')
  const [amount, setAmount] = useState(searchParams.get('amount') || '')
  const [type, setType] = useState(searchParams.get('type') || 'GASTO') 
  const [scope, setScope] = useState(searchParams.get('scope') || 'PERSONAL')
  
  // ESTA ES LA LÍNEA QUE FALTABA:
  const [selectedAsset, setSelectedAsset] = useState('') 
  
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('cat') || '')
  
  // Listas para los desplegables
  const [assets, setAssets] = useState<any[]>([]) 
  const [categories, setCategories] = useState<any[]>([]) 
  // -------------------------------------

  // ... (el resto del código sigue igual)
  useEffect(() => {
    const loadAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase.from('accounts').select('*').eq('scope', scope)
      if (scope === 'PERSONAL') {
        query = query.eq('user_id', user.id)
      }
      
      const { data } = await query
      if (data) {
        setAssets(data.filter(a => a.type === 'ASSET'))
        setCategories(data.filter(a => a.type === (type === 'INGRESO' ? 'INCOME' : 'EXPENSE')))
      }
    }
    loadAccounts()
  }, [scope, type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const val = parseFloat(amount)
    if (!val || !selectedAsset || (!selectedCategory && type !== 'APORTE')) {
        alert('Completa todos los campos'); setLoading(false); return;
    }

    const { data: tx, error: txError } = await supabase.from('transactions').insert({
      description,
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
    else router.push('/dashboard')
    setLoading(false)
  }

  return (
    <div className="max-w-xl mx-auto py-6">
      <Link href="/dashboard" className="flex items-center text-sm text-gray-500 mb-4 hover:text-blue-600">
        <ArrowLeft className="w-4 h-4 mr-1" /> Volver al Dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-center">Registrar Movimiento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* 1. SELECTOR DE SCOPE (Personal vs Familiar) */}
            <div className="space-y-2">
              <Label>¿De quién es el movimiento?</Label>
              <Tabs defaultValue="PERSONAL" onValueChange={(v) => setScope(v)} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="PERSONAL">👤 Personal</TabsTrigger>
                  <TabsTrigger value="SHARED">🏠 Familiar</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* 2. TIPO DE MOVIMIENTO (Gasto vs Ingreso) */}
            <div className="space-y-2">
              <Label>Tipo de Transacción</Label>
              <div className="flex gap-4">
                <div 
                  onClick={() => setType('GASTO')}
                  className={`flex-1 p-4 rounded-lg border-2 cursor-pointer text-center transition-all ${type === 'GASTO' ? 'border-red-500 bg-red-50 text-red-700 font-bold' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  📉 Gasto
                </div>
                <div 
                  onClick={() => setType('INGRESO')}
                  className={`flex-1 p-4 rounded-lg border-2 cursor-pointer text-center transition-all ${type === 'INGRESO' ? 'border-green-500 bg-green-50 text-green-700 font-bold' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  📈 Ingreso
                </div>
              </div>
            </div>

            {/* 3. DATOS DE LA TRANSACCIÓN */}
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="desc">Descripción</Label>
                <Input id="desc" placeholder="Ej. Mercado D1, Pago Netflix..." value={description} onChange={e => setDescription(e.target.value)} />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="amount">Monto (COP)</Label>
                <Input id="amount" type="number" placeholder="0" className="text-lg font-mono" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cuenta de Origen</Label>
                  <Select onValueChange={setSelectedAsset}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {assets.map(a => <SelectItem key={a.id} value={a.id}>{a.icon} {a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Categoría</Label>
                  <Select onValueChange={setSelectedCategory}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent>
                      {categories.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Button disabled={loading} type="submit" className="w-full text-lg py-6 bg-blue-700 hover:bg-blue-800">
              {loading ? 'Guardando...' : '💾 Guardar Transacción'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}