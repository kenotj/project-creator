// src/components/UnsavedChangesDialog.tsx
import { useState, useEffect } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
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
          <DialogDescription>
            The following templates have unsaved changes.
          </DialogDescription>
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
