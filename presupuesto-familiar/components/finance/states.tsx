import type { LucideIcon } from 'lucide-react'
import { Inbox, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function LoadingState({ label = 'Cargando información…' }: { label?: string }) {
  return (
    <Card>
      <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-7 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm">{label}</p>
      </CardContent>
    </Card>
  )
}

export function EmptyState({ title, description, icon: Icon = Inbox }: {
  title: string
  description: string
  icon?: LucideIcon
}) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/25 p-6 text-center">
      <span className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted">
        <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
