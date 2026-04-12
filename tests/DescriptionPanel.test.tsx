import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DescriptionPanel } from '@/components/DescriptionPanel'

describe('DescriptionPanel', () => {
  it('renders folder name and textarea with current description', () => {
    render(
      <DescriptionPanel
        folderName="src"
        description="Source code"
        onChange={vi.fn()}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('src')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Source code')).toBeInTheDocument()
  })

  it('calls onChange when textarea value changes', () => {
    const onChange = vi.fn()
    render(
      <DescriptionPanel
        folderName="src"
        description=""
        onChange={onChange}
        onClose={vi.fn()}
      />
    )
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'New description' },
    })
    expect(onChange).toHaveBeenCalledWith('New description')
  })

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <DescriptionPanel
        folderName="src"
        description=""
        onChange={vi.fn()}
        onClose={onClose}
      />
    )
    fireEvent.click(screen.getByTitle('Close'))
    expect(onClose).toHaveBeenCalled()
  })
})
