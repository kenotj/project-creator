// src/lib/generate.ts
import { mkdir, exists } from '@tauri-apps/plugin-fs'
import type { Template, FolderNode } from './models'

export interface ProjectError {
  code: 'EXISTS' | 'UNKNOWN'
  message?: string
}

export interface ProjectSuccess {
  ok: true
  path: string
}

async function createFolders(basePath: string, nodes: FolderNode[]): Promise<void> {
  for (const node of nodes) {
    const nodePath = `${basePath}/${node.name}`
    await mkdir(nodePath, { recursive: true })
    if (node.children.length > 0) {
      await createFolders(nodePath, node.children)
    }
  }
}

export async function createProject(
  template: Template,
  projectName: string,
  destDir: string
): Promise<ProjectSuccess> {
  const rootPath = `${destDir}/${projectName}`

  const alreadyExists = await exists(rootPath)
  if (alreadyExists) {
    throw { code: 'EXISTS' } satisfies ProjectError
  }

  try {
    await mkdir(rootPath, { recursive: true })
    await createFolders(rootPath, template.folders)
    return { ok: true, path: rootPath }
  } catch (err) {
    if ((err as ProjectError).code === 'EXISTS') throw err
    throw { code: 'UNKNOWN', message: (err as Error).message } satisfies ProjectError
  }
}
