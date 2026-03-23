'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { 
  LayoutDashboard, 
  PlusCircle, 
  ScrollText, 
  Wallet, 
  PieChart, 
  LogOut,
  Menu,
  X,
  CreditCard,
  TerminalSquare
} from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Lista de navegación centralizada
  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Nueva Transacción', href: '/dashboard/transaccion', icon: PlusCircle },
    { name: 'Historial', href: '/dashboard/movimientos', icon: ScrollText },
    { name: 'Reportes', href: '/dashboard/reportes', icon: PieChart },
    { name: 'Deudas y Pagos', href: '/dashboard/obligaciones', icon: CreditCard },
    { name: 'Configuración', href: '/dashboard/cuentas', icon: Wallet },
  ]

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">
      
      {/* --- SIDEBAR PARA PC --- */}
      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card shadow-2xl">
        <div className="h-20 flex items-center px-6 border-b border-border">
          <div className="flex items-center gap-3 text-primary">
            <TerminalSquare className="w-8 h-8 text-primary" />
            <span className="font-bold text-xl tracking-widest uppercase">SYNERGY</span>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link 
                key={item.name} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group ${
                  isActive 
                    ? 'bg-primary/10 text-primary font-medium border border-primary/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]' 
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : 'group-hover:text-foreground'}`} />
                {item.name}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 px-4 py-3 w-full rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors font-medium"
          >
            <LogOut className="w-5 h-5" />
            Desconectar
          </button>
        </div>
      </aside>

      {/* --- CONTENIDO PRINCIPAL Y HEADER MÓVIL --- */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        
        {/* Header solo visible en celular */}
        <header className="md:hidden h-16 flex items-center justify-between px-4 border-b border-border bg-card z-20 shadow-md">
          <div className="flex items-center gap-2 text-primary">
            <TerminalSquare className="w-6 h-6" />
            <span className="font-bold text-lg tracking-widest uppercase">SYNERGY</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-foreground p-2 focus:outline-none">
            {isMobileMenuOpen ? <X className="w-6 h-6 text-primary" /> : <Menu className="w-6 h-6 text-primary" />}
          </button>
        </header>

        {/* Menú Desplegable Móvil */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bottom-0 bg-background z-10 flex flex-col animate-in slide-in-from-top-5">
            <nav className="flex-1 px-4 py-6 space-y-3 overflow-y-auto">
              {navItems.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                  <Link 
                    key={item.name} 
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-4 rounded-xl transition-all ${
                      isActive 
                        ? 'bg-primary/10 text-primary font-medium border border-primary/20 shadow-inner' 
                        : 'text-muted-foreground bg-card hover:bg-secondary hover:text-foreground'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
                    <span className="text-lg">{item.name}</span>
                  </Link>
                )
              })}
            </nav>
            <div className="p-6 border-t border-border bg-card">
              <button 
                onClick={handleLogout}
                className="flex items-center justify-center gap-3 px-4 py-4 w-full rounded-xl text-destructive border border-destructive/30 bg-destructive/10 font-bold text-lg"
              >
                <LogOut className="w-5 h-5" />
                Desconectar
              </button>
            </div>
          </div>
        )}

        {/* Contenedor donde se cargan todas las páginas (Dashboard, Reportes, etc.) */}
        <main className="flex-1 overflow-y-auto bg-background p-4 md:p-8 scroll-smooth">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}