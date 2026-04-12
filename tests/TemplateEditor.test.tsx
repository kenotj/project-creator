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

const templateWithFolders: Template = {
  id: 'tmpl-2',
  name: 'With Folders',
  folders: [
    { name: 'Alpha', children: [] },
    { name: 'Beta', children: [{ name: 'Child', children: [] }] },
  ],
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

describe('TemplateEditor: copy and paste', () => {
  it('Cmd+C then Cmd+V inserts a copy of the focused node after itself', async () => {
    const { container } = render(
      <TemplateEditor
        template={templateWithFolders}
        templates={[templateWithFolders]}
        saveSignal={0}
        onSave={vi.fn()}
        onDelete={vi.fn()}
        onDuplicate={vi.fn()}
        onWorkingStateChange={vi.fn()}
      />
    )
    const tree = container.querySelector('[tabindex="0"]') as HTMLElement

    // Click the first folder row to focus it (sets focusedPath to [0])
    const firstRow = container.querySelector('[data-path="0"]') as HTMLElement
    await act(async () => {
      fireEvent.click(firstRow)
    })

    const foldersBefore = container.querySelectorAll('[data-path]').length

    // Cmd+C: copies the focused node (Alpha)
    await act(async () => {
      fireEvent.keyDown(tree, { key: 'c', metaKey: true })
    })
    // Cmd+V: pastes after the focused path [0]
    await act(async () => {
      fireEvent.keyDown(tree, { key: 'v', metaKey: true })
    })

    const foldersAfter = container.querySelectorAll('[data-path]').length
    // A new "Alpha" node should have been inserted, increasing count by 1
    expect(foldersAfter).toBe(foldersBefore + 1)
    // The new node should be named "Alpha" (unique since original is still named "Alpha"
    // — uniqueSiblingName handles collision: the copy gets a distinct name)
    const allNames = Array.from(container.querySelectorAll('[data-path]')).map(
      el => el.textContent
    )
    // At least two nodes should contain "Alpha"
    expect(allNames.filter(n => n?.includes('Alpha')).length).toBeGreaterThanOrEqual(2)
  })
})
