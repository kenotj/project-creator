// src/components/FolderTreeDragOverlay.tsx
import { FolderIcon } from 'lucide-react'
import type { FolderNode } from '@/lib/models'

interface Props {
  node: FolderNode
  depth: number
  count?: number
}

export function FolderTreeDragOverlay({ node, depth, count = 1 }: Props) {
  const isMulti = count > 1

  return (
    <div className="relative" style={{ paddingTop: isMulti ? '8px' : 0, paddingLeft: isMulti ? '8px' : 0 }}>
      {/* Stacked card layers (back to front) */}
      {isMulti && (
        <>
          <div
            className="absolute inset-0 rounded-md bg-accent border border-border opacity-40"
            style={{ transform: 'translate(-8px, -8px)' }}
          />
          <div
            className="absolute inset-0 rounded-md bg-accent border border-border opacity-60"
            style={{ transform: 'translate(-4px, -4px)' }}
          />
        </>
      )}

      {/* Main ghost row */}
      <div
        className="relative flex items-center h-8 rounded-md bg-accent border border-border shadow-md opacity-80 text-sm font-medium select-none cursor-grabbing"
        style={{ paddingLeft: `${depth * 24 + 8}px`, paddingRight: '8px' }}
      >
        <FolderIcon className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400 mr-1.5" />
        <span className="truncate flex-1">{node.name}</span>
        {isMulti && (
          <span className="ml-2 flex-shrink-0 rounded-full bg-muted text-muted-foreground text-xs font-semibold px-1.5 py-0.5">
            +{count - 1}
          </span>
        )}
      </div>
    </div>
  )
}
