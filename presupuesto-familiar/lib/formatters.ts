const currencyFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const formatCurrency = (amount: number): string => currencyFormatter.format(amount)

export const formatDate = (dateString: string): string => {
  if (!dateString) return ''
  const [year, month, day] = dateString.substring(0, 10).split('-')
  return `${day}/${month}/${year}`
}

export const getLocalDateInputValue = (date = new Date()): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const getLocalMonthInputValue = (date = new Date()): string =>
  getLocalDateInputValue(date).slice(0, 7)

export const parseCurrencyInput = (value: string): number => {
  const normalized = value.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const parsed = Number.parseFloat(normalized)
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0
}

export const formatCurrencyInput = (value: string): string => {
  const parsed = parseCurrencyInput(value)
  if (!parsed) return ''
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 }).format(parsed)
}

export const getMonthBounds = (monthValue: string): { start: string; end: string } => {
  const [year, month] = monthValue.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${String(month).padStart(2, '0')}-01`,
    end: `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  }
}
