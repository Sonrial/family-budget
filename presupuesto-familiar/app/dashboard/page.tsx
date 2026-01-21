'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ArrowUpRight, ArrowDownRight, Wallet, Users } from 'lucide-react'

export default function Dashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  
  // Estado para guardar datos separados para no recargar al cambiar de tab
  const [personalData, setPersonalData] = useState({ accounts: [], transactions: [] })
  const [sharedData, setSharedData] = useState({ accounts: [], transactions: [] })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Cargar Datos Personales
    const { data: pAcc } = await supabase.from('accounts').select('*').eq('scope', 'PERSONAL').eq('user_id', user.id)
    const { data: pTx } = await supabase.from('transactions').select('*, created_by_profile:profiles(email)').eq('scope', 'PERSONAL').order('date', { ascending: false }).limit(5)
    
    // 2. Cargar Datos Familiares
    const { data: sAcc } = await supabase.from('accounts').select('*').eq('scope', 'SHARED')
    const { data: sTx } = await supabase.from('transactions').select('*, created_by_profile:profiles(email)').eq('scope', 'SHARED').order('date', { ascending: false }).limit(5)

    setPersonalData({ accounts: pAcc || [], transactions: pTx || [] })
    setSharedData({ accounts: sAcc || [], transactions: sTx || [] })
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // Componente interno para renderizar la lista (Reutilizable)
  const AccountList = ({ data }: { data: any[] }) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.filter(a => a.type === 'ASSET').map((acc) => (
        <Card key={acc.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{acc.name}</CardTitle>
            <div className="text-2xl">{acc.icon}</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$ 0.00</div> {/* Aquí irá el saldo real en V2 */}
            <p className="text-xs text-muted-foreground">Disponible</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const TransactionList = ({ data }: { data: any[] }) => (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Últimos Movimientos</CardTitle>
        <CardDescription>Tus transacciones recientes.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.length === 0 && <p className="text-sm text-gray-500">No hay movimientos.</p>}
          {data.map((tx) => (
            <div key={tx.id} className="flex items-center justify-between border-b pb-2 last:border-0">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">{tx.description}</p>
                <p className="text-xs text-muted-foreground">{tx.date} • {tx.created_by_profile?.email.split('@')[0]}</p>
              </div>
              <div className="flex items-center font-medium">
                {/* Lógica simple visual: si no tengo el monto, muestro icono */}
                <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
                <span className="text-sm">Ver detalle</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
      </div>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList>
          <TabsTrigger value="personal" className="flex gap-2"><Wallet className="w-4 h-4"/> Personal</TabsTrigger>
          <TabsTrigger value="shared" className="flex gap-2"><Users className="w-4 h-4"/> Familiar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="personal" className="space-y-4">
          {loading ? <p>Cargando...</p> : (
            <>
              <AccountList data={personalData.accounts} />
              <TransactionList data={personalData.transactions} />
            </>
          )}
        </TabsContent>
        
        <TabsContent value="shared" className="space-y-4">
          {loading ? <p>Cargando...</p> : (
             <>
              <AccountList data={sharedData.accounts} />
              <TransactionList data={sharedData.transactions} />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}