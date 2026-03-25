// tests/generate.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdir, exists } from '@tauri-apps/plugin-fs'
import { createProject, type ProjectError } from '@/lib/generate'
import type { Template } from '@/lib/models'

const mockMkdir = vi.mocked(mkdir)
const mockExists = vi.mocked(exists)

beforeEach(() => {
  vi.clearAllMocks()
  mockMkdir.mockResolvedValue(undefined)
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
})
