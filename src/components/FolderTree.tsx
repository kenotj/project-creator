// src/components/FolderTree.tsx
import { useState, useRef, useEffect, Fragment } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { ChevronRight, ChevronDown, FolderIcon, FolderOpenIcon, Plus } from 'lucide-react'
import { FolderTreeRow } from './FolderTreeRow'
import { FolderTreeDragOverlay } from './FolderTreeDragOverlay'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu'
import { getVisiblePaths, getNodeAtPath, getSiblingsAtPath, isAncestorOf } from '@/lib/tree-operations'
import { cn } from '@/lib/utils'
import type { FolderNode } from '@/lib/models'

interface FolderTreeProps {
  templateName: string
  nodes: FolderNode[]
  selectedPaths: string[]
  focusedPath: number[] | null
  editingPath: number[] | null
  expandedPaths: Set<string>
  onSelect: (paths: string[]) => void
  onFocusChange: (path: number[] | null) => void
  onEditingChange: (path: number[] | null) => void
  onToggleExpand: (path: number[]) => void
  onAddSubfolder: (path: number[]) => void
  onAddSiblingAfter: (path: number[]) => void
  onRename: (path: number[], newName: string) => void
  onDuplicate: (paths: string[]) => void
  onDelete: (paths: string[]) => void
  onIndent: (paths: number[][]) => void
  onOutdent: (paths: number[][]) => void
  onMove: (fromPath: number[], toPath: number[], position: 'before' | 'after' | 'inside') => void
  onMoveMultiple: (fromPaths: number[][], toPath: number[], position: 'before' | 'after' | 'inside') => void
  onCopy?: (paths: string[]) => void
  onPaste?: (afterPath: number[] | null) => void
  onEditDescription?: (path: number[]) => void
  descriptionPaths?: Set<string>
}

export function computeMarqueeHits(
  marquee: { x1: number; y1: number; x2: number; y2: number },
  containerEl: HTMLDivElement,
  containerRect: DOMRect
): string[] {
  const items = containerEl.querySelectorAll('[data-path]')
  const hits: string[] = []
  items.forEach((item) => {
    const r = item.getBoundingClientRect()
    const rel = {
      left: r.left - containerRect.left,
      top: r.top - containerRect.top,
      right: r.right - containerRect.left,
      bottom: r.bottom - containerRect.top,
    }
    if (
      rel.left < marquee.x2 && rel.right > marquee.x1 &&
      rel.top < marquee.y2 && rel.bottom > marquee.y1
    ) {
      hits.push(item.getAttribute('data-path')!)
    }
  })
  return hits
}

