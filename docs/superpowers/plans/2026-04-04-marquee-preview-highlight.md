# Marquee Preview Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While a marquee drag-select is in progress (before mouse release), highlight all folders intersecting the rectangle with the same style as confirmed selected folders.

**Architecture:** Extract `computeMarqueeHits` to module scope in `FolderTree.tsx` (exported for testability), add `previewPaths` state that updates on every `mousemove`, clear it on `mouseup` after committing selection, and pass `isPreview` down to each `FolderTreeRow`.

**Tech Stack:** React 18, Vitest + jsdom, React Testing Library, @dnd-kit/core, Tailwind CSS

---

### Task 1: Add `isPreview` prop to `FolderTreeRow`

**Files:**
- Modify: `src/components/FolderTreeRow.tsx`
- Test: `tests/FolderTreeRow.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/FolderTreeRow.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DndContext } from '@dnd-kit/core'
import { FolderTreeRow } from '@/components/FolderTreeRow'

const baseProps = {
  node: { name: 'src', children: [] },
  path: [0],
  depth: 1,
  selectedPaths: [],
  isFocused: false,
  isEditing: false,
  isExpanded: false,
  siblingNames: [],
  onSelect: vi.fn(),
  onShiftSelect: vi.fn(),
  onFocusChange: vi.fn(),
  onEditingChange: vi.fn(),
  onToggleExpand: vi.fn(),
  onAddSubfolder: vi.fn(),
  onRename: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
}

function renderRow(overrides = {}) {
  return render(
    <DndContext>
      <FolderTreeRow {...baseProps} {...overrides} />
    </DndContext>
  )
}

describe('FolderTreeRow isPreview', () => {
  it('applies selection style when isPreview is true', () => {
    const { container } = renderRow({ isPreview: true })
    expect(container.querySelector('.bg-accent')).toBeInTheDocument()
  })

  it('does not apply selection style when isPreview is false and not selected', () => {
    const { container } = renderRow({ isPreview: false })
    expect(container.querySelector('.bg-accent')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/FolderTreeRow.test.tsx
```
Expected: FAIL — `isPreview` prop is unknown / selection style not applied

- [ ] **Step 3: Implement `isPreview` prop**

In `src/components/FolderTreeRow.tsx`:

1. Add to `FolderTreeRowProps` interface (after `isDropTarget`):
```ts
isPreview?: boolean
```

2. Add to the destructured function params (after `isDropTarget`):
```ts
isPreview,
```

3. Update the content area `cn(...)` condition — change:
```ts
isSelected || isFocused
  ? 'bg-accent text-accent-foreground font-medium ring-1 ring-border/50 shadow-sm'
  : 'hover:bg-accent/40'
```
to:
```ts
isSelected || isFocused || isPreview
  ? 'bg-accent text-accent-foreground font-medium ring-1 ring-border/50 shadow-sm'
  : 'hover:bg-accent/40'
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/FolderTreeRow.test.tsx
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add tests/FolderTreeRow.test.tsx src/components/FolderTreeRow.tsx
git commit -m "feat: add isPreview prop to FolderTreeRow"
```

---

### Task 2: Extract `computeMarqueeHits` + wire `previewPaths` state in `FolderTree`

**Files:**
- Modify: `src/components/FolderTree.tsx`
- Test: `tests/FolderTree.test.tsx`

- [ ] **Step 1: Write the failing test for `computeMarqueeHits`**

Create `tests/FolderTree.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { computeMarqueeHits } from '@/components/FolderTree'

function makeEl(
  pathStr: string,
  rect: { left: number; top: number; right: number; bottom: number }
) {
  const el = document.createElement('div')
  el.setAttribute('data-path', pathStr)
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
    width: rect.right - rect.left, height: rect.bottom - rect.top,
    x: rect.left, y: rect.top, toJSON: () => {},
  } as DOMRect)
  return el
}

function makeContainer(children: HTMLElement[]) {
  const container = document.createElement('div') as HTMLDivElement
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 400, bottom: 600,
    width: 400, height: 600, x: 0, y: 0, toJSON: () => {},
  } as DOMRect)
  children.forEach(c => container.appendChild(c))
  return container
}

describe('computeMarqueeHits', () => {
  it('returns paths of elements that intersect the marquee', () => {
    // el1 sits at relative y 10–30, el2 at y 40–60
    const container = makeContainer([
      makeEl('0', { left: 10, top: 10, right: 200, bottom: 30 }),
      makeEl('1', { left: 10, top: 40, right: 200, bottom: 60 }),
    ])
    const rect = container.getBoundingClientRect()
    // Marquee covers y 0–35 — hits el1 only
    const hits = computeMarqueeHits({ x1: 0, y1: 0, x2: 300, y2: 35 }, container, rect)
    expect(hits).toEqual(['0'])
  })

  it('returns multiple paths when marquee covers several elements', () => {
    const container = makeContainer([
      makeEl('0', { left: 10, top: 10, right: 200, bottom: 30 }),
      makeEl('1', { left: 10, top: 40, right: 200, bottom: 60 }),
    ])
    const rect = container.getBoundingClientRect()
    const hits = computeMarqueeHits({ x1: 0, y1: 0, x2: 300, y2: 65 }, container, rect)
    expect(hits).toEqual(['0', '1'])
  })

  it('returns empty array when marquee misses all elements', () => {
    const container = makeContainer([
      makeEl('0', { left: 10, top: 100, right: 200, bottom: 130 }),
    ])
    const rect = container.getBoundingClientRect()
    const hits = computeMarqueeHits({ x1: 0, y1: 0, x2: 50, y2: 5 }, container, rect)
    expect(hits).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/FolderTree.test.tsx
```
Expected: FAIL — `computeMarqueeHits` is not exported

- [ ] **Step 3: Add `computeMarqueeHits` at module scope in `FolderTree.tsx`**

In `src/components/FolderTree.tsx`, add this exported function **above** the `export function FolderTree(...)` declaration:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/FolderTree.test.tsx
```
Expected: PASS (3 tests)

- [ ] **Step 5: Add `previewPaths` state**

In `src/components/FolderTree.tsx`, inside the `FolderTree` component, add alongside the other `useState` declarations:

```ts
const [previewPaths, setPreviewPaths] = useState<string[]>([])
```

- [ ] **Step 6: Update `handleMouseMove` to compute preview**

Inside the `useEffect`, `handleMouseDown` closure, replace the existing `handleMouseMove`:

```ts
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
```

Note: `rect` here is the `DOMRect` already captured at the top of `handleMouseDown` — the same baseline used to compute `startX/startY` and the marquee coordinates.

- [ ] **Step 7: Update `handleMouseUp` to use `computeMarqueeHits` and clear preview**

Replace the existing `handleMouseUp` closure:

```ts
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
```

- [ ] **Step 8: Pass `isPreview` to each `FolderTreeRow`**

In the `visibleNodes.map(...)` render block inside `FolderTree`, add the `isPreview` prop to `<FolderTreeRow`:

```tsx
isPreview={previewPaths.includes(pathStr)}
```

- [ ] **Step 9: Run all tests**

```bash
npm test
```
Expected: all tests pass

- [ ] **Step 10: Commit**

```bash
git add src/components/FolderTree.tsx tests/FolderTree.test.tsx
git commit -m "feat: highlight folders during marquee drag selection preview"
```
