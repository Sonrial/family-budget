import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

// Importamos la fuente elegante
const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Finanzas Familiares | Synergy",
  description: "Sistema avanzado de control financiero.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // className="dark" activa nuestra nueva paleta oscura
  return (
    <html lang="es" className="dark">
      <body className={`${inter.className} antialiased`}>
        {children}
      </body>
    </html>
  )
}