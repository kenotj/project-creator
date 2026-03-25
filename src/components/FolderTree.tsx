// src/components/FolderTree.tsx
import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, FolderIcon, FolderOpenIcon } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'
import { Collapsible, CollapsibleContent } from './ui/collapsible'
import { cn } from '@/lib/utils'
import { validateName } from '@/lib/validation'
import type { FolderNode } from '@/lib/models'

interface FolderTreeProps {
  nodes: FolderNode[]
  selectedPath: number[] | null
  onSelect: (path: number[]) => void
  onAddSubfolder: (path: number[]) => void
  onRename: (path: number[], newName: string) => void
  onDuplicate: (path: number[]) => void
  onDelete: (path: number[]) => void
}

interface NodeItemProps {
  node: FolderNode
  path: number[]
  selectedPath: number[] | null
  onSelect: (path: number[]) => void
  onAddSubfolder: (path: number[]) => void
  onRename: (path: number[], newName: string) => void
  onDuplicate: (path: number[]) => void
  onDelete: (path: number[]) => void
}

function pathsEqual(a: number[] | null, b: number[]): boolean {
  return a !== null && a.length === b.length && a.every((v, i) => v === b[i])
}

function NodeItem({
  node, path, selectedPath,
  onSelect, onAddSubfolder, onRename, onDuplicate, onDelete
}: NodeItemProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const escapePressedRef = useRef(false)
  const isSelected = pathsEqual(selectedPath, path)

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.name)
      setRenameError(null)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [isRenaming, node.name])

  // Listen for the Rename toolbar button's broadcast
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<number[]>).detail
      if (pathsEqual(detail, path)) setIsRenaming(true)
    }
    window.addEventListener('rename-node', handler)
    return () => window.removeEventListener('rename-node', handler)
  }, [path])

  const commitRename = () => {
    if (escapePressedRef.current) {
      escapePressedRef.current = false
      return
    }
    const result = validateName(renameValue)
    if (!result.valid) {
      setRenameError(result.error ?? 'Invalid name')
      return
    }
    onRename(path, renameValue.trim())
    setIsRenaming(false)
    setRenameError(null)
  }

  const cancelRename = () => {
    escapePressedRef.current = true
    setIsRenaming(false)
    setRenameError(null)
    setRenameValue(node.name)
  }

  const hasChildren = node.children.length > 0

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer select-none text-sm',
              isSelected
                ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'hover:bg-accent hover:text-foreground text-foreground/80'
            )}
            onClick={() => onSelect(path)}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setIsOpen((o) => !o) }}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              {hasChildren
                ? isOpen
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />
                : <span className="w-3 h-3 inline-block" />}
            </button>
            {isOpen && hasChildren
              ? <FolderOpenIcon className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
              : <FolderIcon className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />}

            {isRenaming ? (
              <div className="flex-1 flex flex-col">
                <input
                  ref={inputRef}
                  value={renameValue}
                  onChange={(e) => { setRenameValue(e.target.value); setRenameError(null) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                    if (e.key === 'Escape') cancelRename()
                  }}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'w-full bg-background border rounded px-1 py-0 text-sm outline-none',
                    renameError ? 'border-red-500' : 'border-blue-400'
                  )}
                />
                {renameError && (
                  <span className="text-xs text-red-500 mt-0.5">{renameError}</span>
                )}
              </div>
            ) : (
              <span className="flex-1 truncate font-medium">{node.name}</span>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-44">
          <ContextMenuItem onClick={() => onAddSubfolder(path)}>
            Add Subfolder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => { onSelect(path); setIsRenaming(true) }}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDuplicate(path)}>
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDelete(path)}
            className="text-red-500 focus:text-red-500"
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <CollapsibleContent>
        <div className="ml-4">
          {node.children.map((child, i) => (
            <NodeItem
              key={child.name}
              node={child}
              path={[...path, i]}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onAddSubfolder={onAddSubfolder}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function FolderTree({
  nodes, selectedPath, onSelect,
  onAddSubfolder, onRename, onDuplicate, onDelete
}: FolderTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No folders yet. Use "+ Folder" to add one.
      </div>
    )
  }
  return (
    <div className="space-y-0.5">
      {nodes.map((node, i) => (
        <NodeItem
          key={node.name}
          node={node}
          path={[i]}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onAddSubfolder={onAddSubfolder}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
