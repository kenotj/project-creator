// src/components/TemplateEditor.tsx
import { useState, useEffect, useCallback } from 'react'
import { CopyIcon, Trash2Icon, SaveIcon, FolderPlusIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { FolderTree } from './FolderTree'
import { GenerateDialog } from './GenerateDialog'
import { validateName } from '@/lib/validation'
import type { Template, FolderNode } from '@/lib/models'
import {
  addNodeAt, renameNodeAt, deleteNodeAt, duplicateNodeAt,
  insertNodeAfter, moveNode, indentNode, outdentNode
} from '@/lib/tree-operations'
import { cn } from '@/lib/utils'

interface TemplateEditorProps {
  template: Template | null
  templates: Template[]
  saveSignal: number
  onSave: (t: Template) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onDirtyChange: (dirty: boolean) => void
}

function getAllPathStrings(nodes: FolderNode[]): Set<string> {
  const result = new Set<string>()
  function traverse(children: FolderNode[], parentPath: number[]) {
    for (let i = 0; i < children.length; i++) {
      const path = [...parentPath, i]
      result.add(path.join(','))
      if (children[i].children.length > 0) {
        traverse(children[i].children, path)
      }
    }
  }
  traverse(nodes, [])
  return result
}

export function TemplateEditor({
  template, templates, saveSignal,
  onSave, onDelete, onDuplicate, onDirtyChange
}: TemplateEditorProps) {
  const [name, setName] = useState('')
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [nameError, setNameError] = useState<string | null>(null)
  const [focusedPath, setFocusedPath] = useState<number[] | null>(null)
  const [editingPath, setEditingPath] = useState<number[] | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())

  // Reset local state when selected template changes
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

  const handleDuplicateNodes = (paths: string[]) => {
    // Sort paths to avoid indexing issues during mutation
    const sortedPaths = [...paths].map(p => p.split(',').map(Number)).sort((a, b) => {
      if (a.length !== b.length) return b.length - a.length // deeper first
      return b[b.length - 1] - a[a.length - 1] // higher index first
    })

    setFolders((prev) => {
      let current = [...prev]
      for (const path of sortedPaths) {
        current = duplicateNodeAt(current, path)
      }
      return current
    })
  }

  const handleDeleteNodes = (paths: string[]) => {
    // Sort paths: deeper first to avoid invalidating parent indices
    const sortedPaths = [...paths].map(p => p.split(',').map(Number)).sort((a, b) => {
      if (a.length !== b.length) return b.length - a.length
      return b[b.length - 1] - a[a.length - 1]
    })

    setFolders((prev) => {
      let current = [...prev]
      for (const path of sortedPaths) {
        current = deleteNodeAt(current, path)
      }
      return current
    })
    setSelectedPaths([])
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

  // Reserved for Phase 4 drag-and-drop; not wired as a prop yet
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleMove = (fromPath: number[], toPath: number[], position: 'before' | 'after' | 'inside') => {
    setFolders((prev) => moveNode(prev, fromPath, toPath, position))
  }
  void handleMove // suppress noUnusedLocals until Phase 4

  const handleIndent = (path: number[]) => {
    const lastIdx = path[path.length - 1]
    if (lastIdx === 0) return // can't indent first sibling
    const precedingSiblingPath = [...path.slice(0, -1), lastIdx - 1]
    setFolders((prev) => indentNode(prev, path))
    // Auto-expand the new parent (preceding sibling becomes parent)
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      next.add(precedingSiblingPath.join(','))
      return next
    })
    // Clear focused path — the node is now inside a different parent
    setFocusedPath(null)
  }

  const handleOutdent = useCallback((path: number[]) => {
    setFolders((prev) => outdentNode(prev, path))
    setFocusedPath(null)  // path changes after outdent
  }, [])

  const handleAddSiblingAfter = (path: number[]) => {
    const newNode: FolderNode = { name: 'New Folder', children: [] }
    setFolders((prev) => insertNodeAfter(prev, path, newNode))
    const newPath = [...path.slice(0, -1), path[path.length - 1] + 1]
    setFocusedPath(newPath)
    setEditingPath(newPath)
  }

  const handleToggleExpand = (path: number[]) => {
    const key = path.join(',')
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
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
          <div className="flex items-center gap-1 ml-1 animate-in fade-in slide-in-from-left-1 duration-200">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDuplicate(template.id)}
              title="Duplicate"
            >
              <CopyIcon className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => onDelete(template.id)}
              title="Delete"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleSave}
              disabled={!canSave}
              title="Save"
            >
              <SaveIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex-1" />
        </div>
      )}

      {/* Tree area */}
      <ScrollArea className="flex-1 px-3 py-2">
        {template ? (
          <div className="h-full min-h-full select-none">
            <FolderTree
              nodes={folders}
              selectedPaths={selectedPaths}
              focusedPath={focusedPath}
              editingPath={editingPath}
              expandedPaths={expandedPaths}
              onSelect={setSelectedPaths}
              onFocusChange={setFocusedPath}
              onEditingChange={setEditingPath}
              onToggleExpand={handleToggleExpand}
              onAddSubfolder={handleAddSubfolder}
              onAddSiblingAfter={handleAddSiblingAfter}
              onRename={handleRename}
              onDuplicate={handleDuplicateNodes}
              onDelete={handleDeleteNodes}
              onIndent={handleIndent}
              onOutdent={handleOutdent}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground pt-8 select-none">
            Select or create a template to get started.
          </div>
        )}
      </ScrollArea>

      {/* Action bar — always rendered, buttons disabled when no template */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={handleAddFolder}
          disabled={!template}
          title="New Folder"
        >
          <FolderPlusIcon className="w-3.5 h-3.5" />
        </Button>

        {selectedPaths.length > 1 && (
          <div className="flex items-center gap-1.5 pl-3 ml-1.5 border-l border-border animate-in fade-in slide-in-from-left-1">
            <span className="text-xs font-medium text-muted-foreground mr-1">
              {selectedPaths.length} selected
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleDuplicateNodes(selectedPaths)}
              title="Duplicate Selected"
            >
              <CopyIcon className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => handleDeleteNodes(selectedPaths)}
              title="Delete Selected"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

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
