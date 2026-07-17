'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3, ChevronRight, CreditCard, History, LayoutDashboard,
  LogOut, Menu, PiggyBank, PlusCircle, Settings,
} from 'lucide-react'
import { getBrowserClient } from '@/lib/supabase/client'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard', label: 'Resumen', icon: LayoutDashboard },
  { href: '/dashboard/transaccion', label: 'Nueva transacción', icon: PlusCircle },
  { href: '/dashboard/movimientos', label: 'Historial', icon: History },
  { href: '/dashboard/obligaciones', label: 'Deudas y pagos', icon: CreditCard },
  { href: '/dashboard/cuentas', label: 'Cuentas', icon: Settings },
  { href: '/dashboard/reportes', label: 'Reportes', icon: BarChart3 },
] as const

function Navigation({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Navegación principal" className="space-y-1">
      {links.map(({ href, label, icon: Icon }) => {
        const active = pathname === href
        return (
          <Link key={href} href={href} className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            active ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )} aria-current={active ? 'page' : undefined}>
            <Icon className="size-4" aria-hidden="true" />
            <span>{label}</span>
            {active && <ChevronRight className="ms-auto size-4" aria-hidden="true" />}
          </Link>
        )
      })}
    </nav>
  )
}

function Brand() {
  return (
    <Link href="/dashboard" className="flex items-center gap-3">
      <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
        <PiggyBank className="size-5" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-bold">Presupuesto</span>
        <span className="block text-xs text-muted-foreground">Familia Barrios</span>
      </span>
    </Link>
  )
}

export function DashboardShell({ children, userEmail }: { children: React.ReactNode; userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const activePage = links.find((link) => link.href === pathname)?.label ?? 'Finanzas'

  const signOut = async () => {
    await getBrowserClient().auth.signOut()
    router.replace('/')
    router.refresh()
  }

  const userName = userEmail.split('@')[0]
  const userInitial = userEmail.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="sticky top-0 hidden h-screen border-r bg-card lg:flex lg:flex-col">
        <div className="p-5"><Brand /></div>
        <Separator />
        <div className="flex-1 p-3"><Navigation pathname={pathname} /></div>
        <div className="border-t p-4">
          <div className="mb-3 flex items-center gap-3 rounded-lg bg-muted/60 p-3">
            <Avatar className="size-9"><AvatarFallback>{userInitial}</AvatarFallback></Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold capitalize">{userName}</p>
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-destructive hover:text-destructive" onClick={signOut}>
            <LogOut aria-hidden="true" /> Cerrar sesión
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="lg:hidden" aria-label="Abrir navegación">
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[290px] p-0">
                <SheetHeader className="p-5 text-left"><SheetTitle><Brand /></SheetTitle></SheetHeader>
                <Separator />
                <div className="p-3"><Navigation pathname={pathname} /></div>
              </SheetContent>
            </Sheet>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Presupuesto familiar</p>
              <p className="text-sm font-semibold">{activePage}</p>
            </div>
          </div>
          <Avatar className="size-9 lg:hidden"><AvatarFallback>{userInitial}</AvatarFallback></Avatar>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
