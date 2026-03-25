// src/lib/validation.ts

const ILLEGAL_CHARS = /[/\\:*?"<>|]/

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateName(name: string): ValidationResult {
  const trimmed = name.trim()
  if (!trimmed) {
    return { valid: false, error: 'Name cannot be empty' }
  }
  if (ILLEGAL_CHARS.test(trimmed)) {
    return { valid: false, error: 'Name contains illegal characters: / \\ : * ? " < > |' }
  }
  return { valid: true }
}
