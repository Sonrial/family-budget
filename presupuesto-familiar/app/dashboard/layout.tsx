'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, PlusCircle, History,
  CreditCard, Settings, BarChart2,
  LogOut, Menu, X, ChevronRight
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/dashboard',              label: 'Resumen',           icon: LayoutDashboard, color: '#2563eb' },
  { href: '/dashboard/transaccion',  label: 'Nueva Transacción', icon: PlusCircle,       color: '#059669' },
  { href: '/dashboard/movimientos',  label: 'Historial',         icon: History,          color: '#8b5cf6' },
  { href: '/dashboard/obligaciones', label: 'Deudas y Pagos',    icon: CreditCard,       color: '#dc2626' },
  { href: '/dashboard/cuentas',      label: 'Configuración',     icon: Settings,         color: '#f59e0b' },
  { href: '/dashboard/reportes',     label: 'Reportes',          icon: BarChart2,        color: '#06b6d4' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]           = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/')
      setUser(user)
    })
  }, [])

  // Cerrar drawer al cambiar de ruta
  useEffect(() => { setDrawerOpen(false) }, [pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const userInitial = user?.email?.charAt(0).toUpperCase() || '?'
  const userName    = user?.email?.split('@')[0] || ''

  if (!user) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', color: '#94a3b8' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          border: '3px solid #2563eb', borderTopColor: 'transparent',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ fontSize: '13px', fontWeight: 600 }}>Cargando sesión...</span>
      </div>
    </div>
  )

  // ── COMPONENTE NAV ITEM (reutilizable para sidebar y drawer) ──
  const NavItem = ({ href, label, icon: Icon, color }: typeof NAV_LINKS[0]) => {
    const active = pathname === href
    return (
      <Link href={href} style={{ textDecoration: 'none' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '11px 14px', borderRadius: '12px', cursor: 'pointer',
          transition: 'all 0.15s', position: 'relative',
          background: active ? `${color}18` : 'transparent',
          marginBottom: '3px',
        }}
          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#f1f5f9' }}
          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent' }}
        >
          {/* Barra de acento izquierda */}
          {active && (
            <div style={{
              position: 'absolute', left: 0, top: '20%', bottom: '20%',
              width: '3px', borderRadius: '0 3px 3px 0',
              background: color
            }} />
          )}
          {/* Ícono */}
          <div style={{
            width: '34px', height: '34px', borderRadius: '9px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: active ? `${color}22` : '#f1f5f9',
            transition: 'all 0.15s',
          }}>
            <Icon size={17} style={{ color: active ? color : '#94a3b8' }} />
          </div>
          {/* Label */}
          <span style={{
            fontSize: '13px', fontWeight: active ? 700 : 500,
            color: active ? color : '#475569',
            transition: 'all 0.15s',
          }}>
            {label}
          </span>
          {/* Chevron si activo */}
          {active && <ChevronRight size={14} style={{ color, marginLeft: 'auto', opacity: 0.7 }} />}
        </div>
      </Link>
    )
  }

  // ── CONTENIDO DEL SIDEBAR (reutilizado en desktop y drawer) ──
  const SidebarContent = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <Link href="/dashboard" style={{ textDecoration: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
              background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '18px', boxShadow: '0 4px 10px rgba(37,99,235,0.35)'
            }}>
              💰
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0, letterSpacing: '-0.3px' }}>
                Presupuesto
              </p>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, fontWeight: 500 }}>
                Familia Barrios
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Navegación */}
      <nav style={{ flex: 1, padding: '16px 12px', overflowY: 'auto' }}>
        <p style={{
          fontSize: '10px', fontWeight: 700, color: '#cbd5e1',
          textTransform: 'uppercase', letterSpacing: '1px',
          padding: '0 14px', marginBottom: '8px'
        }}>
          Menú principal
        </p>
        {NAV_LINKS.map(link => <NavItem key={link.href} {...link} />)}
      </nav>

      {/* Usuario + Salir */}
      <div style={{ padding: '16px 12px', borderTop: '1px solid #f1f5f9' }}>
        {/* Avatar usuario */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '10px 12px', borderRadius: '12px',
          background: '#f8fafc', border: '1px solid #e2e8f0',
          marginBottom: '8px'
        }}>
          <div style={{
            width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 800, color: 'white'
          }}>
            {userInitial}
          </div>
          <div style={{ overflow: 'hidden' }}>
            <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </p>
            <p style={{ fontSize: '10px', color: '#94a3b8', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user.email}
            </p>
          </div>
        </div>

        {/* Botón cerrar sesión */}
        <button onClick={handleSignOut} style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          width: '100%', padding: '10px 14px', borderRadius: '11px',
          border: 'none', background: 'none', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600, color: '#dc2626',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = '#fef2f2')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <div style={{
            width: '30px', height: '30px', borderRadius: '8px',
            background: '#fef2f2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <LogOut size={14} style={{ color: '#dc2626' }} />
          </div>
          Cerrar sesión
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex' }}>

      {/* ══════════ SIDEBAR DESKTOP (≥1024px) ══════════ */}
      <aside style={{
        width: '240px', flexShrink: 0,
        background: 'white', borderRight: '1px solid #e2e8f0',
        position: 'sticky', top: 0, height: '100vh',
        display: 'none', // Controlado por media query via style tag
        flexDirection: 'column',
        boxShadow: '1px 0 0 #f1f5f9',
      }}
        className="desktop-sidebar"
      >
        <SidebarContent />
      </aside>

      {/* ══════════ ÁREA DERECHA ══════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* ── TOPBAR (visible en mobile, en desktop solo muestra título de sección) ── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 40,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e2e8f0',
          padding: '0 20px',
          height: '60px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Izquierda: hamburguesa (mobile) + breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Botón hamburguesa — solo mobile */}
            <button
              onClick={() => setDrawerOpen(true)}
              className="mobile-menu-btn"
              style={{
                width: '38px', height: '38px', borderRadius: '10px',
                border: '1px solid #e2e8f0', background: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0
              }}
            >
              <Menu size={18} style={{ color: '#475569' }} />
            </button>

            {/* Logo en mobile */}
            <div className="mobile-logo" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '9px',
                background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '16px', boxShadow: '0 2px 8px rgba(37,99,235,0.3)'
              }}>
                💰
              </div>
              <span style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>
                Presupuesto
              </span>
            </div>

            {/* Nombre de sección activa (desktop) */}
            <div className="desktop-section-label" style={{ display: 'none' }}>
              {(() => {
                const active = NAV_LINKS.find(l => l.href === pathname)
                if (!active) return null
                const Icon = active.icon
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Icon size={16} style={{ color: active.color }} />
                    <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e293b' }}>{active.label}</span>
                  </div>
                )
              })()}
            </div>
          </div>

          {/* Derecha: avatar usuario (desktop) */}
          <div className="desktop-user-badge" style={{ display: 'none', alignItems: 'center', gap: '10px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', margin: 0 }}>{userName}</p>
              <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{user.email}</p>
            </div>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #1d4ed8, #3b82f6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 800, color: 'white', flexShrink: 0
            }}>
              {userInitial}
            </div>
          </div>
        </header>

        {/* ── CONTENIDO PRINCIPAL ── */}
        <main style={{ flex: 1, padding: '28px 28px 48px', maxWidth: '1200px', width: '100%' }}>
          {children}
        </main>
      </div>

      {/* ══════════ DRAWER MOBILE ══════════ */}
      {/* Overlay */}
      {drawerOpen && (
        <div
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            background: 'rgba(15,23,42,0.5)',
            backdropFilter: 'blur(3px)',
            animation: 'fadeIn 0.2s ease'
          }}
        />
      )}

      {/* Panel del drawer */}
      <div style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 51,
        width: '280px', background: 'white',
        boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column',
        borderRadius: '0 20px 20px 0',
        overflow: 'hidden',
      }}>
        {/* Botón cerrar */}
        <button
          onClick={() => setDrawerOpen(false)}
          style={{
            position: 'absolute', top: '16px', right: '16px', zIndex: 1,
            width: '32px', height: '32px', borderRadius: '8px',
            border: '1px solid #e2e8f0', background: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <X size={16} style={{ color: '#94a3b8' }} />
        </button>

        <SidebarContent />
      </div>

      {/* ══════════ ESTILOS RESPONSIVE ══════════ */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0 }
          to   { opacity: 1 }
        }
        @keyframes spin {
          to { transform: rotate(360deg) }
        }

        /* Desktop: mostrar sidebar, ocultar elementos mobile */
        @media (min-width: 1024px) {
          .desktop-sidebar        { display: flex !important; }
          .mobile-menu-btn        { display: none !important; }
          .mobile-logo            { display: none !important; }
          .desktop-section-label  { display: flex !important; }
          .desktop-user-badge     { display: flex !important; }
        }

        /* Scrollbar delgado para la sidebar */
        nav::-webkit-scrollbar        { width: 4px; }
        nav::-webkit-scrollbar-track  { background: transparent; }
        nav::-webkit-scrollbar-thumb  { background: #e2e8f0; border-radius: 99px; }

        /* Smooth focus en inputs */
        input:focus, select:focus, textarea:focus {
          border-color: #2563eb !important;
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1) !important;
        }
      `}</style>
    </div>
  )
}
