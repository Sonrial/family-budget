'use client'
import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Save, Trash2, CalendarIcon, Loader2, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { formatCurrency } from '@/lib/formatters'

export default function DetalleMovimientoPage({ params }: { params: Promise<{ id: string }> }) {
  const [txId, setTxId] = useState<string>('')
  useEffect(() => { params.then(p => setTxId(p.id)) }, [params])

  const supabase = createClient()
  const router   = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const [tx,     setTx]     = useState<any>(null)
  const [lines,  setLines]  = useState<any[]>([])
  const [notes,  setNotes]  = useState('')
  const [amount, setAmount] = useState('')
  const [date,   setDate]   = useState('')

  useEffect(() => {
    if (!txId) return
    const fetchTx = async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, transaction_lines(*, account:accounts(name, icon))')
        .eq('id', txId)
        .single()
      if (error) { router.push('/dashboard/movimientos'); return }
      setTx(data)
      setLines(data.transaction_lines || [])
      setNotes(data.notes || '')
      if (data.date) setDate(new Date(data.date).toISOString().split('T')[0])
      const posLine = data.transaction_lines.find((l: any) => l.amount > 0)
      if (posLine) {
        setAmount(new Intl.NumberFormat('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(posLine.amount))
      }
      setLoading(false)
    }
    fetchTx()
  }, [txId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))
  const handleFocus  = () => setAmount(amount.replace(/\./g, ''))
  const handleBlur   = () => {
    if (!amount) return
    let val = amount.replace(/\./g, ',')
    const parts = val.split(',')
    const intPart = parts[0].replace(/\D/g, '')
    if (!intPart) { setAmount(''); return }
    const formatted = new Intl.NumberFormat('es-CO').format(BigInt(intPart))
    setAmount(parts[1] !== undefined ? `${formatted},${parts[1].slice(0, 2)}` : formatted)
  }

  const handleUpdate = async () => {
    setSaving(true)
    const newAmount = parseFloat(amount.replace(/\./g, '').replace(',', '.'))
    if (!newAmount || newAmount <= 0) { alert('Monto inválido'); setSaving(false); return }
    if (!date) { alert('Fecha inválida'); setSaving(false); return }
    await supabase.from('transactions').update({ notes, date: new Date(date + 'T12:00:00').toISOString() }).eq('id', txId)
    const { data: txLines } = await supabase.from('transaction_lines').select('*').eq('transaction_id', txId)
    if (txLines) {
      for (const line of txLines) {
        await supabase.from('transaction_lines').update({ amount: line.amount > 0 ? newAmount : -newAmount }).eq('id', line.id)
      }
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => { router.push('/dashboard/movimientos') }, 900)
  }

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este movimiento permanentemente? Los saldos se ajustarán.')) return
    await supabase.from('transactions').delete().eq('id', txId)
    router.push('/dashboard/movimientos')
  }

  // ── CONFIGURACIÓN VISUAL POR TIPO ──
  const typeConfig: Record<string, { label: string; emoji: string; color: string; bg: string; border: string }> = {
    GASTO:   { label: 'Gasto',        emoji: '📉', color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
    INGRESO: { label: 'Ingreso',      emoji: '📈', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0' },
    APORTE:  { label: 'Transferencia',emoji: '🔄', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 14px', borderRadius: '10px',
    border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none',
    background: 'white', color: '#1e293b', boxSizing: 'border-box', fontFamily: 'inherit'
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 700,
    color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px'
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px', gap: '14px', color: '#94a3b8' }}>
      <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: '#2563eb' }} />
      <span style={{ fontSize: '13px' }}>Cargando movimiento...</span>
    </div>
  )

  const cfg = typeConfig[tx.type] || typeConfig['GASTO']
  const originLine = lines.find((l: any) => l.amount < 0)
  const destLine   = lines.find((l: any) => l.amount > 0)

  return (
    <div style={{ maxWidth: '520px', margin: '0 auto', paddingBottom: '40px' }}>

      {/* ── BOTÓN VOLVER ── */}
      <Link href="/dashboard/movimientos">
        <button style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: 'none', border: 'none', color: '#64748b',
          fontSize: '13px', fontWeight: 600, cursor: 'pointer',
          marginBottom: '20px', padding: '0'
        }}>
          <ArrowLeft size={15} /> Volver al historial
        </button>
      </Link>

      {/* ── ENCABEZADO ── */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.5px' }}>
          Detalle del Movimiento
        </h2>
        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '4px' }}>
          Edita o elimina este registro
        </p>
      </div>

      {/* ── BADGE TIPO ── */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: '8px',
        background: cfg.bg, border: `1px solid ${cfg.border}`,
        borderRadius: '99px', padding: '6px 16px', marginBottom: '20px'
      }}>
        <span style={{ fontSize: '16px' }}>{cfg.emoji}</span>
        <span style={{ fontSize: '13px', fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
      </div>

      {/* ── CARD DESCRIPCIÓN ── */}
      <div style={{
        background: 'white', borderRadius: '18px', border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', marginBottom: '14px', overflow: 'hidden'
      }}>
        {/* Header degradado sutil */}
        <div style={{
          background: `linear-gradient(135deg, ${cfg.bg} 0%, white 100%)`,
          padding: '20px 24px', borderBottom: '1px solid #f1f5f9'
        }}>
          <p style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 6px' }}>
            Descripción
          </p>
          <p style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            {tx.description}
          </p>
        </div>

        {/* Flujo de cuentas */}
        {(originLine || destLine) && (
          <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {originLine?.account && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: '8px', padding: '6px 12px'
              }}>
                <span style={{ fontSize: '13px' }}>{originLine.account.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{originLine.account.name}</span>
              </div>
            )}
            {originLine?.account && destLine?.account && (
              <span style={{ fontSize: '16px', color: '#cbd5e1' }}>→</span>
            )}
            {destLine?.account && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: '#f8fafc', border: '1px solid #e2e8f0',
                borderRadius: '8px', padding: '6px 12px'
              }}>
                <span style={{ fontSize: '13px' }}>{destLine.account.icon}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>{destLine.account.name}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── CARD CAMPOS EDITABLES ── */}
      <div style={{
        background: 'white', borderRadius: '18px', border: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)', padding: '22px 24px',
        display: 'flex', flexDirection: 'column', gap: '18px', marginBottom: '14px'
      }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
          ✏️ Campos editables
        </p>

        {/* Fecha */}
        <div>
          <label style={labelStyle}>Fecha del movimiento</label>
          <div style={{ position: 'relative' }}>
            <CalendarIcon size={15} style={{ position: 'absolute', left: '13px', top: '12px', color: '#94a3b8', pointerEvents: 'none' }} />
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ ...inputStyle, paddingLeft: '38px' }}
            />
          </div>
        </div>

        {/* Monto */}
        <div>
          <label style={labelStyle}>Monto (COP)</label>
          <input
            type="text" value={amount} placeholder="0,00"
            onChange={handleChange} onFocus={handleFocus} onBlur={handleBlur}
            style={{
              ...inputStyle,
              fontSize: '24px', fontWeight: 800, fontFamily: 'monospace',
              color: cfg.color, letterSpacing: '-0.5px'
            }}
          />
        </div>

        {/* Notas */}
        <div>
          <label style={labelStyle}>Notas / Detalles (opcional)</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)} rows={4}
            placeholder="Agrega observaciones o detalles adicionales..."
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>
      </div>

      {/* ── BOTONES DE ACCIÓN ── */}
      <div style={{ display: 'flex', gap: '10px' }}>
        {/* Guardar */}
        <button
          onClick={handleUpdate} disabled={saving || saved}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            padding: '15px', borderRadius: '14px', border: 'none',
            background: saved
              ? 'linear-gradient(135deg, #059669, #10b981)'
              : saving
              ? '#93c5fd'
              : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
            color: 'white', fontSize: '14px', fontWeight: 700,
            cursor: saving || saved ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 14px rgba(37,99,235,0.3)', transition: 'all 0.2s'
          }}
        >
          {saved
            ? <><CheckCircle size={16} /> Guardado</>
            : saving
            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Guardando...</>
            : <><Save size={16} /> Guardar cambios</>
          }
        </button>

        {/* Eliminar */}
        <button
          onClick={handleDelete}
          style={{
            width: '52px', height: '52px', borderRadius: '14px', border: '1px solid #fecaca',
            background: '#fef2f2', color: '#dc2626', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s', flexShrink: 0
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#dc2626'; (e.currentTarget as HTMLElement).style.color = 'white' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; (e.currentTarget as HTMLElement).style.color = '#dc2626' }}
        >
          <Trash2 size={18} />
        </button>
      </div>

      {/* Advertencia eliminación */}
      <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '10px' }}>
        ⚠️ Eliminar ajustará permanentemente los saldos de las cuentas afectadas.
      </p>
    </div>
  )
}
