import { moveNode } from './src/lib/tree-operations'
import { FolderNode } from './src/lib/models'

const nodes: FolderNode[] = [
  { name: 'Folder 1', children: [] },
  { name: 'Folder 2', children: [] },
]

console.log("Original: ", JSON.stringify(nodes, null, 2))

// move Folder 2 BEFORE Folder 1
// from [1] to [0] before
console.log("Move [1] BEFORE [0]")
const test1 = moveNode(nodes, [1], [0], 'before')
console.log(JSON.stringify(test1, null, 2))

