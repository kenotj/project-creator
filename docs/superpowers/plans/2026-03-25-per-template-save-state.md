# Per-Template Save State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-template dirty tracking with a per-template working-copies map, add sidebar dirty indicators, and show an unsaved-changes dialog when the user closes the app with dirty templates.

**Architecture:** `App` holds `workingCopies: Record<id, {name, folders}>` — presence means dirty. `TemplateEditor` mirrors its local state into this map on every keystroke via `onWorkingStateChange`. `TemplateList` receives `dirtyIds` for amber dot indicators. `UnsavedChangesDialog` is triggered by Tauri's `onCloseRequested` event whenever dirty templates exist.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Radix UI Dialog, Vitest + React Testing Library (`@testing-library/react`), Tauri v2 (`@tauri-apps/api/window`)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/components/UnsavedChangesDialog.tsx` | Create | Checkbox list of dirty templates + save/discard/cancel footer |
| `src/components/TemplateList.tsx` | Modify | Accept `dirtyIds: Set<string>`, render amber dot on dirty rows |
| `src/components/TemplateEditor.tsx` | Modify | Accept `workingCopy?` + `onWorkingStateChange`, remove `onDirtyChange` |
| `src/App.tsx` | Modify | `workingCopies` state, `persistTemplate`, `handleWorkingStateChange`, `handleSaveSelectedAndClose`, Tauri close handler |
| `tests/setup.ts` | Modify | Add `@tauri-apps/api/window` mock |
| `tests/UnsavedChangesDialog.test.tsx` | Create | Component unit tests |
| `tests/TemplateList.test.tsx` | Create | Dirty dot rendering tests |
| `tests/TemplateEditor.test.tsx` | Create | Working copy initialisation tests |

---

## Task 1: `UnsavedChangesDialog` component

**Files:**
- Create: `src/components/UnsavedChangesDialog.tsx`
- Create: `tests/UnsavedChangesDialog.test.tsx`

### Background

The dialog uses the existing `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` primitives from `src/components/ui/dialog.tsx`. No shadcn Checkbox component exists in this project — use a native `<input type="checkbox">` styled with Tailwind. The dialog is modal, so the user cannot interact with the editor behind it.

- [ ] **Step 1.1: Write the failing tests**

Create `tests/UnsavedChangesDialog.test.tsx`:

```tsx
// tests/UnsavedChangesDialog.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'

const baseEntries = [
  { id: 'a', displayName: 'Alpha' },
  { id: 'b', displayName: 'Beta' },
]

describe('UnsavedChangesDialog', () => {
  const onSaveSelected = vi.fn()
  const onDiscardAll = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all dirty entries with checkboxes pre-checked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    checkboxes.forEach(cb => expect(cb).toBeChecked())
  })

  it('disables Save Selected when all checkboxes are unchecked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    screen.getAllByRole('checkbox').forEach(cb => fireEvent.click(cb))
    expect(screen.getByRole('button', { name: /save selected/i })).toBeDisabled()
  })

  it('calls onSaveSelected with only checked ids', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    // Uncheck Beta
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    fireEvent.click(screen.getByRole('button', { name: /save selected/i }))
    expect(onSaveSelected).toHaveBeenCalledWith(['a'])
  })

  it('calls onDiscardAll when Close Without Saving is clicked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /close without saving/i }))
    expect(onDiscardAll).toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('re-checks all entries when re-opened after partial uncheck', () => {
    const { rerender } = render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    // Uncheck one
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    // Close and re-open
    rerender(
      <UnsavedChangesDialog
        open={false}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    rerender(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    screen.getAllByRole('checkbox').forEach(cb => expect(cb).toBeChecked())
  })
})
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
cd /Users/kennethong/repos/project-creator && npm test -- tests/UnsavedChangesDialog.test.tsx
```
Expected: fail with "Cannot find module '@/components/UnsavedChangesDialog'"

- [ ] **Step 1.3: Implement `UnsavedChangesDialog`**

Create `src/components/UnsavedChangesDialog.tsx`:

