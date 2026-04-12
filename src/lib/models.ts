// src/lib/models.ts

export interface FolderNode {
  name: string
  description?: string
  children: FolderNode[]
}

export interface Template {
  id: string
  name: string
  folders: FolderNode[]
}

export function folderNodeToDict(node: FolderNode): Record<string, unknown> {
  const dict: Record<string, unknown> = {
    name: node.name,
    children: node.children.map(folderNodeToDict),
  }
  if (node.description !== undefined) {
    dict.description = node.description
  }
  return dict
}

export function folderNodeFromDict(dict: Record<string, unknown>): FolderNode {
  const node: FolderNode = {
    name: dict.name as string,
    children: ((dict.children as Record<string, unknown>[] | undefined) ?? []).map(
      folderNodeFromDict
    ),
  }
  if (typeof dict.description === 'string' && dict.description.length > 0) {
    node.description = dict.description
  }
  return node
}

export function templateToDict(t: Template): Record<string, unknown> {
  return {
    id: t.id,
    name: t.name,
    folders: t.folders.map(folderNodeToDict),
  }
}

export function templateFromDict(dict: Record<string, unknown>): Template {
  return {
    id: (dict.id as string | undefined) ?? crypto.randomUUID(),
    name: dict.name as string,
    folders: ((dict.folders as Record<string, unknown>[] | undefined) ?? []).map(
      folderNodeFromDict
    ),
  }
}
