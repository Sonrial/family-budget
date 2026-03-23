'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Loader2, ArrowRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/formatters'

const generateRecentMonths = () => {
  const months = []
  const date = new Date()
  for (let i = 0; i < 18; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const name  = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' }).format(d)
    months.push({ value, name: name.charAt(0).toUpperCase() + name.slice(1) })
  }
  return months
}

export default function HistorialPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [scope, setScope]               = useState('PERSONAL')
  const [transactions, setTransactions] = useState<any[]>([])
  const [loading, setLoading]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [hasMore, setHasMore]           = useState(true)
  const [page, setPage]                 = useState(0)
  const [monthFilter, setMonthFilter]   = useState('ALL')
  const [typeFilter, setTypeFilter]     = useState('ALL')
  const [availableMonths]               = useState(generateRecentMonths)
  const ITEMS_PER_PAGE = 20

  const fetchTransactions = async (pageNumber: number, isNewScope = false) => {
    if (isNewScope) setLoading(true); else setLoadingMore(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const from = pageNumber * ITEMS_PER_PAGE
    const to   = from + ITEMS_PER_PAGE - 1
    let query = supabase
      .from('transactions')
      .select('*, created_by_profile:profiles(email), lines:transaction_lines(amount, account:accounts(name, icon))')
      .order('date', { ascending: false }).range(from, to)
    if (scope === 'PERSONAL') query = query.eq('scope', 'PERSONAL').eq('created_by', user.id)
    else query = query.eq('scope', 'SHARED')
    if (typeFilter !== 'ALL') query = query.eq('type', typeFilter)
    if (monthFilter !== 'ALL') {
      const [year, month] = monthFilter.split('-')
      const startDate = `${year}-${month}-01`
      const endDate   = new Date(parseInt(year), parseInt(month), 0).toISOString().slice(0, 10)
      query = query.gte('date', startDate).lte('date', endDate + 'T23:59:59')
    }
    const { data } = await query
    if (data) {
      if (isNewScope || pageNumber === 0) setTransactions(data)
      else setTransactions(prev => [...prev, ...data])
      setHasMore(data.length >= ITEMS_PER_PAGE)
    }
    setLoading(false); setLoadingMore(false)
  }

  useEffect(() => { setPage(0); setHasMore(true); fetchTransactions(0, true) }, [scope, monthFilter, typeFilter])

  const selectStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: '10px', border: '1px solid #e2e8f0',
    fontSize: '13px', fontWeight: 600, color: '#1e293b', background: 'white',
    outline: 'none', cursor: 'pointer', width: '100%'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '40px' }}>

      {/* ── ENCABEZADO ── */}
      <div>
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
          Historial
        </h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '3px' }}>Consulta y edita cualquier movimiento</p>
      </div>

      {/* ── FILTROS ── */}
      <div style={{
        background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0',
        padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        display: 'flex', flexDirection: 'column', gap: '14px'
      }}>
        {/* Tabs scope */}
        <div style={{ display: 'inline-flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px', width: 'fit-content' }}>
          {[{ v: 'PERSONAL', label: '👤 Personal' }, { v: 'SHARED', label: '🏠 Familiar' }].map(({ v, label }) => (
            <button key={v} onClick={() => setScope(v)} style={{
              padding: '7px 20px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
              background: scope === v ? 'white' : 'transparent',
              color: scope === v ? '#2563eb' : '#64748b',
              boxShadow: scope === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>{label}</button>
          ))}
        </div>

        {/* Selectores */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Mes</p>
            <select value={monthFilter} onChange={e => setMonthFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">🗓️ Todos los meses</option>
              {availableMonths.map(m => <option key={m.value} value={m.value}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Tipo</p>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={selectStyle}>
              <option value="ALL">📁 Todos</option>
              <option value="GASTO">📉 Gastos</option>
              <option value="INGRESO">📈 Ingresos</option>
              <option value="APORTE">🔄 Transferencias</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── LISTA ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '12px', color: '#94a3b8' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
          <span style={{ fontSize: '13px' }}>Buscando movimientos...</span>
        </div>
      ) : transactions.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '16px', border: '2px dashed #e2e8f0', padding: '60px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' }}>
          🕵️‍♂️ No se encontraron movimientos con estos filtros.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {transactions.map((tx) => {
            const originLine = tx.lines?.find((l: any) => l.amount < 0)
            const destLine   = tx.lines?.find((l: any) => l.amount > 0)
            const rawAmount  = destLine ? destLine.amount : (originLine ? Math.abs(originLine.amount) : 0)
            const originName = originLine?.account ? `${originLine.account.icon || ''} ${originLine.account.name}` : 'Desconocido'
            const destName   = destLine?.account   ? `${destLine.account.icon || ''} ${destLine.account.name}`   : 'Desconocido'
            const iconBg  = tx.type === 'INGRESO' ? '#ecfdf5' : tx.type === 'GASTO' ? '#fef2f2' : '#eff6ff'
            const amtClr  = tx.type === 'INGRESO' ? '#059669' : tx.type === 'GASTO' ? '#dc2626' : '#2563eb'
            const amtPrefix = tx.type === 'GASTO' ? '-' : tx.type === 'INGRESO' ? '+' : ''

            return (
              <div key={tx.id} style={{
                background: 'white', borderRadius: '14px', border: '1px solid #e2e8f0',
                padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap'
              }}>
                {/* Icono */}
                <div style={{ width: '40px', height: '40px', borderRadius: '11px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {tx.type === 'INGRESO' && <ArrowUpRight  size={18} style={{ color: '#059669' }} />}
                  {tx.type === 'GASTO'   && <ArrowDownRight size={18} style={{ color: '#dc2626' }} />}
                  {tx.type === 'APORTE'  && <ArrowRightLeft  size={18} style={{ color: '#2563eb' }} />}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: '160px' }}>
                  <p style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', margin: 0 }}>{tx.description}</p>
                  {/* Flujo de cuentas */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '5px',
                    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '7px', padding: '3px 8px'
                  }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{originName}</span>
                    <ArrowRight size={10} style={{ color: '#94a3b8', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{destName}</span>
                  </div>
                  <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    📅 {formatDate(tx.date)} · 👤 {tx.created_by_profile?.email?.split('@')[0]}
                  </p>
                  {tx.notes && (
                    <p style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '3px', borderLeft: '2px solid #e2e8f0', paddingLeft: '8px' }}>
                      "{tx.notes}"
                    </p>
                  )}
                </div>

                {/* Monto + botón */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                  <p style={{ fontSize: '18px', fontWeight: 800, color: amtClr, margin: 0, letterSpacing: '-0.5px' }}>
                    {amtPrefix} {formatCurrency(rawAmount)}
                  </p>
                  <button
                    onClick={() => router.push(`/dashboard/movimiento/${tx.id}`)}
                    style={{
                      fontSize: '11px', fontWeight: 600, color: '#64748b',
                      background: 'white', border: '1px solid #e2e8f0',
                      borderRadius: '7px', padding: '5px 12px', cursor: 'pointer'
                    }}>
                    Ver / Editar
                  </button>
                </div>
              </div>
            )
          })}

          {/* Cargar más */}
          {hasMore && (
            <button onClick={() => { const next = page + 1; setPage(next); fetchTransactions(next, false) }}
              disabled={loadingMore} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              width: '100%', padding: '14px', marginTop: '8px', borderRadius: '12px',
              border: '1px solid #e2e8f0', background: 'white', color: '#2563eb',
              fontSize: '13px', fontWeight: 700, cursor: loadingMore ? 'not-allowed' : 'pointer'
            }}>
              {loadingMore ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Cargando...</> : '⬇ Cargar más movimientos'}
            </button>
          )}
          {!hasMore && transactions.length > 0 && (
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#94a3b8', padding: '16px 0' }}>
              ✓ Has llegado al final del historial
            </p>
          )}
        </div>
      )}
    </div>
  )
}
