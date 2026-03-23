'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')
  const router   = useRouter()
  const supabase = createClient()

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: email.split('@')[0] } }
      })
      if (error) setError(error.message)
      else setSuccess('Revisa tu correo para confirmar tu cuenta.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError('Correo o contraseña incorrectos.')
      else router.push('/dashboard')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4
      bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900">

      {/* Fondo decorativo */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-blue-700/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">

        {/* Header */}
        <div className="text-center mb-8 select-none">
          <div className="text-6xl mb-4 drop-shadow-lg">💰</div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Presupuesto Barrios
          </h1>
          <p className="text-blue-300/80 text-sm mt-1.5">
            Control financiero familiar
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20
          rounded-2xl p-8 shadow-2xl shadow-blue-950/50">

          <h2 className="text-white font-bold text-lg mb-6 text-center">
            {isSignUp ? '✨ Crear cuenta nueva' : '👋 Bienvenido de vuelta'}
          </h2>

          <form onSubmit={handleAuth} className="space-y-4">

            <div className="space-y-1.5">
              <label className="block text-blue-200 text-sm font-semibold">
                Correo electrónico
              </label>
              <input
                type="email"
                placeholder="correo@ejemplo.com"
                autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20
                  text-white placeholder:text-white/30 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                  transition hover:bg-white/15"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-blue-200 text-sm font-semibold">
                Contraseña
              </label>
              <input
                type="password"
                placeholder="••••••••"
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20
                  text-white placeholder:text-white/30 text-sm
                  focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent
                  transition hover:bg-white/15"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Mensaje de error */}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-500/20 border border-red-400/30
                text-red-200 text-sm px-4 py-3 rounded-xl">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            {/* Mensaje de éxito */}
            {success && (
              <div className="flex items-start gap-2.5 bg-green-500/20 border border-green-400/30
                text-green-200 text-sm px-4 py-3 rounded-xl">
                <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-2
                bg-blue-500 hover:bg-blue-400 active:bg-blue-600
                disabled:opacity-50 disabled:cursor-not-allowed
                text-white font-bold py-3 rounded-xl
                transition-all shadow-lg shadow-blue-900/40 text-sm">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</>
                : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 text-center">
            <button
              type="button"
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess('') }}
              className="text-sm text-blue-300 hover:text-white transition-colors font-medium">
              {isSignUp
                ? '¿Ya tienes cuenta? → Inicia sesión'
                : '¿No tienes cuenta? → Regístrate'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-blue-400/50 text-xs mt-6">
          Familia Barrios · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
