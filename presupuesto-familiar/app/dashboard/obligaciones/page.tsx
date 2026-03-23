'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, Wallet, CreditCard, AlertCircle, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { formatCurrency } from '@/lib/formatters'

export default function ObligacionesPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading] = useState(true)
  const [scope, setScope]     = useState('PERSONAL')

  const [debts, setDebts]           = useState<any[]>([])
  const [bills, setBills]           = useState<any[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [newBill, setNewBill]       = useState({ title: '', amount: '', pay_day: '', category_id: '' })

  // Modal nueva deuda
  const [debtModal, setDebtModal] = useState(false)
  const [newDebt, setNewDebt]     = useState({ name: '', amount: '' })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let debtQuery = supabase.from('account_balances').select('*').eq('type', 'LIABILITY').eq('scope', scope)
    if (scope === 'PERSONAL') debtQuery = debtQuery.eq('user_id', user.id)
    let billQuery = supabase.from('recurring_bills').select('*, category:accounts(name, icon)').eq('scope', scope)
    if (scope === 'PERSONAL') billQuery = billQuery.eq('created_by', user.id)
    let catQuery = supabase.from('accounts').select('*').eq('type', 'EXPENSE').eq('scope', scope)
    if (scope === 'PERSONAL') catQuery = catQuery.eq('user_id', user.id)
    const [{ data: d }, { data: b }, { data: c }] = await Promise.all([debtQuery, billQuery, catQuery])
    setDebts(d || []); setBills(b || []); setCategories(c || [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [scope])

  const createDebt = async () => {
    if (!newDebt.name) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: account, error } = await supabase.from('accounts').insert({
      name: newDebt.name, type: 'LIABILITY', scope, user_id: user.id, icon: '📉'
    }).select().single()
    if (error) return
    const initialAmount = parseFloat(newDebt.amount || '0')
    if (initialAmount > 0) {
      const { data: tx } = await supabase.from('transactions').insert({
        description: 'Saldo Inicial Deuda', scope, created_by: user.id, date: new Date().toISOString()
      }).select().single()
      if (tx) await supabase.from('transaction_lines').insert({ transaction_id: tx.id, account_id: account.id, amount: -initialAmount })
    }
    setNewDebt({ name: '', amount: '' }); setDebtModal(false); fetchData()
  }

  const createBill = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!newBill.title || !newBill.amount || !newBill.category_id) return
    await supabase.from('recurring_bills').insert({
      title: newBill.title, amount: newBill.amount,
      pay_day: parseInt(newBill.pay_day), category_id: newBill.category_id,
      scope, created_by: user?.id
    })
    setNewBill({ title: '', amount: '', pay_day: '', category_id: '' }); fetchData()
  }

  const deleteDebt = async (id: string) => {
    await supabase.from('accounts').delete().eq('id', id); fetchData()
  }
  const deleteBill = async (id: string) => {
    await supabase.from('recurring_bills').delete().eq('id', id); fetchData()
  }
  const payDebt = (debt: any) => {
    router.push(`/dashboard/transaccion?${new URLSearchParams({ desc: `Abono a ${debt.name}`, cat: debt.id, scope: debt.scope, type: 'GASTO' })}`)
  }
  const payBill = (bill: any) => {
    router.push(`/dashboard/transaccion?${new URLSearchParams({ desc: bill.title, amount: bill.amount, cat: bill.category_id, scope: bill.scope, type: 'GASTO' })}`)
  }

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: '9px', border: '1px solid #e2e8f0',
    fontSize: '13px', outline: 'none', background: 'white', color: '#1e293b',
    width: '100%', boxSizing: 'border-box'
  }
  const cardStyle: React.CSSProperties = {
    background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>

      {/* ── ENCABEZADO ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
            Obligaciones
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '3px' }}>Deudas y pagos recurrentes</p>
        </div>
        {/* Tabs scope */}
        <div style={{ display: 'inline-flex', gap: '4px', background: '#f1f5f9', borderRadius: '12px', padding: '4px' }}>
          {[{ v: 'PERSONAL', label: '👤 Personal' }, { v: 'SHARED', label: '🏠 Familiar' }].map(({ v, label }) => (
            <button key={v} onClick={() => setScope(v)} style={{
              padding: '7px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer',
              fontSize: '13px', fontWeight: 600, transition: 'all 0.15s',
              background: scope === v ? 'white' : 'transparent',
              color: scope === v ? '#2563eb' : '#64748b',
              boxShadow: scope === v ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '80px', color: '#94a3b8' }}>
          <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
        </div>
      ) : (<>

        {/* ── SECCIÓN DEUDAS ── */}
        <div style={cardStyle}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '20px 24px', borderBottom: '1px solid #f1f5f9'
          }}>
            <div>
              <p style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Mis Deudas</p>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Pasivos activos y saldos pendientes</p>
            </div>
            <button onClick={() => setDebtModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
              borderRadius: '9px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
            }}>
              <Plus size={14} /> Agregar deuda
            </button>
          </div>

          <div style={{ padding: '20px 24px' }}>
            {debts.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', padding: '24px 0' }}>
                🎉 ¡Sin deudas registradas!
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' }}>
                {debts.map((d: any) => (
                  <div key={d.id} style={{
                    background: '#fff9f9', border: '1px solid #fecaca',
                    borderRadius: '14px', padding: '18px',
                    display: 'flex', flexDirection: 'column', gap: '12px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px', margin: 0 }}>{d.icon} {d.name}</p>
                        <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Saldo pendiente</p>
                      </div>
                      <button onClick={() => deleteDebt(d.id)} style={{
                        background: 'none', border: 'none', cursor: 'pointer', color: '#fca5a5', padding: '2px'
                      }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <p style={{ fontSize: '22px', fontWeight: 800, color: '#dc2626', margin: 0, letterSpacing: '-0.5px' }}>
                      {formatCurrency(d.current_balance)}
                    </p>
                    <button onClick={() => payDebt(d)} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                      background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                      borderRadius: '9px', padding: '9px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                    }}>
                      <Wallet size={14} /> Abonar capital
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── SECCIÓN PAGOS RECURRENTES ── */}
        <div style={cardStyle}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <p style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Pagos Recurrentes</p>
            <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Suscripciones y servicios fijos del mes</p>
          </div>

          {/* Formulario agregar */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #f8fafc', background: '#f8fafc' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 80px 120px auto auto', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' }}>Nombre</p>
                <input placeholder="Netflix" value={newBill.title} onChange={e => setNewBill({ ...newBill, title: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' }}>Día</p>
                <input type="number" placeholder="5" value={newBill.pay_day} onChange={e => setNewBill({ ...newBill, pay_day: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' }}>Monto</p>
                <input type="number" placeholder="$" value={newBill.amount} onChange={e => setNewBill({ ...newBill, amount: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '5px', textTransform: 'uppercase' }}>Categoría</p>
                <select value={newBill.category_id} onChange={e => setNewBill({ ...newBill, category_id: e.target.value })} style={inputStyle}>
                  <option value="">Seleccionar...</option>
                  {categories.map((c: any) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
                </select>
              </div>
              <button onClick={createBill} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: '#0f172a', color: 'white', border: 'none', borderRadius: '9px',
                padding: '9px 16px', cursor: 'pointer', fontWeight: 700, fontSize: '13px', gap: '6px'
              }}>
                <Plus size={14} /> Agregar
              </button>
            </div>
          </div>

          {/* Lista */}
          <div style={{ padding: '8px 24px 20px' }}>
            {bills.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '14px', padding: '24px 0' }}>
                No hay pagos recurrentes registrados.
              </p>
            ) : bills.map((b: any, i: number) => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px',
                padding: '14px 0', borderBottom: i < bills.length - 1 ? '1px solid #f1f5f9' : 'none'
              }}>
                {/* Día */}
                <div style={{
                  minWidth: '48px', height: '48px', borderRadius: '12px',
                  background: '#eff6ff', border: '1px solid #bfdbfe',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '9px', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase' }}>día</span>
                  <span style={{ fontSize: '18px', fontWeight: 900, color: '#1d4ed8', lineHeight: 1 }}>{b.pay_day}</span>
                </div>
                {/* Info */}
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '14px', margin: 0 }}>{b.title}</p>
                  <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    {b.category?.icon} {b.category?.name} · {formatCurrency(parseFloat(b.amount))}
                  </p>
                </div>
                {/* Acciones */}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => payBill(b)} style={{
                    display: 'flex', alignItems: 'center', gap: '5px',
                    background: '#059669', color: 'white', border: 'none',
                    borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
                  }}>
                    <CreditCard size={13} /> Pagar
                  </button>
                  <button onClick={() => deleteBill(b.id)} style={{
                    background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px',
                    padding: '8px', cursor: 'pointer', color: '#cbd5e1'
                  }}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </>)}

      {/* ── MODAL NUEVA DEUDA ── */}
      {debtModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '20px'
        }}>
          <div style={{ background: 'white', borderRadius: '20px', padding: '28px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '40px', height: '40px', background: '#fef2f2', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertCircle size={20} style={{ color: '#dc2626' }} />
              </div>
              <div>
                <p style={{ fontWeight: 800, fontSize: '16px', color: '#0f172a', margin: 0 }}>Agregar nueva deuda</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>Se registrará como pasivo</p>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '20px' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Nombre de la deuda</p>
                <input placeholder="Ej: Tarjeta Visa" value={newDebt.name} onChange={e => setNewDebt({ ...newDebt, name: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>Saldo actual que debes</p>
                <input type="number" placeholder="0" value={newDebt.amount} onChange={e => setNewDebt({ ...newDebt, amount: e.target.value })} style={inputStyle} />
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px' }}>Ingresa 0 si no quieres registrar saldo inicial</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setDebtModal(false)} style={{
                flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0',
                background: 'white', color: '#64748b', fontWeight: 600, fontSize: '14px', cursor: 'pointer'
              }}>Cancelar</button>
              <button onClick={createDebt} disabled={!newDebt.name} style={{
                flex: 1, padding: '12px', borderRadius: '10px', border: 'none',
                background: newDebt.name ? '#dc2626' : '#fca5a5', color: 'white',
                fontWeight: 700, fontSize: '14px', cursor: newDebt.name ? 'pointer' : 'not-allowed'
              }}>Crear deuda</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
