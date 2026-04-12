// tests/models.test.ts
import { describe, it, expect } from 'vitest'
import {
  folderNodeToDict,
  folderNodeFromDict,
  type FolderNode,
} from '@/lib/models'

describe('FolderNode serialization', () => {
  it('round-trips a leaf node', () => {
    const node: FolderNode = { name: 'src', children: [] }
    expect(folderNodeFromDict(folderNodeToDict(node))).toEqual(node)
  })

  it('round-trips a nested node', () => {
    const node: FolderNode = {
      name: 'src',
      children: [{ name: 'components', children: [] }],
    }
    expect(folderNodeFromDict(folderNodeToDict(node))).toEqual(node)
  })

  it('handles missing children key in dict', () => {
    const dict = { name: 'src' }
    expect(folderNodeFromDict(dict)).toEqual({ name: 'src', children: [] })
  })

  it('round-trips a node with description', () => {
    const node: FolderNode = { name: 'src', description: 'Source code', children: [] }
    expect(folderNodeFromDict(folderNodeToDict(node))).toEqual(node)
  })

  it('omits description key when undefined', () => {
    const node: FolderNode = { name: 'src', children: [] }
    const dict = folderNodeToDict(node)
    expect(dict).not.toHaveProperty('description')
  })

  it('handles missing description key in dict', () => {
    const dict = { name: 'src', children: [] }
    expect(folderNodeFromDict(dict)).toEqual({ name: 'src', children: [] })
  })
})
