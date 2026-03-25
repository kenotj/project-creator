// src/components/FolderTree.tsx
import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, FolderIcon, FolderOpenIcon, FolderTreeIcon, PencilIcon, Trash2Icon, FolderPlusIcon } from 'lucide-react'
import { Button } from './ui/button'
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
  selectedPaths: string[]
  onSelect: (paths: string[]) => void
  onAddSubfolder: (path: number[]) => void
  onAddSiblingFolder: (path: number[]) => void
  onRename: (path: number[], newName: string) => void
  onDuplicate: (paths: string[]) => void
  onDelete: (paths: string[]) => void
}

interface NodeItemProps {
  node: FolderNode
  path: number[]
  selectedPaths: string[]
  siblingNames: string[]
  onSelect: (paths: string[]) => void
  onAddSubfolder: (path: number[]) => void
  onAddSiblingFolder: (path: number[]) => void
  onRename: (path: number[], newName: string) => void
  onDuplicate: (paths: string[]) => void
  onDelete: (paths: string[]) => void
}



function NodeItem({
  node, path, selectedPaths, siblingNames,
  onSelect, onAddSubfolder, onAddSiblingFolder, onRename, onDuplicate, onDelete
}: NodeItemProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const escapePressedRef = useRef(false)
  const pathStr = path.join(',')
  const isSelected = selectedPaths.includes(pathStr)

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
      if (detail.join(',') === pathStr) setIsRenaming(true)
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
    if (siblingNames.includes(renameValue.trim())) {
      setRenameError('A folder with this name already exists')
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
              'flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer select-none text-sm group/item transition-colors',
              isSelected
                ? 'bg-accent border border-muted text-foreground font-bold shadow-sm'
                : 'hover:bg-accent/50 hover:text-foreground text-foreground/80'
            )}
            data-path={pathStr}
            onClick={(e) => {
              e.stopPropagation()
              if (e.metaKey || e.ctrlKey) {
                onSelect(isSelected ? selectedPaths.filter(p => p !== pathStr) : [...selectedPaths, pathStr])
              } else if (e.shiftKey && selectedPaths.length > 0) {
                // Simplified range select could go here, but for now we broadcast the single select
                onSelect([pathStr])
              } else {
                onSelect([pathStr])
              }
            }}
            onDoubleClick={() => setIsRenaming(true)}
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
                    renameError ? 'border-red-500' : 'border-ring'
                  )}
                />
                {renameError && (
                  <span className="text-xs text-red-500 mt-0.5">{renameError}</span>
                )}
              </div>
            ) : (
              <div className="flex items-center min-w-0">
                <span className={cn("truncate", isSelected ? "font-bold" : "font-medium")}>
                  {node.name}
                </span>
                {isSelected && selectedPaths.length === 1 && (
                  <div className="flex items-center gap-2 ml-3 animate-in fade-in slide-in-from-left-1 duration-200">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-foreground/10"
                      onClick={(e) => { e.stopPropagation(); onAddSiblingFolder(path) }}
                      title="Add Sibling Folder"
                    >
                      <FolderPlusIcon className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-foreground/10"
                      onClick={(e) => { e.stopPropagation(); onAddSubfolder(path) }}
                      title="Add Subfolder"
                    >
                      <FolderTreeIcon className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 hover:bg-foreground/10"
                      onClick={(e) => { e.stopPropagation(); setIsRenaming(true) }}
                      title="Rename"
                    >
                      <PencilIcon className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-red-500 hover:text-red-500 hover:bg-red-500/10"
                      onClick={(e) => { e.stopPropagation(); onDelete([pathStr]) }}
                      title="Delete"
                    >
                      <Trash2Icon className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-44">
          <ContextMenuItem onClick={() => onAddSubfolder(path)}>
            Add Subfolder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setIsRenaming(true)}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDuplicate([pathStr])}>
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDelete([pathStr])}
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
              key={`${i}-${child.name}`}
              node={child}
              path={[...path, i]}
              selectedPaths={selectedPaths}
              siblingNames={node.children.map(c => c.name).filter(n => n !== child.name)}
              onSelect={onSelect}
              onAddSubfolder={onAddSubfolder}
              onAddSiblingFolder={onAddSiblingFolder}
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
  nodes, selectedPaths, onSelect,
  onAddSubfolder, onAddSiblingFolder, onRename, onDuplicate, onDelete
}: FolderTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [marquee, setMarquee] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const handleMouseDown = (e: MouseEvent) => {
      // Only start marquee if clicking empty area or container itself
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('input')) return

      const rect = containerRef.current!.getBoundingClientRect()
      const startX = e.clientX - rect.left
      const startY = e.clientY - rect.top

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentX = moveEvent.clientX - rect.left
        const currentY = moveEvent.clientY - rect.top
        setMarquee({
          x1: Math.min(startX, currentX),
          y1: Math.min(startY, currentY),
          x2: Math.max(startX, currentX),
          y2: Math.max(startY, currentY)
        })
      }

      const handleMouseUp = (upEvent: MouseEvent) => {
        setMarquee((currentMarquee) => {
          if (currentMarquee) {
            // Hit detection
            const selected: string[] = []
            const items = containerRef.current!.querySelectorAll('[data-path]')
            const containerRect = containerRef.current!.getBoundingClientRect()

            items.forEach((item) => {
              const itemRect = item.getBoundingClientRect()
              const relativeItemRect = {
                left: itemRect.left - containerRect.left,
                top: itemRect.top - containerRect.top,
                right: itemRect.right - containerRect.left,
                bottom: itemRect.bottom - containerRect.top
              }

              if (
                relativeItemRect.left < currentMarquee.x2 &&
                relativeItemRect.right > currentMarquee.x1 &&
                relativeItemRect.top < currentMarquee.y2 &&
                relativeItemRect.bottom > currentMarquee.y1
              ) {
                selected.push(item.getAttribute('data-path')!)
              }
            })

            if (selected.length > 0) {
              if (upEvent.metaKey || upEvent.ctrlKey) {
                // Toggle/Append
                const newSelection = new Set([...selectedPaths, ...selected])
                onSelect(Array.from(newSelection))
              } else {
                onSelect(selected)
              }
            } else if (Math.abs(upEvent.clientX - rect.left - startX) < 5 && Math.abs(upEvent.clientY - rect.top - startY) < 5) {
              // It was a click on empty area, clear selection
              onSelect([])
            }
          }
          return null
        })
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    const container = containerRef.current
    if (container) {
      container.addEventListener('mousedown', handleMouseDown)
      return () => container.removeEventListener('mousedown', handleMouseDown)
    }
  }, [onSelect, selectedPaths])

  return (
    <div 
      ref={containerRef} 
      className="relative h-full min-h-full select-none cursor-default"
    >
      {nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
          No folders yet. Use "+ Folder" to add one.
        </div>
      ) : (
        <div className="space-y-0.5">
          {nodes.map((node, i) => (
            <NodeItem
              key={`${i}-${node.name}`}
              node={node}
              path={[i]}
              selectedPaths={selectedPaths}
              siblingNames={nodes.map(n => n.name).filter(n => n !== node.name)}
              onSelect={onSelect}
              onAddSubfolder={onAddSubfolder}
              onAddSiblingFolder={onAddSiblingFolder}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {marquee && (
        <div
          className="absolute border-2 border-primary bg-primary/20 pointer-events-none z-50 select-none"
          style={{
            left: marquee.x1,
            top: marquee.y1,
            width: marquee.x2 - marquee.x1,
            height: marquee.y2 - marquee.y1
          }}
        />
      )}
    </div>
  )
}
