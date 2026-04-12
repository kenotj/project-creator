import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DndContext } from '@dnd-kit/core'
import { FolderTreeRow } from '@/components/FolderTreeRow'

const baseProps = {
  node: { name: 'src', children: [] },
  path: [0],
  depth: 1,
  selectedPaths: [],
  isFocused: false,
  isEditing: false,
  isExpanded: false,
  siblingNames: [],
  onSelect: vi.fn(),
  onShiftSelect: vi.fn(),
  onFocusChange: vi.fn(),
  onEditingChange: vi.fn(),
  onToggleExpand: vi.fn(),
  onAddSubfolder: vi.fn(),
  onRename: vi.fn(),
  onDuplicate: vi.fn(),
  onDelete: vi.fn(),
  hasDescription: false,
  onEditDescription: vi.fn(),
}

function renderRow(overrides = {}) {
  return render(
    <DndContext>
      <FolderTreeRow {...baseProps} {...overrides} />
    </DndContext>
  )
}

describe('FolderTreeRow isPreview', () => {
  it('applies selection style when isPreview is true', () => {
    const { container } = renderRow({ isPreview: true })
    expect(container.querySelector('.bg-accent')).toBeInTheDocument()
  })

  it('does not apply selection style when isPreview is false and not selected', () => {
    const { container } = renderRow({ isPreview: false })
    expect(container.querySelector('.bg-accent')).not.toBeInTheDocument()
  })
})

describe('FolderTreeRow description', () => {
  it('shows dot indicator when hasDescription is true', () => {
    const { container } = renderRow({ hasDescription: true })
    expect(container.querySelector('[data-description-dot]')).toBeInTheDocument()
  })

  it('does not show dot indicator when hasDescription is false', () => {
    const { container } = renderRow({ hasDescription: false })
    expect(container.querySelector('[data-description-dot]')).not.toBeInTheDocument()
  })
})
