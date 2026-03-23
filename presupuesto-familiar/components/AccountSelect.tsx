'use client'
import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface Account {
  id: string
  name: string
  icon: string
}

interface AccountSelectProps {
  accounts: Account[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
  accentColor?: string
}

export default function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = 'Seleccionar cuenta...',
  disabled = false,
  accentColor = '#2563eb',
}: AccountSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = accounts.find(a => a.id === value)

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Color de fondo por sigla (hash simple para variedad)
  const siglaColors = [
    { bg: '#eff6ff', color: '#1d4ed8' }, // azul
    { bg: '#ecfdf5', color: '#059669' }, // verde
    { bg: '#fef3c7', color: '#b45309' }, // amarillo
    { bg: '#fdf2f8', color: '#be185d' }, // rosa
    { bg: '#f5f3ff', color: '#6d28d9' }, // violeta
    { bg: '#fff7ed', color: '#c2410c' }, // naranja
    { bg: '#f0fdf4', color: '#15803d' }, // verde claro
    { bg: '#e0f2fe', color: '#0369a1' }, // celeste
  ]

  const getSiglaStyle = (icon: string, index: number) => {
    const colorSet = siglaColors[index % siglaColors.length]
    return colorSet
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>

      {/* ── BOTÓN TRIGGER ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(prev => !prev)}
        style={{
          width: '100%', padding: '10px 14px',
          borderRadius: '10px',
          border: `1.5px solid ${open ? accentColor : '#e2e8f0'}`,
          background: disabled ? '#f8fafc' : 'white',
          display: 'flex', alignItems: 'center', gap: '10px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: open ? `0 0 0 3px ${accentColor}18` : 'none',
          transition: 'all 0.15s',
          outline: 'none', boxSizing: 'border-box',
        }}
      >
        {selected ? (
          <>
            {/* Badge sigla */}
            <div style={{
              minWidth: '36px', height: '28px', borderRadius: '7px',
              background: getSiglaStyle(selected.icon, accounts.indexOf(selected)).bg,
              border: `1px solid ${getSiglaStyle(selected.icon, accounts.indexOf(selected)).color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 6px', flexShrink: 0,
            }}>
              <span style={{
                fontSize: '10px', fontWeight: 800,
                color: getSiglaStyle(selected.icon, accounts.indexOf(selected)).color,
                letterSpacing: '0.5px', textTransform: 'uppercase',
                fontFamily: 'monospace'
              }}>
                {selected.icon}
              </span>
            </div>
            {/* Nombre */}
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', textAlign: 'left', flex: 1 }}>
              {selected.name}
            </span>
          </>
        ) : (
          <span style={{ fontSize: '14px', color: '#94a3b8', flex: 1, textAlign: 'left' }}>
            {placeholder}
          </span>
        )}

        {/* Chevron */}
        <ChevronDown
          size={16}
          style={{
            color: '#94a3b8', flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease'
          }}
        />
      </button>

      {/* ── DROPDOWN ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 100,
          background: 'white', borderRadius: '14px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          animation: 'dropdownIn 0.15s ease',
        }}>
          {/* Header del dropdown */}
          <div style={{
            padding: '10px 14px 8px',
            borderBottom: '1px solid #f1f5f9',
            background: '#f8fafc'
          }}>
            <p style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
              {accounts.length} cuenta{accounts.length !== 1 ? 's' : ''} disponible{accounts.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Lista de opciones */}
          <div style={{ maxHeight: '240px', overflowY: 'auto', padding: '6px' }}>
            {accounts.length === 0 ? (
              <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '20px' }}>
                Sin cuentas disponibles
              </p>
            ) : accounts.map((acc, index) => {
              const isSelected = acc.id === value
              const colorSet = getSiglaStyle(acc.icon, index)
              return (
                <div
                  key={acc.id}
                  onClick={() => { onChange(acc.id); setOpen(false) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 12px', borderRadius: '10px', cursor: 'pointer',
                    background: isSelected ? `${accentColor}10` : 'transparent',
                    transition: 'background 0.1s',
                    marginBottom: '2px',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f8fafc'
                  }}
                  onMouseLeave={e => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  {/* Badge sigla */}
                  <div style={{
                    minWidth: '40px', height: '32px', borderRadius: '8px',
                    background: colorSet.bg,
                    border: `1px solid ${colorSet.color}30`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 8px', flexShrink: 0,
                  }}>
                    <span style={{
                      fontSize: '11px', fontWeight: 800, color: colorSet.color,
                      letterSpacing: '0.5px', textTransform: 'uppercase', fontFamily: 'monospace'
                    }}>
                      {acc.icon}
                    </span>
                  </div>

                  {/* Nombre cuenta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '13px', fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? accentColor : '#1e293b',
                      margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>
                      {acc.name}
                    </p>
                  </div>

                  {/* Check si seleccionado */}
                  {isSelected && (
                    <Check size={15} style={{ color: accentColor, flexShrink: 0 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Animación */}
      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
