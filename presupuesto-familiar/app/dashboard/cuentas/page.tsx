'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Plus, Wallet, ShoppingBag, Banknote } from 'lucide-react'

export default function GestionCuentasPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('PERSONAL')
  
  const [assets, setAssets] = useState<any[]>([])   // Bancos/Efectivo
  const [expenses, setExpenses] = useState<any[]>([]) // Categorías Gasto
  const [incomes, setIncomes] = useState<any[]>([])   // Categorías Ingreso

  // Estados para los inputs de creación rápida
  const [newAsset, setNewAsset] = useState({ name: '', icon: '🏦' })
  const [newExpense, setNewExpense] = useState({ name: '', icon: '🛒' })
  const [newIncome, setNewIncome] = useState({ name: '', icon: '💰' })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let query = supabase.from('accounts').select('*').eq('scope', scope)
    if (scope === 'PERSONAL') query = query.eq('user_id', user.id)
    
    const { data } = await query
    if (data) {
      setAssets(data.filter(a => a.type === 'ASSET'))
      setExpenses(data.filter(a => a.type === 'EXPENSE'))
      setIncomes(data.filter(a => a.type === 'INCOME'))
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [scope])

  // Función genérica para CREAR
  const createAccount = async (name: string, icon: string, type: string) => {
    if (!name) return alert("Ponle un nombre")
    const { data: { user } } = await supabase.auth.getUser()
    
    await supabase.from('accounts').insert({
      name, icon, type, scope, user_id: user?.id
    })
    
    // Limpiar inputs
    setNewAsset({ name: '', icon: '🏦' })
    setNewExpense({ name: '', icon: '🛒' })
    setNewIncome({ name: '', icon: '💰' })
    fetchData()
  }

  // Función genérica para BORRAR
  const deleteAccount = async (id: string) => {
    if (!confirm("¿Borrar esta cuenta/categoría? Se borrará su historial si no tiene movimientos importantes bloqueados.")) return
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) alert("No se pudo borrar. Puede que tenga deudas o datos protegidos.")
    else fetchData()
  }

  // Componente pequeño para renderizar cada lista (para no repetir código)
  const ListSection = ({ title, icon, items, newItem, setNewItem, type }: any) => (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">{icon} {title}</CardTitle>
        <CardDescription>Total: {items.length}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        {/* Lista de items existentes */}
        <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-2">
            {items.map((item: any) => (
                <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border hover:bg-white transition">
                    <span className="text-xl mr-2">{item.icon}</span>
                    <span className="font-medium flex-1 text-sm">{item.name}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-400 hover:text-red-600" onClick={() => deleteAccount(item.id)}>
                        <Trash2 className="w-4 h-4" />
                    </Button>
                </div>
            ))}
        </div>

        {/* Formulario para agregar nuevo */}
        <div className="flex gap-2 items-center pt-2 border-t">
            <Input 
                className="w-12 text-center text-xl p-1" 
                value={newItem.icon} 
                onChange={e => setNewItem({...newItem, icon: e.target.value})} 
            />
            <Input 
                placeholder="Nuevo nombre..." 
                value={newItem.name} 
                onChange={e => setNewItem({...newItem, name: e.target.value})} 
            />
            <Button size="icon" onClick={() => createAccount(newItem.name, newItem.icon, type)}>
                <Plus className="w-4 h-4" />
            </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Configuración</h2>
        <Tabs defaultValue="PERSONAL" onValueChange={setScope} className="w-[300px]">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="PERSONAL">Personal</TabsTrigger>
                <TabsTrigger value="SHARED">Familiar</TabsTrigger>
            </TabsList>
        </Tabs>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* COLUMNA 1: BANCOS (ASSETS) */}
        <ListSection 
            title="Cuentas / Bancos" 
            icon={<Wallet className="w-5 h-5 text-blue-600"/>}
            items={assets} 
            newItem={newAsset} 
            setNewItem={setNewAsset} 
            type="ASSET" 
        />

        {/* COLUMNA 2: GASTOS (EXPENSE) */}
        <ListSection 
            title="Categorías Gasto" 
            icon={<ShoppingBag className="w-5 h-5 text-red-600"/>}
            items={expenses} 
            newItem={newExpense} 
            setNewItem={setNewExpense} 
            type="EXPENSE" 
        />

        {/* COLUMNA 3: INGRESOS (INCOME) */}
        <ListSection 
            title="Categorías Ingreso" 
            icon={<Banknote className="w-5 h-5 text-green-600"/>}
            items={incomes} 
            newItem={newIncome} 
            setNewItem={setNewIncome} 
            type="INCOME" 
        />
      </div>
    </div>
  )
}