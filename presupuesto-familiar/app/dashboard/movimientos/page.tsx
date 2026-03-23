'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, ArrowLeft, Wallet, Users, Loader2, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/formatters' // Importamos las utilidades

const generateRecentMonths = () => {
    const months = []
    const date = new Date()
    for (let i = 0; i < 12; i++) {
        const d = new Date(date.getFullYear(), date.getMonth() - i, 1)
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const name = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(d)
        months.push({ value, name: name.charAt(0).toUpperCase() + name.slice(1) })
    }
    return months
}

export default function HistorialPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [scope, setScope] = useState('PERSONAL')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(0)
  const ITEMS_PER_PAGE = 20

  const [monthFilter, setMonthFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [availableMonths] = useState(generateRecentMonths())

  const fetchTransactions = async (pageNumber: number, isNewScope: boolean = false) => {
    if (isNewScope) setLoading(true)
    else setLoadingMore(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const from = pageNumber * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    let query = supabase
        .from('transactions')
        .select(`*, created_by_profile:profiles(email), lines:transaction_lines(amount, account:accounts(name, icon))`)
        .order('date', { ascending: false })
        .range(from, to)
    
    if (scope === 'PERSONAL') {
        query = query.eq('scope', 'PERSONAL').eq('created_by', user.id)
    } else {
        query = query.eq('scope', 'SHARED')
    }

    if (typeFilter !== 'ALL') query = query.eq('type', typeFilter)

    if (monthFilter !== 'ALL') {
        const [year, month] = monthFilter.split('-')
        const startDate = `${year}-${month}-01`
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10)
        query = query.gte('date', startDate).lte('date', endDate + 'T23:59:59')
    }

    const { data } = await query
    
    if (data) {
        if (isNewScope || pageNumber === 0) setTransactions(data)
        else setTransactions(prev => [...prev, ...data])
        if (data.length < ITEMS_PER_PAGE) setHasMore(false)
        else setHasMore(true)
    }

    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    setPage(0)
    setHasMore(true)
    fetchTransactions(0, true)
  }, [scope, monthFilter, typeFilter])

  const handleLoadMore = () => {
      const nextPage = page + 1
      setPage(nextPage)
      fetchTransactions(nextPage, false)
  }

  const TransactionList = () => (
    <div className="space-y-4">
        {transactions.map((tx) => {
            const originLine = tx.lines?.find((l: any) => l.amount < 0)
            const destLine = tx.lines?.find((l: any) => l.amount > 0)
            const rawAmount = destLine ? destLine.amount : (originLine ? Math.abs(originLine.amount) : 0)
            
            const originName = originLine?.account ? `${originLine.account.icon || ''} ${originLine.account.name}` : 'Desconocido'
            const destName = destLine?.account ? `${destLine.account.icon || ''} ${destLine.account.name}` : 'Desconocido'

            return (
                <Card key={tx.id} className="hover:border-primary/50 transition-all overflow-hidden border-border bg-card shadow-md">
                    <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
                            
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2">
                                    {tx.type === 'INGRESO' && <ArrowUpRight className="h-5 w-5 text-emerald-400" />}
                                    {tx.type === 'GASTO' && <ArrowDownRight className="h-5 w-5 text-rose-500" />}
                                    {tx.type === 'APORTE' && <ArrowRightLeft className="h-5 w-5 text-cyan-400" />}
                                    <p className="font-bold text-foreground text-lg tracking-tight">{tx.description}</p>
                                </div>
                                
                                <div className="pl-7">
                                    <div className="inline-flex items-center text-xs font-medium text-muted-foreground bg-secondary px-2 py-1.5 rounded border border-border">
                                        <span className="truncate max-w-[120px] sm:max-w-[200px]">{originName}</span> 
                                        <ArrowRight className="w-3 h-3 mx-2 text-muted-foreground shrink-0" /> 
                                        <span className="truncate max-w-[120px] sm:max-w-[200px]">{destName}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:gap-4 pl-7 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">📅 {formatDate(tx.date)}</span>
                                    <span className="flex items-center gap-1 mt-1 sm:mt-0">👤 {tx.created_by_profile?.email.split('@')[0]}</span>
                                </div>
                                
                                {tx.notes && (
                                    <p className="text-xs text-muted-foreground italic pl-7 truncate max-w-[300px] border-l-2 border-border ml-[29px] pl-2">
                                        "{tx.notes}"
                                    </p>
                                )}
                            </div>

                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center pl-7 md:pl-0 border-t border-border md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0 gap-3">
                                <div className={`font-black text-xl md:text-right tracking-tight ${tx.type === 'GASTO' ? 'text-rose-500' : tx.type === 'INGRESO' ? 'text-emerald-400' : 'text-cyan-400'}`}>
                                    {tx.type === 'GASTO' ? '-' : (tx.type === 'INGRESO' ? '+' : '')} {formatCurrency(rawAmount)}
                                </div>
                                
                                <Button variant="secondary" size="sm" className="h-8 shadow-sm hover:bg-primary hover:text-primary-foreground transition-colors" onClick={() => router.push(`/dashboard/movimiento/${tx.id}`)}>
                                    Modificar
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )
        })}

        {hasMore && (
            <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={handleLoadMore} disabled={loadingMore} className="text-primary hover:text-primary-foreground hover:bg-primary border-primary/50 w-full sm:w-auto transition-all">
                    {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '⬇ Cargar movimientos anteriores'}
                </Button>
            </div>
        )}
        
        {!hasMore && transactions.length > 0 && <p className="text-center text-xs text-muted-foreground pt-6 pb-4">Has llegado al final del historial.</p>}
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6 pb-20">
      
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
            <Button variant="outline" size="icon" className="shrink-0 border-border text-foreground hover:bg-secondary"><ArrowLeft className="h-4 w-4"/></Button>
        </Link>
        <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Historial Detallado</h2>
            <p className="text-sm text-muted-foreground">Encuentra y modifica cualquier movimiento.</p>
        </div>
      </div>

      <Tabs defaultValue="PERSONAL" onValueChange={setScope} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] bg-secondary border border-border">
          <TabsTrigger value="PERSONAL" className="flex gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Wallet className="w-4 h-4"/> Personal</TabsTrigger>
          <TabsTrigger value="SHARED" className="flex gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Users className="w-4 h-4"/> Familiar</TabsTrigger>
        </TabsList>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-card p-4 rounded-xl border border-border shadow-lg">
            <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filtrar por Mes</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger className="bg-secondary border-border text-foreground hover:bg-secondary/80 transition-colors">
                        <SelectValue placeholder="Seleccionar mes" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                        <SelectItem value="ALL">🗓️ Todos los meses</SelectItem>
                        {availableMonths.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filtrar por Tipo</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="bg-secondary border-border text-foreground hover:bg-secondary/80 transition-colors">
                        <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                        <SelectItem value="ALL">📁 Todos los movimientos</SelectItem>
                        <SelectItem value="GASTO">📉 Solo Gastos</SelectItem>
                        <SelectItem value="INGRESO">📈 Solo Ingresos</SelectItem>
                        <SelectItem value="APORTE">🔄 Solo Transferencias</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <TabsContent value="PERSONAL" className="space-y-4">
            {loading ? <div className="py-20 flex flex-col items-center text-primary"><Loader2 className="w-8 h-8 animate-spin mb-4"/> Buscando...</div> : <TransactionList />}
            {!loading && transactions.length === 0 && <div className="py-20 text-center bg-card rounded-xl border border-dashed border-border text-muted-foreground">No se encontraron movimientos. 🕵️‍♂️</div>}
        </TabsContent>
        
        <TabsContent value="SHARED" className="space-y-4">
            {loading ? <div className="py-20 flex flex-col items-center text-primary"><Loader2 className="w-8 h-8 animate-spin mb-4"/> Buscando...</div> : <TransactionList />}
            {!loading && transactions.length === 0 && <div className="py-20 text-center bg-card rounded-xl border border-dashed border-border text-muted-foreground">No se encontraron movimientos. 🕵️‍♂️</div>}
        </TabsContent>
      </Tabs>
    </div>
  )
}