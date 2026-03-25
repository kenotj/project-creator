// src/components/GenerateDialog.tsx
import type { Template } from '@/lib/models'

interface GenerateDialogProps {
  template: Template
  open: boolean
  onClose: () => void
}

export function GenerateDialog({ open, onClose }: GenerateDialogProps) {
  if (!open) return null
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40 z-50">
      <div className="bg-background border rounded-lg p-6 shadow-lg">
        <p className="text-sm text-muted-foreground mb-4">Create Project dialog coming in Task 11</p>
        <button type="button" onClick={onClose} className="text-sm underline">Close</button>
      </div>
    </div>
  )
}
