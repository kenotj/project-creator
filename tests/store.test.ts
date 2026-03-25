// tests/store.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readTextFile, writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs'
import {
  loadTemplates,
  saveTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  uniqueTemplateName,
} from '@/lib/store'
import type { Template } from '@/lib/models'

const mockReadTextFile = vi.mocked(readTextFile)
const mockWriteTextFile = vi.mocked(writeTextFile)
const mockMkdir = vi.mocked(mkdir)
const mockExists = vi.mocked(exists)

beforeEach(() => {
  vi.clearAllMocks()
  mockExists.mockResolvedValue(false)
  mockMkdir.mockResolvedValue(undefined)
  mockWriteTextFile.mockResolvedValue(undefined)
})

describe('loadTemplates', () => {
  it('returns empty array when file does not exist', async () => {
    mockReadTextFile.mockRejectedValue(new Error('not found'))
    const result = await loadTemplates()
    expect(result).toEqual([])
  })

  it('returns parsed templates from file', async () => {
    const data = [{ id: '1', name: 'Test', folders: [] }]
    mockReadTextFile.mockResolvedValue(JSON.stringify(data))
    const result = await loadTemplates()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test')
  })

  it('returns empty array on malformed JSON', async () => {
    mockReadTextFile.mockResolvedValue('not json {{{{')
    const result = await loadTemplates()
    expect(result).toEqual([])
  })

  it('assigns uuid to legacy templates missing id and re-saves', async () => {
    const data = [{ name: 'Legacy', folders: [] }]
    mockReadTextFile.mockResolvedValue(JSON.stringify(data))
    const result = await loadTemplates()
    expect(result[0].id).toBeTruthy()
    expect(mockWriteTextFile).toHaveBeenCalled()
  })
})

describe('saveTemplates', () => {
  it('writes serialized templates to disk', async () => {
    const templates: Template[] = [{ id: '1', name: 'Test', folders: [] }]
    await saveTemplates(templates)
    expect(mockWriteTextFile).toHaveBeenCalledWith(
      expect.stringContaining('templates.json'),
      expect.stringContaining('"Test"'),
      expect.anything()
    )
  })

  it('creates config directory if it does not exist', async () => {
    mockExists.mockResolvedValue(false)
    await saveTemplates([])
    expect(mockMkdir).toHaveBeenCalled()
  })

  it('skips mkdir if directory already exists', async () => {
    mockExists.mockResolvedValue(true)
    await saveTemplates([])
    expect(mockMkdir).not.toHaveBeenCalled()
  })
})

describe('addTemplate', () => {
  it('appends a new template to the list', () => {
    const existing: Template[] = [{ id: '1', name: 'A', folders: [] }]
    const result = addTemplate(existing, 'B')
    expect(result).toHaveLength(2)
    expect(result[1].name).toBe('B')
    expect(result[1].id).toBeTruthy()
  })
})

describe('updateTemplate', () => {
  it('replaces the template with matching id', () => {
    const t: Template = { id: '1', name: 'Old', folders: [] }
    const updated: Template = { id: '1', name: 'New', folders: [] }
    const result = updateTemplate([t], updated)
    expect(result[0].name).toBe('New')
  })
})

describe('deleteTemplate', () => {
  it('removes the template with matching id', () => {
    const templates: Template[] = [
      { id: '1', name: 'A', folders: [] },
      { id: '2', name: 'B', folders: [] },
    ]
    const result = deleteTemplate(templates, '1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })
})

describe('duplicateTemplate', () => {
  it('creates a copy with a unique name', () => {
    const t: Template = { id: '1', name: 'Web App', folders: [] }
    const copy = duplicateTemplate([t], '1')
    expect(copy!.name).toBe('Web App Copy')
    expect(copy!.id).not.toBe('1')
  })

  it('avoids name collision with "Copy 2"', () => {
    const t1: Template = { id: '1', name: 'Web App', folders: [] }
    const t2: Template = { id: '2', name: 'Web App Copy', folders: [] }
    const copy = duplicateTemplate([t1, t2], '1')
    expect(copy!.name).toBe('Web App Copy 2')
  })
})

describe('uniqueTemplateName', () => {
  it('returns base name when no conflict', () => {
    expect(uniqueTemplateName([], 'New Template')).toBe('New Template')
  })

  it('appends 2 when base name is taken', () => {
    const templates: Template[] = [{ id: '1', name: 'New Template', folders: [] }]
    expect(uniqueTemplateName(templates, 'New Template')).toBe('New Template 2')
  })

  it('increments to next available number', () => {
    const templates: Template[] = [
      { id: '1', name: 'New Template', folders: [] },
      { id: '2', name: 'New Template 2', folders: [] },
    ]
    expect(uniqueTemplateName(templates, 'New Template')).toBe('New Template 3')
  })
})
