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

Extract the hit-detection logic that currently lives inside the `handleMouseUp` closure into a standalone helper inside `FolderTree`:

```ts
function computeMarqueeHits(
  marquee: { x1: number; y1: number; x2: number; y2: number },
  containerRef: React.RefObject<HTMLDivElement>
): string[] {
  const items = containerRef.current!.querySelectorAll('[data-path]')
  const containerRect = containerRef.current!.getBoundingClientRect()
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

### `handleMouseMove`

After updating `marquee` state, also call:

```ts
setPreviewPaths(computeMarqueeHits(newMarquee, containerRef))
```

### `handleMouseUp`

Replace the inline hit-detection with a call to `computeMarqueeHits`. After committing selection (or on no-drag mouseup), clear preview:

```ts
setPreviewPaths([])
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

## Files Changed

| File | Change |
|------|--------|
| `src/components/FolderTree.tsx` | Add `previewPaths` state, extract `computeMarqueeHits`, call in `mousemove`/`mouseup`, pass `isPreview` to rows |
| `src/components/FolderTreeRow.tsx` | Add `isPreview` prop, include in highlight condition |

## Behaviour Notes

- `previewPaths` is always cleared on mouseup regardless of whether a marquee was drawn.
- Preview is only active while the marquee rectangle exists (`marquee !== null`). The mousemove handler only fires when a drag is in progress so no extra guard is needed.
- Modifier key behaviour (cmd/ctrl append) applies only at mouseup as today; preview always shows the raw hit set, not the merged set. This matches user expectation: "what would be selected if I released now."
- No changes to keyboard selection, DnD, or any other selection path.
