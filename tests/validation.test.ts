// tests/validation.test.ts
import { describe, it, expect } from 'vitest'
import { validateName } from '@/lib/validation'

describe('validateName', () => {
  it('accepts a valid name', () => {
    expect(validateName('my-project')).toEqual({ valid: true })
  })

  it('rejects empty string', () => {
    expect(validateName('')).toMatchObject({ valid: false })
  })

  it('rejects whitespace-only string', () => {
    expect(validateName('   ')).toMatchObject({ valid: false })
  })

  it.each(['/', '\\', ':', '*', '?', '"', '<', '>', '|'])(
    'rejects name containing illegal char %s',
    (char) => {
      expect(validateName(`foo${char}bar`)).toMatchObject({ valid: false })
    }
  )

  it('accepts a name with spaces', () => {
    expect(validateName('My Project')).toEqual({ valid: true })
  })

  it('accepts a name with numbers and dashes', () => {
    expect(validateName('project-42')).toEqual({ valid: true })
  })
})
