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

// Utilidad para formatear dinero
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// Utilidad para la fecha
const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.substring(0, 10).split('-')
    return `${day}/${month}/${year}`
}

// Generador Dinámico de Meses (Para que no tengas que actualizarlos a mano)
const generateRecentMonths = () => {
    const months = []
    const date = new Date()
    for (let i = 0; i < 12; i++) {
        const d = new Date(date.getFullYear(), date.getMonth() - i, 1)
        const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const name = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(d)
        // Capitalizamos la primera letra
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

  // --- NUEVOS ESTADOS DE FILTRO ---
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

    // AÑADIMOS LA RELACIÓN 'lines:transaction_lines' PARA TRAER LAS CUENTAS (ORIGEN Y DESTINO)
    let query = supabase
        .from('transactions')
        .select(`
            *, 
            created_by_profile:profiles(email),
            lines:transaction_lines(amount, account:accounts(name, icon))
        `)
        .order('date', { ascending: false })
        .range(from, to)
    
    if (scope === 'PERSONAL') {
        query = query.eq('scope', 'PERSONAL').eq('created_by', user.id)
    } else {
        query = query.eq('scope', 'SHARED')
    }

    // APLICAR FILTRO DE TIPO
    if (typeFilter !== 'ALL') {
        query = query.eq('type', typeFilter)
    }

    // APLICAR FILTRO DE MES
    if (monthFilter !== 'ALL') {
        const [year, month] = monthFilter.split('-')
        const startDate = `${year}-${month}-01`
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10)
        query = query.gte('date', startDate).lte('date', endDate + 'T23:59:59')
    }

    const { data } = await query
    
    if (data) {
        if (isNewScope || pageNumber === 0) {
            setTransactions(data)
        } else {
            setTransactions(prev => [...prev, ...data])
        }
        
        if (data.length < ITEMS_PER_PAGE) setHasMore(false)
        else setHasMore(true)
    }

    setLoading(false)
    setLoadingMore(false)
  }

  // Si cambia un filtro o la pestaña, volvemos a la página 0 y buscamos de nuevo
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

  // --- COMPONENTE DE LA LISTA VISUAL ---
  const TransactionList = () => (
    <div className="space-y-4">
        {transactions.map((tx) => {
            // LÓGICA PARA IDENTIFICAR ORIGEN Y DESTINO
            // La cuenta que resta (-) es el origen. La que suma (+) es el destino.
            const originLine = tx.lines?.find((l: any) => l.amount < 0)
            const destLine = tx.lines?.find((l: any) => l.amount > 0)
            
            // Calculamos el valor base para mostrarlo en grande
            const rawAmount = destLine ? destLine.amount : (originLine ? Math.abs(originLine.amount) : 0)
            
            // Extraemos los nombres y los iconos
            const originName = originLine?.account ? `${originLine.account.icon || ''} ${originLine.account.name}` : 'Desconocido'
            const destName = destLine?.account ? `${destLine.account.icon || ''} ${destLine.account.name}` : 'Desconocido'

            return (
                <Card key={tx.id} className="hover:bg-gray-50 transition-colors overflow-hidden border-gray-200">
                    <CardContent className="p-0">
                        <div className="flex flex-col md:flex-row md:items-center justify-between p-4 gap-4">
                            
                            {/* Lado Izquierdo (Icono, Título, Cuentas y Fecha) */}
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-2">
                                    {tx.type === 'INGRESO' && <ArrowUpRight className="h-5 w-5 text-green-600" />}
                                    {tx.type === 'GASTO' && <ArrowDownRight className="h-5 w-5 text-red-600" />}
                                    {tx.type === 'APORTE' && <ArrowRightLeft className="h-5 w-5 text-blue-600" />}
                                    
                                    <p className="font-bold text-gray-900 text-lg tracking-tight">{tx.description}</p>
                                </div>
                                
                                {/* CAJITA DE ORIGEN -> DESTINO */}
                                <div className="pl-7">
                                    <div className="inline-flex items-center text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1.5 rounded border border-gray-200">
                                        <span className="truncate max-w-[120px] sm:max-w-[200px]" title={originName}>{originName}</span> 
                                        <ArrowRight className="w-3 h-3 mx-2 text-gray-400 shrink-0" /> 
                                        <span className="truncate max-w-[120px] sm:max-w-[200px]" title={destName}>{destName}</span>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row sm:gap-4 pl-7 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">📅 {formatDate(tx.date)}</span>
                                    <span className="flex items-center gap-1 mt-1 sm:mt-0">👤 {tx.created_by_profile?.email.split('@')[0]}</span>
                                </div>
                                
                                {tx.notes && (
                                    <p className="text-xs text-gray-500 italic pl-7 truncate max-w-[300px] border-l-2 border-gray-300 ml-[29px] pl-2">
                                        "{tx.notes}"
                                    </p>
                                )}
                            </div>

                            {/* Lado Derecho (Monto en grande y Botón) */}
                            <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center pl-7 md:pl-0 border-t md:border-t-0 pt-3 md:pt-0 mt-2 md:mt-0 gap-3">
                                
                                <div className={`font-black text-xl md:text-right tracking-tight ${tx.type === 'GASTO' ? 'text-red-600' : tx.type === 'INGRESO' ? 'text-green-600' : 'text-blue-600'}`}>
                                    {tx.type === 'GASTO' ? '-' : (tx.type === 'INGRESO' ? '+' : '')} {formatCurrency(rawAmount)}
                                </div>
                                
                                <Button variant="outline" size="sm" className="h-8 shadow-sm hover:bg-gray-100" onClick={() => router.push(`/dashboard/movimiento/${tx.id}`)}>
                                    Modificar
                                </Button>
                            </div>

                        </div>
                    </CardContent>
                </Card>
            )
        })}

        {/* BOTÓN CARGAR MÁS */}
        {hasMore && (
            <div className="flex justify-center pt-4">
                <Button 
                    variant="outline" 
                    onClick={handleLoadMore} 
                    disabled={loadingMore}
                    className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 w-full sm:w-auto border-blue-200"
                >
                    {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '⬇ Cargar movimientos anteriores'}
                </Button>
            </div>
        )}
        
        {!hasMore && transactions.length > 0 && (
            <p className="text-center text-xs text-gray-400 pt-6 pb-4">Has llegado al final del historial.</p>
        )}
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl mx-auto py-6 pb-20">
      
      {/* CABECERA */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
            <Button variant="outline" size="icon" className="shrink-0"><ArrowLeft className="h-4 w-4"/></Button>
        </Link>
        <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">Historial Detallado</h2>
            <p className="text-sm text-gray-500">Encuentra y modifica cualquier movimiento.</p>
        </div>
      </div>

      <Tabs defaultValue="PERSONAL" onValueChange={setScope} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="PERSONAL" className="flex gap-2"><Wallet className="w-4 h-4"/> Personal</TabsTrigger>
          <TabsTrigger value="SHARED" className="flex gap-2"><Users className="w-4 h-4"/> Familiar</TabsTrigger>
        </TabsList>
        
        {/* --- BARRA DE FILTROS INTELIGENTES --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filtrar por Mes</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger className="bg-gray-50/50 hover:bg-gray-100 transition-colors">
                        <SelectValue placeholder="Seleccionar mes" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">🗓️ Todos los meses</SelectItem>
                        {/* Imprimimos los últimos 12 meses automáticamente */}
                        {availableMonths.map((m) => (
                            <SelectItem key={m.value} value={m.value}>{m.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            
            <div className="space-y-1.5">
                <Label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Filtrar por Tipo</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="bg-gray-50/50 hover:bg-gray-100 transition-colors">
                        <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="ALL">📁 Todos los movimientos</SelectItem>
                        <SelectItem value="GASTO">📉 Solo Gastos</SelectItem>
                        <SelectItem value="INGRESO">📈 Solo Ingresos</SelectItem>
                        <SelectItem value="APORTE">🔄 Solo Transferencias</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>

        <TabsContent value="PERSONAL" className="space-y-4">
            {loading ? (
                <div className="py-20 text-center text-gray-500 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500"/> Buscando movimientos...
                </div>
            ) : <TransactionList />}
            
            {!loading && transactions.length === 0 && (
                <div className="py-20 text-center bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
                    No se encontraron movimientos con estos filtros. 🕵️‍♂️
                </div>
            )}
        </TabsContent>
        
        <TabsContent value="SHARED" className="space-y-4">
            {loading ? (
                <div className="py-20 text-center text-gray-500 flex flex-col items-center">
                    <Loader2 className="w-8 h-8 animate-spin mb-4 text-blue-500"/> Buscando movimientos...
                </div>
            ) : <TransactionList />}
            
            {!loading && transactions.length === 0 && (
                <div className="py-20 text-center bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">
                    No se encontraron movimientos familiares con estos filtros. 🕵️‍♂️
                </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  )
}