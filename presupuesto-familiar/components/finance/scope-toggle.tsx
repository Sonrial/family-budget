import { Users, Wallet } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { ScopeType } from '@/lib/types'

export function ScopeToggle({ value, onChange }: {
  value: ScopeType
  onChange: (value: ScopeType) => void
}) {
  return (
    <Tabs value={value} onValueChange={(next) => onChange(next as ScopeType)}>
      <TabsList>
        <TabsTrigger value="PERSONAL"><Wallet aria-hidden="true" /> Personal</TabsTrigger>
        <TabsTrigger value="SHARED"><Users aria-hidden="true" /> Familiar</TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
