// src/components/GenerateDialog.tsx
import { useState, useEffect } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { createProject } from '@/lib/generate'
import { loadLastDestination, saveLastDestination } from '@/lib/store'
import { validateName } from '@/lib/validation'
import type { Template } from '@/lib/models'
import { cn } from '@/lib/utils'

interface GenerateDialogProps {
  template: Template
  open: boolean
  onClose: () => void
}

export function GenerateDialog({ template, open: isOpen, onClose }: GenerateDialogProps) {
  const [projectName, setProjectName] = useState('')
  const [destination, setDestination] = useState('')
  const [projectNameError, setProjectNameError] = useState<string | null>(null)
  const [destError, setDestError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadLastDestination().then((saved) => {
        if (saved) setDestination(saved)
      })
    }
  }, [isOpen])

  const handleBrowse = async () => {
    const selected = await open({ directory: true, multiple: false })
    if (typeof selected === 'string') setDestination(selected)
  }

  const handleProjectNameChange = (val: string) => {
    setProjectName(val)
    const result = validateName(val)
    setProjectNameError(result.valid ? null : (result.error ?? 'Invalid name'))
  }

  const canCreate =
    validateName(projectName).valid &&
    destination.trim().length > 0 &&
    !isCreating

  const handleCreate = async () => {
    if (!canCreate) return
    setIsCreating(true)
    setDestError(null)
    try {
      const result = await createProject(template, projectName.trim(), destination)
      await saveLastDestination(destination)
      toast.success('Project created', { description: result.path })
      handleClose()
    } catch (err: unknown) {
      const e = err as { code: string; message?: string }
      if (e.code === 'EXISTS') {
        setDestError('A folder at this path already exists')
      } else {
        setDestError(`Could not create project: ${e.message ?? 'Unknown error'}`)
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleClose = () => {
    onClose()
    setProjectName('')
    setDestination('')
    setProjectNameError(null)
    setDestError(null)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) handleClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Scaffold a folder structure from <strong>{template.name}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              placeholder="my-new-project"
              value={projectName}
              onChange={(e) => handleProjectNameChange(e.target.value)}
              className={cn(projectNameError && 'border-red-500')}
            />
            {projectNameError && (
              <p className="text-xs text-red-500">{projectNameError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="destination">Destination folder</Label>
            <div className="flex gap-2">
              <Input
                id="destination"
                placeholder="Choose a folder..."
                value={destination}
                readOnly
                className={cn('flex-1', destError && 'border-red-500')}
              />
              <Button type="button" variant="outline" size="sm" onClick={handleBrowse}>
                Browse
              </Button>
            </div>
            {destError && <p className="text-xs text-red-500">{destError}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleClose}>Cancel</Button>
          <Button type="button" onClick={handleCreate} disabled={!canCreate}>
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
