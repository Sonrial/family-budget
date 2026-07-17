'use client'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

export interface AccountOption {
  id: string
  name: string
  icon: string | null
}

export default function AccountSelect({ accounts, value, onChange, label, placeholder = 'Seleccionar cuenta…', disabled = false }: {
  accounts: AccountOption[]
  value: string
  onChange: (id: string) => void
  label: string
  placeholder?: string
  disabled?: boolean
  accentColor?: string
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full" aria-label={label}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <span className="flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-bold text-muted-foreground">
                {account.icon || account.name.slice(0, 3).toUpperCase()}
              </span>
              <span>{account.name}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
