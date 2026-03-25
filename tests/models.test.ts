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
})
