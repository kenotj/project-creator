// src/components/TemplateEditor.tsx
import { useState, useEffect, useCallback } from 'react'
import { CopyIcon, Trash2Icon, SaveIcon, FolderPlusIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { FolderTree } from './FolderTree'
import { GenerateDialog } from './GenerateDialog'
import { DeleteTemplateDialog } from './DeleteTemplateDialog'
import { validateName } from '@/lib/validation'
import type { Template, FolderNode } from '@/lib/models'
import {
  addNodeAt, renameNodeAt, deleteNodeAt, duplicateNodeAt,
  insertNodeAfter, moveNode, moveNodes, indentNodes, outdentNodes,
  getNodeAtPath, getSiblingsAtPath, uniqueSiblingName
} from '@/lib/tree-operations'
import { cn } from '@/lib/utils'

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
  onSave, onDelete, onDuplicate, onWorkingStateChange, workingCopy
}: TemplateEditorProps) {
  const [name, setName] = useState('')
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [selectedPaths, setSelectedPaths] = useState<string[]>([])
  const [nameError, setNameError] = useState<string | null>(null)
  const [focusedPath, setFocusedPath] = useState<number[] | null>(null)
  const [editingPath, setEditingPath] = useState<number[] | null>(null)
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Reset local state when selected template changes
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

  // Compute dirty state
  const isDirty = template
    ? name !== template.name || JSON.stringify(folders) !== JSON.stringify(template.folders)
    : false

  useEffect(() => {
    if (!template) return
    onWorkingStateChange(template.id, name, folders)
  }, [name, folders]) // template.id captured at effect-run time via closure

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
    setExpandedPaths((prev) => new Set([...prev, path.join(',')]))
  }

  const handleRename = (path: number[], newName: string) => {
    setFolders((prev) => renameNodeAt(prev, path, newName))
  }

  const handleDuplicateNodes = (paths: string[]) => {
    if (paths.length === 1) {
      // Single node: insert copy right after the original
      const path = paths[0].split(',').map(Number)
      setFolders((prev) => duplicateNodeAt(prev, path))
      return
    }

    // Multi-select: group by parent, insert all copies after the last selected sibling
    const parsed = paths.map(p => p.split(',').map(Number))
    const groups = new Map<string, number[][]>()
    for (const path of parsed) {
      const parentKey = path.slice(0, -1).join(',')
      if (!groups.has(parentKey)) groups.set(parentKey, [])
      groups.get(parentKey)!.push(path)
    }

    setFolders((prev) => {
      let current = prev
      // Process deepest groups first to avoid path invalidation
      const sortedGroups = [...groups.entries()].sort((a, b) => {
        const depthA = a[0] === '' ? 0 : a[0].split(',').length
        const depthB = b[0] === '' ? 0 : b[0].split(',').length
        return depthB - depthA
      })

      for (const [, group] of sortedGroups) {
        group.sort((a, b) => a[a.length - 1] - b[b.length - 1])
        const lastIdx = group[group.length - 1][group[group.length - 1].length - 1]
        const parentPath = group[0].slice(0, -1)
        const siblings = parentPath.length === 0 ? current : getSiblingsAtPath(current, group[0])

        // Collect copies with unique names
        const copies: FolderNode[] = []
        for (const path of group) {
          const node = getNodeAtPath(current, path)
          if (!node) continue
          const copy = JSON.parse(JSON.stringify(node)) as FolderNode
          const baseName = `${copy.name} Copy`
          copy.name = uniqueSiblingName(
            [...siblings, ...copies],
            baseName
          )
          copies.push(copy)
        }

        // Insert all copies after the last selected node
        for (let i = copies.length - 1; i >= 0; i--) {
          current = insertNodeAfter(current, [...parentPath, lastIdx], copies[i])
        }
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

  const handleMove = useCallback((fromPath: number[], toPath: number[], position: 'before' | 'after' | 'inside') => {
    setFolders((prev) => moveNode(prev, fromPath, toPath, position))
  }, [])

  const handleMoveMultiple = useCallback((
    fromPaths: number[][],
    toPath: number[],
    position: 'before' | 'after' | 'inside'
  ) => {
    setFolders(prev => moveNodes(prev, fromPaths, toPath, position))
  }, [])

  const handleIndent = (paths: number[][]) => {
    // Pre-compute new parent paths for auto-expand
    const topLevel = paths.filter(p =>
      !paths.some(other => other.length < p.length && other.every((v, i) => v === p[i]))
    )
    const groups = new Map<string, number[][]>()
    for (const path of topLevel) {
      const parentKey = path.slice(0, -1).join(',')
      if (!groups.has(parentKey)) groups.set(parentKey, [])
      groups.get(parentKey)!.push(path)
    }
    const newParentPaths: string[] = []
    for (const [, group] of groups) {
      group.sort((a, b) => a[a.length - 1] - b[b.length - 1])
      const firstIdx = group[0][group[0].length - 1]
      if (firstIdx === 0) continue
      newParentPaths.push([...group[0].slice(0, -1), firstIdx - 1].join(','))
    }

    setFolders((prev) => indentNodes(prev, paths))
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      for (const p of newParentPaths) next.add(p)
      return next
    })
    setFocusedPath(null)
    setSelectedPaths([])
  }

  const handleOutdent = useCallback((paths: number[][]) => {
    setFolders((prev) => outdentNodes(prev, paths))
    setFocusedPath(null)
    setSelectedPaths([])
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
          <div className="flex items-center gap-2">
            <label htmlFor="template-name" className="text-sm text-muted-foreground whitespace-nowrap">
              Template Name
            </label>
            <div className="flex flex-col">
              <Input
                id="template-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                className={cn('h-8 w-44 text-sm', nameError && 'border-red-500')}
              />
            {nameError && <span className="text-xs text-red-500 mt-0.5">{nameError}</span>}
            </div>
          </div>
          <div className="flex items-center gap-1 ml-1 animate-in fade-in slide-in-from-left-1 duration-200">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDuplicate(template.id)}
              title="Duplicate template"
            >
              <CopyIcon className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => setShowDeleteDialog(true)}
              title="Delete template"
            >
              <Trash2Icon className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleSave}
              disabled={!canSave}
              title="Save template"
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
          <div className="flex-1 flex flex-col select-none">
            <FolderTree
              templateName={name}
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
              onMove={handleMove}
              onMoveMultiple={handleMoveMultiple}
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
      {template && (
        <DeleteTemplateDialog
          open={showDeleteDialog}
          templateName={name}
          onConfirm={() => {
            setShowDeleteDialog(false)
            onDelete(template.id)
          }}
          onCancel={() => setShowDeleteDialog(false)}
        />
      )}
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
