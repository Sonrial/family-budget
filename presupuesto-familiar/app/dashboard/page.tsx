'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Wallet, Users, TrendingUp, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/formatters'

export default function Dashboard() {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading] = useState(true)
  const [personalData, setPersonalData] = useState({ accounts: [] as any[], transactions: [] as any[] })
  const [sharedData,   setSharedData]   = useState({ accounts: [] as any[], transactions: [] as any[] })

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
          .from('transaction_lines').select('amount').eq('account_id', acc.id)
        const balance = lines ? lines.reduce((s, l) => s + l.amount, 0) : 0
        return { ...acc, current_balance: balance }
      }))

      let txQuery = supabase
        .from('transactions')
        .select('*, created_by_profile:profiles(email)')
        .eq('scope', scope)
        .order('date', { ascending: false })
        .limit(8)
      if (scope === 'PERSONAL') txQuery = txQuery.eq('created_by', user.id)
      const { data: transactions } = await txQuery

      return { accounts: accountsWithBalance, transactions: transactions || [] }
    }

    const [pData, sData] = await Promise.all([
      loadDataByScope('PERSONAL'),
      loadDataByScope('SHARED'),
    ])
    setPersonalData(pData)
    setSharedData(sData)
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  /* ── Tarjetas de cuentas ── */
  const AccountList = ({ data }: { data: any[] }) => {
    const total = data.reduce((s, a) => s + (a.current_balance ?? 0), 0)

    return (
      <div className="space-y-4">
        {/* Tarjeta total */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-200">
          <p className="text-blue-100 text-sm font-medium mb-1 flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" /> Patrimonio Total
          </p>
          <p className="text-3xl font-extrabold tracking-tight">{formatCurrency(total)}</p>
          <p className="text-blue-200 text-xs mt-1">{data.length} cuenta{data.length !== 1 ? 's' : ''} registrada{data.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Grid cuentas individuales */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((acc) => {
            const positive = acc.current_balance >= 0
            return (
              <Card key={acc.id} className="bg-white hover:shadow-md transition-shadow border-slate-200">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 font-bold text-sm text-slate-700 border border-slate-200">
                      {acc.icon}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${positive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {positive ? '↑ positivo' : '↓ negativo'}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 mb-0.5">{acc.name}</p>
                  <p className={`text-xl font-extrabold tracking-tight ${positive ? 'text-slate-800' : 'text-red-600'}`}>
                    {formatCurrency(acc.current_balance)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    )
  }

  /* ── Lista de transacciones recientes ── */
  const TransactionList = ({ data }: { data: any[] }) => (
    <Card className="mt-4 bg-white border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Últimos Movimientos</CardTitle>
            <CardDescription>Las {data.length} transacciones más recientes</CardDescription>
          </div>
          <Link href="/dashboard/movimientos">
            <Button variant="outline" size="sm" className="text-blue-600 border-blue-200 hover:bg-blue-50 text-xs">
              Ver todo →
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {data.length === 0
          ? <p className="text-sm text-slate-400 text-center py-8">No hay movimientos registrados aún.</p>
          : (
            <div className="space-y-0">
              {data.map((tx, i) => (
                <div key={tx.id}
                  className={`flex items-center justify-between py-3 ${i < data.length - 1 ? 'border-b border-slate-100' : ''}`}>
                  {/* Icono tipo */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mr-3
                    ${tx.type === 'INGRESO' ? 'bg-green-50' : tx.type === 'GASTO' ? 'bg-red-50' : 'bg-blue-50'}`}>
                    {tx.type === 'INGRESO' && <ArrowUpRight   className="h-4 w-4 text-green-600" />}
                    {tx.type === 'GASTO'   && <ArrowDownRight className="h-4 w-4 text-red-600"   />}
                    {tx.type === 'APORTE'  && <ArrowRightLeft  className="h-4 w-4 text-blue-600"  />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{tx.description}</p>
                    <p className="text-xs text-slate-400">
                      {formatDate(tx.date)} · {tx.created_by_profile?.email.split('@')[0]}
                    </p>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2 ml-2 shrink-0">
                    <Button variant="ghost" size="sm"
                      className="h-7 text-xs text-slate-500 hover:text-blue-600 hover:bg-blue-50 px-2"
                      onClick={() => router.push(`/dashboard/movimiento/${tx.id}`)}>
                      Editar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </CardContent>
    </Card>
  )

  /* ── Loading state ── */
  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      <span className="text-sm">Calculando saldos...</span>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">Resumen</h2>
          <p className="text-slate-500 text-sm mt-0.5">Vista general de tus finanzas</p>
        </div>
        <Link href="/dashboard/transaccion">
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm text-sm gap-1.5">
            <ArrowUpRight className="w-4 h-4" /> Nueva
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="personal" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="personal"
            className="flex gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <Wallet className="w-4 h-4" /> Personal
          </TabsTrigger>
          <TabsTrigger value="shared"
            className="flex gap-2 data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-lg">
            <Users className="w-4 h-4" /> Familiar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-4 mt-0">
          {loading ? <LoadingState /> : (
            <>
              <AccountList data={personalData.accounts} />
              <TransactionList data={personalData.transactions} />
            </>
          )}
        </TabsContent>

        <TabsContent value="shared" className="space-y-4 mt-0">
          {loading ? <LoadingState /> : (
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
