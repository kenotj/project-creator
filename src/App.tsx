// src/App.tsx
import { useEffect, useState, useCallback, useRef } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { toast } from 'sonner'
import { AppLayout } from './components/AppLayout'
import { TemplateList } from './components/TemplateList'
import { TemplateEditor } from './components/TemplateEditor'
import { NewTemplateDialog } from './components/NewTemplateDialog'
import { UnsavedChangesDialog } from './components/UnsavedChangesDialog'
import {
  loadTemplates,
  saveTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  uniqueTemplateName,
} from './lib/store'
import type { Template, FolderNode } from './lib/models'
import { Toaster } from './components/ui/sonner'

function getInitialTheme(): boolean {
  const stored = localStorage.getItem('theme')
  if (stored) return stored === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function App() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [workingCopies, setWorkingCopies] = useState<Record<string, { name: string; folders: FolderNode[] }>>({})
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [isDark, setIsDark] = useState(getInitialTheme)

  const workingCopiesRef = useRef(workingCopies)
  useEffect(() => { workingCopiesRef.current = workingCopies }, [workingCopies])
  const isClosingRef = useRef(false)

  // Apply theme class to root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // Load templates on mount
  useEffect(() => {
    loadTemplates().then((loaded) => {
      setTemplates(loaded)
      if (loaded.length > 0) setSelectedId(loaded[0].id)
    })
  }, [])

  // Cmd/Ctrl+S shortcut — signal to TemplateEditor to save
  const [saveSignal, setSaveSignal] = useState(0)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        setSaveSignal((n) => n + 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Register Tauri close-requested listener
  useEffect(() => {
    let unlisten: (() => void) | undefined
    let mounted = true
    getCurrentWindow().onCloseRequested((event) => {
      if (isClosingRef.current) return          // already handling close
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

  const handleSelectTemplate = useCallback(
    (id: string) => {
      if (id === selectedId) return
      setSelectedId(id)
    },
    [selectedId]
  )

  const [newDialogOpen, setNewDialogOpen] = useState(false)
  const [newDialogDefault, setNewDialogDefault] = useState('')

  const handleNewTemplate = useCallback(() => {
    setNewDialogDefault(uniqueTemplateName(templates, 'New Template'))
    setNewDialogOpen(true)
  }, [templates])

  const handleNewTemplateConfirm = useCallback((name: string) => {
    setNewDialogOpen(false)
    const updated = addTemplate(templates, name)
    setTemplates(updated)
    setSelectedId(updated[updated.length - 1].id)
    saveTemplates(updated).catch(() => {
      toast.error('Failed to save template')
    })
  }, [templates])

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

  const handleDuplicate = useCallback(
    (id: string) => {
      const copy = duplicateTemplate(templates, id)
      if (!copy) return
      const next = [...templates, copy]
      setTemplates(next)
      saveTemplates(next)
    },
    [templates]
  )

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
        return
      }
      isClosingRef.current = true
      getCurrentWindow().close()
    },
    [templates, workingCopies]
  )

  const handleDiscardAllAndClose = useCallback(() => {
    isClosingRef.current = true
    getCurrentWindow().close()
  }, [])

  const handleCancelClose = useCallback(() => {
    setCloseDialogOpen(false)
  }, [])

  const selected = templates.find((t) => t.id === selectedId) ?? null

  const dirtyIds = new Set(Object.keys(workingCopies))
  const dirtyEntries = templates
    .filter(t => dirtyIds.has(t.id))
    .map(t => ({ id: t.id, displayName: workingCopies[t.id].name }))

  return (
    <>
      <AppLayout
        sidebar={
          <TemplateList
            templates={templates}
            selectedId={selectedId}
            dirtyIds={dirtyIds}
            isDark={isDark}
            onSelect={handleSelectTemplate}
            onNew={handleNewTemplate}
            onToggleTheme={() => setIsDark((d) => !d)}
          />
        }
        editor={
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
        }
      />
      <NewTemplateDialog
        open={newDialogOpen}
        defaultName={newDialogDefault}
        onConfirm={handleNewTemplateConfirm}
        onClose={() => setNewDialogOpen(false)}
      />
      <UnsavedChangesDialog
        open={closeDialogOpen}
        dirtyEntries={dirtyEntries}
        onSaveSelected={handleSaveSelectedAndClose}
        onDiscardAll={handleDiscardAllAndClose}
        onCancel={handleCancelClose}
      />
      <Toaster />
    </>
  )
}
