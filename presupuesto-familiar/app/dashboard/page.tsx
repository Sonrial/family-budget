'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Wallet, Users } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/formatters' // Usando nuestras nuevas utilidades

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

    const loadDataByScope = async (scope: string) => {
        let accQuery = supabase.from('accounts').select('*').eq('scope', scope).eq('type', 'ASSET')
        if (scope === 'PERSONAL') accQuery = accQuery.eq('user_id', user.id)
        
        const { data: accountsRaw } = await accQuery
        const accounts = accountsRaw || []

        const accountsWithBalance = await Promise.all(accounts.map(async (acc) => {
            const { data: lines } = await supabase
                .from('transaction_lines')
                .select('amount')
                .eq('account_id', acc.id)
            
            const balance = lines ? lines.reduce((sum, line) => sum + line.amount, 0) : 0
            return { ...acc, current_balance: balance }
        }))

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

  // Colores adaptados para modo oscuro
  const getBalanceColor = (amount: number) => {
      if (amount > 0) return 'text-emerald-400' 
      if (amount < 0) return 'text-rose-500'   
      return 'text-foreground'                  
  }

  const AccountList = ({ data }: { data: any[] }) => (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.map((acc) => (
        <Card key={acc.id} className="border-border bg-card shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{acc.name}</CardTitle>
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary border border-border font-bold text-xs text-primary">
                {acc.icon}
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold tracking-tight ${getBalanceColor(acc.current_balance)}`}>
              {formatCurrency(acc.current_balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Saldo disponible</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
  
  const TransactionList = ({ data }: { data: any[] }) => {
    return (
      <Card className="mt-6 border-border bg-card shadow-lg">
        <CardHeader>
          <CardTitle className="text-foreground">Últimos Movimientos</CardTitle>
          <CardDescription className="text-muted-foreground">Tus transacciones recientes.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.length === 0 && <p className="text-sm text-muted-foreground">No hay movimientos.</p>}
            
            {data.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between border-b border-border pb-3 last:border-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {tx.type === 'INGRESO' && <ArrowUpRight className="h-5 w-5 text-emerald-400" />}
                    {tx.type === 'GASTO' && <ArrowDownRight className="h-5 w-5 text-rose-500" />}
                    {tx.type === 'APORTE' && <ArrowRightLeft className="h-5 w-5 text-cyan-400" />}
                    
                    <p className="text-sm font-medium leading-none text-foreground">{tx.description}</p>
                  </div>
                  
                  {tx.notes && <p className="text-xs text-muted-foreground italic pl-7 truncate max-w-[200px]">{tx.notes}</p>}
                  <p className="text-xs text-muted-foreground pl-7 mt-1">
                    {formatDate(tx.date)} • {tx.created_by_profile?.email.split('@')[0]}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" className="h-8 text-xs hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => router.push(`/dashboard/movimiento/${tx.id}`)}>
                    Ver / Editar
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {data.length > 0 && (
              <div className="mt-6 pt-4 border-t border-border text-center">
                  <Link href="/dashboard/movimientos">
                    <Button variant="ghost" className="text-primary hover:text-primary-foreground hover:bg-primary w-full sm:w-auto transition-all">
                        Ver todo el historial histórico →
                    </Button>
                  </Link>
              </div>
          )}

        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h2>
      </div>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="bg-secondary border border-border">
          <TabsTrigger value="personal" className="flex gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Wallet className="w-4 h-4"/> Personal</TabsTrigger>
          <TabsTrigger value="shared" className="flex gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Users className="w-4 h-4"/> Familiar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="personal" className="space-y-4">
          {loading ? <p className="text-muted-foreground animate-pulse">Calculando saldos...</p> : (
            <>
              <AccountList data={personalData.accounts} />
              <TransactionList data={personalData.transactions} />
            </>
          )}
        </TabsContent>
        
        <TabsContent value="shared" className="space-y-4">
          {loading ? <p className="text-muted-foreground animate-pulse">Calculando saldos...</p> : (
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