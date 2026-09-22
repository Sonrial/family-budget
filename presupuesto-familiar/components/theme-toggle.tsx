'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  return (
    <div className="flex items-center rounded-xl border bg-card p-1" role="group" aria-label="Apariencia">
      {[
        { value: 'light', label: 'Modo claro', icon: Sun },
        { value: 'dark', label: 'Modo oscuro', icon: Moon },
        { value: 'system', label: 'Usar tema del sistema', icon: Monitor },
      ].map(({ value, label, icon: Icon }) => (
        <button key={value} type="button" title={label} aria-label={label}
          aria-pressed={mounted && theme === value} onClick={() => setTheme(value)}
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted aria-pressed:bg-primary aria-pressed:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          <Icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
