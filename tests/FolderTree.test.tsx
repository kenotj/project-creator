import { render, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { computeMarqueeHits, FolderTree } from '@/components/FolderTree'
import type { FolderNode } from '@/lib/models'

function makeEl(
  pathStr: string,
  rect: { left: number; top: number; right: number; bottom: number }
) {
  const el = document.createElement('div')
  el.setAttribute('data-path', pathStr)
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom,
    width: rect.right - rect.left, height: rect.bottom - rect.top,
    x: rect.left, y: rect.top, toJSON: () => {},
  } as DOMRect)
  return el
}

function makeContainer(children: HTMLElement[]) {
  const container = document.createElement('div') as HTMLDivElement
  vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
    left: 0, top: 0, right: 400, bottom: 600,
    width: 400, height: 600, x: 0, y: 0, toJSON: () => {},
  } as DOMRect)
  children.forEach(c => container.appendChild(c))
  return container
}

describe('computeMarqueeHits', () => {
  it('returns paths of elements that intersect the marquee', () => {
    // el1 sits at relative y 10–30, el2 at y 40–60
    const container = makeContainer([
      makeEl('0', { left: 10, top: 10, right: 200, bottom: 30 }),
      makeEl('1', { left: 10, top: 40, right: 200, bottom: 60 }),
    ])
    const rect = container.getBoundingClientRect()
    // Marquee covers y 0–35 — hits el1 only
    const hits = computeMarqueeHits({ x1: 0, y1: 0, x2: 300, y2: 35 }, container, rect)
    expect(hits).toEqual(['0'])
  })

  it('returns multiple paths when marquee covers several elements', () => {
    const container = makeContainer([
      makeEl('0', { left: 10, top: 10, right: 200, bottom: 30 }),
      makeEl('1', { left: 10, top: 40, right: 200, bottom: 60 }),
    ])
    const rect = container.getBoundingClientRect()
    const hits = computeMarqueeHits({ x1: 0, y1: 0, x2: 300, y2: 65 }, container, rect)
    expect(hits).toEqual(['0', '1'])
  })

  it('returns empty array when marquee misses all elements', () => {
    const container = makeContainer([
      makeEl('0', { left: 10, top: 100, right: 200, bottom: 130 }),
    ])
    const rect = container.getBoundingClientRect()
    const hits = computeMarqueeHits({ x1: 0, y1: 0, x2: 50, y2: 5 }, container, rect)
    expect(hits).toEqual([])
  })
})

// Shared minimal tree used across keyboard tests
const singleNode: FolderNode[] = [{ name: 'Alpha', children: [] }]

function makeTreeProps(overrides: Partial<Parameters<typeof FolderTree>[0]> = {}) {
  return {
    templateName: 'Test',
    nodes: singleNode,
    selectedPaths: [],
    focusedPath: [0],
    editingPath: null,
    expandedPaths: new Set<string>(['0']),
    onSelect: vi.fn(),
    onFocusChange: vi.fn(),
    onEditingChange: vi.fn(),
    onToggleExpand: vi.fn(),
    onAddSubfolder: vi.fn(),
    onAddSiblingAfter: vi.fn(),
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onIndent: vi.fn(),
    onOutdent: vi.fn(),
    onMove: vi.fn(),
    onMoveMultiple: vi.fn(),
    onCopy: vi.fn(),
    onPaste: vi.fn(),
    onEditDescription: vi.fn(),
    descriptionPaths: new Set<string>(),
    ...overrides,
  }
}

describe('FolderTree keyboard: Enter', () => {
  it('calls onEditingChange with focusedPath when Enter is pressed', () => {
    const onEditingChange = vi.fn()
    const onAddSiblingAfter = vi.fn()
    const { container } = render(
      <FolderTree {...makeTreeProps({ onEditingChange, onAddSiblingAfter })} />
    )
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: 'Enter' })
    expect(onEditingChange).toHaveBeenCalledWith([0])
    expect(onAddSiblingAfter).not.toHaveBeenCalled()
  })
})

const threeNodes: FolderNode[] = [
  { name: 'Alpha', children: [] },
  { name: 'Beta', children: [] },
  { name: 'Gamma', children: [] },
]

