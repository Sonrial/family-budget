// src/lib/formatters.ts

/**
 * Formatea un número a moneda colombiana (COP) con 2 decimales.
 */
export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
}

/**
 * Recibe una fecha ISO (Ej: 2026-01-01T12:00:00) y devuelve DD/MM/YYYY
 * Evita problemas de zona horaria restando días.
 */
export const formatDate = (dateString: string): string => {
    if (!dateString) return ''
    const [year, month, day] = dateString.substring(0, 10).split('-')
    return `${day}/${month}/${year}`
}