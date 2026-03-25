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

**Invariant — presence equals dirty.** An entry exists in `workingCopies` for a template ID if and only if the user has edits that differ from the persisted template. Entries are cleaned up eagerly: `handleWorkingStateChange` deletes the entry whenever the incoming state matches the saved template. The mere presence of an entry is sufficient to treat the template as dirty. `dirtyIds` is derived as `new Set(Object.keys(workingCopies))`.

**Equality definition.** The `name` field uses direct `===` comparison. The `folders` tree uses `JSON.stringify`:
```ts
name === saved.name && JSON.stringify(folders) === JSON.stringify(saved.folders)
```

**Lifecycle:**
- **On user edit:** `handleWorkingStateChange` upserts the entry (if new state ≠ saved) or deletes it (if new state matches saved). When the upserted value is identical to the existing entry (e.g. on a template switch that restores a working copy), `setWorkingCopies` still triggers a re-render. This is intentional and acceptable.
- **On save (single template):** `persistTemplate` removes `workingCopies[id]` before awaiting the write (see ordering constraint below).
- **On save (multiple templates at close):** `handleSaveSelectedAndClose` removes all saved ids from `workingCopies` before awaiting the write.
- **On delete:** `handleDelete` removes `workingCopies[id]` synchronously before removing the template from the persisted array. The existing selection-switching logic is unchanged.
- **On switch:** no action required.

### Removed state

- `isDirty: boolean` — removed.
- `confirmDiscard()` — removed. Switching templates no longer discards or blocks.

## Component Changes

### `App.tsx`

**State additions:**
- `workingCopies: Record<string, { name: string; folders: FolderNode[] }>` — initialise as `{}`.
- `closeDialogOpen: boolean` — controls the `UnsavedChangesDialog`.

**Derived (computed inline in render, not stored as separate state):**
```ts
const dirtyIds = new Set(Object.keys(workingCopies))
// Both derived from workingCopies in the same render → workingCopies[t.id] is guaranteed
// non-null for any id in dirtyIds within that render cycle.
const dirtyEntries = templates
  .filter(t => dirtyIds.has(t.id))
  .map(t => ({ id: t.id, displayName: workingCopies[t.id].name }))
```
`dirtyEntries` preserves sidebar order and uses the working-copy name (what the user sees in the editor).

---

**`persistTemplate(merged: Template): Promise<void>`**

Shared helper for single-template saves. Called by `handleSave` only (not by `handleSaveSelectedAndClose`, which uses a batch path — see below).

```ts
const persistTemplate = useCallback(async (merged: Template) => {
  const next = updateTemplate(templates, merged)
  // State updates MUST happen synchronously before the await, so that workingCopiesRef
  // reflects the clean state immediately (prevents double-close-dialog on rapid close attempts).
  setTemplates(next)
  setWorkingCopies(prev => {
    const copy = { ...prev }
    delete copy[merged.id]
    return copy
  })
  await saveTemplates(next)
}, [templates])
```

**Ordering constraint:** `setTemplates` and `setWorkingCopies` are called synchronously before `await saveTemplates`. This ensures `workingCopiesRef.current` is updated (via the sync `useEffect`) before any subsequent close attempt can read it. If the write to disk fails, state is already updated in memory — the data is not lost (it survives as long as the process lives), and the user sees a toast.

---

**`handleSave(updated: Template)`**
```ts
const handleSave = useCallback((updated: Template) => {
  persistTemplate(updated).catch(() => {
    toast.error('Failed to save template')
  })
}, [persistTemplate])
```

---

**`handleWorkingStateChange(id: string, name: string, folders: FolderNode[])`:**
1. Find `const saved = templates.find(t => t.id === id)`. If not found, return.
2. If `name === saved.name && JSON.stringify(folders) === JSON.stringify(saved.folders)`:
   call `setWorkingCopies` with the entry removed.
3. Otherwise: `setWorkingCopies(prev => ({ ...prev, [id]: { name, folders } }))`.

---

**`handleSaveSelectedAndClose(ids: string[])`**

Uses a single batch save rather than per-template calls to `persistTemplate`. The two paths (`persistTemplate` for single saves, batch for close) are intentionally different: batch is more efficient on close and avoids N sequential file writes. Both paths share the same invariant: synchronous state cleanup before the async write.

