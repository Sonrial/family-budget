'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Trash2, Wallet, ShoppingBag, Banknote, Loader2 } from 'lucide-react'

export default function GestionCuentasPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [scope, setScope]     = useState('PERSONAL')
  const [assets, setAssets]   = useState<any[]>([])
  const [expenses, setExpenses] = useState<any[]>([])
  const [incomes, setIncomes]   = useState<any[]>([])
  const [newAsset,   setNewAsset]   = useState({ name: '', icon: '' })
  const [newExpense, setNewExpense] = useState({ name: '', icon: '' })
  const [newIncome,  setNewIncome]  = useState({ name: '', icon: '' })

  const fetchData = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let query = supabase.from('accounts').select('*').eq('scope', scope)
    if (scope === 'PERSONAL') query = query.eq('user_id', user.id)
    const { data } = await query
    if (data) {
      setAssets(data.filter((a: any) => a.type === 'ASSET'))
      setExpenses(data.filter((a: any) => a.type === 'EXPENSE'))
      setIncomes(data.filter((a: any) => a.type === 'INCOME'))
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [scope])

  const createAccount = async (name: string, icon: string, type: string) => {
    if (!name) return
    const finalIcon = icon || name.charAt(0).toUpperCase()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('accounts').insert({ name, icon: finalIcon, type, scope, user_id: user?.id })
    setNewAsset({ name: '', icon: '' }); setNewExpense({ name: '', icon: '' }); setNewIncome({ name: '', icon: '' })
    fetchData()
  }

  const deleteAccount = async (id: string) => {
    const { error } = await supabase.from('accounts').delete().eq('id', id)
    if (error) alert('No se pudo borrar. Puede tener datos asociados.')
    else fetchData()
  }

  const inputStyle: React.CSSProperties = {
    padding: '9px 12px', borderRadius: '9px', border: '1px solid #e2e8f0',
    fontSize: '13px', outline: 'none', background: 'white', color: '#1e293b', boxSizing: 'border-box'
  }

  const sections = [
    { title: 'Cuentas / Bancos', icon: <Wallet size={16} style={{ color: '#2563eb' }} />, items: assets, newItem: newAsset, setNewItem: setNewAsset, type: 'ASSET', accent: '#2563eb', accentBg: '#eff6ff', accentBorder: '#bfdbfe' },
    { title: 'Categorías de Gasto', icon: <ShoppingBag size={16} style={{ color: '#dc2626' }} />, items: expenses, newItem: newExpense, setNewItem: setNewExpense, type: 'EXPENSE', accent: '#dc2626', accentBg: '#fef2f2', accentBorder: '#fecaca' },
    { title: 'Fuentes de Ingreso', icon: <Banknote size={16} style={{ color: '#059669' }} />, items: incomes, newItem: newIncome, setNewItem: setNewIncome, type: 'INCOME', accent: '#059669', accentBg: '#ecfdf5', accentBorder: '#a7f3d0' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>

      {/* Encabezado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
            Configuración
          </h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '3px' }}>
            Gestiona tus cuentas y categorías
          </p>
        </div>
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
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
          {sections.map((sec) => (
            <div key={sec.type} style={{
              background: 'white', borderRadius: '20px', border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)', overflow: 'hidden'
            }}>
              {/* Header sección */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', borderBottom: '1px solid #f1f5f9',
                background: sec.accentBg
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {sec.icon}
                  <p style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', margin: 0 }}>{sec.title}</p>
                </div>
                <span style={{
                  fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '99px',
                  background: 'white', color: sec.accent, border: `1px solid ${sec.accentBorder}`
                }}>
                  {sec.items.length} ítem{sec.items.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Lista */}
              <div style={{ padding: '12px 16px', maxHeight: '240px', overflowY: 'auto' }}>
                {sec.items.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '16px 0' }}>
                    Sin ítems aún.
                  </p>
                ) : sec.items.map((item: any) => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '9px 10px', borderRadius: '10px',
                    marginBottom: '4px', transition: 'background 0.1s'
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{
                      width: '34px', height: '28px', borderRadius: '7px',
                      background: '#f1f5f9', border: '1px solid #e2e8f0',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '11px', fontWeight: 800, color: '#475569', flexShrink: 0
                    }}>
                      {item.icon}
                    </div>
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: '#334155' }}>{item.name}</span>
                    <button onClick={() => deleteAccount(item.id)} style={{
                      background: 'none', border: 'none', cursor: 'pointer', color: '#cbd5e1', padding: '3px'
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                      onMouseLeave={e => (e.currentTarget.style.color = '#cbd5e1')}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Formulario agregar */}
              <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '8px' }}>
                <input
                  placeholder="SIGLA" maxLength={4}
                  value={sec.newItem.icon}
                  onChange={e => sec.setNewItem({ ...sec.newItem, icon: e.target.value.toUpperCase() })}
                  style={{ ...inputStyle, width: '64px', textAlign: 'center', fontWeight: 800, textTransform: 'uppercase' }}
                />
                <input
                  placeholder="Nombre completo"
                  value={sec.newItem.name}
                  onChange={e => sec.setNewItem({ ...sec.newItem, name: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                  onKeyDown={e => e.key === 'Enter' && createAccount(sec.newItem.name, sec.newItem.icon, sec.type)}
                />
                <button
                  onClick={() => createAccount(sec.newItem.name, sec.newItem.icon, sec.type)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '9px', border: 'none',
                    background: sec.accent, color: 'white', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                  <Plus size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
