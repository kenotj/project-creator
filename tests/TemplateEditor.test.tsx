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
