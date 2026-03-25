// src/components/TemplateEditor.tsx
import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, CopyIcon, Trash2Icon, SaveIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { FolderTree } from './FolderTree'
import { GenerateDialog } from './GenerateDialog'
import { validateName } from '@/lib/validation'
import type { Template, FolderNode } from '@/lib/models'
import { cn } from '@/lib/utils'

// Tree mutation helpers

function addNodeAt(nodes: FolderNode[], path: number[], newNode: FolderNode): FolderNode[] {
  if (path.length === 0) return [...nodes, newNode]
  return nodes.map((n, i) =>
    i === path[0]
      ? { ...n, children: path.length === 1
          ? [...n.children, newNode]
          : addNodeAt(n.children, path.slice(1), newNode) }
      : n
  )
}

function renameNodeAt(nodes: FolderNode[], path: number[], name: string): FolderNode[] {
  return nodes.map((n, i) =>
    i === path[0]
      ? path.length === 1
        ? { ...n, name }
        : { ...n, children: renameNodeAt(n.children, path.slice(1), name) }
      : n
  )
}

function deleteNodeAt(nodes: FolderNode[], path: number[]): FolderNode[] {
  if (path.length === 1) return nodes.filter((_, i) => i !== path[0])
  return nodes.map((n, i) =>
    i === path[0] ? { ...n, children: deleteNodeAt(n.children, path.slice(1)) } : n
  )
}

function uniqueSiblingName(siblings: FolderNode[], baseName: string): string {
  const names = new Set(siblings.map((n) => n.name))
  if (!names.has(baseName)) return baseName
  let i = 2
  while (names.has(`${baseName} ${i}`)) i++
  return `${baseName} ${i}`
}

function duplicateNodeAt(nodes: FolderNode[], path: number[]): FolderNode[] {
  if (path.length === 1) {
    const target = nodes[path[0]]
    const copy = JSON.parse(JSON.stringify(target)) as FolderNode
    const baseName = `${copy.name} Copy`
    copy.name = uniqueSiblingName(nodes, baseName)
    return [...nodes.slice(0, path[0] + 1), copy, ...nodes.slice(path[0] + 1)]
  }
  return nodes.map((n, i) =>
    i === path[0] ? { ...n, children: duplicateNodeAt(n.children, path.slice(1)) } : n
  )
}

interface TemplateEditorProps {
  template: Template | null
  templates: Template[]
  saveSignal: number
  onSave: (t: Template) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onDirtyChange: (dirty: boolean) => void
}

export function TemplateEditor({
  template, templates, saveSignal,
  onSave, onDelete, onDuplicate, onDirtyChange
}: TemplateEditorProps) {
  const [name, setName] = useState('')
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  // Reset local state when selected template changes
  useEffect(() => {
    if (template) {
      setName(template.name)
      setFolders(JSON.parse(JSON.stringify(template.folders)))
      setSelectedPath(null)
      setNameError(null)
    }
  }, [template?.id])

  // Compute dirty state
  const isDirty = template
    ? name !== template.name || JSON.stringify(folders) !== JSON.stringify(template.folders)
    : false

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  // Name conflict check
  const nameConflict = templates.some((t) => t.name === name && t.id !== template?.id)

  const canSave = isDirty && !nameConflict && validateName(name).valid

  const handleSave = useCallback(() => {
    if (!template || !canSave) return
    onSave({ ...template, name, folders })
  }, [template, canSave, name, folders, onSave])

  // Respond to Cmd+S signal from App
  useEffect(() => {
    if (saveSignal > 0) handleSave()
  }, [saveSignal, handleSave])

  const handleAddFolder = () => {
    setFolders((prev) => [...prev, { name: 'New Folder', children: [] }])
  }

  const handleAddSubfolder = (path: number[]) => {
    setFolders((prev) => addNodeAt(prev, path, { name: 'New Folder', children: [] }))
  }

  const handleRename = (path: number[], newName: string) => {
    setFolders((prev) => renameNodeAt(prev, path, newName))
  }

  const handleDuplicateNode = (path: number[]) => {
    setFolders((prev) => duplicateNodeAt(prev, path))
  }

  const handleDeleteNode = (path: number[]) => {
    setFolders((prev) => deleteNodeAt(prev, path))
    setSelectedPath(null)
  }

  const handleNameChange = (val: string) => {
    setName(val)
    const result = validateName(val)
    if (!result.valid) {
      setNameError(result.error ?? null)
    } else if (templates.some((t) => t.name === val && t.id !== template?.id)) {
      setNameError('Name already exists')
    } else {
      setNameError(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar — only shown when template exists */}
      {template && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
          <div className="flex flex-col">
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className={cn('h-8 w-44 text-sm', nameError && 'border-red-500')}
            />
            {nameError && <span className="text-xs text-red-500 mt-0.5">{nameError}</span>}
          </div>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={() => onDuplicate(template.id)}>
            <CopyIcon className="w-3.5 h-3.5 mr-1.5" />
            Duplicate
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
            onClick={() => onDelete(template.id)}
          >
            <Trash2Icon className="w-3.5 h-3.5 mr-1.5" />
            Delete
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!canSave}
          >
            <SaveIcon className="w-3.5 h-3.5 mr-1.5" />
            Save
          </Button>
        </div>
      )}

      {/* Tree area */}
      <ScrollArea className="flex-1 px-3 py-2">
        {template ? (
          <FolderTree
            nodes={folders}
            selectedPath={selectedPath}
            onSelect={setSelectedPath}
            onAddSubfolder={handleAddSubfolder}
            onRename={handleRename}
            onDuplicate={handleDuplicateNode}
            onDelete={handleDeleteNode}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground pt-8">
            Select or create a template to get started.
          </div>
        )}
      </ScrollArea>

      {/* Action bar — always rendered, buttons disabled when no template */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={handleAddFolder} disabled={!template}>
          <PlusIcon className="w-3 h-3 mr-1" />
          Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!template || !selectedPath}
          onClick={() => selectedPath && handleAddSubfolder(selectedPath)}
        >
          <PlusIcon className="w-3 h-3 mr-1" />
          Subfolder
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!template || !selectedPath}
          onClick={() => {
            if (selectedPath) {
              window.dispatchEvent(new CustomEvent('rename-node', { detail: selectedPath }))
            }
          }}
        >
          Rename
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!template || !selectedPath}
          className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => selectedPath && handleDeleteNode(selectedPath)}
        >
          Remove
        </Button>
        <div className="flex-1" />
        {template ? (
          <GenerateProjectButton template={{ ...template, name, folders }} />
        ) : (
          <Button size="sm" disabled>
            Create Project
          </Button>
        )}
      </div>
    </div>
  )
}

function GenerateProjectButton({ template }: { template: Template }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Create Project
      </Button>
      <GenerateDialog template={template} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
