'use client'
import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft, Users, User, CalendarIcon, Send, Loader2 } from 'lucide-react'
import Link from 'next/link'
import AccountSelect from '@/components/AccountSelect'

function TransactionForm() {
  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)

  const [description, setDescription] = useState(searchParams.get('desc') || '')
  const [notes, setNotes]             = useState('')
  const [amount, setAmount]           = useState(searchParams.get('amount') || '')
  const [type, setType]               = useState(searchParams.get('type') || 'GASTO')
  const [scope, setScope]             = useState(searchParams.get('scope') || 'PERSONAL')
  const [date, setDate]               = useState(() => new Date().toISOString().split('T')[0])
  const [transferMode, setTransferMode]     = useState('POOL')
  const [targetUserId, setTargetUserId]     = useState('')
  const [selectedAsset, setSelectedAsset]   = useState('')
  const [selectedDestination, setSelectedDestination] = useState(searchParams.get('cat') || '')
  const [originAccounts, setOriginAccounts] = useState<any[]>([])
  const [destOptions, setDestOptions]       = useState<any[]>([])
  const [familyMembers, setFamilyMembers]   = useState<any[]>([])
  const [myProfile, setMyProfile]           = useState<any>(null)

  useEffect(() => {
    const loadFamily = async () => {
      const { data } = await supabase.from('profiles').select('*')
      if (data) setFamilyMembers(data)
      const { data: { user } } = await supabase.auth.getUser()
      if (user && data) setMyProfile(data.find((p: any) => p.id === user.id))
    }
    loadFamily()
  }, [])

  useEffect(() => {
    const loadAccounts = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      let queryOrigin = supabase.from('accounts').select('*').eq('type', 'ASSET')
      if (type === 'APORTE') queryOrigin = queryOrigin.eq('user_id', user.id)
      else if (scope === 'PERSONAL') queryOrigin = queryOrigin.eq('scope', 'PERSONAL').eq('user_id', user.id)
      else queryOrigin = queryOrigin.eq('scope', 'SHARED')
      const { data: originData } = await queryOrigin
      if (originData) setOriginAccounts(originData)

      let queryDest = supabase.from('accounts').select('*')
      if (type === 'GASTO') {
        queryDest = queryDest.eq('scope', scope).in('type', ['EXPENSE', 'LIABILITY'])
        if (scope === 'PERSONAL') queryDest = queryDest.eq('user_id', user.id)
      } else if (type === 'INGRESO') {
        queryDest = queryDest.eq('scope', scope).eq('type', 'INCOME')
        if (scope === 'PERSONAL') queryDest = queryDest.eq('user_id', user.id)
      } else if (type === 'APORTE') {
        if (transferMode === 'POOL') queryDest = queryDest.eq('scope', 'SHARED').eq('type', 'ASSET')
        else if (transferMode === 'MEMBER' && targetUserId) queryDest = queryDest.eq('user_id', targetUserId).eq('type', 'ASSET')
        else { setDestOptions([]); return }
      }
      const { data: destData } = await queryDest
      if (destData) setDestOptions(destData)
    }
    loadAccounts()
  }, [scope, type, transferMode, targetUserId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))
  const handleFocus  = () => setAmount(amount.replace(/\./g, ''))
  const handleBlur   = () => {
    if (!amount) return
    let val = amount.replace(/\./g, ',')
    const parts = val.split(',')
    const integerPart = parts[0].replace(/\D/g, '')
    if (!integerPart) { setAmount(''); return }
    const formattedInt = new Intl.NumberFormat('es-CO').format(BigInt(integerPart))
    setAmount(parts[1] !== undefined ? `${formattedInt},${parts[1].slice(0, 2)}` : formattedInt)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const val = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
    if (!val || !selectedAsset || !selectedDestination) { alert('Completa los campos'); setLoading(false); return }
    let finalDescription = description
    if (type === 'APORTE' && !description.trim()) {
      const myName = myProfile?.email?.split('@')[0] || 'Yo'
      const targetName = familyMembers.find((m: any) => m.id === targetUserId)?.email?.split('@')[0] || 'Destinatario'
      finalDescription = `Transferencia: ${myName} ➔ ${transferMode === 'POOL' ? 'Fondo Común' : targetName}`
    } else if (!finalDescription) finalDescription = type === 'GASTO' ? 'Gasto General' : 'Ingreso'
    const finalDateISO = new Date(date + 'T12:00:00').toISOString()
    const finalScope = type === 'APORTE' ? 'SHARED' : scope
    const { data: tx, error: txError } = await supabase.from('transactions').insert({
      description: finalDescription, notes, type, scope: finalScope,
      date: finalDateISO, created_by: user.id
    }).select().single()
    if (txError) { alert('Error creando transacción'); setLoading(false); return }
    const lines = []
    if (type === 'GASTO') {
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: val })
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: -val })
    } else if (type === 'INGRESO') {
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: val })
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: -val })
    } else {
      lines.push({ transaction_id: tx.id, account_id: selectedDestination, amount: val })
      lines.push({ transaction_id: tx.id, account_id: selectedAsset, amount: -val })
    }
    await supabase.from('transaction_lines').insert(lines)
    if (searchParams.get('cat')) router.push('/dashboard/obligaciones')
    else router.push('/dashboard')
    setLoading(false)
  }

  // ── ESTILOS REUTILIZABLES ──
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none',
    background: 'white', color: '#1e293b', boxSizing: 'border-box',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '12px', fontWeight: 700,
    color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
  }
  const sectionStyle: React.CSSProperties = {
    background: 'white', borderRadius: '16px',
    border: '1px solid #e2e8f0', padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
  }

  // Configuración por tipo
  const typeConfig: Record<string, { color: string; bg: string; border: string; label: string; emoji: string }> = {
    GASTO:   { color: '#dc2626', bg: '#fef2f2', border: '#fecaca', label: 'Gasto',       emoji: '📉' },
    INGRESO: { color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', label: 'Ingreso',     emoji: '📈' },
    APORTE:  { color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', label: 'Transferir',  emoji: '🔄' },
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── TIPO ── */}
      <div style={sectionStyle}>
        <p style={labelStyle}>Tipo de movimiento</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
          {(['GASTO', 'INGRESO', 'APORTE'] as const).map((t) => {
            const c = typeConfig[t]
            const active = type === t
            return (
              <button key={t} type="button" onClick={() => setType(t)} style={{
                padding: '12px 8px', borderRadius: '12px', cursor: 'pointer',
                border: `2px solid ${active ? c.border : '#e2e8f0'}`,
                background: active ? c.bg : 'white',
                color: active ? c.color : '#94a3b8',
                fontWeight: 700, fontSize: '13px',
                transition: 'all 0.15s',
              }}>
                <div style={{ fontSize: '20px', marginBottom: '4px' }}>{c.emoji}</div>
                {c.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── ÁMBITO (no en APORTE) ── */}
      {type !== 'APORTE' && (
        <div style={sectionStyle}>
          <p style={labelStyle}>Ámbito</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {[{ v: 'PERSONAL', label: '👤 Personal' }, { v: 'SHARED', label: '🏠 Familiar' }].map(({ v, label }) => (
              <button key={v} type="button" onClick={() => setScope(v)} style={{
                padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                border: `2px solid ${scope === v ? '#bfdbfe' : '#e2e8f0'}`,
                background: scope === v ? '#eff6ff' : 'white',
                color: scope === v ? '#2563eb' : '#94a3b8',
                transition: 'all 0.15s',
              }}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── MODO TRANSFERENCIA ── */}
      {type === 'APORTE' && (
        <div style={{ ...sectionStyle, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <p style={{ ...labelStyle, color: '#1d4ed8' }}>¿Hacia dónde va el dinero?</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            {[{ v: 'POOL', label: '🏦 Fondo Común' }, { v: 'MEMBER', label: '👤 A un familiar' }].map(({ v, label }) => (
              <button key={v} type="button"
                onClick={() => { setTransferMode(v); setSelectedDestination('') }} style={{
                padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px',
                border: `2px solid ${transferMode === v ? '#2563eb' : '#bfdbfe'}`,
                background: transferMode === v ? '#2563eb' : 'white',
                color: transferMode === v ? 'white' : '#2563eb',
                transition: 'all 0.15s',
              }}>
                {label}
              </button>
            ))}
          </div>
          {transferMode === 'MEMBER' && (
            <div>
              <p style={labelStyle}>¿A quién le envías?</p>
              <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)} style={inputStyle}>
                <option value="">Seleccionar familiar...</option>
                {familyMembers.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.email?.split('@')[0]}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* ── DATOS PRINCIPALES ── */}
      <div style={sectionStyle}>
        <div style={{ display: 'grid', gap: '16px' }}>

          {/* Fecha */}
          <div>
            <label style={labelStyle}>Fecha del movimiento</label>
            <div style={{ position: 'relative' }}>
              <CalendarIcon size={16} style={{ position: 'absolute', left: '12px', top: '11px', color: '#94a3b8', pointerEvents: 'none' }} />
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ ...inputStyle, paddingLeft: '36px' }} />
            </div>
          </div>

          {/* Descripción */}
          <div>
            <label style={labelStyle}>Descripción</label>
            <input type="text"
              placeholder={type === 'APORTE' ? '(Opcional) Ej. Para el arriendo' : 'Ej. Mercado del sábado...'}
              value={description} onChange={e => setDescription(e.target.value)} style={inputStyle} />
            {type === 'APORTE' && !description && (
              <p style={{ fontSize: '11px', color: '#2563eb', marginTop: '6px' }}>
                💡 Se guardará como: "Transferencia: {myProfile?.email?.split('@')[0] || 'Yo'} ➔{' '}
                {transferMode === 'POOL' ? 'Fondo Común' : (familyMembers.find((m: any) => m.id === targetUserId)?.email?.split('@')[0] || '...')}"
              </p>
            )}
          </div>

          {/* Monto */}
          <div>
            <label style={labelStyle}>Monto (COP)</label>
            <input type="text" placeholder="0,00" value={amount}
              onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur}
              style={{ ...inputStyle, fontSize: '20px', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.5px' }} />
          </div>

          {/* Cuentas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>
                {type === 'APORTE' ? 'Desde (Tu cuenta)' : 'Cuenta origen'}
              </label>
              <AccountSelect
                accounts={originAccounts}
                value={selectedAsset}
                onChange={setSelectedAsset}
                placeholder="Seleccionar..."
                accentColor="#2563eb"
              />
            </div>
            <div>
              <label style={labelStyle}>
                {type === 'APORTE'
                  ? (transferMode === 'MEMBER' ? 'Cuenta de él/ella' : 'Cuenta del fondo')
                  : 'Categoría / Destino'}
              </label>
              <AccountSelect
                accounts={destOptions}
                value={selectedDestination}
                onChange={setSelectedDestination}
                placeholder="Seleccionar..."
                disabled={type === 'APORTE' && transferMode === 'MEMBER' && !targetUserId}
                accentColor={type === 'GASTO' ? '#dc2626' : type === 'INGRESO' ? '#059669' : '#2563eb'}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={labelStyle}>Notas (opcional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
              placeholder="Observaciones adicionales..."
              style={{ ...inputStyle, resize: 'none', fontFamily: 'inherit' }} />
          </div>
        </div>
      </div>

      {/* ── BOTÓN SUBMIT ── */}
      <button type="submit" disabled={loading} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
        background: loading ? '#93c5fd' : 'linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%)',
        color: 'white', fontSize: '15px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
        boxShadow: '0 4px 16px rgba(37,99,235,0.35)', transition: 'all 0.15s',
      }}>
        {loading
          ? <><Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> Procesando...</>
          : <><Send size={16} /> {type === 'APORTE' ? 'Enviar dinero' : 'Guardar movimiento'}</>
        }
      </button>
    </form>
  )
}

export default function NuevaTransaccionPage() {
  return (
    <div style={{ maxWidth: '560px', margin: '0 auto', paddingBottom: '40px' }}>
      <Link href="/dashboard">
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: '#64748b',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          marginBottom: '20px', padding: '0'
        }}>
          <ArrowLeft size={15} /> Volver al resumen
        </button>
      </Link>

      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
          Nueva Transacción
        </h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
          Registra un gasto, ingreso o transferencia
        </p>
      </div>

      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px', color: '#94a3b8' }}>
          <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
        </div>
      }>
        <TransactionForm />
      </Suspense>
    </div>
  )
}
