// src/lib/tree-operations.ts
import type { FolderNode } from '@/lib/models'

// ---------------------------------------------------------------------------
// Existing helpers (moved from TemplateEditor.tsx)
// ---------------------------------------------------------------------------

export function addNodeAt(nodes: FolderNode[], path: number[], newNode: FolderNode): FolderNode[] {
  if (path.length === 0) return [...nodes, newNode]
  return nodes.map((n, i) =>
    i === path[0]
      ? {
        ...n, children: path.length === 1
          ? [...n.children, newNode]
          : addNodeAt(n.children, path.slice(1), newNode)
      }
      : n
  )
}

export function renameNodeAt(nodes: FolderNode[], path: number[], name: string): FolderNode[] {
  return nodes.map((n, i) =>
    i === path[0]
      ? path.length === 1
        ? { ...n, name }
        : { ...n, children: renameNodeAt(n.children, path.slice(1), name) }
      : n
  )
}

export function deleteNodeAt(nodes: FolderNode[], path: number[]): FolderNode[] {
  if (path.length === 1) return nodes.filter((_, i) => i !== path[0])
  return nodes.map((n, i) =>
    i === path[0] ? { ...n, children: deleteNodeAt(n.children, path.slice(1)) } : n
  )
}

export function uniqueSiblingName(siblings: FolderNode[], baseName: string): string {
  const names = new Set(siblings.map((n) => n.name))
  if (!names.has(baseName)) return baseName
  let i = 2
  while (names.has(`${baseName} ${i}`)) i++
  return `${baseName} ${i}`
}

export function duplicateNodeAt(nodes: FolderNode[], path: number[]): FolderNode[] {
  if (path.length === 1) {
    const target = nodes[path[0]]
    const copy = JSON.parse(JSON.stringify(target)) as FolderNode
    const baseName = `${copy.name} Copy`
    copy.name = uniqueSiblingName(nodes, baseName)
    return [...nodes.slice(0, path[0] + 1), copy, ...nodes.slice(path[0] + 1)]
  }
  return nodes.map((n, i) =>
    i === path[0] ? { ...n, children: duplicateNodeAt(n.children, path.slice(1)) } : n
  )
}

// ---------------------------------------------------------------------------
// New pure functions
// ---------------------------------------------------------------------------

/** Returns the FolderNode at a given path, or undefined if not found. */
export function getNodeAtPath(nodes: FolderNode[], path: number[]): FolderNode | undefined {
  if (path.length === 0) return undefined
  const node = nodes[path[0]]
  if (!node) return undefined
  if (path.length === 1) return node
  return getNodeAtPath(node.children, path.slice(1))
}

/** Returns the sibling array containing the node at the given path. */
export function getSiblingsAtPath(nodes: FolderNode[], path: number[]): FolderNode[] {
  if (path.length === 1) return nodes
  const parent = getNodeAtPath(nodes, path.slice(0, -1))
  return parent ? parent.children : []
}

/**
 * Insert a new node as a sibling directly after the node at the given path.
 * (Used for Enter-to-create.)
 */
export function insertNodeAfter(
  nodes: FolderNode[],
  path: number[],
  newNode: FolderNode
): FolderNode[] {
  if (path.length === 1) {
    const idx = path[0]
    return [...nodes.slice(0, idx + 1), newNode, ...nodes.slice(idx + 1)]
  }
  return nodes.map((n, i) =>
    i === path[0]
      ? { ...n, children: insertNodeAfter(n.children, path.slice(1), newNode) }
      : n
  )
}

function isAncestorOf(ancestor: number[], descendant: number[]): boolean {
  return ancestor.length < descendant.length &&
    ancestor.every((v, i) => v === descendant[i])
}

/**
 * Move the node at `fromPath` to a position relative to the node at `toPath`.
 * `position` is 'before', 'after', or 'inside' (appended as last child of toPath node).
 */
