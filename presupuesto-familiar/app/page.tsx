'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Loader2, PiggyBank } from 'lucide-react'
import { getBrowserClient } from '@/lib/supabase/client'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const router = useRouter()

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const supabase = getBrowserClient()
      if (isSignUp) {
        if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.')
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: email.split('@')[0] } },
        })
        if (signUpError) throw signUpError
        setSuccess('Revisa tu correo para confirmar la cuenta. El acceso familiar requiere invitación.')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw new Error('Correo o contraseña incorrectos.')
        router.replace('/dashboard')
        router.refresh()
      }
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'No se pudo iniciar sesión.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="surface-grid relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,oklch(0.78_0.12_255/0.28),transparent_38%),radial-gradient(circle_at_bottom_left,oklch(0.72_0.13_195/0.2),transparent_34%)]" />
      <div className="relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <PiggyBank className="size-7" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Presupuesto Barrios</h1>
          <p className="mt-2 text-sm text-muted-foreground">Control financiero familiar, claro y seguro</p>
        </div>

        <Card className="border-border/80 shadow-xl shadow-slate-900/8">
          <CardHeader className="text-center">
            <CardTitle>{isSignUp ? 'Crear cuenta' : 'Bienvenido de vuelta'}</CardTitle>
            <CardDescription>
              {isSignUp ? 'Tu información personal queda separada del hogar.' : 'Ingresa para consultar y registrar movimientos.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" type="email" autoComplete="email" value={email}
                  onChange={(event) => setEmail(event.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <Input id="password" type="password"
                  autoComplete={isSignUp ? 'new-password' : 'current-password'} value={password}
                  onChange={(event) => setPassword(event.target.value)} minLength={isSignUp ? 8 : undefined} required />
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle aria-hidden="true" />
                  <AlertTitle>No fue posible continuar</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="border-emerald-200 bg-emerald-50 text-emerald-900">
                  <CheckCircle2 aria-hidden="true" />
                  <AlertTitle>Cuenta creada</AlertTitle>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
                {loading ? 'Procesando…' : isSignUp ? 'Crear cuenta' : 'Iniciar sesión'}
              </Button>
            </form>

            <div className="mt-6 border-t pt-5 text-center">
              <Button type="button" variant="link" onClick={() => {
                setIsSignUp((current) => !current)
                setError('')
                setSuccess('')
              }}>
                {isSignUp ? 'Ya tengo cuenta' : 'Crear una cuenta personal'}
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-muted-foreground">Familia Barrios · {new Date().getFullYear()}</p>
      </div>
    </main>
  )
}
