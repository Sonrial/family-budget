'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Landmark, PiggyBank, TrendingDown, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { PageHeader } from '@/components/finance/page-header'
import { ScopeToggle } from '@/components/finance/scope-toggle'
import { EmptyState, LoadingState } from '@/components/finance/states'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { getFinanceContext, getFinanceErrorMessage } from '@/lib/finance'
import { formatCurrency, getLocalMonthInputValue, getMonthBounds } from '@/lib/formatters'
import { buildMonthlyReport, emptyReportKpis, type ExpenseDatum, type PieDatum, type ReportTransaction } from '@/lib/reporting'
import { getBrowserClient } from '@/lib/supabase/client'
import type { ReportKPIs, ScopeType } from '@/lib/types'

const colors = ['#2563eb', '#059669', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899', '#0891b2', '#65a30d']

interface TooltipPayload { value?: number; name?: string }

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayload[]; label?: string }) {
  if (!active || !payload?.length) return null
  return <div className="rounded-lg border bg-popover p-3 text-sm shadow-lg"><p className="font-semibold">{label || payload[0].name}</p><p className="metric-value text-primary">{formatCurrency(Number(payload[0].value ?? 0))}</p></div>
}

function monthOptions() {
  const now = new Date()
  return Array.from({ length: 24 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    const raw = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(date)
    return { value, label: raw.charAt(0).toUpperCase() + raw.slice(1) }
  })
}

