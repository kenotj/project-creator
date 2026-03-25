# Per-Template Save State Design

**Date:** 2026-03-25
**Status:** Approved

## Overview

Replace the current single-boolean dirty flag with a per-template working-copies map so that unsaved edits survive template switching. Add a visual indicator in the sidebar for dirty templates, and intercept the app-close event to offer the user a chance to save any outstanding changes before quitting.

## Goals

1. Switching between templates no longer discards unsaved edits.
2. Each template independently tracks whether it has unsaved changes.
3. The sidebar shows a visual indicator on dirty templates.
4. Closing the app while templates have unsaved changes shows a dialog with per-template checkboxes so the user can choose what to save.

## State Model

### `workingCopies` (in `App.tsx`)

```ts
workingCopies: Record<string, { name: string; folders: FolderNode[] }>
```

- An entry exists for a template ID whenever the user has made edits that differ from the last saved state.
- A template is **dirty** when `workingCopies[id]` exists and its content differs from the persisted template.
- `dirtyIds: Set<string>` is derived from `workingCopies` — computed inline, not stored separately.
- **On save:** remove the entry for that template ID.
- **On delete:** remove the entry for that template ID.
- **On switch:** no action needed — the editor is already mirroring its state into `workingCopies` on every change via `onWorkingStateChange`.

### Removed state

- `isDirty: boolean` — removed.
- `confirmDiscard()` — removed. Switching templates no longer discards or blocks.

## Component Changes

### `App.tsx`

- Add `workingCopies: Record<string, { name: string; folders: FolderNode[] }>` state.
- Derive `dirtyIds = new Set(Object.keys(workingCopies).filter(id => isDirtyForId(id)))` where `isDirtyForId` compares the working copy to the saved template.
- Add `handleWorkingStateChange(id: string, name: string, folders: FolderNode[])`:
  - If the new state matches the saved template exactly, delete the entry from `workingCopies` (clean).
  - Otherwise, upsert the entry.
- Pass `workingCopy={workingCopies[selected?.id]}` and `onWorkingStateChange={handleWorkingStateChange}` to `TemplateEditor`.
- Pass `dirtyIds` to `TemplateList`.
- Remove `isDirty`, `onDirtyChange`, and `confirmDiscard`.
- Register `getCurrentWindow().onCloseRequested` on mount; if any `dirtyIds` exist, prevent the default close and show `UnsavedChangesDialog`.

### `TemplateEditor.tsx`

- Add prop `workingCopy?: { name: string; folders: FolderNode[] }`.
- Add prop `onWorkingStateChange: (id: string, name: string, folders: FolderNode[]) => void`.
- Remove prop `onDirtyChange`.
- On template switch (`template?.id` changes): initialise `name` and `folders` from `workingCopy` if present, otherwise from `template`.
- Call `onWorkingStateChange(template.id, name, folders)` via `useEffect` whenever `name` or `folders` change (after the initial load effect has run).

### `TemplateList.tsx`

- Add prop `dirtyIds: Set<string>`.
- For each template row:
  - If dirty AND selected: render an **amber dot** (`bg-amber-400`) replacing the current white selected dot.
  - If dirty AND NOT selected: render a smaller amber dot on the right.
  - If clean AND selected: render the existing white dot as-is.
  - If clean AND not selected: no dot (unchanged).

### `UnsavedChangesDialog.tsx` (new)

```
Props:
  open: boolean
  dirtyTemplates: Template[]   // the full saved Template objects for name display
  onSaveSelected: (ids: string[]) => void
  onDiscardAll: () => void
  onCancel: () => void
```

- Renders a `Dialog` using the existing Radix UI dialog primitives.
- Title: "Unsaved Changes"
- Subtitle: "The following templates have unsaved changes."
- Body: scrollable list of dirty templates, each with a `Checkbox` (pre-checked) and template name label.
- Footer buttons:
  - **Cancel** (outline) — calls `onCancel`, window stays open.
  - **Close Without Saving** (outline, destructive style) — calls `onDiscardAll`, then the caller closes the window.
  - **Save Selected & Close** (primary) — calls `onSaveSelected(checkedIds)`, then the caller saves those templates and closes the window.
- Disabled state: "Save Selected & Close" is disabled when no checkboxes are checked.

## App-Close Flow

```
onCloseRequested fires
  → any dirtyIds?
      no  → allow close (do nothing, default proceeds)
      yes → event.preventDefault()
            show UnsavedChangesDialog
              → Cancel       : hide dialog, window stays open
              → Discard All  : appWindow.close()
              → Save Selected: save each selected template → appWindow.close()
```

`appWindow.close()` is called explicitly after user action (not `event.preventDefault()` being un-called, since Tauri v2 requires explicit `appWindow.close()` after preventDefault).

## Data Flow Diagram

```
User edits name/folders
  → TemplateEditor fires onWorkingStateChange(id, name, folders)
    → App upserts workingCopies[id]
      → dirtyIds recomputed
        → TemplateList re-renders with amber dot on dirty rows

User clicks Save (or Cmd+S)
  → TemplateEditor fires onSave(template)
    → App persists, deletes workingCopies[id]
      → dirtyIds recomputed (template becomes clean)

User switches template
  → App passes workingCopy (if any) to TemplateEditor
    → TemplateEditor initialises from workingCopy
      (no discard prompt, no data loss)

User closes app
  → onCloseRequested fires
    → if dirtyIds non-empty: show UnsavedChangesDialog
    → user picks action → save / discard / cancel
```

## Files Touched

| File | Type |
|---|---|
| `src/App.tsx` | Modified |
| `src/components/TemplateEditor.tsx` | Modified |
| `src/components/TemplateList.tsx` | Modified |
| `src/components/UnsavedChangesDialog.tsx` | New |

## Out of Scope

- Autosave / draft persistence across app restarts (working copies live in memory only).
- Conflict resolution if the same template is edited externally while the app is open.
