# Virtual Root Folder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a permanent, non-deletable virtual root row displaying `<Template Name>` at the top of the folder tree, with all folders indented beneath it.

**Architecture:** The root exists only in the UI layer — no data model changes. `FolderTree.tsx` renders a static root row inside the `DndContext` (but outside `SortableContext`), uses `useDroppable` to make the root a valid drop target, adds `isRootExpanded`/`isRootFocused` local state, and shifts all real node depths by +1. Keyboard navigation is updated to handle the root boundary.

**Tech Stack:** React, TypeScript, Tailwind CSS, @dnd-kit, Lucide icons

**Spec:** `docs/superpowers/specs/2026-03-25-virtual-root-folder-design.md`

---

### Task 1: Pass `templateName` prop through

**Files:**
- Modify: `src/components/FolderTree.tsx` (lines 22-40, 42-46)
- Modify: `src/components/TemplateEditor.tsx` (line 260)

- [ ] **Step 1: Add `templateName` to FolderTreeProps and destructure it**

In `src/components/FolderTree.tsx`, add `templateName: string` to the interface and destructure:

```typescript
// In FolderTreeProps interface (line 22 area):
interface FolderTreeProps {
  templateName: string   // <-- ADD
  nodes: FolderNode[]
  // ... rest unchanged
}

// In function signature (line 42 area):
export function FolderTree({
  templateName, nodes, selectedPaths, focusedPath, editingPath, expandedPaths,
  // ... rest unchanged
}: FolderTreeProps) {
```

- [ ] **Step 2: Pass `templateName` from TemplateEditor**

In `src/components/TemplateEditor.tsx`, add the prop to the `<FolderTree>` call (around line 260):

```tsx
<FolderTree
  templateName={name}    // <-- ADD
  nodes={folders}
  // ... rest unchanged
/>
```

- [ ] **Step 3: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/FolderTree.tsx src/components/TemplateEditor.tsx
git commit -m "feat: add templateName prop to FolderTree"
```

---

### Task 2: Add root state, render root row, and make it a drop target

**Files:**
- Modify: `src/components/FolderTree.tsx`

- [ ] **Step 1: Add imports**

At the top of `src/components/FolderTree.tsx`, add these imports:

```typescript
// Add to the existing lucide-react import:
import { ChevronRight, ChevronDown, FolderOpenIcon, Plus } from 'lucide-react'