```tsx
// src/components/UnsavedChangesDialog.tsx
import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'

interface UnsavedChangesDialogProps {
  open: boolean
  dirtyEntries: Array<{ id: string; displayName: string }>
  onSaveSelected: (ids: string[]) => void
  onDiscardAll: () => void
  onCancel: () => void
}

export function UnsavedChangesDialog({
  open, dirtyEntries, onSaveSelected, onDiscardAll, onCancel,
}: UnsavedChangesDialogProps) {
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())

  // Re-initialise checkboxes every time the dialog opens.
  // dirtyEntries is excluded from deps: the dialog is modal so entries
  // cannot change while it is open.
  useEffect(() => {
    if (open) setCheckedIds(new Set(dirtyEntries.map(e => e.id)))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <p className="text-sm text-muted-foreground">
            The following templates have unsaved changes.
          </p>
        </DialogHeader>

        <div className="py-2 space-y-2 max-h-60 overflow-y-auto">
          {dirtyEntries.map(entry => (
            <label
              key={entry.id}
              className="flex items-center gap-3 px-1 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checkedIds.has(entry.id)}
                onChange={() => toggle(entry.id)}
                className="w-4 h-4 rounded border-border accent-primary cursor-pointer"
              />
              <span className="text-sm">{entry.displayName}</span>
            </label>
          ))}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            variant="outline"
            className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={onDiscardAll}
          >
            Close Without Saving
          </Button>
          <Button
            onClick={() => onSaveSelected([...checkedIds])}
            disabled={checkedIds.size === 0}
          >
            Save Selected & Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
cd /Users/kennethong/repos/project-creator && npm test -- tests/UnsavedChangesDialog.test.tsx
```
Expected: all 6 tests pass

- [ ] **Step 1.5: Commit**

```bash
cd /Users/kennethong/repos/project-creator
git add src/components/UnsavedChangesDialog.tsx tests/UnsavedChangesDialog.test.tsx
git commit -m "feat: add UnsavedChangesDialog component"
```

---

## Task 2: `TemplateList` dirty indicators

**Files:**
- Modify: `src/components/TemplateList.tsx`
- Create: `tests/TemplateList.test.tsx`

### Background

`TemplateList` already renders a white `bg-foreground` dot for the selected template. We extend it to accept `dirtyIds: Set<string>` and render an amber (`bg-amber-400`) dot for any dirty template, replacing the white dot if the template is also selected.

- [ ] **Step 2.1: Write the failing tests**

Create `tests/TemplateList.test.tsx`:

```tsx
// tests/TemplateList.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TemplateList } from '@/components/TemplateList'
import type { Template } from '@/lib/models'

const templates: Template[] = [
  { id: 'a', name: 'Alpha', folders: [] },
  { id: 'b', name: 'Beta', folders: [] },
  { id: 'c', name: 'Gamma', folders: [] },
]

function renderList(selectedId: string | null, dirtyIds: Set<string>) {
  return render(
    <TemplateList
      templates={templates}
      selectedId={selectedId}
      dirtyIds={dirtyIds}
      isDark={false}
      onSelect={vi.fn()}
      onNew={vi.fn()}
      onToggleTheme={vi.fn()}
    />
  )
}

describe('TemplateList dirty indicators', () => {
  it('shows amber dot for a dirty unselected template', () => {
    const { container } = renderList('a', new Set(['b']))
    const betaRow = screen.getByText('Beta').closest('button')!
    const dot = betaRow.querySelector('.bg-amber-400')
    expect(dot).toBeInTheDocument()
  })

  it('shows amber dot for a dirty selected template', () => {
    const { container } = renderList('b', new Set(['b']))
    const betaRow = screen.getByText('Beta').closest('button')!
    const dot = betaRow.querySelector('.bg-amber-400')
    expect(dot).toBeInTheDocument()
  })

  it('shows white dot for a clean selected template', () => {
    const { container } = renderList('a', new Set())
    const alphaRow = screen.getByText('Alpha').closest('button')!
    expect(alphaRow.querySelector('.bg-foreground')).toBeInTheDocument()
    expect(alphaRow.querySelector('.bg-amber-400')).not.toBeInTheDocument()
  })

  it('shows no dot for a clean unselected template', () => {
    const { container } = renderList('a', new Set())
    const betaRow = screen.getByText('Beta').closest('button')!
    expect(betaRow.querySelector('.bg-foreground')).not.toBeInTheDocument()
    expect(betaRow.querySelector('.bg-amber-400')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
cd /Users/kennethong/repos/project-creator && npm test -- tests/TemplateList.test.tsx
```
Expected: TypeScript error — `dirtyIds` is not a recognised prop