```ts
const handleSaveSelectedAndClose = useCallback(async (ids: string[]) => {
  // Build final templates array with all selected working copies merged in.
  let next = [...templates]
  for (const id of ids) {
    const wc = workingCopies[id]
    const saved = next.find(t => t.id === id)
    if (!wc || !saved) continue
    next = updateTemplate(next, { ...saved, name: wc.name, folders: wc.folders })
  }
  // Synchronous state cleanup BEFORE the async write (same invariant as persistTemplate).
  setTemplates(next)
  setWorkingCopies(prev => {
    const copy = { ...prev }
    for (const id of ids) delete copy[id]
    return copy
  })
  // Single write for all selected templates.
  try {
    await saveTemplates(next)
  } catch {
    toast.error('Some templates could not be saved')
  }
  getCurrentWindow().close()
}, [templates, workingCopies])
```

---

**`handleDiscardAllAndClose()`:** calls `getCurrentWindow().close()` directly. No error handling — if the Tauri call fails, the window stays open (acceptable; user can retry).

**`handleCancelClose()`:** `setCloseDialogOpen(false)`.

---

**`onCloseRequested` registration** — registered once via a ref pattern to avoid re-registering on every edit:

```ts
const workingCopiesRef = useRef(workingCopies)
useEffect(() => { workingCopiesRef.current = workingCopies }, [workingCopies])

useEffect(() => {
  let unlisten: (() => void) | undefined
  let mounted = true
  getCurrentWindow().onCloseRequested((event) => {
    if (Object.keys(workingCopiesRef.current).length > 0) {
      event.preventDefault()
      setCloseDialogOpen(true)
    }
  }).then((fn) => {
    if (mounted) { unlisten = fn } else { fn() } // immediately unlisten if already unmounted
  })
  return () => {
    mounted = false
    unlisten?.()
  }
}, []) // register once on mount
```

`onCloseRequested` returns a Promise and does not throw synchronously per Tauri v2's API contract, so no `.catch` is required.

---

**Props to pass down:**
- `TemplateEditor`: add `workingCopy={workingCopies[selected?.id ?? '']}` and `onWorkingStateChange={handleWorkingStateChange}`, remove `onDirtyChange`.
- `TemplateList`: add `dirtyIds`.
- Render `<UnsavedChangesDialog open={closeDialogOpen} dirtyEntries={dirtyEntries} ... />`.

---

### `TemplateEditor.tsx`

**Prop changes:**
- Add `workingCopy?: { name: string; folders: FolderNode[] }`.
- Add `onWorkingStateChange: (id: string, name: string, folders: FolderNode[]) => void`.
- Remove `onDirtyChange`.

**About `workingCopy` after load:** `workingCopy` is read only at load time (when `template.id` changes). The editor owns its local `name`/`folders` state after that. If `App` updates `workingCopies[currentId]` while the editor is showing that template, the prop reference will change, but the initial load effect will not re-run (it depends only on `template?.id`). This is safe because the only code paths that write to `workingCopies[currentId]` are:
- `handleWorkingStateChange` — which originates from the editor itself (no divergence possible).
- `persistTemplate` / `handleSaveSelectedAndClose` — which delete the entry, not overwrite it.

No code path sets `workingCopies[currentId]` to a different value while the editor is actively showing that template.

---

**Initial load effect** (extend the existing `useEffect([template?.id])`):

```ts
useEffect(() => {
  if (!template) return
  setName(workingCopy?.name ?? template.name)
  setFolders(workingCopy?.folders
    ? JSON.parse(JSON.stringify(workingCopy.folders))
    : JSON.parse(JSON.stringify(template.folders))
  )
  setSelectedPaths([])
  setNameError(null)
  setFocusedPath(null)
  setEditingPath(null)
  setExpandedPaths(getAllPathStrings(workingCopy?.folders ?? template.folders))
}, [template?.id])
// workingCopy intentionally excluded from deps — read at load time only.
```

---

**Change effect:**

```ts
useEffect(() => {
  if (!template) return
  onWorkingStateChange(template.id, name, folders)
}, [name, folders])
```

