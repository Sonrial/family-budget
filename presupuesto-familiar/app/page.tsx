// Ruta: app/page.tsx
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: email.split('@')[0] } }
      })
      if (error) alert(error.message)
      else alert('Revisa tu correo (o inicia sesión si desactivaste confirmación)')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) alert(error.message)
      else router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleAuth} className="w-full max-w-md bg-white p-8 rounded shadow-md text-black">
        <h1 className="text-2xl font-bold mb-6 text-center text-blue-800">
          Presupuesto Barrios
        </h1>
        <div className="space-y-4">
          <input
            type="email" placeholder="Correo"
            className="w-full p-2 border rounded text-black"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <input
            type="password" placeholder="Contraseña"
            className="w-full p-2 border rounded text-black"
            value={password} onChange={(e) => setPassword(e.target.value)} required
          />
          <button disabled={loading} className="w-full bg-blue-600 text-white p-2 rounded hover:bg-blue-700">
            {loading ? 'Procesando...' : (isSignUp ? 'Registrarse' : 'Iniciar Sesión')}
          </button>
          <p 
            className="text-center text-sm text-gray-500 cursor-pointer hover:underline"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </p>
        </div>
      </form>
    </div>
  )
}