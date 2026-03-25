// tests/UnsavedChangesDialog.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'

const baseEntries = [
  { id: 'a', displayName: 'Alpha' },
  { id: 'b', displayName: 'Beta' },
]

describe('UnsavedChangesDialog', () => {
  const onSaveSelected = vi.fn()
  const onDiscardAll = vi.fn()
  const onCancel = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all dirty entries with checkboxes pre-checked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(2)
    checkboxes.forEach(cb => expect(cb).toBeChecked())
  })

  it('disables Save Selected when all checkboxes are unchecked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    screen.getAllByRole('checkbox').forEach(cb => fireEvent.click(cb))
    expect(screen.getByRole('button', { name: /save selected/i })).toBeDisabled()
  })

  it('calls onSaveSelected with only checked ids', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    // Uncheck Beta
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    fireEvent.click(screen.getByRole('button', { name: /save selected/i }))
    expect(onSaveSelected).toHaveBeenCalledWith(['a'])
  })

  it('calls onDiscardAll when Close Without Saving is clicked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /close without saving/i }))
    expect(onDiscardAll).toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', () => {
    render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
    expect(onCancel).toHaveBeenCalled()
  })

  it('re-checks all entries when re-opened after partial uncheck', () => {
    const { rerender } = render(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    // Uncheck one
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    // Close and re-open
    rerender(
      <UnsavedChangesDialog
        open={false}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    rerender(
      <UnsavedChangesDialog
        open={true}
        dirtyEntries={baseEntries}
        onSaveSelected={onSaveSelected}
        onDiscardAll={onDiscardAll}
        onCancel={onCancel}
      />
    )
    screen.getAllByRole('checkbox').forEach(cb => expect(cb).toBeChecked())
  })
})
