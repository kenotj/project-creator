// src/components/TemplateList.tsx
import { FolderIcon, PlusIcon } from 'lucide-react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { ThemeToggle } from './ThemeToggle'
import type { Template } from '@/lib/models'
import { cn } from '@/lib/utils'

interface TemplateListProps {
  templates: Template[]
  selectedId: string | null
  dirtyIds?: Set<string>
  isDark: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onToggleTheme: () => void
}

export function TemplateList({
  templates,
  selectedId,
  dirtyIds = new Set<string>(),
  isDark,
  onSelect,
  onNew,
  onToggleTheme,
}: TemplateListProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Templates
        </span>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors',
                t.id === selectedId
                  ? 'bg-accent border border-muted text-foreground font-bold shadow-sm'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <FolderIcon
                className={cn(
                  'w-3.5 h-3.5 flex-shrink-0',
                  t.id === selectedId ? 'text-foreground' : 'text-muted-foreground/50'
                )}
              />
              <span className={cn("flex-1 truncate", t.id === selectedId && "font-bold text-foreground")}>{t.name}</span>
              {(t.id === selectedId || dirtyIds.has(t.id)) && (
                <span className={cn(
                  'w-1.5 h-1.5 rounded-full flex-shrink-0',
                  dirtyIds.has(t.id) ? 'bg-amber-400' : 'bg-foreground'
                )} />
              )}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <Button variant="outline" size="sm" className="w-full" onClick={onNew}>
          <PlusIcon className="w-3 h-3 mr-1.5" />
          New Template
        </Button>
      </div>
    </>
  )
}
