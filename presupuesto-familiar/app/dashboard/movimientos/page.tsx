'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, ArrowLeft, Wallet, Users, Loader2 } from 'lucide-react'
import Link from 'next/link'

// --- UTILIDADES (Las mismas del Dashboard) ---
const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const [year, month, day] = dateString.substring(0, 10).split('-')
    return `${day}/${month}/${year}`
}

export default function HistorialPage() {
  const supabase = createClient()
  const router = useRouter()
  
  const [scope, setScope] = useState('PERSONAL')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true) // ¿Hay más por cargar?
  const [page, setPage] = useState(0) // Página actual (0, 1, 2...)
  const ITEMS_PER_PAGE = 20 // Cantidad a cargar por tanda

  // Función para cargar datos (soporta paginación)
  const fetchTransactions = async (pageNumber: number, isNewScope: boolean = false) => {
    if (isNewScope) setLoading(true)
    else setLoadingMore(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Calculamos el rango (0-19, 20-39, etc.)
    const from = pageNumber * ITEMS_PER_PAGE
    const to = from + ITEMS_PER_PAGE - 1

    let query = supabase
        .from('transactions')
        .select('*, created_by_profile:profiles(email)')
        .eq('scope', isNewScope ? scope : scope) // Aseguramos usar el scope actual
        .order('date', { ascending: false })
        .range(from, to)
    
    // Si es personal, filtramos por usuario
    if ((isNewScope ? scope : scope) === 'PERSONAL') {
        query = query.eq('created_by', user.id)
    } else {
        query = query.eq('scope', 'SHARED') // Familiar
    }

    const { data } = await query
    
    if (data) {
        if (isNewScope) {
            setTransactions(data) // Reemplazamos todo si cambiamos de pestaña
        } else {
            setTransactions(prev => [...prev, ...data]) // Agregamos al final si es "Cargar más"
        }
        
        // Si llegaron menos datos de los que pedimos, es que ya no hay más
        if (data.length < ITEMS_PER_PAGE) setHasMore(false)
        else setHasMore(true)
    }

    setLoading(false)
    setLoadingMore(false)
  }

  // Cargar al inicio o al cambiar de pestaña
  useEffect(() => {
    setPage(0)
    setHasMore(true)
    fetchTransactions(0, true)
  }, [scope])

  const handleLoadMore = () => {
      const nextPage = page + 1
      setPage(nextPage)
      fetchTransactions(nextPage, false)
  }

  // --- LISTA VISUAL ---
  const TransactionList = () => (
    <div className="space-y-4">
        {transactions.map((tx) => (
            <Card key={tx.id} className="hover:bg-gray-50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {tx.type === 'INGRESO' && <ArrowUpRight className="h-5 w-5 text-green-600" />}
                            {tx.type === 'GASTO' && <ArrowDownRight className="h-5 w-5 text-red-600" />}
                            {tx.type === 'APORTE' && <ArrowRightLeft className="h-5 w-5 text-blue-600" />}
                            
                            <p className="font-medium text-gray-900">{tx.description}</p>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:gap-4 pl-7 text-xs text-muted-foreground">
                            <span>📅 {formatDate(tx.date)}</span>
                            <span>👤 {tx.created_by_profile?.email.split('@')[0]}</span>
                        </div>
                        {tx.notes && <p className="text-xs text-gray-400 italic pl-7 truncate max-w-[300px]">{tx.notes}</p>}
                    </div>

                    <div className="flex items-center gap-4">
                        {/* No mostramos el monto aquí para no saturar, pero podrías agregarlo si quieres */}
                        <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/movimiento/${tx.id}`)}>
                            Ver Detalles
                        </Button>
                    </div>
                </CardContent>
            </Card>
        ))}

        {/* BOTÓN CARGAR MÁS */}
        {hasMore && (
            <div className="flex justify-center pt-4">
                <Button 
                    variant="ghost" 
                    onClick={handleLoadMore} 
                    disabled={loadingMore}
                    className="text-blue-600 hover:text-blue-800"
                >
                    {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : '⬇ Cargar más antiguos'}
                </Button>
            </div>
        )}
        
        {!hasMore && transactions.length > 0 && (
            <p className="text-center text-xs text-gray-400 pt-4">No hay más movimientos registrados.</p>
        )}
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5"/></Button>
        </Link>
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">Historial de Movimientos</h2>
      </div>

      <Tabs defaultValue="PERSONAL" onValueChange={setScope} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="PERSONAL" className="flex gap-2"><Wallet className="w-4 h-4"/> Personal</TabsTrigger>
          <TabsTrigger value="SHARED" className="flex gap-2"><Users className="w-4 h-4"/> Familiar</TabsTrigger>
        </TabsList>
        
        <TabsContent value="PERSONAL" className="space-y-4">
            {loading ? <div className="p-10 text-center text-gray-500">Cargando historial...</div> : <TransactionList />}
            {!loading && transactions.length === 0 && <div className="p-10 text-center bg-white rounded border">No tienes movimientos aún.</div>}
        </TabsContent>
        
        <TabsContent value="SHARED" className="space-y-4">
            {loading ? <div className="p-10 text-center text-gray-500">Cargando historial...</div> : <TransactionList />}
            {!loading && transactions.length === 0 && <div className="p-10 text-center bg-white rounded border">No hay movimientos familiares.</div>}
        </TabsContent>
      </Tabs>
    </div>
  )
}