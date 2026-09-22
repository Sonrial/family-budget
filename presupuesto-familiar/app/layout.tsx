import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = {
  title: { default: 'Presupuesto Familiar', template: '%s · Presupuesto Familiar' },
  description: 'Control contable y financiero para la familia.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <ThemeProvider>
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  )
}
