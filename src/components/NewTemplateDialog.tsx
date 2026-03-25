// src/components/NewTemplateDialog.tsx
import { useState, useEffect, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface NewTemplateDialogProps {
  open: boolean
  defaultName: string
  onConfirm: (name: string) => void
  onClose: () => void
}

export function NewTemplateDialog({ open, defaultName, onConfirm, onClose }: NewTemplateDialogProps) {
  const [name, setName] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(defaultName)
      // Select text after dialog animation settles
      setTimeout(() => inputRef.current?.select(), 50)
    }
  }, [open, defaultName])

  const trimmed = name.trim()

  const handleConfirm = () => {
    if (!trimmed) return
    onConfirm(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Template</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <Label htmlFor="template-name">Template name</Label>
          <Input
            ref={inputRef}
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            className="mt-1.5"
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleConfirm} disabled={!trimmed}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
