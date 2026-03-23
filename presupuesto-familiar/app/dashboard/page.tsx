'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowDownRight, ArrowUpRight, ArrowRightLeft, Wallet, Users, TrendingUp, Loader2, PlusCircle, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/formatters'

export default function Dashboard() {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading]           = useState(true)
  const [activeTab, setActiveTab]       = useState<'personal' | 'shared'>('personal')
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

  const data = activeTab === 'personal' ? personalData : sharedData
  const total = data.accounts.reduce((s, a) => s + (a.current_balance ?? 0), 0)

  return (
    <div style={{ fontFamily: 'inherit' }}>

      {/* ══════════ ENCABEZADO ══════════ */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
            Resumen
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '2px' }}>
            Vista general de tus finanzas
          </p>
        </div>
        <Link href="/dashboard/transaccion">
          <button style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: '#2563eb', color: 'white',
            border: 'none', borderRadius: '12px',
            padding: '10px 18px', fontSize: '13px', fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.35)',
            transition: 'all 0.15s'
          }}>
            <PlusCircle size={15} /> Nueva transacción
          </button>
        </Link>
      </div>

      {/* ══════════ TABS ══════════ */}
      <div style={{
        display: 'inline-flex', gap: '4px',
        background: '#f1f5f9', borderRadius: '12px', padding: '4px',
        marginBottom: '24px'
      }}>
        {(['personal', 'shared'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '8px 20px', borderRadius: '9px',
            border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
            transition: 'all 0.15s',
            background: activeTab === tab ? 'white' : 'transparent',
            color: activeTab === tab ? '#2563eb' : '#64748b',
            boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
          }}>
            {tab === 'personal' ? <Wallet size={14} /> : <Users size={14} />}
            {tab === 'personal' ? 'Personal' : 'Familiar'}
          </button>
        ))}
      </div>

      {/* ══════════ CONTENIDO ══════════ */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: '12px', color: '#94a3b8' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
          <span style={{ fontSize: '13px' }}>Calculando saldos...</span>
        </div>
      ) : (
        <>
          {/* ── HERO PATRIMONIO ── */}
          <div style={{
            background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 50%, #3b82f6 100%)',
            borderRadius: '20px', padding: '28px 32px', marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(37,99,235,0.25)',
            position: 'relative', overflow: 'hidden'
          }}>
            {/* Círculos decorativos */}
            <div style={{
              position: 'absolute', top: '-40px', right: '-40px',
              width: '180px', height: '180px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)'
            }} />
            <div style={{
              position: 'absolute', bottom: '-60px', right: '80px',
              width: '140px', height: '140px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.04)'
            }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <TrendingUp size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {activeTab === 'personal' ? 'Patrimonio Personal' : 'Fondo Familiar'}
                </span>
              </div>
              <p style={{ fontSize: '38px', fontWeight: 900, color: 'white', margin: 0, letterSpacing: '-1px', lineHeight: 1.1 }}>
                {formatCurrency(total)}
              </p>
              <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', marginTop: '8px' }}>
                {data.accounts.length} cuenta{data.accounts.length !== 1 ? 's' : ''} · actualizado ahora
              </p>
            </div>
          </div>

          {/* ── GRID DE CUENTAS ── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '12px',
            marginBottom: '24px'
          }}>
            {data.accounts.map((acc) => {
              const pos = acc.current_balance >= 0
              return (
                <div key={acc.id} style={{
                  background: 'white',
                  borderRadius: '16px',
                  border: '1px solid #e2e8f0',
                  padding: '18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s',
                  cursor: 'default'
                }}>
                  {/* Fila superior: icono + badge */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <div style={{
                      width: '40px', height: '40px', borderRadius: '10px',
                      background: '#f8fafc', border: '1px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 700, color: '#475569'
                    }}>
                      {acc.icon}
                    </div>
                    <span style={{
                      fontSize: '10px', fontWeight: 700, padding: '3px 9px', borderRadius: '99px',
                      background: pos ? '#ecfdf5' : '#fef2f2',
                      color: pos ? '#059669' : '#dc2626',
                      border: `1px solid ${pos ? '#a7f3d0' : '#fecaca'}`
                    }}>
                      {pos ? '↑ positivo' : '↓ negativo'}
                    </span>
                  </div>
                  {/* Nombre */}
                  <p style={{ fontSize: '12px', fontWeight: 600, color: '#64748b', margin: '0 0 4px 0' }}>
                    {acc.name}
                  </p>
                  {/* Saldo */}
                  <p style={{
                    fontSize: '20px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px',
                    color: pos ? '#0f172a' : '#dc2626'
                  }}>
                    {formatCurrency(acc.current_balance)}
                  </p>
                </div>
              )
            })}
          </div>

          {/* ── TRANSACCIONES RECIENTES ── */}
          <div style={{
            background: 'white', borderRadius: '20px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            overflow: 'hidden'
          }}>
            {/* Header tabla */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 24px 16px',
              borderBottom: '1px solid #f1f5f9'
            }}>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>
                  Últimos movimientos
                </p>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                  {data.transactions.length} transacciones recientes
                </p>
              </div>
              <Link href="/dashboard/movimientos">
                <button style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  background: '#eff6ff', color: '#2563eb',
                  border: '1px solid #bfdbfe', borderRadius: '8px',
                  padding: '7px 14px', fontSize: '12px', fontWeight: 600,
                  cursor: 'pointer'
                }}>
                  Ver historial <ChevronRight size={13} />
                </button>
              </Link>
            </div>

            {/* Lista */}
            {data.transactions.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                No hay movimientos registrados aún.
              </div>
            ) : (
              <div>
                {data.transactions.map((tx, i) => {
                  const isLast = i === data.transactions.length - 1
                  const iconBg  = tx.type === 'INGRESO' ? '#ecfdf5' : tx.type === 'GASTO' ? '#fef2f2' : '#eff6ff'
                  const iconClr = tx.type === 'INGRESO' ? '#059669' : tx.type === 'GASTO' ? '#dc2626' : '#2563eb'

                  return (
                    <div key={tx.id} style={{
                      display: 'flex', alignItems: 'center', gap: '14px',
                      padding: '14px 24px',
                      borderBottom: isLast ? 'none' : '1px solid #f8fafc',
                      transition: 'background 0.1s'
                    }}>
                      {/* Icono */}
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '10px',
                        background: iconBg, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', flexShrink: 0
                      }}>
                        {tx.type === 'INGRESO' && <ArrowUpRight   size={16} style={{ color: iconClr }} />}
                        {tx.type === 'GASTO'   && <ArrowDownRight  size={16} style={{ color: iconClr }} />}
                        {tx.type === 'APORTE'  && <ArrowRightLeft  size={16} style={{ color: iconClr }} />}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', fontWeight: 600, color: '#1e293b', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {tx.description}
                        </p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                          {formatDate(tx.date)} · {tx.created_by_profile?.email?.split('@')[0]}
                        </p>
                      </div>

                      {/* Botón editar */}
                      <button
                        onClick={() => router.push(`/dashboard/movimiento/${tx.id}`)}
                        style={{
                          fontSize: '11px', fontWeight: 600, color: '#94a3b8',
                          background: 'transparent', border: '1px solid #e2e8f0',
                          borderRadius: '7px', padding: '5px 12px', cursor: 'pointer',
                          flexShrink: 0, transition: 'all 0.15s'
                        }}>
                        Editar
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