// Add new imports:
import { useDroppable } from '@dnd-kit/core'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from './ui/context-menu'
import { cn } from '@/lib/utils'
```

- [ ] **Step 2: Add local state for root**

After the existing `useState` calls (around line 49), add:

```typescript
const [isRootExpanded, setIsRootExpanded] = useState(true)
const [isRootFocused, setIsRootFocused] = useState(false)
```

- [ ] **Step 3: Add `handleFocusNode` wrapper**

Add a helper that clears root focus when a regular node is focused. Place it near the state declarations:

```typescript
const handleFocusNode = (path: number[] | null) => {
  if (path !== null) setIsRootFocused(false)
  onFocusChange(path)
}
```

Then replace these specific existing call sites of `onFocusChange` with `handleFocusNode`:
- The `FolderTreeRow` prop: `onFocusChange={handleFocusNode}` (line 417)
- The keyboard handler calls where we navigate TO a regular node (in ArrowUp/Down/Left/Right — these will be rewritten in Task 4)
- The marquee mouseup handler empty-area click: `handleFocusNode(null)` (line 203) — note: `handleFocusNode(null)` does NOT clear root focus since `path` is `null`, which is fine

**Do NOT** replace the destructured prop `onFocusChange` in the function signature. When setting root focus (e.g., in the root row click handler), call `onFocusChange(null)` directly — this intentionally does not clear `isRootFocused`.

- [ ] **Step 4: Add root droppable hook**

Add a `useDroppable` hook for the root row so nodes can be dropped onto it:

```typescript
const { setNodeRef: setRootDropRef, isOver: isRootDropOver } = useDroppable({
  id: '__root__',
})
```

- [ ] **Step 5: Handle root drop in `handleDragOver` and `handleDragEnd`**

In `handleDragOver` (around line 73), add a check for when `over.id === '__root__'`:

```typescript
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

  // ... rest of existing handleDragOver unchanged
}
```

In `handleDragEnd` (around line 112), the existing code already calls `onMove(fromPath, currentDropTarget.path, currentDropTarget.position)`. When `path` is `[]` and `position` is `'inside'`, `moveNode` + `addNodeAt(result, [], node)` appends to the root array. Verify this works — `addNodeAt` with empty path appends to root (line 9 of tree-operations.ts). No change needed in `handleDragEnd`.

- [ ] **Step 6: Render the root row inside DndContext but before SortableContext**

Restructure the return JSX. The root row goes **inside** `DndContext` (so droppable works) but **before** `SortableContext` (so it's not sortable). Wrap the SortableContext + DragOverlay in a div that hides when root is collapsed:

```tsx
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
              'flex items-center h-8 cursor-pointer select-none text-sm',
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
            <div className="flex-1 flex items-center h-[90%] rounded-sm px-2 mr-2">
              <FolderOpenIcon className="w-4 h-4 flex-shrink-0 text-amber-500 dark:text-amber-400 mr-2" />
              <span className="truncate text-sm font-semibold text-muted-foreground">
                &lt;{templateName}&gt;
              </span>
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-44">
          <ContextMenuItem onClick={() => onAddSubfolder([])}>
            <Plus className="w-3.5 h-3.5 mr-2" />
            Add Folder
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Children — hidden when root collapsed, keep mounted to preserve sortable registrations */}
      <div className={cn(!isRootExpanded && 'hidden')}>
        <SortableContext
          items={visibleNodes.map(({ path }) => path.join(','))}
          strategy={verticalListSortingStrategy}
        >
          {/* ... existing nodes.length === 0 empty state and visibleNodes.map unchanged ... */}
        </SortableContext>
      </div>

      <DragOverlay>
        {/* ... existing drag overlay unchanged ... */}
      </DragOverlay>
    </DndContext>

    {marquee && (
      {/* ... existing marquee unchanged ... */}
    )}
  </div>
)
```

Key details:
- `ref={setRootDropRef}` makes the root a drop target
- `data-root-row` attribute lets marquee/click handlers distinguish it
- `onDoubleClick={(e) => e.stopPropagation()}` prevents rename behavior
- `onPointerDown` stop propagation prevents marquee from starting on root
- Chevron button has `onPointerDown={(e) => e.stopPropagation()}` matching `FolderTreeRow` pattern
- `isRootDropOver && activeDragId` shows drop highlight only during active drag

- [ ] **Step 7: Verify `onAddSubfolder([])` works**

The root's "Add Folder" context menu calls `onAddSubfolder([])`. In `TemplateEditor.tsx`, `handleAddSubfolder` calls `addNodeAt(prev, [], {...})` which appends to the root array (tree-operations.ts line 9). This works. The `setExpandedPaths` adds `""` which is harmless. No change needed.

- [ ] **Step 8: Type check and verify visually**

Run: `npx tsc --noEmit`
Expected: No errors

Verify:
- Root row appears at the top showing `<Template Name>`
- Clicking the chevron collapses/expands the children
- Right-click shows "Add Folder" context menu
- Double-click on root does nothing
- Dragging a folder onto the root row moves it to top level
- Children are still at the same depth (depth shift is Task 3)

- [ ] **Step 9: Commit**

```bash
git add src/components/FolderTree.tsx
git commit -m "feat: render virtual root row with drop target in FolderTree"
```

---

### Task 3: Shift all node depths +1

**Files:**
- Modify: `src/components/FolderTree.tsx` (render loop, drop indicators, drag overlay)

- [ ] **Step 1: Add +1 to all depth-dependent rendering**

In the `visibleNodes.map()` render loop, change every use of `depth` to `depth + 1`:

a) **FolderTreeRow `depth` prop**:
```tsx
depth={depth + 1}
```

b) **Drop indicator BEFORE** marginLeft:
```tsx
style={{ marginLeft: `${(depth + 1) * 24 + 8}px`, marginRight: '8px' }}
```

c) **Drop indicator AFTER** marginLeft:
```tsx
style={{ marginLeft: `${(depth + 1) * 24 + 8}px`, marginRight: '8px' }}
```

d) **DragOverlay** depth:
```tsx
return <FolderTreeDragOverlay node={draggedVisible.node} depth={draggedVisible.depth + 1} />
```

- [ ] **Step 2: Indent the empty state message**

Change the empty state to be indented under the root:

```tsx
{nodes.length === 0 ? (
  <div className="flex items-center h-8 text-sm text-muted-foreground pl-12">
    No folders yet.
  </div>
) : (
```

The `pl-12` (~48px) aligns with depth-1 indentation (24px indent + 24px gutter).

- [ ] **Step 3: Type check and verify visually**

Run: `npx tsc --noEmit`
Expected: No errors

Verify:
- All folders are indented one level deeper than before
- Drag overlay shows at the correct indented depth
- Drop indicator lines align with the indented rows
- Empty state text sits inside the root visually

- [ ] **Step 4: Commit**

```bash
git add src/components/FolderTree.tsx
git commit -m "feat: shift all folder depths +1 under virtual root"
```

---

### Task 4: Update keyboard navigation for root boundary

**Files:**
- Modify: `src/components/FolderTree.tsx` (handleKeyDown function)

- [ ] **Step 1: Add root guard for non-arrow keys**

In `handleKeyDown`, immediately after the editing check (line 224: `if (editingPath !== null && e.key !== 'Escape') return`), add a root-focused guard. This must go **before** the Tab block (which is at line 227) so that Tab is blocked when root is focused:

```typescript
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
```

- [ ] **Step 2: Update ArrowUp/ArrowDown to handle root**

Replace the entire ArrowUp/ArrowDown block (lines 242-268) with:

```typescript
if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
  e.preventDefault()
  const visible = getVisiblePaths(nodes, expandedPaths)

  if (isRootFocused) {
    // Root is focused — only ArrowDown does anything
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
      // First node — move focus to root
      setIsRootFocused(true)
      onFocusChange(null)
      onSelect([])
    } else if (currentIdx > 0) {
      if (e.shiftKey) {
        const prevPathStr = visible[currentIdx - 1].path.join(',')
        if (!selectedPaths.includes(prevPathStr)) {
          onSelect([...selectedPaths, prevPathStr])
        }
      }
      handleFocusNode(visible[currentIdx - 1].path)
    }
  } else {
    if (currentIdx < visible.length - 1) {
      if (e.shiftKey) {
        const nextPathStr = visible[currentIdx + 1].path.join(',')
        if (!selectedPaths.includes(nextPathStr)) {
          onSelect([...selectedPaths, nextPathStr])
        }
      }
      handleFocusNode(visible[currentIdx + 1].path)
    }
  }
  return
}
```

- [ ] **Step 3: Update ArrowLeft to navigate to root from top-level nodes**

Replace the ArrowLeft block (lines 271-283) with:

```typescript
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
    handleFocusNode(focusedPath.slice(0, -1))
  } else {
    // Top-level node — go to root
    setIsRootFocused(true)
    onFocusChange(null)
    onSelect([])
  }
  return
}
```

- [ ] **Step 4: Update ArrowRight for root**

Replace the ArrowRight block with a root guard at the top:

```typescript
if (e.key === 'ArrowRight') {
  e.preventDefault()
  if (isRootFocused) {
    if (!isRootExpanded) {
      setIsRootExpanded(true)
    } else if (nodes.length > 0) {
      setIsRootFocused(false)
      handleFocusNode([0])
    }
    return
  }
  if (!focusedPath) return
  // ... rest of existing ArrowRight logic unchanged
}
```

- [ ] **Step 5: Type check and verify**

Run: `npx tsc --noEmit`
Expected: No errors

Verify:
- ArrowUp from first folder focuses root (root gets subtle highlight)
- ArrowDown from root focuses first folder
- ArrowLeft on top-level collapsed folder focuses root
- ArrowLeft on root collapses it
- ArrowRight on collapsed root expands it
- ArrowRight on expanded root focuses first child
- Enter on root adds a new top-level folder
- Delete/Tab/F2 on root are no-ops

- [ ] **Step 6: Commit**

```bash
git add src/components/FolderTree.tsx
git commit -m "feat: keyboard navigation for virtual root boundary"
```

---

### Task 5: Update empty-space click and marquee to handle root

**Files:**
- Modify: `src/components/FolderTree.tsx` (useEffect mousedown handler)

- [ ] **Step 1: Clear root focus on empty-space click**

In the `handleMouseUp` function inside the useEffect (around line 198-204), update the empty-area click handler to also clear root focus and exclude root row clicks:

```typescript
} else {
  // No drag — simple click on empty area, clear selection
  const upTarget = upEvent.target as HTMLElement
  if (!upTarget.closest('[data-path]') && !upTarget.closest('[data-root-row]')) {
    onSelect([])
    onFocusChange(null)
    setIsRootFocused(false)
  }
}
```

The `data-root-row` attribute was already added to the root row div in Task 2.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

Verify:
- Clicking empty space below folders clears selection AND unfocuses root
- Clicking root row focuses root and clears folder selection
- Marquee selection doesn't include root row (no `data-path` attribute)

- [ ] **Step 3: Commit**

```bash
git add src/components/FolderTree.tsx
git commit -m "feat: handle root focus in empty-space click and marquee"
```

---

### Task 6: Final polish and smoke test

**Files:**
- Modify: `src/components/FolderTree.tsx` (minor, if needed)

- [ ] **Step 1: Verify `handleFocusNode` is wired to FolderTreeRow**

Confirm that the `FolderTreeRow` prop at line 417 reads:
```tsx
onFocusChange={handleFocusNode}
```
This is critical — when a user clicks a regular folder row, `FolderTreeRow` calls this handler, which clears `isRootFocused`. Without it, both root and a folder row could appear highlighted simultaneously.

- [ ] **Step 2: Full type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Manual smoke test**

Verify all behaviors:
- [ ] Root row shows `<Template Name>` with open folder icon
- [ ] Root chevron collapses/expands children
- [ ] All folders indented one level under root
- [ ] Root right-click shows "Add Folder" only
- [ ] Click root: clears selection, highlights root
- [ ] Click folder: clears root highlight
- [ ] Click empty space: clears everything including root focus
- [ ] Double-click root: no-op
- [ ] ArrowUp from first folder → root
- [ ] ArrowDown from root → first folder
- [ ] ArrowLeft on top-level folder → root
- [ ] ArrowLeft on root → collapses root
- [ ] ArrowRight on collapsed root → expands
- [ ] ArrowRight on expanded root → focuses first child
- [ ] Enter on root → adds top-level folder
- [ ] Delete/Tab on root → no-op
- [ ] Drag folder onto root → becomes top-level folder
- [ ] Rename template in toolbar → root name updates live
- [ ] Drag overlay depth is correct (indented)
- [ ] Drop indicators align with indented rows
- [ ] Empty template still shows root + "No folders yet." message
- [ ] Bottom action bar "+" button still adds top-level folders (coexists with root context menu)

- [ ] **Step 4: Commit**

```bash
git add src/components/FolderTree.tsx src/components/TemplateEditor.tsx
git commit -m "feat: virtual root folder for folder tree"
```