export function moveNode(
  nodes: FolderNode[],
  fromPath: number[],
  toPath: number[],
  position: 'before' | 'after' | 'inside'
): FolderNode[] {
  // Grab the node first, before removing it
  const nodeToMove = getNodeAtPath(nodes, fromPath)
  if (!nodeToMove) return nodes

  // Guard: moving a node into one of its own descendants is undefined — bail out
  if (isAncestorOf(fromPath, toPath)) return nodes

  // Remove the node from its current location
  let result = deleteNodeAt(nodes, fromPath)

  // Adjust toPath to account for the index shift caused by the removal of fromPath.
  // Find the deepest level d where fromPath and toPath share the same parent prefix.
  // At that level, if fromPath[d] < toPath[d], the removal shifted toPath[d] down by 1.
  const adjustedToPath = [...toPath]
  const sharedDepth = Math.min(fromPath.length, toPath.length)
  for (let d = 0; d < sharedDepth; d++) {
    // Check that the two paths share the same parent at depth d
    // (i.e., fromPath[0..d-1] === toPath[0..d-1])
    const samePrefix = fromPath.slice(0, d).every((v, i) => v === toPath[i])
    if (!samePrefix) break
    if (d === fromPath.length - 1) {
      // This is the level where the deletion happened
      if (fromPath[d] < toPath[d]) {
        adjustedToPath[d] -= 1
      }
      break
    }
  }

  if (position === 'inside') {
    // Append as last child of the target node
    result = addNodeAt(result, adjustedToPath, nodeToMove)
  } else if (position === 'before') {
    const parentPath = adjustedToPath.slice(0, -1)
    const insertIdx = adjustedToPath[adjustedToPath.length - 1]
    result = insertAtIndex(result, parentPath, insertIdx, nodeToMove)
  } else {
    // 'after'
    const parentPath = adjustedToPath.slice(0, -1)
    const insertIdx = adjustedToPath[adjustedToPath.length - 1] + 1
    result = insertAtIndex(result, parentPath, insertIdx, nodeToMove)
  }

  return result
}

/** Internal helper: insert a node at a specific index within a sibling array. */
function insertAtIndex(
  nodes: FolderNode[],
  parentPath: number[],
  index: number,
  newNode: FolderNode
): FolderNode[] {
  if (parentPath.length === 0) {
    return [...nodes.slice(0, index), newNode, ...nodes.slice(index)]
  }
  return nodes.map((n, i) =>
    i === parentPath[0]
      ? { ...n, children: insertAtIndex(n.children, parentPath.slice(1), index, newNode) }
      : n
  )
}

/**
 * Make the node at `path` the last child of the node immediately before it
 * in the same parent. If the node is already first in its parent, return nodes unchanged.
 */
export function indentNode(nodes: FolderNode[], path: number[]): FolderNode[] {
  const lastIdx = path[path.length - 1]
  if (lastIdx === 0) return nodes // already first child — fail silently

  const nodeToIndent = getNodeAtPath(nodes, path)
  if (!nodeToIndent) return nodes

  // The new parent is the preceding sibling
  const precedingSiblingPath = [...path.slice(0, -1), lastIdx - 1]

  // Remove node from current location
  let result = deleteNodeAt(nodes, path)

  // Append as last child of the preceding sibling (whose index hasn't changed
  // since we removed a node after it)
  result = addNodeAt(result, precedingSiblingPath, nodeToIndent)

  return result
}

/**
 * Move the node at `path` to become a sibling right after its parent.
 * If the node is at root level (path.length === 1), return nodes unchanged.
 */
export function outdentNode(nodes: FolderNode[], path: number[]): FolderNode[] {
  if (path.length === 1) return nodes // root level — fail silently

  const nodeToOutdent = getNodeAtPath(nodes, path)
  if (!nodeToOutdent) return nodes

  const parentPath = path.slice(0, -1)
  const parentIdx = parentPath[parentPath.length - 1]

  // Remove node from current location (inside parent's children)
  let result = deleteNodeAt(nodes, path)

  // Insert as sibling right after the parent
  const grandParentPath = parentPath.slice(0, -1)
  const insertIdx = parentIdx + 1
  result = insertAtIndex(result, grandParentPath, insertIdx, nodeToOutdent)

  return result
}

/**
 * Returns a flat array of all visible nodes (respecting collapsed state).
 * Root nodes are always visible. A node's children are visible only if that
 * node's path string (comma-joined) is present in `expandedPaths`.
 */
export function getVisiblePaths(
  nodes: FolderNode[],
  expandedPaths: Set<string>
): Array<{ path: number[]; depth: number; node: FolderNode }> {
  const result: Array<{ path: number[]; depth: number; node: FolderNode }> = []

  function traverse(children: FolderNode[], parentPath: number[], depth: number) {
    for (let i = 0; i < children.length; i++) {
      const node = children[i]
      const path = [...parentPath, i]
      result.push({ path, depth, node })

      if (node.children.length > 0 && expandedPaths.has(path.join(','))) {
        traverse(node.children, path, depth + 1)
      }
    }
  }

  traverse(nodes, [], 0)
  return result
}
