// src/components/FolderTreeRow.tsx
import { useState, useRef, useEffect } from 'react'
import {
  ChevronRight,
  ChevronDown,
  FolderIcon,
  FolderOpenIcon,
  GripVertical,
  Plus,
  MoreHorizontal,
  PencilIcon,
  CopyIcon,
  Trash2Icon,
} from 'lucide-react'
import { Button } from './ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { validateName } from '@/lib/validation'
import type { FolderNode } from '@/lib/models'

export interface FolderTreeRowProps {
  node: FolderNode
  path: number[]
  depth: number
  selectedPaths: string[]
  isFocused: boolean
  isEditing: boolean
  isExpanded: boolean
  isDragSource?: boolean
  isDropTarget?: boolean
  siblingNames: string[]
  onSelect: (paths: string[]) => void
  onShiftSelect: (clickedPath: number[]) => void
  onFocusChange: (path: number[] | null) => void
  onEditingChange: (path: number[] | null) => void
  onToggleExpand: (path: number[]) => void
  onAddSubfolder: (path: number[]) => void
  onRename: (path: number[], newName: string) => void
  onDuplicate: (paths: string[]) => void
  onDelete: (paths: string[]) => void
}

export function FolderTreeRow({
  node,
  path,
  depth,
  selectedPaths,
  isFocused,
  isEditing,
  isExpanded,
  isDragSource,
  isDropTarget,
  siblingNames,
  onSelect,
  onShiftSelect,
  onFocusChange,
  onEditingChange,
  onToggleExpand,
  onAddSubfolder,
  onRename,
  onDuplicate,
  onDelete,
}: FolderTreeRowProps) {
  const [renameValue, setRenameValue] = useState(node.name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const escapePressedRef = useRef(false)
  const pathStr = path.join(',')
  const isSelected = selectedPaths.includes(pathStr)
  const hasChildren = node.children.length > 0

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: pathStr,
  })

  const style = {
    paddingLeft: `${depth * 24}px`,
    transform: CSS.Transform.toString(transform),
    transition,
  }

  useEffect(() => {
    if (isEditing) {
      setRenameValue(node.name)
      setRenameError(null)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [isEditing, node.name])

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
    onEditingChange(null)
    setRenameError(null)
  }

  const cancelRename = () => {
    escapePressedRef.current = true
    onEditingChange(null)
    setRenameError(null)
    setRenameValue(node.name)
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          {...attributes}
          className={cn(
            'group/row flex items-center h-8 rounded-md cursor-pointer select-none text-sm transition-colors',
            isFocused || isSelected
              ? 'bg-accent'
              : 'hover:bg-accent/50',
            isDragSource && 'opacity-50',
            isDropTarget && 'ring-2 ring-primary bg-primary/10'
          )}
          style={style}
          data-path={pathStr}
          onClick={(e) => {
            e.stopPropagation()
            onFocusChange(path)
            if (e.metaKey || e.ctrlKey) {
              onSelect(
                isSelected
                  ? selectedPaths.filter((p) => p !== pathStr)
                  : [...selectedPaths, pathStr]
              )
            } else if (e.shiftKey) {
              onShiftSelect(path)
            } else {
              onSelect([pathStr])
            }
          }}
          onDoubleClick={() => onEditingChange(path)}
        >
          {/* Left gutter: chevron / grip swap */}
          {hasChildren ? (
            <div
              className="relative w-5 h-full flex-shrink-0"
              {...listeners}
              data-drag-handle
            >
              {/* Chevron - default visible, hidden on row hover */}
              <button
                type="button"
                className="absolute inset-0 flex items-center justify-center opacity-100 group-hover/row:opacity-0 transition-opacity text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation()
                  onToggleExpand(path)
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              {/* Grip - default hidden, shown on row hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab">
                <GripVertical className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
          ) : (
            <div
              className="relative w-5 h-full flex-shrink-0"
              {...listeners}
              data-drag-handle
            >
              {/* For leaf nodes: show grip on hover, no chevron */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity cursor-grab">
                <GripVertical className="w-3 h-3 text-muted-foreground" />
              </div>
            </div>
          )}

          {/* Folder icon */}
          {isExpanded && hasChildren ? (
            <FolderOpenIcon className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400 mr-1.5" />
          ) : (
            <FolderIcon className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400 mr-1.5" />
          )}

          {/* Name / input */}
          {isEditing ? (
            <div className="flex-1 flex flex-col min-w-0">
              <input
                ref={inputRef}
                value={renameValue}
                onChange={(e) => {
                  setRenameValue(e.target.value)
                  setRenameError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    commitRename()
                  }
                  if (e.key === 'Escape') cancelRename()
                }}
                onBlur={commitRename}
                onClick={(e) => e.stopPropagation()}
                className={cn(
                  'w-full border-0 border-b-2 bg-transparent outline-none text-sm py-0 px-0 font-medium',
                  renameError ? 'border-red-500' : 'border-primary'
                )}
              />
              {renameError && (
                <span className="text-xs text-red-500 mt-0.5">{renameError}</span>
              )}
            </div>
          ) : (
            <span className="truncate text-sm font-medium flex-1 min-w-0">
              {node.name}
            </span>
          )}

          {/* Right side hover actions */}
          {!isEditing && (
            <div className="flex items-center gap-0.5 ml-auto mr-1 opacity-0 group-hover/row:opacity-100 transition-opacity">
              {/* Add subfolder button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5 rounded-sm"
                onClick={(e) => {
                  e.stopPropagation()
                  onAddSubfolder(path)
                }}
                title="Add subfolder"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>

              {/* More menu button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 rounded-sm"
                    onClick={(e) => e.stopPropagation()}
                    title="More actions"
                  >
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem
                    onClick={() => onEditingChange(path)}
                  >
                    <PencilIcon className="w-3.5 h-3.5 mr-2" />
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDuplicate([pathStr])}
                  >
                    <CopyIcon className="w-3.5 h-3.5 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete([pathStr])}
                    className="text-red-500 focus:text-red-500"
                  >
                    <Trash2Icon className="w-3.5 h-3.5 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </ContextMenuTrigger>

      {/* Context menu (right-click) */}
      <ContextMenuContent className="w-44">
        <ContextMenuItem onClick={() => onAddSubfolder(path)}>
          <Plus className="w-3.5 h-3.5 mr-2" />
          Add Subfolder
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onEditingChange(path)}>
          <PencilIcon className="w-3.5 h-3.5 mr-2" />
          Rename
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onDuplicate([pathStr])}>
          <CopyIcon className="w-3.5 h-3.5 mr-2" />
          Duplicate
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => onDelete([pathStr])}
          className="text-red-500 focus:text-red-500"
        >
          <Trash2Icon className="w-3.5 h-3.5 mr-2" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
