# Marquee Preview Highlight — Design Spec

**Date:** 2026-04-04  
**Status:** Approved

## Overview

While the user drags a marquee selection rectangle and has not yet released the mouse, highlight the folders that intersect the rectangle using the same visual style as a confirmed selection. On mouse release the selection is committed as normal.

## Approach

Approach A: React state updated on each `mousemove`.

## Architecture

### New state — `FolderTree`

```ts
const [previewPaths, setPreviewPaths] = useState<string[]>([])
```

### Extracted helper

Extract the hit-detection logic that currently lives inside the `handleMouseUp` closure into a standalone helper inside `FolderTree`. The helper accepts the mousedown-captured `rect` so that the coordinate system matches the marquee values (which are also computed relative to that same `rect`):

```ts
function computeMarqueeHits(
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
    if (rel.left < marquee.x2 && rel.right > marquee.x1 &&
        rel.top < marquee.y2 && rel.bottom > marquee.y1) {
      hits.push(item.getAttribute('data-path')!)
    }
  })
  return hits
}
```

The `rect` passed in is the one already captured at the top of `handleMouseDown` (i.e. `containerRef.current!.getBoundingClientRect()`), the same value used to compute `startX/startY` and the marquee coordinates.

### `handleMouseMove`

After computing the new marquee values, call the helper and update preview state. Both `setMarquee` and `setPreviewPaths` are called in the same `window` `mousemove` listener. React 18 batches state updates automatically — including those from non-synthetic event listeners — so this produces a single re-render per frame.

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

### `handleMouseUp`

The existing `handleMouseUp` uses a functional updater `setMarquee((currentMarquee) => { ... })` to read the latest marquee without a stale-closure issue. Replace the inline hit-detection inside that updater with `computeMarqueeHits`. After the `setMarquee(...)` call (i.e. outside the functional updater), call `setPreviewPaths([])` to clear the preview:

```ts
const handleMouseUp = (upEvent: MouseEvent) => {
  setMarquee((currentMarquee) => {
    if (currentMarquee) {
      const selected = computeMarqueeHits(currentMarquee, containerRef.current!, rect)
      if (selected.length > 0) {
        if (upEvent.metaKey || upEvent.ctrlKey) {
          onSelect(Array.from(new Set([...selectedPaths, ...selected])))
        } else {
          onSelect(selected)
        }
      } else {
        onSelect([])
      }
    } else {
      // No drag — simple click on empty area
      const upTarget = upEvent.target as HTMLElement
      if (!upTarget.closest('[data-path]') && !upTarget.closest('[data-root-row]')) {
        onSelect([])
        onFocusChange(null)
        setIsRootFocused(false)
      }
    }
    return null
  })
  setPreviewPaths([])   // always clear, called outside the functional updater
  window.removeEventListener('mousemove', handleMouseMove)
  window.removeEventListener('mouseup', handleMouseUp)
}
```

### `FolderTreeRow` — new prop

```ts
isPreview?: boolean
```

In the content area `cn(...)` expression, add `isPreview` to the condition that applies the full selection style:

```ts
isSelected || isFocused || isPreview
  ? 'bg-accent text-accent-foreground font-medium ring-1 ring-border/50 shadow-sm'
  : 'hover:bg-accent/40'
```

### Wiring in `FolderTree`

When rendering each `FolderTreeRow`:

```tsx
isPreview={previewPaths.includes(pathStr)}
```

`previewPaths.includes` is O(n) and `FolderTreeRow` renders once per visible node, making hit checks O(n²) per mousemove frame. For typical folder trees (< 100 nodes) this is negligible and no optimisation is needed.

## Files Changed

| File | Change |
|------|--------|
| `src/components/FolderTree.tsx` | Add `previewPaths` state, extract `computeMarqueeHits`, call in `mousemove`/`mouseup`, pass `isPreview` to rows |
| `src/components/FolderTreeRow.tsx` | Add `isPreview` prop, include in highlight condition |

## Behaviour Notes

- `previewPaths` is always cleared on mouseup regardless of whether a marquee was drawn.
- Preview is only active while the marquee rectangle exists. The `mousemove` listener only fires during an active drag so no extra guard is needed.
- Modifier key behaviour (cmd/ctrl append) applies only at mouseup as today; preview always shows the raw hit set, not the merged set. This matches the expectation: "what would be selected if I released now."
- No changes to keyboard selection, DnD, or any other selection path.