- [ ] **Step 2.3: Update `TemplateList.tsx`**

In `src/components/TemplateList.tsx`, make the following changes:

1. Add `dirtyIds: Set<string>` to `TemplateListProps`.
2. Add `dirtyIds` to the destructured props.
3. Replace the existing right-side dot JSX:

**Find and replace the existing dot:**
```tsx
{t.id === selectedId && (
  <span className="w-1.5 h-1.5 rounded-full bg-foreground flex-shrink-0" />
)}
```

**Replace with:**
```tsx
{(t.id === selectedId || dirtyIds.has(t.id)) && (
  <span className={cn(
    'w-1.5 h-1.5 rounded-full flex-shrink-0',
    dirtyIds.has(t.id) ? 'bg-amber-400' : 'bg-foreground'
  )} />
)}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
cd /Users/kennethong/repos/project-creator && npm test -- tests/TemplateList.test.tsx
```
Expected: all 4 tests pass

- [ ] **Step 2.5: Commit**

```bash
cd /Users/kennethong/repos/project-creator
git add src/components/TemplateList.tsx tests/TemplateList.test.tsx
git commit -m "feat: add dirty indicator dots to TemplateList"
```

---

## Task 3: `TemplateEditor` working copy changes

**Files:**
- Modify: `src/components/TemplateEditor.tsx`
- Create: `tests/TemplateEditor.test.tsx`

### Background

`TemplateEditor` gains two new props: `workingCopy?` (initialises from if present on template switch) and `onWorkingStateChange` (fires on every `name`/`folders` state change). The existing `onDirtyChange` prop is removed. The change effect fires unconditionally — React 18 batching ensures it only fires after the initial load effect's state updates are committed.

- [ ] **Step 3.1: Write the failing tests**

Create `tests/TemplateEditor.test.tsx`:

```tsx
// tests/TemplateEditor.test.tsx
import { render, screen, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TemplateEditor } from '@/components/TemplateEditor'
import type { Template } from '@/lib/models'

const baseTemplate: Template = {
  id: 'tmpl-1',
  name: 'My Template',
  folders: [],
}

function renderEditor(overrides: Partial<Parameters<typeof TemplateEditor>[0]> = {}) {
  const defaults = {
    template: baseTemplate,
    templates: [baseTemplate],
    saveSignal: 0,
    onSave: vi.fn(),
    onDelete: vi.fn(),
    onDuplicate: vi.fn(),
    onWorkingStateChange: vi.fn(),
  }
  return render(<TemplateEditor {...defaults} {...overrides} />)
}

describe('TemplateEditor working copy', () => {
  it('initialises name from workingCopy when provided', () => {
    renderEditor({
      workingCopy: { name: 'Draft Name', folders: [] },
    })
    const nameInput = screen.getByDisplayValue('Draft Name')
    expect(nameInput).toBeInTheDocument()
  })

  it('falls back to template name when no workingCopy', () => {
    renderEditor()
    expect(screen.getByDisplayValue('My Template')).toBeInTheDocument()
  })

  it('calls onWorkingStateChange when name changes', async () => {
    const onWorkingStateChange = vi.fn()
    renderEditor({ onWorkingStateChange })
    const nameInput = screen.getByDisplayValue('My Template')
    await act(async () => {
      fireEvent.change(nameInput, { target: { value: 'Renamed' } })
    })
    expect(onWorkingStateChange).toHaveBeenCalledWith(
      'tmpl-1',
      'Renamed',
      expect.any(Array)
    )
  })
})
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
cd /Users/kennethong/repos/project-creator && npm test -- tests/TemplateEditor.test.tsx
```
Expected: TypeScript errors — `workingCopy` and `onWorkingStateChange` are unknown props; `onDirtyChange` is required

- [ ] **Step 3.3: Update `TemplateEditor.tsx` props interface**

In `src/components/TemplateEditor.tsx`, update the `TemplateEditorProps` interface:

```ts
interface TemplateEditorProps {
  template: Template | null
  templates: Template[]
  saveSignal: number
  onSave: (t: Template) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onWorkingStateChange: (id: string, name: string, folders: FolderNode[]) => void
  workingCopy?: { name: string; folders: FolderNode[] }
}
```

