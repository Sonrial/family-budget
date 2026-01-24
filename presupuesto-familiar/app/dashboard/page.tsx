'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation' //
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowDownRight, ArrowUpRight, Wallet, Users } from 'lucide-react'

// Utilidad para formatear dinero colombiano (COP)
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function Dashboard() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  
  // Usamos 'as any[]' para evitar errores de TypeScript
  const [personalData, setPersonalData] = useState({ accounts: [] as any[], transactions: [] as any[] })
  const [sharedData, setSharedData] = useState({ accounts: [] as any[], transactions: [] as any[] })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Cargar SALDOS PERSONALES (Desde la nueva vista account_balances)
    const { data: pAcc } = await supabase
      .from('account_balances') // <--- CAMBIO IMPORTANTE: Leemos la vista, no la tabla
      .select('*')
      .eq('scope', 'PERSONAL')
      .eq('user_id', user.id)

    const { data: pTx } = await supabase
      .from('transactions')
      .select('*, created_by_profile:profiles(email)')
      .eq('scope', 'PERSONAL')
      .order('date', { ascending: false })
      .limit(5)
    
    // 2. Cargar SALDOS FAMILIARES (Desde la nueva vista account_balances)
    const { data: sAcc } = await supabase
      .from('account_balances') // <--- CAMBIO IMPORTANTE
      .select('*')
      .eq('scope', 'SHARED')

    const { data: sTx } = await supabase
      .from('transactions')
      .select('*, created_by_profile:profiles(email)')
      .eq('scope', 'SHARED')
      .order('date', { ascending: false })
      .limit(5)

    setPersonalData({ accounts: pAcc || [], transactions: pTx || [] })
    setSharedData({ accounts: sAcc || [], transactions: sTx || [] })
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // Componente de Lista de Cuentas con SALDO REAL
  const AccountList = ({ data }: { data: any[] }) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Filtramos solo ACTIVOS (Bancos/Efectivo) */}
      {data.filter(a => a.type === 'ASSET').map((acc) => (
        <Card key={acc.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{acc.name}</CardTitle>
            <div className="text-2xl">{acc.icon}</div>
          </CardHeader>
          <CardContent>
            {/* Aquí mostramos el saldo real que viene de la base de datos */}
            <div className={`text-2xl font-bold ${acc.current_balance < 0 ? 'text-red-600' : 'text-green-700'}`}>
              {formatCurrency(acc.current_balance)}
            </div>
            <p className="text-xs text-muted-foreground">Saldo actual</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
  
  const TransactionList = ({ data }: { data: any[] }) => {
    const router = useRouter() // Asegúrate de importar useRouter arriba

    return (
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
                  <div className="flex items-center gap-2">
                    {/* ICONO DE COLOR SEGÚN EL TIPO */}
                    {tx.type === 'INGRESO' 
                        ? <ArrowUpRight className="h-5 w-5 text-green-600" /> 
                        : <ArrowDownRight className="h-5 w-5 text-red-600" />
                    }
                    <p className="text-sm font-medium leading-none">{tx.description}</p>
                  </div>
                  {/* Mostramos el inicio de la nota si existe */}
                  {tx.notes && <p className="text-xs text-gray-400 italic pl-7 truncate max-w-[200px]">{tx.notes}</p>}
                  <p className="text-xs text-muted-foreground pl-7">{new Date(tx.date).toLocaleDateString()} • {tx.created_by_profile?.email.split('@')[0]}</p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => router.push(`/dashboard/movimiento/${tx.id}`)}>
                    Ver / Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

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
          {loading ? <p>Cargando saldos...</p> : (
            <>
              <AccountList data={personalData.accounts} />
              <TransactionList data={personalData.transactions} />
            </>
          )}
        </TabsContent>
        
        <TabsContent value="shared" className="space-y-4">
          {loading ? <p>Cargando saldos...</p> : (
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