export function FolderTree({
  templateName, nodes, selectedPaths, focusedPath, editingPath, expandedPaths,
  onSelect, onFocusChange, onEditingChange, onToggleExpand,
  onAddSubfolder, onAddSiblingAfter: _onAddSiblingAfter, onRename, onDuplicate, onDelete,
  onIndent, onOutdent, onMove, onMoveMultiple, onCopy, onPaste,
  onEditDescription, descriptionPaths
}: FolderTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [marquee, setMarquee] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null)
  const [previewPaths, setPreviewPaths] = useState<string[]>([])
  const [isRootExpanded, setIsRootExpanded] = useState(true)
  const [isRootFocused, setIsRootFocused] = useState(false)
  const selectionAnchorRef = useRef<number[] | null>(null)

  const handleFocusNode = (path: number[] | null) => {
    selectionAnchorRef.current = null
    if (path !== null) setIsRootFocused(false)
    onFocusChange(path)
  }

  const { setNodeRef: setRootDropRef, isOver: isRootDropOver } = useDroppable({
    id: '__root__',
  })

  // DnD state
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    path: number[]
    position: 'before' | 'after' | 'inside'
  } | null>(null)
  const dropTargetRef = useRef<{ path: number[], position: 'before' | 'after' | 'inside' } | null>(null)
  const [ghostInfo, setGhostInfo] = useState<{ node: FolderNode; depth: number } | null>(null)
  const ghostClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isMultiDrag, setIsMultiDrag] = useState(false)
  const dragStartPointerY = useRef<number>(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Compute flat visible list early so drag handlers can reference it
  const visibleNodes = getVisiblePaths(nodes, expandedPaths)

  // Cancel any pending ghost clear timer when the component unmounts
  useEffect(() => {
    return () => {
      if (ghostClearTimerRef.current !== null) {
        clearTimeout(ghostClearTimerRef.current)
      }
    }
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    // Cancel any pending ghost cleanup from a previous drag
    if (ghostClearTimerRef.current !== null) {
      clearTimeout(ghostClearTimerRef.current)
      ghostClearTimerRef.current = null
    }

    dragStartPointerY.current = (event.activatorEvent as PointerEvent).clientY
    const pathStr = event.active.id as string
    setActiveDragId(pathStr)

    const isMulti = selectedPaths.includes(pathStr) && selectedPaths.length > 1
    setIsMultiDrag(isMulti)

    // Cache dragged node so DragOverlay stays correct after onMove() changes paths
    const activePath = pathStr.split(',').map(Number)
    const node = getNodeAtPath(nodes, activePath)
    const visible = visibleNodes.find(v => v.path.join(',') === pathStr)
    if (node && visible) {
      setGhostInfo({ node, depth: visible.depth + 1 })
    }

    if (editingPath !== null) {
      onEditingChange(null)
    }
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      setDropTarget(null)
      dropTargetRef.current = null
      return
    }

    // Dropping onto the virtual root — always 'inside' (becomes top-level folder)
    if (over.id === '__root__') {
      const newDropTarget = { path: [] as number[], position: 'inside' as const }
      setDropTarget(newDropTarget)
      dropTargetRef.current = newDropTarget
      return
    }

    const overPath = (over.id as string).split(',').map(Number)
    const activePath = (active.id as string).split(',').map(Number)

    // Prevent dropping on self or descendants.
    // For multi-drag, also check all other selected paths.
    const pathsToCheck = isMultiDrag
      ? selectedPaths.map(sp => sp.split(',').map(Number))
      : [activePath]
    if (pathsToCheck.some(p => isAncestorOf(p, overPath))) {
      setDropTarget(null)
      dropTargetRef.current = null
      return
    }

    // Get pointer position from the ref (captured at drag start) + delta
    const currentY = dragStartPointerY.current + event.delta.y

    const overRect = over.rect
    const relY = currentY - overRect.top
    const fraction = relY / overRect.height

    let position: 'before' | 'after' | 'inside'
    if (fraction < 0.25) {
      position = 'before'
    } else if (fraction > 0.75) {
      position = 'after'
    } else {
      position = 'inside'
    }

    if (position === 'after') {
      const overNode = getNodeAtPath(nodes, overPath)
      if (overNode && overNode.children.length > 0 && expandedPaths.has(overPath.join(','))) {
        const newDropTarget = { path: [...overPath, 0], position: 'before' as const }
        setDropTarget(newDropTarget)
        dropTargetRef.current = newDropTarget
        return
      }
    }

    const newDropTarget = { path: overPath, position }
    setDropTarget(newDropTarget)
    dropTargetRef.current = newDropTarget
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)

    const currentDropTarget = dropTargetRef.current
    setDropTarget(null)
    dropTargetRef.current = null

    // Schedule ghost fade-out (200ms matches the dropAnimation duration).
    // isMultiDrag is cleared inside the timer so the +N badge stays visible
    // for the full animation before disappearing.
    // Always scheduled — including the no-valid-target (early-return) path below.
    ghostClearTimerRef.current = setTimeout(() => {
      setGhostInfo(null)
      setIsMultiDrag(false)
      ghostClearTimerRef.current = null
    }, 200)

    if (!over || !currentDropTarget) {
      return
    }

    if (isMultiDrag) {
      const fromPaths = selectedPaths.map(sp => sp.split(',').map(Number))
      onMoveMultiple(fromPaths, currentDropTarget.path, currentDropTarget.position)
    } else {
      const fromPath = (active.id as string).split(',').map(Number)
      onMove(fromPath, currentDropTarget.path, currentDropTarget.position)
    }

    if (currentDropTarget.position === 'inside' && !expandedPaths.has(currentDropTarget.path.join(','))) {
      onToggleExpand(currentDropTarget.path)
    }
  }

  useEffect(() => {
    if (!containerRef.current) return

    const handleMouseDown = (e: MouseEvent) => {
      // Only start marquee if clicking empty area or container itself
      if (activeDragId !== null) return
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      if (target.closest('button') || target.closest('input') || target.closest('[data-drag-handle]')) return

      const rect = containerRef.current!.getBoundingClientRect()
      const startX = e.clientX - rect.left
      const startY = e.clientY - rect.top

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const currentX = moveEvent.clientX - rect.left
        const currentY = moveEvent.clientY - rect.top
        const newMarquee = {
          x1: Math.min(startX, currentX),
          y1: Math.min(startY, currentY),
          x2: Math.max(startX, currentX),
          y2: Math.max(startY, currentY),
        }
        setMarquee(newMarquee)
        setPreviewPaths(computeMarqueeHits(newMarquee, containerRef.current!, rect))
      }

      const handleMouseUp = (upEvent: MouseEvent) => {
        setMarquee((currentMarquee) => {
          if (currentMarquee) {
            const selected = computeMarqueeHits(currentMarquee, containerRef.current!, rect)
            if (selected.length > 0) {
              if (upEvent.metaKey || upEvent.ctrlKey) {
                const newSelection = new Set([...selectedPaths, ...selected])
                onSelect(Array.from(newSelection))
              } else {
                onSelect(selected)
              }
            } else {
              onSelect([])
            }
          } else {
            // No drag — simple click on empty area, clear selection
            const upTarget = upEvent.target as HTMLElement
            if (!upTarget.closest('[data-path]') && !upTarget.closest('[data-root-row]')) {
              onSelect([])
              onFocusChange(null)
              setIsRootFocused(false)
            }
          }
          return null
        })
        setPreviewPaths([])   // always clear, outside the functional updater
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
  }, [onSelect, onFocusChange, selectedPaths, activeDragId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // While renaming, let the input handle all keys except Escape (cancel)
    if (editingPath !== null && e.key !== 'Escape') return

    // Root-focused guard — Enter adds folder, everything else except arrows is a no-op
    if (isRootFocused) {
      if (e.key === 'Enter') {
        e.preventDefault()
        onAddSubfolder([])
        return
      }
      if (['Tab', 'Backspace', 'Delete', 'F2', 'Escape'].includes(e.key)) {
        e.preventDefault()
        return
      }
      if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        return
      }
      // Arrow keys fall through to their own blocks below
    }

    // Tab / Shift+Tab
    if (e.key === 'Tab') {
      e.preventDefault()
      if (selectedPaths.length === 0) return
      const pathsToProcess = selectedPaths.map(sp => sp.split(',').map(Number))
      if (e.shiftKey) {
        onOutdent(pathsToProcess)
      } else {
        onIndent(pathsToProcess)
      }
      return
    }

    // Arrow keys
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const visible = getVisiblePaths(nodes, expandedPaths)

      if (isRootFocused) {
        if (e.key === 'ArrowDown' && visible.length > 0) {
          setIsRootFocused(false)
          handleFocusNode(visible[0].path)
        }
        return
      }

      if (!focusedPath) return
      const currentIdx = visible.findIndex(v => v.path.join(',') === focusedPath.join(','))

      if (e.key === 'ArrowUp') {
        if (currentIdx === 0) {
          setIsRootFocused(true)
          onFocusChange(null)
          onSelect([])
          selectionAnchorRef.current = null
        } else if (currentIdx > 0) {
          const newFocus = visible[currentIdx - 1].path
          if (e.shiftKey) {
            if (selectionAnchorRef.current === null) {
              selectionAnchorRef.current = focusedPath
            }
            const anchorIdx = visible.findIndex(
              v => v.path.join(',') === selectionAnchorRef.current!.join(',')
            )
            const newIdx = currentIdx - 1
            const start = Math.min(anchorIdx, newIdx)
            const end = Math.max(anchorIdx, newIdx)
            onSelect(visible.slice(start, end + 1).map(v => v.path.join(',')))
            onFocusChange(newFocus)
            if (newFocus !== null) setIsRootFocused(false)
          } else {
            onSelect([])
            handleFocusNode(newFocus)
          }
        }
      } else {
        if (currentIdx < visible.length - 1) {
          const newFocus = visible[currentIdx + 1].path
          if (e.shiftKey) {
            if (selectionAnchorRef.current === null) {
              selectionAnchorRef.current = focusedPath
            }
            const anchorIdx = visible.findIndex(
              v => v.path.join(',') === selectionAnchorRef.current!.join(',')
            )
            const newIdx = currentIdx + 1
            const start = Math.min(anchorIdx, newIdx)
            const end = Math.max(anchorIdx, newIdx)
            onSelect(visible.slice(start, end + 1).map(v => v.path.join(',')))
            onFocusChange(newFocus)
            if (newFocus !== null) setIsRootFocused(false)
          } else {
            onSelect([])
            handleFocusNode(newFocus)
          }
        }
      }
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (isRootFocused) {
        setIsRootExpanded(false)
        return
      }
      if (!focusedPath) return
      const pathStr = focusedPath.join(',')
      const node = getNodeAtPath(nodes, focusedPath)
      const nodeHasChildren = node ? node.children.length > 0 : false
      const isExpanded = expandedPaths.has(pathStr)
      if (isExpanded && nodeHasChildren) {
        onToggleExpand(focusedPath)
      } else if (focusedPath.length > 1) {
        const parentPath = focusedPath.slice(0, -1)
        onSelect([parentPath.join(',')])
        handleFocusNode(parentPath)
      } else {
        // Top-level node — go to root
        setIsRootFocused(true)
        onFocusChange(null)
        onSelect([])
      }
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (isRootFocused) {
        if (!isRootExpanded) {
          setIsRootExpanded(true)
        } else if (nodes.length > 0) {
          setIsRootFocused(false)
          onSelect(['0'])
          handleFocusNode([0])
        }
        return
      }
      if (!focusedPath) return
      const pathStr = focusedPath.join(',')
      const node = getNodeAtPath(nodes, focusedPath)
      const nodeHasChildren = node ? node.children.length > 0 : false
      const isExpanded = expandedPaths.has(pathStr)
      if (!isExpanded && nodeHasChildren) {
        onToggleExpand(focusedPath)
      } else if (isExpanded && nodeHasChildren) {
        const firstChildPath = [...focusedPath, 0]
        onSelect([firstChildPath.join(',')])
        handleFocusNode(firstChildPath)
      }
      return
    }

    // Enter
    if (e.key === 'Enter') {
      if (focusedPath) onEditingChange(focusedPath)
      return
    }

    // F2
    if (e.key === 'F2') {
      if (focusedPath) onEditingChange(focusedPath)
      return
    }

    // Escape
    if (e.key === 'Escape') {
      if (editingPath !== null) onEditingChange(null)
      return
    }

    // Backspace / Delete (not editing — guard already above, but kept for clarity)
    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (selectedPaths.length > 0) {
        onDelete(selectedPaths)
      }
      return
    }

    // Cmd/Ctrl+D
    if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (selectedPaths.length > 0) {
        onDuplicate(selectedPaths)
      }
      return
    }

    // Cmd/Ctrl+C
    if (e.key === 'c' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (isRootFocused) return
      const source = selectedPaths.length > 0
        ? selectedPaths
        : focusedPath ? [focusedPath.join(',')] : []
      if (source.length === 0) return
      // Filter descendants: keep only paths that have no ancestor also in source
      const parsed = source.map(s => s.split(',').map(Number))
      const filtered = source.filter((_, i) =>
        !parsed.some((q, j) => j !== i && isAncestorOf(q, parsed[i]))
      )
      onCopy?.(filtered)
      return
    }

    // Cmd/Ctrl+V
    if (e.key === 'v' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onPaste?.(isRootFocused ? null : focusedPath)
      return
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex-1 select-none cursor-default outline-none focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Virtual root row */}
        <ContextMenu>
          <ContextMenuTrigger asChild>
            <div
              ref={setRootDropRef}
              data-root-row
              className={cn(
                'group/root-row flex items-center h-8 cursor-pointer select-none text-sm',
                isRootFocused && 'bg-accent/30',
                isRootDropOver && activeDragId && 'ring-2 ring-primary bg-primary/10'
              )}
              onClick={(e) => {
                e.stopPropagation()
                setIsRootFocused(true)
                onFocusChange(null)
                onSelect([])
              }}
              onDoubleClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                // Prevent marquee from starting on root row
                if (!(e.target as HTMLElement).closest('button')) e.stopPropagation()
              }}
            >
              {/* Chevron */}
              <div className="w-5 h-full flex-shrink-0 flex items-center justify-center">
                <button
                  type="button"
                  className="flex items-center justify-center w-full h-full text-muted-foreground hover:text-foreground"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsRootExpanded((prev) => !prev)
                  }}
                >
                  {isRootExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 flex items-center h-[90%] rounded-sm px-2">
                {isRootExpanded ? (
                  <FolderOpenIcon className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400 mr-2" />
                ) : (
                  <FolderIcon className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400 mr-2" />
                )}
                <span className="truncate text-sm font-semibold text-muted-foreground">
                  &lt;{templateName}&gt;
                </span>
              </div>

              {/* Add folder button */}
              <button
                type="button"
                className="opacity-0 group-hover/root-row:opacity-100 transition-opacity flex items-center justify-center w-6 h-6 mr-2 rounded hover:bg-accent text-muted-foreground hover:text-foreground flex-shrink-0"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onAddSubfolder([])
                }}
                title="Add folder"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="w-44">
            <ContextMenuItem onClick={() => onAddSubfolder([])}>
              <Plus className="w-3.5 h-3.5 mr-2" />
              Add Folder
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>

        <div className={cn(!isRootExpanded && 'hidden')}>
          {nodes.length === 0 ? (
            <div className="flex items-center h-8 text-sm text-muted-foreground pl-12">
              No folders yet.
            </div>
          ) : (
            <div className="space-y-0.5">
              {visibleNodes.map(({ path, depth, node }) => {
                const pathStr = path.join(',')
                const siblings = getSiblingsAtPath(nodes, path)
                const siblingNames = siblings
                  .filter((_, i) => i !== path[path.length - 1])
                  .map((s) => s.name)

                const isDropTargetInside = dropTarget?.position === 'inside' &&
                  dropTarget.path.join(',') === pathStr

                return (
                  <Fragment key={pathStr}>
                    {/* Drop indicator: blue line BEFORE this row */}
                    {dropTarget?.position === 'before' &&
                      dropTarget.path.join(',') === pathStr && (
                        <div
                          className="relative h-0.5 bg-primary"
                          style={{ marginLeft: `${(depth + 1) * 24 + 8}px`, marginRight: '8px' }}
                        >
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                        </div>
                      )}

                    <FolderTreeRow
                      node={node}
                      path={path}
                      depth={depth + 1}
                      selectedPaths={selectedPaths}
                      isFocused={focusedPath !== null && focusedPath.join(',') === pathStr}
                      isEditing={editingPath !== null && editingPath.join(',') === pathStr}
                      isExpanded={expandedPaths.has(pathStr)}
                      isDragSource={activeDragId !== null && (pathStr === activeDragId || (isMultiDrag && selectedPaths.includes(pathStr)))}
                      isDropTarget={isDropTargetInside}
                      isPreview={previewPaths.includes(pathStr)}
                      siblingNames={siblingNames}
                      onSelect={onSelect}
                      onShiftSelect={(clickedPath) => {
                        const visible = getVisiblePaths(nodes, expandedPaths)
                        const clickedIdx = visible.findIndex(v => v.path.join(',') === clickedPath.join(','))
                        if (selectedPaths.length === 0 || clickedIdx === -1) {
                          onSelect([clickedPath.join(',')])
                          return
                        }
                        const anchor = focusedPath ?? (selectedPaths[0] ? selectedPaths[0].split(',').map(Number) : null)
                        const anchorIdx = anchor ? visible.findIndex(v => v.path.join(',') === anchor.join(',')) : -1
                        if (anchorIdx === -1) { onSelect([clickedPath.join(',')]); return }
                        const start = Math.min(anchorIdx, clickedIdx)
                        const end = Math.max(anchorIdx, clickedIdx)
                        const range = visible.slice(start, end + 1).map(v => v.path.join(','))
                        onSelect(range)
                      }}
                      onFocusChange={handleFocusNode}
                      onEditingChange={onEditingChange}
                      onToggleExpand={(path) => {
                        if (activeDragId === null) onToggleExpand(path)
                      }}
                      onAddSubfolder={onAddSubfolder}
                      onRename={onRename}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                      hasDescription={descriptionPaths?.has(pathStr) ?? false}
                      onEditDescription={onEditDescription}
                    />

                    {/* Drop indicator: blue line AFTER this row */}
                    {dropTarget?.position === 'after' &&
                      dropTarget.path.join(',') === pathStr && (
                        <div
                          className="relative h-0.5 bg-primary"
                          style={{ marginLeft: `${(depth + 1) * 24 + 8}px`, marginRight: '8px' }}
                        >
                          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary" />
                        </div>
                      )}
                  </Fragment>
                )
              })}
            </div>
          )}
        </div>

        <DragOverlay
          dropAnimation={async ({ dragOverlay: { node } }) => {
            const animation = node.animate(
              [{ opacity: 0.8 }, { opacity: 0 }],
              { duration: 200, easing: 'ease-out', fill: 'forwards' }
            )
            await new Promise<void>(resolve => { animation.onfinish = () => resolve() })
          }}
        >
          {ghostInfo ? (
            <FolderTreeDragOverlay
              node={ghostInfo.node}
              depth={ghostInfo.depth}
              count={isMultiDrag ? selectedPaths.length : 1}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {marquee && (
        <div
          className="absolute bg-blue-500/20 pointer-events-none z-50 select-none"
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