Update the function signature to destructure the new props and remove `onDirtyChange`:

```ts
export function TemplateEditor({
  template, templates, saveSignal,
  onSave, onDelete, onDuplicate, onWorkingStateChange, workingCopy
}: TemplateEditorProps) {
```

- [ ] **Step 3.4: Update the initial load effect**

Find the existing `useEffect` that depends on `[template?.id]` and extend it to read from `workingCopy`:

**Find:**
```ts
useEffect(() => {
  if (template) {
    setName(template.name)
    setFolders(JSON.parse(JSON.stringify(template.folders)))
    setSelectedPaths([])
    setNameError(null)
    setFocusedPath(null)
    setEditingPath(null)
    setExpandedPaths(getAllPathStrings(template.folders))
  }
}, [template?.id])
```

**Replace with:**
```ts
useEffect(() => {
  if (template) {
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
  }
}, [template?.id]) // workingCopy intentionally excluded — read at load time only
```

- [ ] **Step 3.5: Replace `onDirtyChange` effect with `onWorkingStateChange` effect**

Find the existing `useEffect` that calls `onDirtyChange`:
```ts
useEffect(() => {
  onDirtyChange(isDirty)
}, [isDirty, onDirtyChange])
```

**Replace with** (add after the initial load effect):
```ts
useEffect(() => {
  if (!template) return
  onWorkingStateChange(template.id, name, folders)
}, [name, folders]) // template.id captured at effect-run time via closure
```

- [ ] **Step 3.6: Run tests to verify they pass**

```bash
cd /Users/kennethong/repos/project-creator && npm test -- tests/TemplateEditor.test.tsx
```
Expected: all 3 tests pass

- [ ] **Step 3.7: Run full test suite to check for regressions**

```bash
cd /Users/kennethong/repos/project-creator && npm test
```
Expected: all existing tests still pass (the only breaking change is removing `onDirtyChange` — App.tsx still passes it for now, which will cause a TypeScript warning but not a test failure)

- [ ] **Step 3.8: Commit**

```bash
cd /Users/kennethong/repos/project-creator
git add src/components/TemplateEditor.tsx tests/TemplateEditor.test.tsx
git commit -m "feat: add workingCopy and onWorkingStateChange to TemplateEditor"
```

---

## Task 4: Wire `App.tsx`

**Files:**
- Modify: `src/App.tsx`
- Modify: `tests/setup.ts`

### Background

This task wires everything together. `App` gains:
- `workingCopies` state + `closeDialogOpen` state
- `persistTemplate` async helper (replaces the fire-and-forget save in `handleSave`)
- `handleWorkingStateChange` (upserts/deletes from `workingCopies`)
- `handleSaveSelectedAndClose` (batch save + close)
- `handleDiscardAllAndClose`, `handleCancelClose`
- Tauri `onCloseRequested` listener registered via a ref pattern
- All new props wired to child components

`confirmDiscard` and `isDirty` are removed. The `onDirtyChange` prop is removed from `<TemplateEditor>`.

The `@tauri-apps/api/window` module must be mocked in `tests/setup.ts` so that importing `App.tsx` in tests doesn't break.

- [ ] **Step 4.1: Add `@tauri-apps/api/window` mock to `tests/setup.ts`**

Open `tests/setup.ts` and add at the bottom:

```ts
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    onCloseRequested: vi.fn().mockResolvedValue(vi.fn()),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}))
```

- [ ] **Step 4.2: Run existing tests to confirm the mock doesn't break anything**

```bash
cd /Users/kennethong/repos/project-creator && npm test
```
Expected: all tests still pass

- [ ] **Step 4.3: Replace `isDirty` state with `workingCopies` + add `closeDialogOpen`**

In `src/App.tsx`:

