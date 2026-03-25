// src/components/ThemeToggle.tsx
import { Sun, Moon } from 'lucide-react'

interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`relative flex items-center justify-between w-14 h-7 rounded-full px-1 transition-colors ${
        isDark ? 'bg-blue-600' : 'bg-zinc-300'
      }`}
      aria-label="Toggle theme"
    >
      <Sun className="w-4 h-4 text-amber-400 z-10" />
      <Moon className={`w-3.5 h-3.5 z-10 ${isDark ? 'text-white' : 'text-zinc-500'}`} />
      <div
        className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-200 ${
          isDark ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