export default function ReportsPage() {
  const [scope, setScope] = useState<ScopeType>('PERSONAL')
  const [selectedMonth, setSelectedMonth] = useState(getLocalMonthInputValue)
  const [months] = useState(monthOptions)
  const [pieData, setPieData] = useState<PieDatum[]>([])
  const [topExpenses, setTopExpenses] = useState<ExpenseDatum[]>([])
  const [kpis, setKpis] = useState<ReportKPIs>(emptyReportKpis)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadReport() {
      try {
        const client = getBrowserClient()
        const context = await getFinanceContext(client)
        if (scope === 'SHARED' && !context.householdId) {
          if (!cancelled) {
            setPieData([])
            setTopExpenses([])
            setKpis(emptyReportKpis)
            setLoading(false)
          }
          return
        }
        const bounds = getMonthBounds(selectedMonth)
        let query = client.from('transactions')
          .select('*, amount:transaction_lines(amount, account:accounts(name,type))')
          .eq('scope', scope).eq('is_reversal', false).is('voided_at', null)
          .gte('date', bounds.start).lte('date', bounds.end)
        query = scope === 'PERSONAL'
          ? query.eq('created_by', context.userId)
          : query.eq('household_id', context.householdId)
        const { data, error } = await query.returns<ReportTransaction[]>()
        if (error) throw error

        const report = buildMonthlyReport(data ?? [])
        if (!cancelled) {
          setPieData(report.categories)
          setTopExpenses(report.topExpenses)
          setKpis(report.kpis)
          setLoading(false)
        }
      } catch (error) {
        if (!cancelled) { toast.error(getFinanceErrorMessage(error)); setLoading(false) }
      }
    }
    void loadReport()
    return () => { cancelled = true }
  }, [scope, selectedMonth])

  const changeScope = (next: ScopeType) => { setLoading(true); setScope(next) }

  return (
    <div className="space-y-6">
      <PageHeader title="Reportes" description="Ingresos, consumo, ahorro y pagos de deuda correctamente separados."
        actions={<><ScopeToggle value={scope} onChange={changeScope} /><Select value={selectedMonth} onValueChange={(value) => { setLoading(true); setSelectedMonth(value) }}><SelectTrigger className="w-[190px]" aria-label="Mes del reporte"><SelectValue /></SelectTrigger><SelectContent>{months.map((month) => <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>)}</SelectContent></Select></>} />

      {loading ? <LoadingState label="Generando reporte…" /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Ingresos" value={kpis.income} helper="Entradas del periodo" icon={TrendingUp} tone="emerald" />
            <MetricCard title="Gastos de consumo" value={kpis.expense} helper="Sin incluir capital de deuda" icon={TrendingDown} tone="red" />
            <MetricCard title="Abonos a deuda" value={kpis.debtPayments} helper="Flujo de financiación" icon={Landmark} tone="amber" />
            <MetricCard title="Ahorro neto" value={kpis.savings} helper={`Tasa de ahorro ${kpis.savingsRate.toFixed(1)}%`} icon={PiggyBank} tone={kpis.savings >= 0 ? 'blue' : 'red'} />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Distribución del gasto</CardTitle><CardDescription>Solo categorías de consumo.</CardDescription></CardHeader><CardContent className="h-80">{pieData.length ? <ResponsiveContainer width="100%" height="100%"><PieChart accessibilityLayer><Pie data={pieData} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} paddingAngle={3}>{pieData.map((datum, index) => <Cell key={datum.name} fill={colors[index % colors.length]} />)}</Pie><Tooltip content={<ChartTooltip />} /><Legend /></PieChart></ResponsiveContainer> : <EmptyState title="Sin gastos" description="No se registraron gastos de consumo en este periodo." />}</CardContent></Card>
            <Card><CardHeader><CardTitle>Flujo del periodo</CardTitle><CardDescription>Comparación entre ingresos, consumo y deuda.</CardDescription></CardHeader><CardContent className="h-80"><ResponsiveContainer width="100%" height="100%"><BarChart accessibilityLayer data={[{ name: 'Ingresos', amount: kpis.income }, { name: 'Consumo', amount: kpis.expense }, { name: 'Deuda', amount: kpis.debtPayments }]}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tickLine={false} axisLine={false} /><YAxis hide /><Tooltip content={<ChartTooltip />} /><Bar dataKey="amount" radius={[8, 8, 0, 0]}>{['#059669', '#dc2626', '#f59e0b'].map((color) => <Cell key={color} fill={color} />)}</Bar></BarChart></ResponsiveContainer></CardContent></Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <Card><CardHeader><CardTitle>Detalle por categoría</CardTitle><CardDescription>Participación sobre el gasto de consumo.</CardDescription></CardHeader><CardContent>{pieData.length ? <div className="space-y-4">{pieData.map((category, index) => <div key={category.name}><div className="mb-1.5 flex justify-between gap-3 text-sm"><span className="font-medium">{category.name}</span><span className="metric-value font-semibold">{formatCurrency(category.value)}</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${category.percent}%`, background: colors[index % colors.length] }} /></div><p className="mt-1 text-right text-xs text-muted-foreground">{category.percent.toFixed(1)}%</p></div>)}</div> : <EmptyState title="Sin categorías" description="No hay datos para distribuir." />}</CardContent></Card>
            <Card><CardHeader><div className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-600" /><CardTitle>Mayores gastos</CardTitle></div><CardDescription>Top cinco del periodo.</CardDescription></CardHeader><CardContent>{topExpenses.length ? <div className="divide-y">{topExpenses.map((expense, index) => <div key={`${expense.description}-${expense.date}-${index}`} className="flex items-center justify-between gap-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{expense.description}</p><p className="text-xs text-muted-foreground">{expense.category} · {expense.date.slice(0, 10)}</p></div><p className="metric-value shrink-0 text-sm font-bold text-red-600">{formatCurrency(expense.amount)}</p></div>)}</div> : <EmptyState title="Sin gastos" description="No hay compras para mostrar." />}</CardContent></Card>
          </div>
        </>
      )}
    </div>
  )
}

function MetricCard({ title, value, helper, icon: Icon, tone }: { title: string; value: number; helper: string; icon: typeof TrendingUp; tone: 'blue' | 'emerald' | 'red' | 'amber' }) {
  const tones = { blue: 'bg-blue-50 text-blue-700', emerald: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-700' }
  return <Card><CardContent className="p-5"><div className="mb-4 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p><span className={`flex size-9 items-center justify-center rounded-lg ${tones[tone]}`}><Icon className="size-4" /></span></div><p className="metric-value text-xl font-bold">{formatCurrency(value)}</p><p className="mt-1 text-xs text-muted-foreground">{helper}</p></CardContent></Card>
}
