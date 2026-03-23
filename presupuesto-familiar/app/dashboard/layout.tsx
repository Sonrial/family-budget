'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, PlusCircle, History,
  CreditCard, Settings, BarChart2,
  LogOut, Menu, X
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/dashboard',              label: 'Resumen',           icon: LayoutDashboard },
  { href: '/dashboard/transaccion',  label: 'Nueva Transacción', icon: PlusCircle      },
  { href: '/dashboard/movimientos',  label: 'Historial',         icon: History         },
  { href: '/dashboard/obligaciones', label: 'Deudas y Pagos',    icon: CreditCard      },
  { href: '/dashboard/cuentas',      label: 'Cuentas',           icon: Settings        },
  { href: '/dashboard/reportes',     label: 'Reportes',          icon: BarChart2       },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser]         = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/')
      setUser(user)
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <div className="w-8 h-8 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Cargando sesión...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">

      {/* ════════════════ NAVBAR ════════════════ */}
      <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/dashboard"
            className="flex items-center gap-2 font-extrabold text-blue-700 text-xl shrink-0 hover:text-blue-600 transition-colors">
            💰 <span className="hidden sm:inline tracking-tight">Presupuesto Barrios</span>
          </Link>

          {/* Links desktop */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${active
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>

          {/* Zona derecha */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Email del usuario — solo en pantallas grandes */}
            <div className="hidden xl:flex flex-col items-end">
              <span className="text-xs font-semibold text-slate-700 truncate max-w-[180px]">
                {user.email?.split('@')[0]}
              </span>
              <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                {user.email}
              </span>
            </div>

            {/* Botón salir desktop */}
            <button onClick={handleSignOut}
              className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700 transition-colors">
              <LogOut className="w-4 h-4" /> Salir
            </button>

            {/* Botón hamburguesa — solo mobile/tablet */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* ── Menú Mobile desplegable ── */}
        {menuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 px-4 py-3 space-y-1 shadow-lg">
            {/* Info usuario */}
            <div className="px-3 py-2 mb-2 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-xs font-semibold text-slate-700">{user.email?.split('@')[0]}</p>
              <p className="text-[11px] text-slate-400">{user.email}</p>
            </div>

            {NAV_LINKS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link key={href} href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                    ${active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              )
            })}

            <button onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 w-full mt-1 border-t border-slate-100 pt-3 transition-colors">
              <LogOut className="w-4 h-4" /> Cerrar sesión
            </button>
          </div>
        )}
      </header>

      {/* ════════════════ CONTENIDO ════════════════ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  )
}
