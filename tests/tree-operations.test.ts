import { describe, it, expect } from 'vitest'
import { moveNodes } from '@/lib/tree-operations'
import type { FolderNode } from '@/lib/models'

function n(name: string, ...children: FolderNode[]): FolderNode {
  return { name, children }
}

// Tree used in most tests:
// root: [A, B, C, D]
//   A: []
//   B: [B1, B2]
//   C: []
//   D: []
function tree() {
  return [n('A'), n('B', n('B1'), n('B2')), n('C'), n('D')]
}

describe('moveNodes', () => {
  it('moves a single item before another (same level)', () => {
    // Move D [3] before B [1] → [A, D, B, C]
    const result = moveNodes(tree(), [[3]], [1], 'before')
    expect(result.map(x => x.name)).toEqual(['A', 'D', 'B', 'C'])
  })

  it('moves a single item after another (same level)', () => {
    // Move A [0] after C [2] → [B, C, A, D]
    const result = moveNodes(tree(), [[0]], [2], 'after')
    expect(result.map(x => x.name)).toEqual(['B', 'C', 'A', 'D'])
  })

  it('moves a single item inside another', () => {
    // Move D [3] inside B [1] → B gains D as last child
    const result = moveNodes(tree(), [[3]], [1], 'inside')
    expect(result.map(x => x.name)).toEqual(['A', 'B', 'C'])
    expect(result[1].children.map(x => x.name)).toEqual(['B1', 'B2', 'D'])
  })

  it('moves multiple siblings before a target', () => {
    // Move C [2] and D [3] before B [1] → [A, C, D, B]
    const result = moveNodes(tree(), [[2], [3]], [1], 'before')
    expect(result.map(x => x.name)).toEqual(['A', 'C', 'D', 'B'])
  })

  it('moves multiple siblings after a target', () => {
    // Move A [0] and B [1] after D [3] → [C, D, A, B]
    const result = moveNodes(tree(), [[0], [1]], [3], 'after')
    expect(result.map(x => x.name)).toEqual(['C', 'D', 'A', 'B'])
  })

  it('moves multiple siblings inside a target', () => {
    // Move C [2] and D [3] inside B [1] → B has [B1, B2, C, D]
    const result = moveNodes(tree(), [[2], [3]], [1], 'inside')
    expect(result.map(x => x.name)).toEqual(['A', 'B'])
    expect(result[1].children.map(x => x.name)).toEqual(['B1', 'B2', 'C', 'D'])
  })

  it('skips child when parent is also selected (top-level filter)', () => {
    // Select B [1] and B1 [1,0] — B1 should move with B, not separately
    // fromPaths includes both [1] and [1,0]; only [1] should be processed
    const result = moveNodes(tree(), [[1], [1, 0]], [3], 'after')
    // Result should be same as moving only B [1] after D
    const singleResult = moveNodes(tree(), [[1]], [3], 'after')
    expect(result).toEqual(singleResult)
  })

  it('returns nodes unchanged when target is a descendant of a source', () => {
    // Try to move B [1] inside B1 [1, 0] — invalid
    const original = tree()
    const result = moveNodes(original, [[1]], [1, 0], 'inside')
    expect(result).toEqual(original)
  })

  it('moves a node with its subtree intact', () => {
    // Move B [1] (has children B1, B2) before A [0]
    const result = moveNodes(tree(), [[1]], [0], 'before')
    expect(result.map(x => x.name)).toEqual(['B', 'A', 'C', 'D'])
    expect(result[0].children.map(x => x.name)).toEqual(['B1', 'B2'])
  })

  it('handles non-contiguous selections from different depths', () => {
    // Move A [0] and B2 [1,1] before C [2]
    // After top-level filter: both are top-level (neither is ancestor of the other)
    // Sorted DFS: [0] then [1,1]
    // Expected: A and B2 appear before C → [B[B1], A, B2, C, D]
    const result = moveNodes(tree(), [[0], [1, 1]], [2], 'before')
    expect(result.map(x => x.name)).toEqual(['B', 'A', 'B2', 'C', 'D'])
    expect(result[0].children.map(x => x.name)).toEqual(['B1'])
  })

  it('returns nodes unchanged for empty fromPaths', () => {
    const original = tree()
    const result = moveNodes(original, [], [1], 'before')
    expect(result).toEqual(original)
  })

  it('returns nodes unchanged when all fromPaths collapse after top-level filter', () => {
    // Select B [1] and its child B1 [1,0] and B2 [1,1] — all descendants collapse to just B
    // Then also select C [2] — only B and C survive filter, top-level=[1,2]
    // This test verifies the filter itself, not an empty-after-filter case
    // For true empty-after-filter: select only B1 and B2 (both descendants of B which is not selected)
    // Actually they pass filter since neither is ancestor of the other
    // Real collapse: select B[1], B1[1,0], B2[1,1] — after filter only B[1] remains
    const original = tree()
    const result = moveNodes(original, [[1], [1, 0], [1, 1]], [3], 'after')
    const expected = moveNodes(original, [[1]], [3], 'after')
    expect(result).toEqual(expected)
  })

  it('moves nodes from different parents inside a third node', () => {
    // Move A [0] and C [2] inside D [3] → D gains A and C as last children
    const result = moveNodes(tree(), [[0], [2]], [3], 'inside')
    expect(result.map(x => x.name)).toEqual(['B', 'D'])
    expect(result[1].children.map(x => x.name)).toEqual(['A', 'C'])
  })
})
