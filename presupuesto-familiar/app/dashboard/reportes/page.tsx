'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { TrendingUp, TrendingDown, PiggyBank, Loader2, AlertCircle, Wallet, Users } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'

const COLORS = ['#2563eb', '#059669', '#f59e0b', '#dc2626', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16']

const generateMonths = () => {
  const months = []
  const now = new Date()
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const name = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(d)
    months.push({ value, name: name.charAt(0).toUpperCase() + name.slice(1) })
  }
  return months
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px 14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '13px' }}>
      <p style={{ fontWeight: 700, color: '#1e293b', margin: '0 0 4px' }}>{label || payload[0].name}</p>
      <p style={{ color: '#2563eb', fontWeight: 600, margin: 0 }}>{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export default function ReportesPage() {
  const supabase = createClient()
  const [loading, setLoading]     = useState(true)
  const [scope, setScope]         = useState('PERSONAL')
  const [months]                  = useState(generateMonths)
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7))
  const [pieData, setPieData]     = useState<any[]>([])
  const [barData, setBarData]     = useState<any[]>([])
  const [topExpenses, setTopExpenses] = useState<any[]>([])
  const [kpis, setKpis]           = useState({ income: 0, expense: 0, savings: 0, savingsRate: 0 })

  const fetchReportData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [year, month] = selectedMonth.split('-')
    const startDate = `${year}-${month}-01`
    const endDate   = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10)
    let query = supabase.from('transactions')
      .select('id, type, description, date, amount:transaction_lines(amount, account:accounts(name, type))')
      .gte('date', startDate).lte('date', endDate + 'T23:59:59').eq('scope', scope)
    if (scope === 'PERSONAL') query = query.eq('created_by', user.id)
    const { data: transactions } = await query
    if (transactions) {
      let totalIncome = 0, totalExpense = 0
      const expensesByCategory: Record<string, number> = {}
      const individualExpenses: any[] = []
      transactions.forEach((tx: any) => {
        if (tx.type === 'GASTO') {
          const line = tx.amount.find((l: any) => l.amount > 0)
          const amount = line?.amount || 0
          const cat = line?.account?.name || 'Otros'
          totalExpense += amount
          expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amount
          individualExpenses.push({ description: tx.description, amount, date: tx.date, category: cat })
        } else if (tx.type === 'INGRESO') {
          const line = tx.amount.find((l: any) => l.amount > 0)
          totalIncome += line?.amount || 0
        }
      })
      const pData = Object.entries(expensesByCategory)
        .map(([name, value]) => ({ name, value, percent: totalExpense > 0 ? (value / totalExpense) * 100 : 0 }))
        .sort((a, b) => b.value - a.value)
      const savings = totalIncome - totalExpense
      setPieData(pData)
      setBarData([{ name: 'Ingresos', amount: totalIncome }, { name: 'Gastos', amount: totalExpense }])
      setTopExpenses(individualExpenses.sort((a, b) => b.amount - a.amount).slice(0, 5))
      setKpis({ income: totalIncome, expense: totalExpense, savings, savingsRate: totalIncome > 0 ? (savings / totalIncome) * 100 : 0 })
    }
    setLoading(false)
  }

  useEffect(() => { fetchReportData() }, [scope, selectedMonth])

  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '18px', border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden'
  }
  const cardHeader: React.CSSProperties = { padding: '18px 20px', borderBottom: '1px solid #f1f5f9' }
  const cardBody: React.CSSProperties   = { padding: '20px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>

      {/* ── ENCABEZADO ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
            Reportes
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '3px' }}>Análisis mensual de tus finanzas</p>
        </div>
        {/* Controles */}
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Scope tabs */}
          <div style={{ display: 'inline-flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
            {[{ v: 'PERSONAL', label: '👤 Personal', Icon: Wallet }, { v: 'SHARED', label: '🏠 Familiar', Icon: Users }].map(({ v, label }) => (
              <button key={v} onClick={() => setScope(v)} style={{
                padding: '7px 16px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontWeight: 600, transition: 'all 0.15s',
                background: scope === v ? 'white' : 'transparent',
                color: scope === v ? '#2563eb' : '#64748b',
                boxShadow: scope === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              }}>{label}</button>
            ))}
          </div>
          {/* Selector mes */}
          <select value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} style={{
            padding: '9px 14px', borderRadius: '10px', border: '1px solid #e2e8f0',
            fontSize: '13px', fontWeight: 600, color: '#1e293b', background: 'white',
            outline: 'none', cursor: 'pointer'
          }}>
            {months.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '12px', color: '#94a3b8' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
          <span style={{ fontSize: '13px' }}>Generando reporte...</span>
        </div>
      ) : (<>

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
          {[
            { label: 'Ingresos', value: kpis.income, color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', Icon: TrendingUp, sub: 'Total recibido' },
            { label: 'Gastos', value: kpis.expense, color: '#dc2626', bg: '#fef2f2', border: '#fecaca', Icon: TrendingDown, sub: 'Total gastado' },
            { label: 'Balance neto', value: kpis.savings, color: kpis.savings >= 0 ? '#2563eb' : '#dc2626', bg: '#eff6ff', border: '#bfdbfe', Icon: PiggyBank, sub: `Tasa de ahorro: ${kpis.savingsRate.toFixed(1)}%` },
          ].map(({ label, value, color, bg, border, Icon, sub }) => (
            <div key={label} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{label}</p>
                <div style={{ width: '34px', height: '34px', borderRadius: '9px', background: bg, border: `1px solid ${border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={16} style={{ color }} />
                </div>
              </div>
              <p style={{ fontSize: '22px', fontWeight: 800, color, margin: 0, letterSpacing: '-0.5px' }}>{formatCurrency(value)}</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>{sub}</p>
            </div>
          ))}
        </div>

        {/* ── GRÁFICAS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {/* Donut */}
          <div style={cardStyle}>
            <div style={cardHeader}>
              <p style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', margin: 0 }}>Distribución de Gastos</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Por categorías</p>
            </div>
            <div style={{ ...cardBody, height: '300px' }}>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={65} outerRadius={95} paddingAngle={4} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <RTooltip content={<CustomTooltip />} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '13px' }}>Sin datos este mes</div>}
            </div>
          </div>

          {/* Barras */}
          <div style={cardStyle}>
            <div style={cardHeader}>
              <p style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', margin: 0 }}>Flujo de Caja</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Ingresos vs Gastos</p>
            </div>
            <div style={{ ...cardBody, height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barSize={64}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} style={{ fontSize: '12px' }} />
                  <YAxis hide />
                  <RTooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="amount" radius={[10, 10, 0, 0]}>
                    {barData.map((_, i) => <Cell key={i} fill={i === 0 ? '#059669' : '#dc2626'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ── DETALLE + TOP GASTOS ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {/* Detalle por categoría */}
          <div style={cardStyle}>
            <div style={cardHeader}>
              <p style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', margin: 0 }}>Detalle por Categoría</p>
            </div>
            <div style={cardBody}>
              {pieData.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '13px' }}>Sin gastos este mes.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {pieData.map((cat, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: COLORS[idx % COLORS.length], display: 'inline-block', flexShrink: 0 }} />
                          {cat.name}
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>{formatCurrency(cat.value)}</span>
                      </div>
                      <div style={{ height: '6px', background: '#f1f5f9', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: '99px', background: COLORS[idx % COLORS.length], width: `${cat.percent}%`, transition: 'width 0.6s ease' }} />
                      </div>
                      <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'right', marginTop: '3px' }}>{cat.percent.toFixed(1)}%</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Top 5 gastos */}
          <div style={cardStyle}>
            <div style={cardHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} style={{ color: '#f59e0b' }} />
                <p style={{ fontWeight: 700, fontSize: '14px', color: '#0f172a', margin: 0 }}>Mayores Gastos</p>
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Top 5 compras del mes</p>
            </div>
            <div style={cardBody}>
              {topExpenses.length === 0 ? <p style={{ color: '#94a3b8', fontSize: '13px' }}>Sin gastos este mes.</p> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                  {topExpenses.map((tx, idx) => (
                    <div key={idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 0', borderBottom: idx < topExpenses.length - 1 ? '1px solid #f8fafc' : 'none', gap: '12px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{
                          width: '26px', height: '26px', borderRadius: '7px', background: '#f8fafc',
                          border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 800, color: '#94a3b8', flexShrink: 0
                        }}>{idx + 1}</span>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0 }}>{tx.description}</p>
                          <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>
                            {new Date(tx.date).toLocaleDateString('es-CO')} · {tx.category}
                          </p>
                        </div>
                      </div>
                      <p style={{ fontSize: '14px', fontWeight: 800, color: '#dc2626', margin: 0, flexShrink: 0 }}>
                        {formatCurrency(tx.amount)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </>)}
    </div>
  )
}
