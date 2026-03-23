'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Wallet, Users, TrendingUp, Loader2, PlusCircle } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/formatters'

export default function Dashboard() {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading]       = useState(true)
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
        const balance = lines ? lines.reduce((s: number, l: any) => s + l.amount, 0) : 0
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

  /* ─────────────────────────────────────────
     TARJETAS DE CUENTAS
  ───────────────────────────────────────── */
  const AccountList = ({ data }: { data: any[] }) => {
    const total = data.reduce((s, a) => s + (a.current_balance ?? 0), 0)

    return (
      <div className="space-y-4">

        {/* ── Hero: Patrimonio total ── */}
        <div style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #1e40af 100%)' }}
          className="rounded-2xl p-6 text-white shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 opacity-80" />
            <span className="text-sm font-semibold opacity-80">Patrimonio Total</span>
          </div>
          <p className="text-4xl font-black tracking-tight leading-none">
            {formatCurrency(total)}
          </p>
          <p className="text-blue-200 text-xs mt-2">
            {data.length} cuenta{data.length !== 1 ? 's' : ''} activa{data.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* ── Grid de cuentas individuales ── */}
        {data.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">
            No tienes cuentas registradas aún.
          </p>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((acc) => {
              const isPositive = acc.current_balance >= 0
              return (
                <div key={acc.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                  {/* Fila superior: icono + badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-sm text-slate-600">
                      {acc.icon}
                    </div>
                    {isPositive ? (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        ↑ positivo
                      </span>
                    ) : (
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                        ↓ negativo
                      </span>
                    )}
                  </div>
                  {/* Nombre */}
                  <p className="text-sm font-semibold text-slate-500 mb-1">{acc.name}</p>
                  {/* Saldo */}
                  {isPositive ? (
                    <p className="text-xl font-extrabold text-slate-900 tracking-tight">
                      {formatCurrency(acc.current_balance)}
                    </p>
                  ) : (
                    <p className="text-xl font-extrabold text-red-600 tracking-tight">
                      {formatCurrency(acc.current_balance)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  /* ─────────────────────────────────────────
     LISTA DE TRANSACCIONES RECIENTES
  ───────────────────────────────────────── */
  const TransactionList = ({ data }: { data: any[] }) => (
    <Card className="bg-white border-slate-200 shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Últimos Movimientos</CardTitle>
            <CardDescription className="text-xs">
              {data.length} transacciones más recientes
            </CardDescription>
          </div>
          <Link href="/dashboard/movimientos">
            <Button variant="outline" size="sm"
              className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300 font-semibold">
              Ver todo →
            </Button>
          </Link>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        {data.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">
            No hay movimientos registrados aún.
          </p>
        ) : (
          <div>
            {data.map((tx, i) => (
              <div key={tx.id}
                className={`flex items-center gap-3 py-3 ${i < data.length - 1 ? 'border-b border-slate-100' : ''}`}>

                {/* Icono tipo transacción */}
                {tx.type === 'INGRESO' && (
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
                {tx.type === 'GASTO' && (
                  <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                  </div>
                )}
                {tx.type === 'APORTE' && (
                  <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                    <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                  </div>
                )}

                {/* Descripción + fecha */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate leading-snug">
                    {tx.description}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(tx.date)} · {tx.created_by_profile?.email?.split('@')[0]}
                  </p>
                </div>

                {/* Botón editar */}
                <button
                  onClick={() => router.push(`/dashboard/movimiento/${tx.id}`)}
                  className="text-xs font-semibold text-slate-400 hover:text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-lg transition-colors shrink-0">
                  Editar
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )

  /* ── Loading ── */
  const LoadingState = () => (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
      <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      <span className="text-sm">Calculando saldos...</span>
    </div>
  )

  /* ─────────────────────────────────────────
     RENDER PRINCIPAL
  ───────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            Resumen
          </h2>
          <p className="text-slate-400 text-sm mt-0.5">Vista general de tus finanzas</p>
        </div>
        <Link href="/dashboard/transaccion">
          <button className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-bold px-4 py-2.5 rounded-xl shadow-sm transition-colors">
            <PlusCircle className="w-4 h-4" /> Nueva
          </button>
        </Link>
      </div>

      {/* Tabs Personal / Familiar */}
      <Tabs defaultValue="personal" className="space-y-5">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-auto">
          <TabsTrigger value="personal"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm
              data-[state=inactive]:text-slate-500">
            <Wallet className="w-4 h-4" /> Personal
          </TabsTrigger>
          <TabsTrigger value="shared"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold
              data-[state=active]:bg-white data-[state=active]:text-blue-700 data-[state=active]:shadow-sm
              data-[state=inactive]:text-slate-500">
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
