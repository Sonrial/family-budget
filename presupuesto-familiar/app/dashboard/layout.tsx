'use client'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const router = useRouter()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-blue-600 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* ENLACES DE NAVEGACIÓN */}
            <div className="flex space-x-6 overflow-x-auto no-scrollbar">
              <Link href="/dashboard" className="text-white hover:text-blue-200 font-medium transition-colors whitespace-nowrap">
                Resumen
              </Link>
              <Link href="/dashboard/transaccion" className="text-white hover:text-blue-200 font-medium transition-colors whitespace-nowrap">
                Nueva Transacción
              </Link>
              <Link href="/dashboard/movimientos" className="text-white hover:text-blue-200 font-medium transition-colors whitespace-nowrap">
                Historial
              </Link>
              <Link href="/dashboard/reportes" className="text-white hover:text-blue-200 font-medium transition-colors whitespace-nowrap">
                Reportes
              </Link>
              <Link href="/dashboard/obligaciones" className="text-white hover:text-blue-200 font-medium transition-colors whitespace-nowrap">
                Deudas y Pagos
              </Link>
              <Link href="/dashboard/cuentas" className="text-white hover:text-blue-200 font-medium transition-colors whitespace-nowrap">
                Mis Cuentas
              </Link>
            </div>
            
            {/* BOTÓN SALIR */}
            <button onClick={handleLogout} className="flex items-center hover:text-blue-200 ml-4 shrink-0 font-medium">
              <LogOut className="w-5 h-5 mr-1" /> Salir
            </button>
          </div>
        </div>
      </nav>

      {/* CONTENIDO DE LA PÁGINA */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}