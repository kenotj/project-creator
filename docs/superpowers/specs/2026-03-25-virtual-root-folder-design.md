# Virtual Root Folder Design

**Date:** 2026-03-25
**Status:** Approved

## Problem

When a new template is created, the folder tree starts empty with no structural anchor. Users add top-level folders as siblings, but there's no visual indication that these folders all live inside a single project directory. There's also nothing preventing a user from deleting every folder, leaving no context.

## Solution: Virtual Root (Render-Only)

Render a permanent, non-deletable root row at the top of the FolderTree displaying `<Template Name>`. All existing folders appear as its children, indented one level deeper. The data model (`template.folders[]`) is unchanged — the root exists only in the UI layer.

### Why virtual, not model-level

The root is conceptually different from a real folder:
- It's not created on disk (the output folder name comes from the "Create Project" dialog)
- It's not renamable from the tree (it syncs with the template name in the toolbar)
- It's not deletable

Keeping it out of the data model avoids migration, serialization changes, and sync logic. The UI special-casing is contained to `FolderTree`.

## Design

### New Props

`FolderTree` receives `templateName: string` from `TemplateEditor`.

### Root Row Component

A new `FolderTreeRootRow` component (or inline JSX in `FolderTree`) renders the root. It does **not** use `FolderTreeRow` because `FolderTreeRow` calls `useSortable` unconditionally, which would register the root as a draggable item. The root row is simple static markup: chevron + folder icon + `<name>`.

### Root Row Rendering

- Rendered **before** the `DndContext`/`SortableContext` — it's not a sortable/draggable item
- Always present when a template is selected
- Displays: open folder icon + `<Template Name>` (with angle brackets)
- Has an expand/collapse chevron — collapsing hides all children. Expanded by default
- Visual treatment: semi-bold text, no selection highlight, no hover background — visually reads as a permanent header row. No drag grip on hover. No `...` dropdown menu.

### Root Expand/Collapse State

A local `isRootExpanded` boolean state lives inside `FolderTree` (defaults to `true`). It is not stored in `expandedPaths` since the root has no path. When collapsed, the `DndContext`/`SortableContext` block is rendered but visually hidden (`hidden` class or `display: none`) — this avoids unmounting/remounting sortable registrations which would cause flickering.

### Depth Shift

All existing `visibleNodes` render at `depth + 1` so they indent under the root. The +1 offset is applied consistently to:
- `FolderTreeRow` `depth` prop
- Drop indicator `marginLeft` calculations
- `FolderTreeDragOverlay` depth

No changes to `getVisiblePaths` or tree-operations — the shift is applied at render time only.

### Keyboard Navigation

| Scenario | Behavior |
|---|---|
| ArrowUp from first real node (`[0]`) | Focus moves to the root row |
| ArrowDown from root row | Focus moves to the first real node (`[0]`) |
| ArrowLeft on a top-level node (collapsed/leaf at path `[0]`) | Focus moves to root row (parent convention, same as macOS Finder) |
| ArrowUp/ArrowDown on root when tree is empty | No-op |
| Delete/Backspace when root is focused | No-op |
| Tab/Shift+Tab when root is focused | No-op |
| Enter when root is focused | Adds a top-level folder (same as "Add Folder" button) |

### Focus Model

The root uses a separate `isRootFocused` boolean (not a sentinel in `focusedPath`). When root is focused, `focusedPath` is set to `null`. When a regular node is focused, `isRootFocused` is set to `false`. They are mutually exclusive.

### Interaction Guards

| Action | Behavior on Root |
|---|---|
| Click | Set `isRootFocused = true`, clear `selectedPaths` and `focusedPath` |
| Shift+Click | Treated as plain click (clear selection, focus root) |
| Cmd/Ctrl+Click | Treated as plain click (clear selection, focus root) |
| Double-click | No-op (not renamable) |
| Drag | Not draggable (outside SortableContext) |
| Drop onto root | Valid drop target — drops the node as a new top-level folder (`position: 'inside'` with root path `[]`). Shows the standard drop indicator. |
| Context menu | Shows only "Add Folder" (labeled "Add Folder", not "Add Subfolder", since from the user's perspective these are top-level) |
| Marquee selection | Skips root row (no `data-path` attribute) |

### Selection Behavior

- Root is never included in `selectedPaths` — it has no path string
- Clicking root clears the current selection and focuses the root
- Bulk operations (delete, duplicate) cannot affect the root

### Empty State

When the template has no folders, root still renders. Below it, the empty state message appears indented at depth 1 to visually sit inside the root: "No folders yet."

## Files Changed

| File | Change |
|---|---|
| `src/components/FolderTree.tsx` | Add `templateName` prop, render root row before DndContext, add `isRootExpanded` and `isRootFocused` state, shift all node depths +1, update keyboard navigation for root boundary, update drop indicator margins |
| `src/components/TemplateEditor.tsx` | Pass `templateName` to FolderTree |

## Out of Scope

- Data model changes to `FolderNode` or `Template`
- Migration of existing saved templates
- Changes to "Create Project" / `GenerateDialog`
- Changes to tree-operations.ts
- ARIA / accessibility attributes (future improvement)