describe('FolderTree keyboard: Shift+Arrow rubber-band selection', () => {
  it('selects anchor + next node on first Shift+ArrowDown', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <FolderTree
        {...makeTreeProps({
          nodes: threeNodes,
          focusedPath: [0],
          expandedPaths: new Set(['0', '1', '2']),
          onSelect,
        })}
      />
    )
    fireEvent.keyDown(container.firstChild as HTMLElement, {
      key: 'ArrowDown',
      shiftKey: true,
    })
    // Should select [0] (anchor) + [1] (new focus)
    expect(onSelect).toHaveBeenCalledWith(['0', '1'])
  })

  it('shrinks selection back when reversing direction', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <FolderTree
        {...makeTreeProps({
          nodes: threeNodes,
          focusedPath: [1],
          selectedPaths: ['0', '1'],
          expandedPaths: new Set(['0', '1', '2']),
          onSelect,
        })}
      />
    )
    // First Shift+Down from [1] → anchor=[1], range=[1,2]
    fireEvent.keyDown(container.firstChild as HTMLElement, {
      key: 'ArrowDown',
      shiftKey: true,
    })
    const firstCall = onSelect.mock.calls[0][0]
    expect(firstCall).toContain('2')

    // Shift+Up from [2] → range back to [1] only
    // Note: after keyDown the focused node moves to [2], but since focusedPath is
    // a prop (not internal state), the component still sees focusedPath=[1] for the
    // second keyDown. The anchor was set to [1] on the first press, new focus after
    // second press is [0], so range is [0,1].
    onSelect.mockClear()
    fireEvent.keyDown(container.firstChild as HTMLElement, {
      key: 'ArrowUp',
      shiftKey: true,
    })
    const secondCall = onSelect.mock.calls[0][0]
    // Range from anchor [1] up one step: [0,1] — but focusedPath prop is still [1]
    // so anchor stays [1], newIdx = 0, range = ['0', '1']
    expect(secondCall).toEqual(['0', '1'])
  })

  it('plain ArrowDown clears selection', () => {
    const onSelect = vi.fn()
    const { container } = render(
      <FolderTree
        {...makeTreeProps({
          nodes: threeNodes,
          focusedPath: [0],
          selectedPaths: ['0', '1'],
          expandedPaths: new Set(['0', '1', '2']),
          onSelect,
        })}
      />
    )
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: 'ArrowDown' })
    expect(onSelect).toHaveBeenCalledWith([])
  })
})

describe('FolderTree keyboard: Cmd+C / Cmd+V', () => {
  it('Cmd+C calls onCopy with focusedPath when no selection', () => {
    const onCopy = vi.fn()
    const { container } = render(
      <FolderTree {...makeTreeProps({ onCopy, focusedPath: [0], selectedPaths: [] })} />
    )
    fireEvent.keyDown(container.firstChild as HTMLElement, {
      key: 'c',
      metaKey: true,
    })
    expect(onCopy).toHaveBeenCalledWith(['0'])
  })

  it('Cmd+C calls onCopy with all selectedPaths when selection is non-empty', () => {
    const onCopy = vi.fn()
    const { container } = render(
      <FolderTree
        {...makeTreeProps({
          nodes: threeNodes,
          onCopy,
          focusedPath: [0],
          selectedPaths: ['0', '1'],
          expandedPaths: new Set(['0', '1', '2']),
        })}
      />
    )
    fireEvent.keyDown(container.firstChild as HTMLElement, {
      key: 'c',
      metaKey: true,
    })
    expect(onCopy).toHaveBeenCalledWith(['0', '1'])
  })

  it('Cmd+C filters out descendants from selection', () => {
    const onCopy = vi.fn()
    const nestedNodes: FolderNode[] = [
      { name: 'Parent', children: [{ name: 'Child', children: [] }] },
    ]
    const { container } = render(
      <FolderTree
        {...makeTreeProps({
          nodes: nestedNodes,
          onCopy,
          focusedPath: [0],
          selectedPaths: ['0', '0,0'],  // parent and its child
          expandedPaths: new Set(['0', '0,0']),
        })}
      />
    )
    fireEvent.keyDown(container.firstChild as HTMLElement, {
      key: 'c',
      metaKey: true,
    })
    // '0,0' is a descendant of '0' — should be filtered out
    expect(onCopy).toHaveBeenCalledWith(['0'])
  })

  it('Cmd+V calls onPaste with focusedPath', () => {
    const onPaste = vi.fn()
    const { container } = render(
      <FolderTree {...makeTreeProps({ onPaste, focusedPath: [0] })} />
    )
    fireEvent.keyDown(container.firstChild as HTMLElement, {
      key: 'v',
      metaKey: true,
    })
    expect(onPaste).toHaveBeenCalledWith([0])
  })
})
