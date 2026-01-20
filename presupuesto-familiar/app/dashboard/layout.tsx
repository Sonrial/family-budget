// Ruta: app/dashboard/layout.tsx
'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.push('/')
      setUser(user)
    }
    checkUser()
  }, [])

  if (!user) return <div className="p-10 text-black">Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <nav className="bg-blue-800 text-white p-4 flex justify-between items-center shadow-lg">
        <div className="font-bold text-xl">🏠 Familia Barrios</div>
        <div className="flex gap-4">
          <Link href="/dashboard" className="hover:text-blue-200">Resumen</Link>
          <Link href="/dashboard/transaccion" className="hover:text-blue-200">Nueva Transacción</Link>
          <button onClick={async () => {
             await supabase.auth.signOut()
             router.push('/')
          }} className="bg-red-500 px-3 py-1 rounded text-sm hover:bg-red-600">Salir</button>
        </div>
      </nav>
      <main className="p-4 max-w-5xl mx-auto">
        {children}
      </main>
    </div>
  )
}