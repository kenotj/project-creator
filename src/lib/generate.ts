// src/lib/generate.ts
import { mkdir, exists, writeTextFile } from '@tauri-apps/plugin-fs'
import type { Template, FolderNode } from './models'

export interface ProjectError {
  code: 'EXISTS' | 'UNKNOWN'
  message?: string
}

export interface ProjectSuccess {
  ok: true
  path: string
}

function hasAnyDescription(nodes: FolderNode[]): boolean {
  return nodes.some(n => n.description || hasAnyDescription(n.children))
}

function buildTreeLines(nodes: FolderNode[], prefix: string): string[] {
  const lines: string[] = []
  nodes.forEach((node, i) => {
    const isLast = i === nodes.length - 1
    const connector = isLast ? '└── ' : '├── '
    const desc = node.description ? ` — ${node.description}` : ''
    lines.push(`${prefix}${connector}${node.name}/${desc}`)
    if (node.children.length > 0) {
      const childPrefix = prefix + (isLast ? '    ' : '│   ')
      lines.push(...buildTreeLines(node.children, childPrefix))
    }
  })
  return lines
}

export function generateReadme(projectName: string, folders: FolderNode[]): string {
  if (!hasAnyDescription(folders)) return ''
  const lines = [
    `# ${projectName}`,
    '',
    '## Project Structure',
    '',
    '```',
    ...buildTreeLines(folders, ''),
    '```',
    '',
  ]
  return lines.join('\n')
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
    const readme = generateReadme(projectName, template.folders)
    if (readme) {
      await writeTextFile(`${rootPath}/README.md`, readme)
    }
    return { ok: true, path: rootPath }
  } catch (err) {
    if ((err as ProjectError).code === 'EXISTS') throw err
    throw { code: 'UNKNOWN', message: (err as Error).message } satisfies ProjectError
  }
}
