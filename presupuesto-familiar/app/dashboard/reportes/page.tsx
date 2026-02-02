'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { Wallet, Users, TrendingUp, TrendingDown, PiggyBank, Loader2, AlertCircle } from 'lucide-react'

// Colores vibrantes y modernos
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CO', { 
    style: 'currency', 
    currency: 'COP', 
    minimumFractionDigits: 0 
  }).format(amount)
}

// Tooltip Personalizado para las gráficas
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 border rounded-lg shadow-lg text-sm">
        <p className="font-bold text-gray-700">{label ? label : payload[0].name}</p>
        <p className="text-blue-600 font-mono">
          {formatCurrency(payload[0].value)}
        </p>
      </div>
    )
  }
  return null
}

export default function ReportesPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [scope, setScope] = useState('PERSONAL')
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
      const now = new Date()
      return now.toISOString().slice(0, 7)
  })

  const [pieData, setPieData] = useState<any[]>([])
  const [barData, setBarData] = useState<any[]>([])
  const [topExpenses, setTopExpenses] = useState<any[]>([]) // <--- NUEVO: Top 5 Gastos
  const [kpis, setKpis] = useState({ income: 0, expense: 0, savings: 0, savingsRate: 0 })

  const fetchReportData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [year, month] = selectedMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0,10)

    let query = supabase
        .from('transactions')
        .select(`
            id, type, description, date, amount:transaction_lines(amount, account:accounts(name, type))
        `)
        .gte('date', startDate)
        .lte('date', endDate + 'T23:59:59')
        .eq('scope', scope)
    
    if (scope === 'PERSONAL') query = query.eq('created_by', user.id)
    
    const { data: transactions } = await query

    if (transactions) {
        let totalIncome = 0
        let totalExpense = 0
        const expensesByCategory: Record<string, number> = {}
        const individualExpenses: any[] = [] // Para el Top 5

        transactions.forEach((tx: any) => {
            if (tx.type === 'GASTO') {
                const categoryLine = tx.amount.find((line: any) => line.amount > 0)
                const amount = categoryLine ? categoryLine.amount : 0
                const categoryName = categoryLine?.account?.name || 'Otros'

                totalExpense += amount
                
                // Agrupar por categoría
                if (expensesByCategory[categoryName]) {
                    expensesByCategory[categoryName] += amount
                } else {
                    expensesByCategory[categoryName] = amount
                }

                // Guardar para Top 5
                individualExpenses.push({
                    description: tx.description,
                    amount: amount,
                    date: tx.date,
                    category: categoryName
                })

            } else if (tx.type === 'INGRESO') {
                const incomeLine = tx.amount.find((line: any) => line.amount > 0)
                const amount = incomeLine ? incomeLine.amount : 0
                totalIncome += amount
            }
        })

        // Top 5 Gastos
        const sortedExpenses = individualExpenses
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5)

        // Datos Torta
        const pData = Object.keys(expensesByCategory).map(key => ({
            name: key,
            value: expensesByCategory[key],
            percent: totalExpense > 0 ? (expensesByCategory[key] / totalExpense) * 100 : 0
        })).sort((a, b) => b.value - a.value)

        // Datos Barras
        const bData = [
            { name: 'Ingresos', amount: totalIncome },
            { name: 'Gastos', amount: totalExpense }
        ]

        const savings = totalIncome - totalExpense
        const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0

        setPieData(pData)
        setBarData(bData)
        setTopExpenses(sortedExpenses)
        setKpis({ income: totalIncome, expense: totalExpense, savings, savingsRate })
    }
    setLoading(false)
  }

  useEffect(() => { fetchReportData() }, [scope, selectedMonth])

  // Componente KPI
  const KpiCard = ({ title, value, icon, color, subtext }: any) => (
      <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              {icon}
          </CardHeader>
          <CardContent>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
          </CardContent>
      </Card>
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-6 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Reportes Mensuales</h2>
        
        <div className="flex items-center gap-2 bg-white p-1 rounded-md border">
            <span className="text-sm font-medium text-gray-500 pl-2">Periodo:</span>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px] border-0 focus:ring-0">
                    <SelectValue placeholder="Mes" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="2026-01">Enero 2026</SelectItem>
                    <SelectItem value="2026-02">Febrero 2026</SelectItem>
                    <SelectItem value="2026-03">Marzo 2026</SelectItem>
                    <SelectItem value="2025-12">Diciembre 2025</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      <Tabs defaultValue="PERSONAL" onValueChange={setScope} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="PERSONAL" className="flex gap-2"><Wallet className="w-4 h-4"/> Personal</TabsTrigger>
          <TabsTrigger value="SHARED" className="flex gap-2"><Users className="w-4 h-4"/> Familiar</TabsTrigger>
        </TabsList>

        <TabsContent value={scope} className="space-y-6">
            {loading ? (
                <div className="h-64 flex items-center justify-center text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mr-2"/> Generando reporte...
                </div>
            ) : (
                <>
                    {/* 1. KPIs */}
                    <div className="grid gap-4 md:grid-cols-3">
                        <KpiCard 
                            title="Ingresos" 
                            value={formatCurrency(kpis.income)} 
                            icon={<TrendingUp className="h-4 w-4 text-green-600"/>}
                            color="text-green-600"
                        />
                        <KpiCard 
                            title="Gastos" 
                            value={formatCurrency(kpis.expense)} 
                            icon={<TrendingDown className="h-4 w-4 text-red-600"/>}
                            color="text-red-600"
                        />
                        <KpiCard 
                            title="Balance Neto" 
                            value={formatCurrency(kpis.savings)} 
                            icon={<PiggyBank className="h-4 w-4 text-blue-600"/>}
                            color={kpis.savings >= 0 ? "text-blue-600" : "text-red-600"}
                            subtext={`Margen de ahorro: ${kpis.savingsRate.toFixed(1)}%`}
                        />
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* 2. TORTA */}
                        <Card className="col-span-1 shadow-sm">
                            <CardHeader>
                                <CardTitle>Distribución de Gastos</CardTitle>
                                <CardDescription>Por categorías</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                {pieData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60} // Efecto Donut
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {pieData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <RechartsTooltip content={<CustomTooltip />} />
                                            <Legend verticalAlign="bottom" height={36}/>
                                        </PieChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-full flex items-center justify-center text-gray-400">Sin datos</div>
                                )}
                            </CardContent>
                        </Card>

                        {/* 3. FLUJO DE CAJA (BARRAS) */}
                        <Card className="col-span-1 shadow-sm">
                            <CardHeader>
                                <CardTitle>Flujo de Caja</CardTitle>
                                <CardDescription>Ingresos vs Egresos</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={barData} barSize={60}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                        <XAxis dataKey="name" tickLine={false} axisLine={false} />
                                        <YAxis hide />
                                        <RechartsTooltip content={<CustomTooltip />} cursor={{fill: 'transparent'}} />
                                        <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                                            {barData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#ef4444'} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </CardContent>
                        </Card>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                        {/* 4. TABLA DETALLE CON BARRAS DE PROGRESO */}
                        <Card className="shadow-sm">
                            <CardHeader><CardTitle>Detalle por Categoría</CardTitle></CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {pieData.map((cat, idx) => (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                                                    {cat.name}
                                                </span>
                                                <span className="text-gray-600">{formatCurrency(cat.value)}</span>
                                            </div>
                                            {/* Barra de progreso visual */}
                                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                                                <div 
                                                    className="h-full rounded-full" 
                                                    style={{ width: `${cat.percent}%`, backgroundColor: COLORS[idx % COLORS.length] }}
                                                ></div>
                                            </div>
                                            <p className="text-xs text-right text-gray-400">{cat.percent.toFixed(1)}%</p>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 5. NUEVO: TOP 5 GASTOS INDIVIDUALES */}
                        <Card className="shadow-sm">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5 text-orange-500" />
                                    Mayores Gastos
                                </CardTitle>
                                <CardDescription>Tus compras más altas del mes</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {topExpenses.length === 0 ? <p className="text-sm text-gray-400">No hay gastos.</p> : null}
                                    {topExpenses.map((tx, idx) => (
                                        <div key={idx} className="flex justify-between items-center border-b pb-3 last:border-0 last:pb-0">
                                            <div className="space-y-1">
                                                <p className="font-medium text-sm">{tx.description}</p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(tx.date).toLocaleDateString()} • {tx.category}
                                                </p>
                                            </div>
                                            <div className="font-bold text-red-600 text-sm">
                                                {formatCurrency(tx.amount)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </TabsContent>
      </Tabs>
    </div>
  )
}