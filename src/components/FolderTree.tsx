// src/components/FolderTree.tsx
import { useState, useRef, useEffect, Fragment } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { FolderTreeRow } from './FolderTreeRow'
import { FolderTreeDragOverlay } from './FolderTreeDragOverlay'
import { getVisiblePaths, getNodeAtPath, getSiblingsAtPath, isAncestorOf } from '@/lib/tree-operations'
import type { FolderNode } from '@/lib/models'

interface FolderTreeProps {
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
  onIndent: (path: number[]) => void
  onOutdent: (path: number[]) => void
  onMove: (fromPath: number[], toPath: number[], position: 'before' | 'after' | 'inside') => void
}

export function FolderTree({
  nodes, selectedPaths, focusedPath, editingPath, expandedPaths,
  onSelect, onFocusChange, onEditingChange, onToggleExpand,
  onAddSubfolder, onAddSiblingAfter, onRename, onDuplicate, onDelete,
  onIndent, onOutdent, onMove
}: FolderTreeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [marquee, setMarquee] = useState<{ x1: number, y1: number, x2: number, y2: number } | null>(null)

  // DnD state
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{
    path: number[]
    position: 'before' | 'after' | 'inside'
  } | null>(null)
  const dropTargetRef = useRef<{ path: number[], position: 'before' | 'after' | 'inside' } | null>(null)
  const dragStartPointerY = useRef<number>(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const handleDragStart = (event: DragStartEvent) => {
    dragStartPointerY.current = (event.activatorEvent as PointerEvent).clientY
    setActiveDragId(event.active.id as string)
    // If currently editing, commit rename first
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

    const overPath = (over.id as string).split(',').map(Number)
    const activePath = (active.id as string).split(',').map(Number)

    // Prevent dropping on self or descendants
    if (isAncestorOf(activePath, overPath)) {
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

    const newDropTarget = { path: overPath, position }
    setDropTarget(newDropTarget)
    dropTargetRef.current = newDropTarget
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)

    const currentDropTarget = dropTargetRef.current  // use ref, not state
    if (!over || !currentDropTarget) {
      setDropTarget(null)
      dropTargetRef.current = null
      return
    }

    const fromPath = (active.id as string).split(',').map(Number)
    onMove(fromPath, currentDropTarget.path, currentDropTarget.position)

    // Auto-expand if dropped inside a collapsed folder
    if (currentDropTarget.position === 'inside' && !expandedPaths.has(currentDropTarget.path.join(','))) {
      onToggleExpand(currentDropTarget.path)
    }

    setDropTarget(null)
    dropTargetRef.current = null
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
  }, [onSelect, selectedPaths, activeDragId])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // While renaming, let the input handle all keys except Escape (cancel)
    if (editingPath !== null && e.key !== 'Escape') return

    // Tab / Shift+Tab
    if (e.key === 'Tab') {
      e.preventDefault()
      if (focusedPath) {
        if (e.shiftKey) {
          onOutdent(focusedPath)
        } else {
          onIndent(focusedPath)
        }
      }
      return
    }

    // Arrow keys
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      if (!focusedPath) return
      const visible = getVisiblePaths(nodes, expandedPaths)
      const currentIdx = visible.findIndex(v => v.path.join(',') === focusedPath.join(','))
      if (e.key === 'ArrowUp') {
        if (currentIdx > 0) {
          if (e.shiftKey) {
            const prevPathStr = visible[currentIdx - 1].path.join(',')
            if (!selectedPaths.includes(prevPathStr)) {
              onSelect([...selectedPaths, prevPathStr])
            }
          }
          onFocusChange(visible[currentIdx - 1].path)
        }
      } else {
        if (currentIdx < visible.length - 1) {
          if (e.shiftKey) {
            const nextPathStr = visible[currentIdx + 1].path.join(',')
            if (!selectedPaths.includes(nextPathStr)) {
              onSelect([...selectedPaths, nextPathStr])
            }
          }
          onFocusChange(visible[currentIdx + 1].path)
        }
      }
      return
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      if (!focusedPath) return
      const pathStr = focusedPath.join(',')
      const node = getNodeAtPath(nodes, focusedPath)
      const nodeHasChildren = node ? node.children.length > 0 : false
      const isExpanded = expandedPaths.has(pathStr)
      if (isExpanded && nodeHasChildren) {
        onToggleExpand(focusedPath)
      } else if (focusedPath.length > 1) {
        onFocusChange(focusedPath.slice(0, -1))
      }
      return
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      if (!focusedPath) return
      const pathStr = focusedPath.join(',')
      const node = getNodeAtPath(nodes, focusedPath)
      const nodeHasChildren = node ? node.children.length > 0 : false
      const isExpanded = expandedPaths.has(pathStr)
      if (!isExpanded && nodeHasChildren) {
        onToggleExpand(focusedPath)
      } else if (isExpanded && nodeHasChildren) {
        onFocusChange([...focusedPath, 0])
      }
      // leaf: do nothing
      return
    }

    // Enter
    if (e.key === 'Enter') {
      if (focusedPath) onAddSiblingAfter(focusedPath)
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
      } else if (focusedPath) {
        onDelete([focusedPath.join(',')])
      }
      return
    }

    // Cmd/Ctrl+D
    if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      if (selectedPaths.length > 0) {
        onDuplicate(selectedPaths)
      } else if (focusedPath) {
        onDuplicate([focusedPath.join(',')])
      }
      return
    }
  }

  // Compute the flat list of visible nodes
  const visibleNodes = getVisiblePaths(nodes, expandedPaths)

  return (
    <div
      ref={containerRef}
      className="relative h-full min-h-full select-none cursor-default outline-none focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleNodes.map(({ path }) => path.join(','))}
          strategy={verticalListSortingStrategy}
        >
          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              No folders yet. Use &quot;+ Folder&quot; to add one.
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
                        className="h-0.5 bg-primary rounded-full"
                        style={{ marginLeft: `${depth * 24 + 8}px`, marginRight: '8px' }}
                      />
                    )}

                    <FolderTreeRow
                      node={node}
                      path={path}
                      depth={depth}
                      selectedPaths={selectedPaths}
                      isFocused={focusedPath !== null && focusedPath.join(',') === pathStr}
                      isEditing={editingPath !== null && editingPath.join(',') === pathStr}
                      isExpanded={expandedPaths.has(pathStr)}
                      isDragSource={activeDragId === pathStr}
                      isDropTarget={isDropTargetInside}
                      siblingNames={siblingNames}
                      onSelect={onSelect}
                      onShiftSelect={(clickedPath) => {
                        const visible = getVisiblePaths(nodes, expandedPaths)
                        const clickedIdx = visible.findIndex(v => v.path.join(',') === clickedPath.join(','))
                        if (selectedPaths.length === 0 || clickedIdx === -1) {
                          onSelect([clickedPath.join(',')])
                          return
                        }
                        // Find anchor — use first selected item or focused path
                        const anchor = focusedPath ?? (selectedPaths[0] ? selectedPaths[0].split(',').map(Number) : null)
                        const anchorIdx = anchor ? visible.findIndex(v => v.path.join(',') === anchor.join(',')) : -1
                        if (anchorIdx === -1) { onSelect([clickedPath.join(',')]); return }
                        const start = Math.min(anchorIdx, clickedIdx)
                        const end = Math.max(anchorIdx, clickedIdx)
                        const range = visible.slice(start, end + 1).map(v => v.path.join(','))
                        onSelect(range)
                      }}
                      onFocusChange={onFocusChange}
                      onEditingChange={onEditingChange}
                      onToggleExpand={(path) => {
                        if (activeDragId === null) onToggleExpand(path)
                      }}
                      onAddSubfolder={onAddSubfolder}
                      onRename={onRename}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                    />

                    {/* Drop indicator: blue line AFTER this row */}
                    {dropTarget?.position === 'after' &&
                     dropTarget.path.join(',') === pathStr && (
                      <div
                        className="h-0.5 bg-primary rounded-full"
                        style={{ marginLeft: `${depth * 24 + 8}px`, marginRight: '8px' }}
                      />
                    )}
                  </Fragment>
                )
              })}
            </div>
          )}
        </SortableContext>

        <DragOverlay>
          {activeDragId ? (() => {
            const draggedVisible = visibleNodes.find(v => v.path.join(',') === activeDragId)
            if (!draggedVisible) return null
            return <FolderTreeDragOverlay node={draggedVisible.node} depth={draggedVisible.depth} />
          })() : null}
        </DragOverlay>
      </DndContext>

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
