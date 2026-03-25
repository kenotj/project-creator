// src/App.tsx
import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from './components/AppLayout'
import {
  loadTemplates,
  saveTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  uniqueTemplateName,
} from './lib/store'
import type { Template } from './lib/models'
import { Toaster } from './components/ui/sonner'

function getInitialTheme(): boolean {
  const stored = localStorage.getItem('theme')
  if (stored) return stored === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function App() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isDark, setIsDark] = useState(getInitialTheme)

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

  const confirmDiscard = useCallback((): boolean => {
    if (!isDirty) return true
    return window.confirm('You have unsaved changes. Discard them?')
  }, [isDirty])

  const handleSelectTemplate = useCallback(
    (id: string) => {
      if (id === selectedId) return
      if (!confirmDiscard()) return
      setSelectedId(id)
      setIsDirty(false)
    },
    [selectedId, confirmDiscard]
  )

  const handleNewTemplate = useCallback(() => {
    if (!confirmDiscard()) return
    const name = uniqueTemplateName(templates, 'New Template')
    const updated = addTemplate(templates, name)
    setTemplates(updated)
    setSelectedId(updated[updated.length - 1].id)
    setIsDirty(false)
    saveTemplates(updated)
  }, [templates, confirmDiscard])

  const handleSave = useCallback(
    (updated: Template) => {
      const next = updateTemplate(templates, updated)
      setTemplates(next)
      setIsDirty(false)
      saveTemplates(next)
    },
    [templates]
  )

  const handleDelete = useCallback(
    (id: string) => {
      if (!confirmDiscard()) return
      const next = deleteTemplate(templates, id)
      setTemplates(next)
      setIsDirty(false)
      saveTemplates(next)
      const idx = templates.findIndex((t) => t.id === id)
      if (next.length === 0) {
        setSelectedId(null)
      } else {
        const newIdx = Math.min(idx, next.length - 1)
        setSelectedId(next[newIdx].id)
      }
    },
    [templates, confirmDiscard]
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

  const selected = templates.find((t) => t.id === selectedId) ?? null

  // TODO (Tasks 8–10): wire these props into TemplateList and TemplateEditor
  void setIsDark
  void handleSelectTemplate
  void handleNewTemplate
  void handleSave
  void handleDelete
  void handleDuplicate
  void saveSignal

  return (
    <>
      <AppLayout
        sidebar={
          // TODO: Replace with <TemplateList> in Task 8
          <div className="p-4 text-sm text-muted-foreground">
            Sidebar placeholder — {templates.length} templates
          </div>
        }
        editor={
          // TODO: Replace with <TemplateEditor> in Task 10
          <div className="p-4 text-sm text-muted-foreground">
            Editor placeholder — selected: {selected?.name ?? 'none'}
          </div>
        }
      />
      <Toaster />
    </>
  )
}
