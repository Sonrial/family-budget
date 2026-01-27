'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Plus, Wallet, ShoppingBag, Banknote } from 'lucide-react'

// --- CORRECCIÓN 1: EL COMPONENTE SE DEFINE AFUERA PARA NO PERDER EL FOCO ---
const ListSection = ({ title, icon, items, newItem, setNewItem, createFunction, deleteFunction, type }: any) => (
  <Card className="h-full flex flex-col">
    <CardHeader className="pb-3">
      <CardTitle className="text-lg flex items-center gap-2">{icon} {title}</CardTitle>
      <CardDescription>Total: {items.length}</CardDescription>
    </CardHeader>
    <CardContent className="flex-1 flex flex-col gap-4">
      {/* Lista de items */}
      <div className="flex-1 overflow-y-auto max-h-[300px] space-y-2 pr-2">
          {items.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center p-2 bg-gray-50 rounded border hover:bg-white transition group">
                  {/* Aquí mostramos la sigla como una etiqueta bonita */}
                  <span className="flex items-center justify-center w-10 h-8 rounded bg-white border border-gray-200 font-bold text-xs text-gray-700 shadow-sm mr-3">
                    {item.icon}
                  </span>
                  <span className="font-medium flex-1 text-sm text-gray-700">{item.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-gray-300 group-hover:text-red-600 transition" onClick={() => deleteFunction(item.id)}>
                      <Trash2 className="w-4 h-4" />
                  </Button>
              </div>
          ))}
      </div>

      {/* Formulario de agregar */}
      <div className="flex gap-2 items-center pt-2 border-t">
          <Input 
              // Hice este input más ancho (w-16) para que quepan siglas como "DV1"
              className="w-16 text-center text-sm font-bold uppercase p-1 placeholder:font-normal" 
              placeholder="SIGLA"
              maxLength={4} // Límite de 4 letras para que se vea bien
              value={newItem.icon} 
              onChange={e => setNewItem({...newItem, icon: e.target.value.toUpperCase()})} 
          />
          <Input 
              placeholder="Nombre completo (ej. Nequi)" 
              value={newItem.name} 
              onChange={e => setNewItem({...newItem, name: e.target.value})} 
          />
          <Button size="icon" onClick={() => createFunction(newItem.name, newItem.icon, type)} className="bg-gray-900">
              <Plus className="w-4 h-4" />
          </Button>
      </div>
    </CardContent>
  </Card>
)
// --------------------------------------------------------------------------

export default function GestionCuentasPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('PERSONAL')
  
  const [assets, setAssets] = useState<any[]>([])   
  const [expenses, setExpenses] = useState<any[]>([]) 
  const [incomes, setIncomes] = useState<any[]>([])   

  // Estados iniciales
  const [newAsset, setNewAsset] = useState({ name: '', icon: '' })
  const [newExpense, setNewExpense] = useState({ name: '', icon: '' })
  const [newIncome, setNewIncome] = useState({ name: '', icon: '' })

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

  const createAccount = async (name: string, icon: string, type: string) => {
    if (!name) return alert("Ponle un nombre")
    // Si no puso icono, usamos la primera letra del nombre
    const finalIcon = icon || name.charAt(0).toUpperCase()
    
    const { data: { user } } = await supabase.auth.getUser()
    
    await supabase.from('accounts').insert({
      name, icon: finalIcon, type, scope, user_id: user?.id
    })
    
    setNewAsset({ name: '', icon: '' })
    setNewExpense({ name: '', icon: '' })
    setNewIncome({ name: '', icon: '' })
    fetchData()
  }

  const deleteAccount = async (id: string) => {
    if (!confirm("¿Borrar esta cuenta/categoría?")) return
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) alert("No se pudo borrar. Puede tener datos asociados.")
    else fetchData()
  }

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
        <ListSection 
            title="Cuentas / Bancos" 
            icon={<Wallet className="w-5 h-5 text-blue-600"/>}
            items={assets} 
            newItem={newAsset} 
            setNewItem={setNewAsset} 
            createFunction={createAccount}
            deleteFunction={deleteAccount}
            type="ASSET" 
        />

        <ListSection 
            title="Categorías Gasto" 
            icon={<ShoppingBag className="w-5 h-5 text-red-600"/>}
            items={expenses} 
            newItem={newExpense} 
            setNewItem={setNewExpense} 
            createFunction={createAccount}
            deleteFunction={deleteAccount}
            type="EXPENSE" 
        />

        <ListSection 
            title="Categorías Ingreso" 
            icon={<Banknote className="w-5 h-5 text-green-600"/>}
            items={incomes} 
            newItem={newIncome} 
            setNewItem={setNewIncome} 
            createFunction={createAccount}
            deleteFunction={deleteAccount}
            type="INCOME" 
        />
      </div>
    </div>
  )
}