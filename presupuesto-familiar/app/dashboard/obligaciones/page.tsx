'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Plus, CreditCard, Trash2, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'

// Formateador de dinero
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0
  }).format(Math.abs(amount)) 
}

export default function ObligacionesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('PERSONAL')
  
  const [debts, setDebts] = useState<any[]>([]) 
  const [bills, setBills] = useState<any[]>([]) 
  const [categories, setCategories] = useState<any[]>([])

  const [newBill, setNewBill] = useState({ title: '', amount: '', pay_day: '', category_id: '' })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Cargar Deudas CON SALDO (Usamos account_balances)
    let debtQuery = supabase.from('account_balances').select('*').eq('type', 'LIABILITY').eq('scope', scope)
    if (scope === 'PERSONAL') debtQuery = debtQuery.eq('user_id', user.id)
    const { data: d } = await debtQuery
    
    // 2. Cargar Recurrentes
    let billQuery = supabase.from('recurring_bills').select('*, category:accounts(name, icon)').eq('scope', scope)
    if (scope === 'PERSONAL') billQuery = billQuery.eq('created_by', user.id)
    const { data: b } = await billQuery

    // 3. Cargar Categorías
    let catQuery = supabase.from('accounts').select('*').eq('type', 'EXPENSE').eq('scope', scope)
    if (scope === 'PERSONAL') catQuery = catQuery.eq('user_id', user.id)
    const { data: c } = await catQuery

    setDebts(d || [])
    setBills(b || [])
    setCategories(c || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [scope])

  // --- LÓGICA DE CREAR DEUDA ---
  const createDebt = async () => {
    const name = prompt("Nombre de la deuda (ej. Tarjeta Visa):")
    if (!name) return
    
    const amountStr = prompt("¿Cuánto debes actualmente? (Ingresa el número sin puntos, ej: 500000)")
    const initialAmount = parseFloat(amountStr || '0')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Crear la cuenta
    const { data: account, error } = await supabase.from('accounts').insert({
      name,
      type: 'LIABILITY', 
      scope,
      user_id: user.id,
      icon: '📉'
    }).select().single()

    if (error) { alert('Error creando cuenta'); return }

    // 2. Si hay saldo inicial, crear la transacción de apertura
    if (initialAmount > 0) {
        const { data: tx } = await supabase.from('transactions').insert({
            description: 'Saldo Inicial Deuda',
            scope,
            created_by: user.id,
            date: new Date().toISOString()
        }).select().single()

        if (tx) {
            await supabase.from('transaction_lines').insert({
                transaction_id: tx.id,
                account_id: account.id,
                amount: -initialAmount // NEGATIVO = DEUDA
            })
        }
    }
    fetchData()
  }

  // --- LÓGICA DE CREAR RECURRENTE (ESTA ERA LA QUE FALTABA) ---
  const createBill = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!newBill.title || !newBill.amount || !newBill.category_id) return alert('Completa los datos')
    
    await supabase.from('recurring_bills').insert({
      title: newBill.title,
      amount: newBill.amount,
      pay_day: parseInt(newBill.pay_day),
      category_id: newBill.category_id,
      scope,
      created_by: user?.id
    })
    setNewBill({ title: '', amount: '', pay_day: '', category_id: '' })
    fetchData()
  }
  // ------------------------------------------------------------

  const deleteAccount = async (id: string) => {
    if(!confirm("¿Estás seguro de eliminar esta deuda y todo su historial?")) return
    await supabase.from('accounts').delete().eq('id', id)
    fetchData()
  }

  const deleteBill = async (id: string) => {
      if(!confirm("¿Borrar recurrente?")) return
      await supabase.from('recurring_bills').delete().eq('id', id)
      fetchData()
  }

  const payDebt = (debt: any) => {
    const params = new URLSearchParams({
        desc: `Abono a ${debt.name}`,
        cat: debt.id,
        scope: debt.scope,
        type: 'GASTO'
    })
    router.push(`/dashboard/transaccion?${params.toString()}`)
  }

  const payBill = (bill: any) => {
    const params = new URLSearchParams({
        desc: bill.title,
        amount: bill.amount,
        cat: bill.category_id,
        scope: bill.scope,
        type: 'GASTO'
    })
    router.push(`/dashboard/transaccion?${params.toString()}`)
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Obligaciones</h2>
        <Tabs defaultValue="PERSONAL" onValueChange={setScope} className="w-[200px] md:w-[300px]">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="PERSONAL">Personal</TabsTrigger>
                <TabsTrigger value="SHARED">Familiar</TabsTrigger>
            </TabsList>
        </Tabs>
      </div>

      {/* SECCIÓN 1: DEUDAS (PASIVOS) */}
      <Card className="border-l-4 border-l-red-500 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Mis Deudas</CardTitle>
                <CardDescription>Pasivos actuales y saldos pendientes.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={createDebt}><Plus className="w-4 h-4 mr-2"/> Agregar Deuda</Button>
        </CardHeader>
        <CardContent>
            {debts.length === 0 && <p className="text-muted-foreground text-sm">¡Estás libre de deudas! 🎉</p>}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {debts.map(d => (
                    <div key={d.id} className="p-4 border rounded-lg bg-white shadow-sm flex flex-col justify-between gap-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-gray-800 flex items-center gap-2">{d.icon} {d.name}</h4>
                                <p className="text-xs text-gray-500">Saldo pendiente</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-500" onClick={() => deleteAccount(d.id)}>
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                        
                        <div className="text-2xl font-bold text-red-600">
                            {formatCurrency(d.current_balance)}
                        </div>

                        <Button size="sm" className="w-full bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200" onClick={() => payDebt(d)}>
                            <Wallet className="w-4 h-4 mr-2"/> Abonar Capital
                        </Button>
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>

      {/* SECCIÓN 2: PAGOS RECURRENTES */}
      <Card className="shadow-md">
        <CardHeader>
            <CardTitle>Pagos Recurrentes</CardTitle>
            <CardDescription>Suscripciones y servicios fijos.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="flex gap-2 mb-6 flex-wrap md:flex-nowrap items-end p-4 bg-gray-50 rounded-lg border">
                <div className="w-full md:w-1/3">
                    <span className="text-xs font-bold text-gray-600">Nombre</span>
                    <Input placeholder="Netflix" value={newBill.title} onChange={e => setNewBill({...newBill, title: e.target.value})} />
                </div>
                <div className="w-24">
                     <span className="text-xs font-bold text-gray-600">Día</span>
                    <Input type="number" placeholder="5" value={newBill.pay_day} onChange={e => setNewBill({...newBill, pay_day: e.target.value})} />
                </div>
                <div className="w-32">
                     <span className="text-xs font-bold text-gray-600">Monto</span>
                    <Input type="number" placeholder="$$$" value={newBill.amount} onChange={e => setNewBill({...newBill, amount: e.target.value})} />
                </div>
                <div className="w-full md:w-1/3">
                     <span className="text-xs font-bold text-gray-600">Categoría</span>
                     <Select onValueChange={(v) => setNewBill({...newBill, category_id: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                        <SelectContent>
                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                        </SelectContent>
                     </Select>
                </div>
                <Button onClick={createBill} className="bg-gray-800 hover:bg-black">Agregar</Button>
            </div>

            <div className="space-y-3">
                {bills.map(b => (
                    <div key={b.id} className="flex items-center justify-between border p-3 rounded hover:bg-gray-50 transition bg-white">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 text-blue-800 p-2 rounded text-center min-w-[50px]">
                                <span className="block text-xs font-bold uppercase">Día</span>
                                <span className="text-xl font-bold">{b.pay_day}</span>
                            </div>
                            <div>
                                <p className="font-bold text-gray-800">{b.title}</p>
                                <p className="text-xs text-gray-500">{b.category?.icon} {b.category?.name} • ${b.amount}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => payBill(b)}>
                                <CreditCard className="w-4 h-4 mr-2" /> Pagar
                             </Button>
                             <Button size="icon" variant="ghost" onClick={() => deleteBill(b.id)}>
                                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                             </Button>
                        </div>
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>
    </div>
  )
}