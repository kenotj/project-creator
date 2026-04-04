// src/lib/store.ts
import { readTextFile, writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs'
import { appLocalDataDir } from '@tauri-apps/api/path'
import { templateFromDict, templateToDict, type Template } from './models'

const CONFIG_FILE = 'templates.json'

async function getConfigPath(): Promise<string> {
  const dir = await appLocalDataDir()
  return `${dir}/${CONFIG_FILE}`
}

async function getDirPath(): Promise<string> {
  return appLocalDataDir()
}

export async function loadTemplates(): Promise<Template[]> {
  try {
    const path = await getConfigPath()
    const text = await readTextFile(path)
    const raw = JSON.parse(text) as Record<string, unknown>[]
    const templates = raw.map(templateFromDict)

    // Legacy migration: assign IDs to records that were missing them
    const needsMigration = templates.some((_t, i) => !(raw[i] as Record<string, unknown>).id)
    if (needsMigration) {
      await saveTemplates(templates)
    }
    return templates
  } catch {
    return []
  }
}

export async function saveTemplates(templates: Template[]): Promise<void> {
  const dirPath = await getDirPath()
  const filePath = await getConfigPath()
  const dirExists = await exists(dirPath)
  if (!dirExists) {
    await mkdir(dirPath, { recursive: true })
  }
  await writeTextFile(filePath, JSON.stringify(templates.map(templateToDict), null, 2), {})
}

export function addTemplate(templates: Template[], name: string): Template[] {
  const newTemplate: Template = {
    id: crypto.randomUUID(),
    name,
    folders: [],
  }
  return [...templates, newTemplate]
}

export function updateTemplate(templates: Template[], updated: Template): Template[] {
  return templates.map((t) => (t.id === updated.id ? updated : t))
}

export function deleteTemplate(templates: Template[], id: string): Template[] {
  return templates.filter((t) => t.id !== id)
}

export function duplicateTemplate(templates: Template[], id: string): Template | null {
  const source = templates.find((t) => t.id === id)
  if (!source) return null
  const baseName = `${source.name} Copy`
  const name = uniqueTemplateName(templates, baseName)
  return {
    ...source,
    id: crypto.randomUUID(),
    name,
    folders: JSON.parse(JSON.stringify(source.folders)),
  }
}

export function uniqueTemplateName(templates: Template[], baseName: string): string {
  const names = new Set(templates.map((t) => t.name))
  if (!names.has(baseName)) return baseName
  let i = 2
  while (names.has(`${baseName} ${i}`)) i++
  return `${baseName} ${i}`
}