**No gating ref needed.** React 18 batches all state updates from synchronous event handlers (and from `useEffect` calls) into a single commit. Template switching is triggered by a click event handler → both `setSelectedId` in `App` and the subsequent `setName`/`setFolders` in the initial load effect are batched into one commit. The change effect's closure captures `template.id` at effect-run time, which is always after the commit that applied the new `template` prop. `onWorkingStateChange` is idempotent: if state matches saved, App deletes the entry (no-op if absent); if it matches a working copy, App upserts the same value (no-op). The only scenario where a stale `template.id` could appear is if two async (non-event-handler) state updates interleave, which does not apply here — all template switching is synchronous user interaction.

**Remove** the existing `onDirtyChange` `useEffect`.

---

### `TemplateList.tsx`

- Add prop `dirtyIds: Set<string>`.
- Replace the existing right-side dot:
  ```tsx
  {(t.id === selectedId || dirtyIds.has(t.id)) && (
    <span className={cn(
      'w-1.5 h-1.5 rounded-full flex-shrink-0',
      dirtyIds.has(t.id) ? 'bg-amber-400' : 'bg-foreground'
    )} />
  )}
  ```
  Selected + clean → white (`bg-foreground`). Dirty (regardless of selection) → amber (`bg-amber-400`). Not selected + clean → no dot. Size and position are identical.

---

### `UnsavedChangesDialog.tsx` (new)

```ts
interface UnsavedChangesDialogProps {
  open: boolean
  dirtyEntries: Array<{ id: string; displayName: string }>
  onSaveSelected: (ids: string[]) => void
  onDiscardAll: () => void
  onCancel: () => void
}
```

**Internal state:** `checkedIds: Set<string>`.

**Initialisation on open:**
```ts
useEffect(() => {
  if (open) setCheckedIds(new Set(dirtyEntries.map(e => e.id)))
}, [open])
```
`dirtyEntries` is intentionally excluded from this effect's deps. The dialog is a modal (Radix `Dialog`) — while it is open, the underlying editor is non-interactive, so `dirtyEntries` cannot change during an open session. Re-initialising only on `open` transitions is therefore safe and avoids resetting user checkbox choices mid-session.

**Behaviour:**
- Title: "Unsaved Changes". Subtitle: "The following templates have unsaved changes."
- Body: scrollable list; each row has a pre-checked `Checkbox` and `displayName` label. Toggling adds/removes from `checkedIds`.
- Footer (left to right):
  - **Cancel** (`variant="outline"`) — always enabled. Calls `onCancel`.
  - **Close Without Saving** (`variant="outline"`, `className="text-red-500 border-red-200"`) — always enabled. Calls `onDiscardAll`. This is an intentional single-click destructive action — the user has already seen the list of unsaved templates in the dialog body, so no secondary confirmation is required.
  - **Save Selected & Close** (`variant="default"`) — disabled when `checkedIds.size === 0`. Calls `onSaveSelected([...checkedIds])`.
- The dialog does **not** call `getCurrentWindow().close()`. All window management belongs to `App`.

## App-Close Flow

```
onCloseRequested fires
  ├── workingCopiesRef is empty
  │     → no-op (default close proceeds)
  └── workingCopiesRef has entries
        → event.preventDefault()
        → setCloseDialogOpen(true)
              │
              ├── onCancel
              │     → setCloseDialogOpen(false), window stays open
              │
              ├── onDiscardAll
              │     → App calls getCurrentWindow().close()
              │
              └── onSaveSelected(ids)
                    → setTemplates + setWorkingCopies (sync)
                    → await saveTemplates (async, toast on error)
                    → getCurrentWindow().close()
```

## Data Flow Diagram

```
User edits name/folders in TemplateEditor
  → onWorkingStateChange(id, name, folders) fires
    → App: upsert workingCopies[id] (or delete if matches saved)
      → dirtyIds recomputed → TemplateList amber dot appears/disappears

User saves (Save button or Cmd+S)
  → TemplateEditor fires onSave(merged)
    → App.handleSave → persistTemplate(merged)
      → updateTemplate + setTemplates + setWorkingCopies (sync)
        → await saveTemplates → template is clean, amber dot removed

User switches template
  → App passes workingCopy={workingCopies[newId]} to TemplateEditor
    → initial load effect reads workingCopy → no data loss

User closes app
  → onCloseRequested fires
    → workingCopiesRef empty? allow close : show UnsavedChangesDialog
    → user picks: save selected / discard all / cancel
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
- Automated tests (implementation detail, not specified in design).
