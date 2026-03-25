// src/lib/models.ts

export interface FolderNode {
  name: string
  children: FolderNode[]
}

export interface Template {
  id: string
  name: string
  folders: FolderNode[]
}

export function folderNodeToDict(node: FolderNode): Record<string, unknown> {
  return {
    name: node.name,
    children: node.children.map(folderNodeToDict),
  }
}

export function folderNodeFromDict(dict: Record<string, unknown>): FolderNode {
  return {
    name: dict.name as string,
    children: ((dict.children as Record<string, unknown>[] | undefined) ?? []).map(
      folderNodeFromDict
    ),
  }
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
