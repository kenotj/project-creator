// tests/generate.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdir, exists, writeTextFile } from '@tauri-apps/plugin-fs'
import { createProject, generateReadme, type ProjectError } from '@/lib/generate'
import type { Template } from '@/lib/models'

const mockMkdir = vi.mocked(mkdir)
const mockExists = vi.mocked(exists)
const mockWriteTextFile = vi.mocked(writeTextFile)

beforeEach(() => {
  vi.clearAllMocks()
  mockMkdir.mockResolvedValue(undefined)
  mockWriteTextFile.mockResolvedValue(undefined)
})

describe('createProject', () => {
  it('creates root directory for an empty template', async () => {
    mockExists.mockResolvedValue(false)
    const template: Template = { id: '1', name: 'Empty', folders: [] }
    const result = await createProject(template, 'my-app', '/dest')
    expect(result.ok).toBe(true)
    expect(mockMkdir).toHaveBeenCalledWith('/dest/my-app', { recursive: true })
  })

  it('creates nested folder structure', async () => {
    mockExists.mockResolvedValue(false)
    const template: Template = {
      id: '1',
      name: 'Test',
      folders: [
        { name: 'src', children: [{ name: 'components', children: [] }] },
      ],
    }
    await createProject(template, 'my-app', '/dest')
    expect(mockMkdir).toHaveBeenCalledWith('/dest/my-app/src', { recursive: true })
    expect(mockMkdir).toHaveBeenCalledWith('/dest/my-app/src/components', { recursive: true })
  })

  it('throws ProjectError with code EXISTS when root path exists', async () => {
    mockExists.mockResolvedValue(true)
    const template: Template = { id: '1', name: 'Test', folders: [] }
    await expect(createProject(template, 'my-app', '/dest')).rejects.toMatchObject({
      code: 'EXISTS',
    } satisfies Partial<ProjectError>)
  })

  it('throws ProjectError with code UNKNOWN on unexpected mkdir failure', async () => {
    mockExists.mockResolvedValue(false)
    mockMkdir.mockRejectedValue(new Error('permission denied'))
    const template: Template = { id: '1', name: 'Test', folders: [] }
    await expect(createProject(template, 'my-app', '/dest')).rejects.toMatchObject({
      code: 'UNKNOWN',
      message: 'permission denied',
    } satisfies Partial<ProjectError>)
  })

  it('writes README.md when folders have descriptions', async () => {
    mockExists.mockResolvedValue(false)
    const template: Template = {
      id: '1',
      name: 'Test',
      folders: [{ name: 'src', description: 'Source code', children: [] }],
    }
    await createProject(template, 'my-app', '/dest')
    expect(mockWriteTextFile).toHaveBeenCalledWith(
      '/dest/my-app/README.md',
      expect.stringContaining('src/ — Source code')
    )
  })

  it('does not write README.md when no descriptions exist', async () => {
    mockExists.mockResolvedValue(false)
    const template: Template = {
      id: '1',
      name: 'Test',
      folders: [{ name: 'src', children: [] }],
    }
    await createProject(template, 'my-app', '/dest')
    expect(mockWriteTextFile).not.toHaveBeenCalled()
  })
})

describe('generateReadme', () => {
  it('returns empty string when no folders have descriptions', () => {
    const folders = [
      { name: 'src', children: [{ name: 'lib', children: [] }] },
    ]
    expect(generateReadme('my-app', folders)).toBe('')
  })

  it('generates tree with descriptions for described folders', () => {
    const folders = [
      {
        name: 'src',
        description: 'Source code',
        children: [
          { name: 'components', description: 'UI components', children: [] },
          { name: 'lib', children: [] },
        ],
      },
      { name: 'assets', children: [] },
    ]
    const result = generateReadme('my-app', folders)
    expect(result).toContain('# my-app')
    expect(result).toContain('## Project Structure')
    expect(result).toContain('src/ — Source code')
    expect(result).toContain('components/ — UI components')
    expect(result).toContain('lib/')
    expect(result).toContain('assets/')
  })

  it('uses correct tree characters for last vs non-last siblings', () => {
    const folders = [
      { name: 'first', description: 'First folder', children: [] },
      { name: 'last', children: [] },
    ]
    const result = generateReadme('proj', folders)
    expect(result).toContain('├── first/')
    expect(result).toContain('└── last/')
  })

  it('uses correct indentation prefixes for nested folders', () => {
    const folders = [
      {
        name: 'src',
        description: 'Source',
        children: [
          { name: 'nested', children: [] },
        ],
      },
      { name: 'other', children: [] },
    ]
    const result = generateReadme('proj', folders)
    // "src" is not last, so prefix for its children is "│   "
    expect(result).toContain('│   └── nested/')
  })
})
