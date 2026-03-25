// src/components/FolderTreeDragOverlay.tsx
import { FolderIcon } from 'lucide-react'
import type { FolderNode } from '@/lib/models'

interface Props {
  node: FolderNode
  depth: number
}

export function FolderTreeDragOverlay({ node, depth }: Props) {
  return (
    <div
      className="flex items-center h-8 rounded-md bg-accent border border-border shadow-md opacity-80 text-sm font-medium select-none cursor-grabbing"
      style={{ paddingLeft: `${depth * 24 + 8}px`, paddingRight: '8px' }}
    >
      <FolderIcon className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400 mr-1.5" />
      <span className="truncate">{node.name}</span>
    </div>
  )
}
