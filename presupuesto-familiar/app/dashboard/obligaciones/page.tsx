'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar, CreditCard, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function ObligacionesPage() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('PERSONAL')
  
  // Datos
  const [debts, setDebts] = useState<any[]>([]) // Cuentas tipo LIABILITY
  const [bills, setBills] = useState<any[]>([]) // Pagos recurrentes
  const [categories, setCategories] = useState<any[]>([])

  // Formulario Nuevo Recurrente
  const [newBill, setNewBill] = useState({ title: '', amount: '', pay_day: '', category_id: '' })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Cargar Deudas (Cuentas tipo LIABILITIES)
    let debtQuery = supabase.from('accounts').select('*').eq('type', 'LIABILITY').eq('scope', scope)
    if (scope === 'PERSONAL') debtQuery = debtQuery.eq('user_id', user.id)
    const { data: d } = await debtQuery
    
    // 2. Cargar Recurrentes
    let billQuery = supabase.from('recurring_bills').select('*, category:accounts(name, icon)').eq('scope', scope)
    if (scope === 'PERSONAL') billQuery = billQuery.eq('created_by', user.id)
    const { data: b } = await billQuery

    // 3. Cargar Categorías (para el select de crear recurrente)
    let catQuery = supabase.from('accounts').select('*').eq('type', 'EXPENSE').eq('scope', scope)
    if (scope === 'PERSONAL') catQuery = catQuery.eq('user_id', user.id)
    const { data: c } = await catQuery

    setDebts(d || [])
    setBills(b || [])
    setCategories(c || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [scope])

  // Crear una nueva Deuda (Cuenta Pasivo)
  const createDebt = async () => {
    const name = prompt("Nombre de la deuda (ej. Tarjeta Visa, Préstamo Carro):")
    if (!name) return
    const { data: { user } } = await supabase.auth.getUser()
    
    await supabase.from('accounts').insert({
      name,
      type: 'LIABILITY', // Importante: Tipo Pasivo
      scope,
      user_id: user?.id,
      icon: '📉'
    })
    fetchData()
  }

  // Crear un nuevo Pago Recurrente
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

  const deleteBill = async (id: string) => {
      if(!confirm("¿Borrar recurrente?")) return
      await supabase.from('recurring_bills').delete().eq('id', id)
      fetchData()
  }

  // Función mágica: Pagar Recurrente
  // Redirige al formulario de transacción con datos pre-llenados
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
        <Tabs defaultValue="PERSONAL" onValueChange={setScope} className="w-[300px]">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="PERSONAL">Personal</TabsTrigger>
                <TabsTrigger value="SHARED">Familiar</TabsTrigger>
            </TabsList>
        </Tabs>
      </div>

      {/* SECCIÓN 1: DEUDAS (PASIVOS) */}
      <Card className="border-l-4 border-l-red-500">
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Mis Deudas (Pasivos)</CardTitle>
                <CardDescription>Tarjetas de crédito, préstamos y dineros que debes.</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={createDebt}><Plus className="w-4 h-4 mr-2"/> Agregar Deuda</Button>
        </CardHeader>
        <CardContent>
            {debts.length === 0 && <p className="text-muted-foreground text-sm">¡Estás libre de deudas! 🎉 (o no las has registrado)</p>}
            <div className="grid gap-4 md:grid-cols-3">
                {debts.map(d => (
                    <div key={d.id} className="p-4 border rounded bg-gray-50 flex justify-between items-center">
                        <span className="font-medium">{d.icon} {d.name}</span>
                        {/* En V3 aquí calcularemos el saldo real */}
                        <Badge variant="secondary">Activo</Badge>
                    </div>
                ))}
            </div>
        </CardContent>
      </Card>

      {/* SECCIÓN 2: PAGOS RECURRENTES */}
      <Card>
        <CardHeader>
            <CardTitle>Pagos Recurrentes (Suscripciones/Servicios)</CardTitle>
            <CardDescription>Crea recordatorios para tus pagos fijos mensuales.</CardDescription>
        </CardHeader>
        <CardContent>
            {/* Formulario rápido para añadir */}
            <div className="flex gap-2 mb-6 flex-wrap md:flex-nowrap items-end p-4 bg-blue-50 rounded-lg">
                <div className="w-full md:w-1/3">
                    <span className="text-xs font-bold text-blue-800">Nombre (ej. Netflix)</span>
                    <Input placeholder="Netflix" value={newBill.title} onChange={e => setNewBill({...newBill, title: e.target.value})} />
                </div>
                <div className="w-24">
                     <span className="text-xs font-bold text-blue-800">Día Mes</span>
                    <Input type="number" placeholder="5" value={newBill.pay_day} onChange={e => setNewBill({...newBill, pay_day: e.target.value})} />
                </div>
                <div className="w-32">
                     <span className="text-xs font-bold text-blue-800">Monto</span>
                    <Input type="number" placeholder="$$$" value={newBill.amount} onChange={e => setNewBill({...newBill, amount: e.target.value})} />
                </div>
                <div className="w-full md:w-1/3">
                     <span className="text-xs font-bold text-blue-800">Categoría Contable</span>
                     <Select onValueChange={(v) => setNewBill({...newBill, category_id: v})}>
                        <SelectTrigger><SelectValue placeholder="Selecciona..." /></SelectTrigger>
                        <SelectContent>
                            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
                        </SelectContent>
                     </Select>
                </div>
                <Button onClick={createBill} className="bg-blue-600 hover:bg-blue-700">Agregar</Button>
            </div>

            {/* Lista de Recurrentes */}
            <div className="space-y-3">
                {bills.map(b => (
                    <div key={b.id} className="flex items-center justify-between border p-3 rounded hover:bg-gray-50 transition">
                        <div className="flex items-center gap-3">
                            <div className="bg-gray-200 p-2 rounded text-center min-w-[50px]">
                                <span className="block text-xs font-bold uppercase">Día</span>
                                <span className="text-xl font-bold">{b.pay_day}</span>
                            </div>
                            <div>
                                <p className="font-bold text-gray-800">{b.title}</p>
                                <p className="text-xs text-gray-500">{b.category?.icon} {b.category?.name} • ${b.amount}</p>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => payBill(b)}>
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