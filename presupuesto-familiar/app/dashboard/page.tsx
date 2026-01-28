'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Wallet, Users } from 'lucide-react'

// --- 1. FORMATO MONEDA (2 DECIMALES) ---
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// --- 2. FORMATO FECHA (SIN RESTAR DÍAS) ---
const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.substring(0, 10).split('-')
    return `${day}/${month}/${year}`
}

export default function Dashboard() {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  
  const [personalData, setPersonalData] = useState({ accounts: [] as any[], transactions: [] as any[] })
  const [sharedData, setSharedData] = useState({ accounts: [] as any[], transactions: [] as any[] })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Función auxiliar para cargar datos según el ámbito (Personal/Familiar)
    const loadDataByScope = async (scope: string) => {
        // A. Cargar Cuentas (Solo Assets/Bancos)
        let accQuery = supabase.from('accounts').select('*').eq('scope', scope).eq('type', 'ASSET')
        if (scope === 'PERSONAL') accQuery = accQuery.eq('user_id', user.id)
        
        const { data: accountsRaw } = await accQuery
        const accounts = accountsRaw || []

        // B. Calcular Saldo Real sumando líneas
        const accountsWithBalance = await Promise.all(accounts.map(async (acc) => {
            const { data: lines } = await supabase
                .from('transaction_lines')
                .select('amount')
                .eq('account_id', acc.id)
            
            const balance = lines ? lines.reduce((sum, line) => sum + line.amount, 0) : 0
            return { ...acc, current_balance: balance }
        }))

        // C. Cargar Últimas Transacciones
        let txQuery = supabase
            .from('transactions')
            .select('*, created_by_profile:profiles(email)')
            .eq('scope', scope)
            .order('date', { ascending: false })
            .limit(10)
        
        if (scope === 'PERSONAL') txQuery = txQuery.eq('created_by', user.id)

        const { data: transactions } = await txQuery

        return {
            accounts: accountsWithBalance,
            transactions: transactions || []
        }
    }

    const [pData, sData] = await Promise.all([
        loadDataByScope('PERSONAL'),
        loadDataByScope('SHARED')
    ])

    setPersonalData(pData)
    setSharedData(sData)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  // --- LÓGICA DE COLOR (Rojo, Verde, Negro) ---
  const getBalanceColor = (amount: number) => {
      if (amount > 0) return 'text-green-600' // Positivo
      if (amount < 0) return 'text-red-600'   // Negativo
      return 'text-gray-900'                  // Cero (Negro)
  }

  // --- COMPONENTE DE CUADRÍCULA DE CUENTAS (Antiguo diseño) ---
  const AccountList = ({ data }: { data: any[] }) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.map((acc) => (
        <Card key={acc.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{acc.name}</CardTitle>
            {/* Badge con la sigla */}
            <div className="flex items-center justify-center w-8 h-8 rounded bg-gray-100 border font-bold text-xs text-gray-700">
                {acc.icon}
            </div>
          </CardHeader>
          <CardContent>
            {/* APLICAMOS EL COLOR AQUÍ */}
            <div className={`text-2xl font-bold ${getBalanceColor(acc.current_balance)}`}>
              {formatCurrency(acc.current_balance)}
            </div>
            <p className="text-xs text-muted-foreground">Saldo disponible</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
  
  // --- LISTA DE TRANSACCIONES ---
  const TransactionList = ({ data }: { data: any[] }) => {
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
                    {tx.type === 'INGRESO' && <ArrowUpRight className="h-5 w-5 text-green-600" />}
                    {tx.type === 'GASTO' && <ArrowDownRight className="h-5 w-5 text-red-600" />}
                    {tx.type === 'APORTE' && <ArrowRightLeft className="h-5 w-5 text-blue-600" />}
                    
                    <p className="text-sm font-medium leading-none">{tx.description}</p>
                  </div>
                  
                  {tx.notes && <p className="text-xs text-gray-400 italic pl-7 truncate max-w-[200px]">{tx.notes}</p>}
                  <p className="text-xs text-muted-foreground pl-7">
                    {formatDate(tx.date)} • {tx.created_by_profile?.email.split('@')[0]}
                  </p>
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