1. Remove `const [isDirty, setIsDirty] = useState(false)`
2. Add:
```ts
const [workingCopies, setWorkingCopies] = useState<Record<string, { name: string; folders: FolderNode[] }>>({})
const [closeDialogOpen, setCloseDialogOpen] = useState(false)
```
3. Add the import for `FolderNode`:
```ts
import type { Template, FolderNode } from './lib/models'
```
(It's already imported as `Template` — just add `FolderNode` to the same import.)

- [ ] **Step 4.4: Add `workingCopiesRef` and `onCloseRequested` registration**

Add after the state declarations:

```ts
const workingCopiesRef = useRef(workingCopies)
useEffect(() => { workingCopiesRef.current = workingCopies }, [workingCopies])
```

Add the `useRef` import to React imports if not present: `import { useEffect, useState, useCallback, useRef } from 'react'`

Add the Tauri window import at the top of the file:
```ts
import { getCurrentWindow } from '@tauri-apps/api/window'
```

Add the close-requested registration effect (after the save signal effect):
```ts
useEffect(() => {
  let unlisten: (() => void) | undefined
  let mounted = true
  getCurrentWindow().onCloseRequested((event) => {
    if (Object.keys(workingCopiesRef.current).length > 0) {
      event.preventDefault()
      setCloseDialogOpen(true)
    }
  }).then((fn) => {
    if (mounted) { unlisten = fn } else { fn() }
  })
  return () => {
    mounted = false
    unlisten?.()
  }
}, [])
```

- [ ] **Step 4.5: Add `persistTemplate` helper**

Add after the existing `handleSave` callback (replacing it):

```ts
const persistTemplate = useCallback(async (merged: Template) => {
  const next = updateTemplate(templates, merged)
  setTemplates(next)
  setWorkingCopies(prev => {
    const copy = { ...prev }
    delete copy[merged.id]
    return copy
  })
  await saveTemplates(next)
}, [templates])

const handleSave = useCallback((updated: Template) => {
  persistTemplate(updated).catch(() => {
    toast.error('Failed to save template')
  })
}, [persistTemplate])
```

Add the `toast` import at the top:
```ts
import { toast } from 'sonner'
```

- [ ] **Step 4.6: Remove `confirmDiscard` and update `handleSelectTemplate`**

Remove:
```ts
const confirmDiscard = useCallback((): boolean => {
  if (!isDirty) return true
  return window.confirm('You have unsaved changes. Discard them?')
}, [isDirty])
```

Update `handleSelectTemplate` to remove the `confirmDiscard` call:
```ts
const handleSelectTemplate = useCallback(
  (id: string) => {
    if (id === selectedId) return
    setSelectedId(id)
  },
  [selectedId]
)
```

Update `handleDelete` to remove `confirmDiscard` and clean up working copy:
```ts
const handleDelete = useCallback(
  (id: string) => {
    setWorkingCopies(prev => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })
    const next = deleteTemplate(templates, id)
    setTemplates(next)
    saveTemplates(next)
    const idx = templates.findIndex((t) => t.id === id)
    if (next.length === 0) {
      setSelectedId(null)
    } else {
      const newIdx = Math.min(idx, next.length - 1)
      setSelectedId(next[newIdx].id)
    }
  },
  [templates]
)
```

Update `handleNewTemplate` to remove `confirmDiscard`, and remove `setIsDirty(false)` from `handleNewTemplateConfirm`:
```ts
const handleNewTemplate = useCallback(() => {
  setNewDialogDefault(uniqueTemplateName(templates, 'New Template'))
  setNewDialogOpen(true)
}, [templates])

const handleNewTemplateConfirm = useCallback((name: string) => {
  setNewDialogOpen(false)
  const updated = addTemplate(templates, name)
  setTemplates(updated)
  setSelectedId(updated[updated.length - 1].id)
  saveTemplates(updated)
}, [templates])
```
(The only change from the original is removing `setIsDirty(false)` — it no longer exists.)

- [ ] **Step 4.7: Add `handleWorkingStateChange` and close handlers**

```ts
const handleWorkingStateChange = useCallback(
  (id: string, name: string, folders: FolderNode[]) => {
    const saved = templates.find(t => t.id === id)
    if (!saved) return
    if (name === saved.name && JSON.stringify(folders) === JSON.stringify(saved.folders)) {
      setWorkingCopies(prev => {
        const copy = { ...prev }
        delete copy[id]
        return copy
      })
    } else {
      setWorkingCopies(prev => ({ ...prev, [id]: { name, folders } }))
    }
  },
  [templates]
)

const handleSaveSelectedAndClose = useCallback(
  async (ids: string[]) => {
    let next = [...templates]
    for (const id of ids) {
      const wc = workingCopies[id]
      const saved = next.find(t => t.id === id)
      if (!wc || !saved) continue
      next = updateTemplate(next, { ...saved, name: wc.name, folders: wc.folders })
    }
    setTemplates(next)
    setWorkingCopies(prev => {
      const copy = { ...prev }
      for (const id of ids) delete copy[id]
      return copy
    })
    try {
      await saveTemplates(next)
    } catch {
      toast.error('Some templates could not be saved')
    }
    getCurrentWindow().close()
  },
  [templates, workingCopies]
)

const handleDiscardAllAndClose = useCallback(() => {
  getCurrentWindow().close()
}, [])

const handleCancelClose = useCallback(() => {
  setCloseDialogOpen(false)
}, [])
```

- [ ] **Step 4.8: Compute derived values and update JSX**

Add before the `return`:
```ts
const dirtyIds = new Set(Object.keys(workingCopies))
const dirtyEntries = templates
  .filter(t => dirtyIds.has(t.id))
  .map(t => ({ id: t.id, displayName: workingCopies[t.id].name }))
```

Update `<TemplateList>` props — add `dirtyIds`, keep others:
```tsx
<TemplateList
  templates={templates}
  selectedId={selectedId}
  dirtyIds={dirtyIds}
  isDark={isDark}
  onSelect={handleSelectTemplate}
  onNew={handleNewTemplate}
  onToggleTheme={() => setIsDark((d) => !d)}
/>
```

Update `<TemplateEditor>` props — remove `onDirtyChange`, add new props:
```tsx
<TemplateEditor
  template={selected}
  templates={templates}
  saveSignal={saveSignal}
  workingCopy={workingCopies[selected?.id ?? '']}
  onSave={handleSave}
  onDelete={handleDelete}
  onDuplicate={handleDuplicate}
  onWorkingStateChange={handleWorkingStateChange}
/>
```

Add `UnsavedChangesDialog` import and render it alongside the existing dialogs:
```ts
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog'
```

```tsx
<UnsavedChangesDialog
  open={closeDialogOpen}
  dirtyEntries={dirtyEntries}
  onSaveSelected={handleSaveSelectedAndClose}
  onDiscardAll={handleDiscardAllAndClose}
  onCancel={handleCancelClose}
/>
```

- [ ] **Step 4.9: Run full test suite**

```bash
cd /Users/kennethong/repos/project-creator && npm test
```
Expected: all tests pass with no TypeScript errors in output

- [ ] **Step 4.10: Commit**

```bash
cd /Users/kennethong/repos/project-creator
git add src/App.tsx tests/setup.ts
git commit -m "feat: per-template save state with unsaved-changes close dialog"
```

---

## Task 5: Manual smoke test

After all commits, start the dev server and verify the following scenarios by hand:

- [ ] **Step 5.1: Start the app**
```bash
cd /Users/kennethong/repos/project-creator && npm run tauri dev
```

- [ ] **Step 5.2: Verify dirty indicator appears**
  - Select any template, rename it → amber dot appears next to its name in the sidebar
  - Press Cmd+S to save → amber dot disappears

- [ ] **Step 5.3: Verify switching templates preserves unsaved edits**
  - Rename template A (don't save) → amber dot appears
  - Click template B → template A's edited name is NOT lost
  - Click back to template A → the unsaved name is still shown in the editor

- [ ] **Step 5.4: Verify close dialog appears with dirty templates**
  - Make edits to two templates without saving
  - Click the window's close button → "Unsaved Changes" dialog appears
  - Both templates listed with checkboxes pre-checked

- [ ] **Step 5.5: Verify Save Selected & Close**
  - Uncheck one template → click "Save Selected & Close"
  - App closes; only the checked template was saved (re-open to verify)

- [ ] **Step 5.6: Verify Close Without Saving**
  - Make edits, trigger close dialog → click "Close Without Saving"
  - App closes; no changes were persisted

- [ ] **Step 5.7: Verify Cancel**
  - Trigger close dialog → click "Cancel"
  - Dialog dismisses, app stays open, edits are intact

- [ ] **Step 5.8: Final commit if any fixes were needed**
```bash
cd /Users/kennethong/repos/project-creator && git add -p && git commit -m "fix: address issues found during smoke test"
```
(Only needed if step 5.2–5.7 revealed bugs that required code changes.)
