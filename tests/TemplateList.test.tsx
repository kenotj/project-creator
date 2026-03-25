// tests/TemplateList.test.tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { TemplateList } from '@/components/TemplateList'
import type { Template } from '@/lib/models'

const templates: Template[] = [
  { id: 'a', name: 'Alpha', folders: [] },
  { id: 'b', name: 'Beta', folders: [] },
  { id: 'c', name: 'Gamma', folders: [] },
]

function renderList(selectedId: string | null, dirtyIds: Set<string>) {
  return render(
    <TemplateList
      templates={templates}
      selectedId={selectedId}
      dirtyIds={dirtyIds}
      isDark={false}
      onSelect={vi.fn()}
      onNew={vi.fn()}
      onToggleTheme={vi.fn()}
    />
  )
}

describe('TemplateList dirty indicators', () => {
  it('shows amber dot for a dirty unselected template', () => {
    renderList('a', new Set(['b']))
    const betaRow = screen.getByText('Beta').closest('button')!
    const dot = betaRow.querySelector('.bg-amber-400')
    expect(dot).toBeInTheDocument()
  })

  it('shows amber dot for a dirty selected template', () => {
    renderList('b', new Set(['b']))
    const betaRow = screen.getByText('Beta').closest('button')!
    const dot = betaRow.querySelector('.bg-amber-400')
    expect(dot).toBeInTheDocument()
  })

  it('shows white dot for a clean selected template', () => {
    renderList('a', new Set())
    const alphaRow = screen.getByText('Alpha').closest('button')!
    expect(alphaRow.querySelector('.bg-foreground')).toBeInTheDocument()
    expect(alphaRow.querySelector('.bg-amber-400')).not.toBeInTheDocument()
  })

  it('shows no dot for a clean unselected template', () => {
    renderList('a', new Set())
    const betaRow = screen.getByText('Beta').closest('button')!
    expect(betaRow.querySelector('.bg-foreground')).not.toBeInTheDocument()
    expect(betaRow.querySelector('.bg-amber-400')).not.toBeInTheDocument()
  })
})
