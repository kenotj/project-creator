// tests/setup.ts
import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Tauri APIs are not available in jsdom — mock them globally
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  mkdir: vi.fn(),
  exists: vi.fn(),
  BaseDirectory: { Home: 6 },
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}))

vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn().mockResolvedValue('/mock/home'),
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    onCloseRequested: vi.fn().mockResolvedValue(vi.fn()),
    close: vi.fn().mockResolvedValue(undefined),
  })),
}))
