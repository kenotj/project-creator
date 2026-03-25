# ProjectCreator Tauri Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Python/tkinter ProjectCreator desktop app into a cross-platform Tauri v2 + React + shadcn/ui app with full feature parity, light/dark theme, right-click context menu, and a Vitest test suite ported from the Python tests.

**Architecture:** TypeScript-only frontend (no custom Rust) using Tauri's built-in `plugin-fs`, `plugin-dialog`, and `api/path` for all native operations. State lives in `App.tsx` with `isDirty` reported upward from `TemplateEditor` via an `onDirtyChange` callback. UI uses shadcn/ui New York style on top of Tailwind CSS v4.

**Tech Stack:** Tauri v2, React 18, Vite, TypeScript, shadcn/ui (New York), Tailwind CSS v4, Vitest, `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, `@tauri-apps/api/path`

**Spec:** `docs/superpowers/specs/2026-03-25-tauri-rewrite-design.md`

---

## File Map

| File | Role |
|------|------|
| `src/lib/models.ts` | `FolderNode`, `Template` types + serialization helpers |
| `src/lib/validation.ts` | `validateName()` — empty/whitespace/illegal chars |
| `src/lib/store.ts` | `TemplateStore` — CRUD, JSON persistence, unique naming, legacy migration |
| `src/lib/generate.ts` | `createProject()` — recursive `mkdir` via Tauri fs, typed `ProjectError` |
| `src/components/AppLayout.tsx` | Root two-panel layout (sidebar + editor) |
| `src/components/TemplateList.tsx` | Sidebar: template list, selection, New Template button |
| `src/components/ThemeToggle.tsx` | Sun/moon pill toggle, persists to `localStorage` |
| `src/components/FolderTree.tsx` | Recursive collapsible tree, inline rename, right-click context menu |
| `src/components/TemplateEditor.tsx` | Toolbar (name, Duplicate, Delete, Save) + tree area + bottom action bar |
| `src/components/GenerateDialog.tsx` | Modal: project name, destination, Create button, error display |
| `src/App.tsx` | Top-level state (`templates`, `selectedId`, `isDirty`, `theme`), keyboard shortcut |
| `src/main.tsx` | React entry point |
| `src-tauri/tauri.conf.json` | Window config (700×450 min), fs/dialog permissions + scope |
| `src-tauri/Cargo.toml` | Tauri plugins: `tauri-plugin-fs`, `tauri-plugin-dialog` |
| `src-tauri/src/main.rs` | Register plugins, no custom commands |
| `tests/models.test.ts` | FolderNode round-trips, serialization edge cases |
| `tests/validation.test.ts` | All valid/invalid name cases |
| `tests/store.test.ts` | CRUD, persistence, unique naming, malformed JSON, legacy migration |
| `tests/generate.test.ts` | Empty template, nested dirs, EXISTS error, UNKNOWN error |
| `vite.config.ts` | Vite config with Tauri host, Vitest config |
| `package.json` | Dependencies |
| `tsconfig.json` | TypeScript config |
| `components.json` | shadcn/ui config (New York style) |
| `tailwind.config.ts` | Tailwind config |

---

## Task 1: Scaffold Tauri + Vite + React project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`
- Create: `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/src/main.rs`

- [ ] **Step 1: Initialize Vite + React + TypeScript project in the existing repo**

```bash
cd /Users/kennethong/repos/project-creator
npm create vite@latest . -- --template react-ts --force
npm install
```

- [ ] **Step 2: Add Tauri CLI and initialize Tauri**

```bash
npm install --save-dev @tauri-apps/cli@^2
npx tauri init
```

When prompted:
- App name: `ProjectCreator`
- Window title: `ProjectCreator`
- Web assets location: `../dist`
- Dev server URL: `http://localhost:1420`
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`

- [ ] **Step 3: Install Tauri plugins**

```bash
npm install @tauri-apps/plugin-fs @tauri-apps/plugin-dialog @tauri-apps/api
```

Add to `src-tauri/Cargo.toml` under `[dependencies]`:

```toml
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
```

- [ ] **Step 4: Register plugins in `src-tauri/src/main.rs`**

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5: Update `vite.config.ts` for Tauri + Vitest**

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
  },
})
```

- [ ] **Step 6: Create `tests/setup.ts` to mock Tauri globals**

```ts
// tests/setup.ts
import { vi } from 'vitest'

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
```

- [ ] **Step 7: Add scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server at `http://localhost:1420` with default React page.

- [ ] **Step 9: Commit scaffold**

```bash
git add package.json vite.config.ts tsconfig.json index.html src/ src-tauri/ tests/setup.ts
git commit -m "chore: scaffold Tauri v2 + Vite + React + TypeScript project"
```

---

## Task 2: Install and configure shadcn/ui

**Files:**
- Create: `components.json`, `tailwind.config.ts`, `src/index.css`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install Tailwind CSS v4 and shadcn peer dependencies**

```bash
npm install tailwindcss @tailwindcss/vite
npm install class-variance-authority clsx tailwind-merge lucide-react
```

Update `vite.config.ts` plugins array to include Tailwind:

```ts
import tailwindcss from '@tailwindcss/vite'

plugins: [react(), tailwindcss()],
```

- [ ] **Step 2: Initialize shadcn/ui (New York style)**

```bash
npx shadcn@latest init
```

When prompted:
- Style: `New York`
- Base color: `Zinc`
- CSS variables: `yes`

This creates `components.json` and updates `src/index.css` with CSS variables.

- [ ] **Step 3: Install required shadcn components**

```bash
npx shadcn@latest add button input dialog scroll-area separator dropdown-menu context-menu collapsible toast
```

- [ ] **Step 4: Update `src/main.tsx`**

```tsx
// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
```

- [ ] **Step 5: Verify shadcn import works — create smoke test `src/App.tsx`**

```tsx
// src/App.tsx (temporary smoke test)
import { Button } from '@/components/ui/button'

export default function App() {
  return <Button>Hello shadcn</Button>
}
```

Run `npm run dev` and confirm the button renders.

- [ ] **Step 6: Commit**

```bash
git add components.json tailwind.config.ts src/index.css src/main.tsx src/App.tsx src/components/ui/
git commit -m "chore: install shadcn/ui New York style with Tailwind CSS v4"
```

---

## Task 3: Data models

**Files:**
- Create: `src/lib/models.ts`
- Create: `tests/models.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/models.test.ts
import { describe, it, expect } from 'vitest'
import {
  folderNodeToDict,
  folderNodeFromDict,
  type FolderNode,
  type Template,
} from '@/lib/models'

describe('FolderNode serialization', () => {
  it('round-trips a leaf node', () => {
    const node: FolderNode = { name: 'src', children: [] }
    expect(folderNodeFromDict(folderNodeToDict(node))).toEqual(node)
  })

  it('round-trips a nested node', () => {
    const node: FolderNode = {
      name: 'src',
      children: [{ name: 'components', children: [] }],
    }
    expect(folderNodeFromDict(folderNodeToDict(node))).toEqual(node)
  })

  it('handles missing children key in dict', () => {
    const dict = { name: 'src' }
    expect(folderNodeFromDict(dict)).toEqual({ name: 'src', children: [] })
  })
})
```

- [ ] **Step 2: Run and confirm they fail**

```bash
npm test -- tests/models.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/models'`

- [ ] **Step 3: Implement `src/lib/models.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- tests/models.test.ts
```

Expected: 3 passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/models.ts tests/models.test.ts
git commit -m "feat: add FolderNode and Template types with serialization"
```

---

## Task 4: Name validation

**Files:**
- Create: `src/lib/validation.ts`
- Create: `tests/validation.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
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
```

- [ ] **Step 2: Run and confirm they fail**

```bash
npm test -- tests/validation.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/validation'`

- [ ] **Step 3: Implement `src/lib/validation.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- tests/validation.test.ts
```

Expected: all passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/validation.ts tests/validation.test.ts
git commit -m "feat: add validateName with illegal char and empty checks"
```

---

## Task 5: Template store

**Files:**
- Create: `src/lib/store.ts`
- Create: `tests/store.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/store.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readTextFile, writeTextFile, mkdir, exists } from '@tauri-apps/plugin-fs'
import { homeDir } from '@tauri-apps/api/path'
import {
  loadTemplates,
  saveTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  uniqueTemplateName,
  type TemplateStore,
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
```

- [ ] **Step 2: Run and confirm they fail**

```bash
npm test -- tests/store.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/store'`

- [ ] **Step 3: Implement `src/lib/store.ts`**

```ts
// src/lib/store.ts
import { readTextFile, writeTextFile, mkdir, exists, BaseDirectory } from '@tauri-apps/plugin-fs'
import { homeDir } from '@tauri-apps/api/path'
import { templateFromDict, templateToDict, type Template } from './models'

const CONFIG_DIR = '.projectcreator'
const CONFIG_FILE = 'templates.json'

async function getConfigPath(): Promise<string> {
  const home = await homeDir()
  return `${home}/${CONFIG_DIR}/${CONFIG_FILE}`
}

async function getDirPath(): Promise<string> {
  const home = await homeDir()
  return `${home}/${CONFIG_DIR}`
}

export async function loadTemplates(): Promise<Template[]> {
  try {
    const path = await getConfigPath()
    const text = await readTextFile(path)
    const raw = JSON.parse(text) as Record<string, unknown>[]
    const templates = raw.map(templateFromDict)

    // Legacy migration: assign IDs to records that were missing them
    const needsMigration = templates.some((t, i) => !(raw[i] as Record<string, unknown>).id)
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
  await writeTextFile(filePath, JSON.stringify(templates.map(templateToDict), null, 2))
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
  return { ...source, id: crypto.randomUUID(), name, folders: JSON.parse(JSON.stringify(source.folders)) }
}

export function uniqueTemplateName(templates: Template[], baseName: string): string {
  const names = new Set(templates.map((t) => t.name))
  if (!names.has(baseName)) return baseName
  let i = 2
  while (names.has(`${baseName} ${i}`)) i++
  return `${baseName} ${i}`
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- tests/store.test.ts
```

Expected: all passing

- [ ] **Step 5: Commit**

```bash
git add src/lib/store.ts tests/store.test.ts
git commit -m "feat: add TemplateStore with CRUD, persistence, and legacy migration"
```

---

## Task 6: Project generation

**Files:**
- Create: `src/lib/generate.ts`
- Create: `tests/generate.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/generate.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdir, exists } from '@tauri-apps/plugin-fs'
import { createProject, ProjectError } from '@/lib/generate'
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
```

- [ ] **Step 2: Run and confirm they fail**

```bash
npm test -- tests/generate.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/generate'`

- [ ] **Step 3: Implement `src/lib/generate.ts`**

```ts
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
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npm test -- tests/generate.test.ts
```

Expected: all passing

- [ ] **Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests from models, validation, store, generate passing

- [ ] **Step 6: Commit**

```bash
git add src/lib/generate.ts tests/generate.test.ts
git commit -m "feat: add createProject with typed ProjectError (EXISTS/UNKNOWN)"
```

---

## Task 7: App shell, theme state, and layout skeleton

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/AppLayout.tsx`
- Create: `src/components/ThemeToggle.tsx`

- [ ] **Step 1: Create `src/components/ThemeToggle.tsx`**

```tsx
// src/components/ThemeToggle.tsx
import { Sun, Moon } from 'lucide-react'

interface ThemeToggleProps {
  isDark: boolean
  onToggle: () => void
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`relative flex items-center justify-between w-14 h-7 rounded-full px-1 transition-colors ${
        isDark ? 'bg-blue-600' : 'bg-zinc-300'
      }`}
      aria-label="Toggle theme"
    >
      <Sun className="w-4 h-4 text-amber-400 z-10" />
      <Moon className={`w-3.5 h-3.5 z-10 ${isDark ? 'text-white' : 'text-zinc-500'}`} />
      <div
        className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-all duration-200 ${
          isDark ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
```

- [ ] **Step 2: Create `src/components/AppLayout.tsx`**

```tsx
// src/components/AppLayout.tsx
import type { ReactNode } from 'react'

interface AppLayoutProps {
  sidebar: ReactNode
  editor: ReactNode
}

export function AppLayout({ sidebar, editor }: AppLayoutProps) {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <aside className="w-52 flex-shrink-0 flex flex-col border-r border-border bg-muted/30">
        {sidebar}
      </aside>
      <main className="flex-1 flex flex-col min-w-0">
        {editor}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Rewrite `src/App.tsx` with full state**

```tsx
// src/App.tsx
import { useEffect, useState, useCallback } from 'react'
import { AppLayout } from './components/AppLayout'
import { TemplateList } from './components/TemplateList'
import { TemplateEditor } from './components/TemplateEditor'
import { loadTemplates, saveTemplates, addTemplate, updateTemplate, deleteTemplate, duplicateTemplate, uniqueTemplateName } from './lib/store'
import type { Template } from './lib/models'
import { Toaster } from './components/ui/toaster'

function getInitialTheme(): boolean {
  const stored = localStorage.getItem('theme')
  if (stored) return stored === 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export default function App() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)
  const [isDark, setIsDark] = useState(getInitialTheme)

  // Apply theme class to root
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  // Load templates on mount
  useEffect(() => {
    loadTemplates().then((loaded) => {
      setTemplates(loaded)
      if (loaded.length > 0) setSelectedId(loaded[0].id)
    })
  }, [])

  const confirmDiscard = useCallback((): boolean => {
    if (!isDirty) return true
    return window.confirm('You have unsaved changes. Discard them?')
  }, [isDirty])

  const handleSelectTemplate = useCallback((id: string) => {
    if (id === selectedId) return
    if (!confirmDiscard()) return
    setSelectedId(id)
    setIsDirty(false)
  }, [selectedId, confirmDiscard])

  const handleNewTemplate = useCallback(() => {
    if (!confirmDiscard()) return
    const name = uniqueTemplateName(templates, 'New Template')
    const updated = addTemplate(templates, name)
    setTemplates(updated)
    setSelectedId(updated[updated.length - 1].id)
    setIsDirty(false)
    saveTemplates(updated)
  }, [templates, confirmDiscard])

  const handleSave = useCallback((updated: Template) => {
    const next = updateTemplate(templates, updated)
    setTemplates(next)
    setIsDirty(false)
    saveTemplates(next)
  }, [templates])

  const handleDelete = useCallback((id: string) => {
    if (!confirmDiscard()) return
    const next = deleteTemplate(templates, id)
    setTemplates(next)
    setIsDirty(false)
    saveTemplates(next)
    // Auto-select next closest template
    const idx = templates.findIndex((t) => t.id === id)
    if (next.length === 0) {
      setSelectedId(null)
    } else {
      const newIdx = Math.min(idx, next.length - 1)
      setSelectedId(next[newIdx].id)
    }
  }, [templates, confirmDiscard])

  const handleDuplicate = useCallback((id: string) => {
    const copy = duplicateTemplate(templates, id)
    if (!copy) return
    const next = [...templates, copy]
    setTemplates(next)
    saveTemplates(next)
  }, [templates])

  // Cmd/Ctrl+S shortcut — calls save on active editor
  // Editor registers the actual save via ref; App wires the shortcut
  const [saveSignal, setSaveSignal] = useState(0)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        setSaveSignal((n) => n + 1)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const selected = templates.find((t) => t.id === selectedId) ?? null

  return (
    <>
      <AppLayout
        sidebar={
          <TemplateList
            templates={templates}
            selectedId={selectedId}
            isDark={isDark}
            onSelect={handleSelectTemplate}
            onNew={handleNewTemplate}
            onToggleTheme={() => setIsDark((d) => !d)}
          />
        }
        editor={
          <TemplateEditor
            template={selected}
            templates={templates}
            saveSignal={saveSignal}
            onSave={handleSave}
            onDelete={handleDelete}
            onDuplicate={handleDuplicate}
            onDirtyChange={setIsDirty}
          />
        }
      />
      <Toaster />
    </>
  )
}
```

- [ ] **Step 4: Verify app renders without errors**

```bash
npm run dev
```

Expected: blank two-panel layout loads (TemplateList and TemplateEditor not yet built — use placeholder divs if needed).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/components/AppLayout.tsx src/components/ThemeToggle.tsx
git commit -m "feat: app shell with theme state, keyboard shortcut, and layout skeleton"
```

---

## Task 8: Template list sidebar

**Files:**
- Create: `src/components/TemplateList.tsx`

- [ ] **Step 1: Implement `src/components/TemplateList.tsx`**

```tsx
// src/components/TemplateList.tsx
import { FolderIcon, PlusIcon } from 'lucide-react'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { ThemeToggle } from './ThemeToggle'
import type { Template } from '@/lib/models'
import { cn } from '@/lib/utils'

interface TemplateListProps {
  templates: Template[]
  selectedId: string | null
  isDark: boolean
  onSelect: (id: string) => void
  onNew: () => void
  onToggleTheme: () => void
}

export function TemplateList({
  templates, selectedId, isDark, onSelect, onNew, onToggleTheme
}: TemplateListProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Templates
        </span>
        <ThemeToggle isDark={isDark} onToggle={onToggleTheme} />
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors',
                t.id === selectedId
                  ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 font-semibold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <FolderIcon
                className={cn(
                  'w-3.5 h-3.5 flex-shrink-0',
                  t.id === selectedId ? 'text-blue-500' : 'text-muted-foreground/50'
                )}
              />
              <span className="flex-1 truncate">{t.name}</span>
              {t.id === selectedId && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="p-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onNew}
        >
          <PlusIcon className="w-3 h-3 mr-1.5" />
          New Template
        </Button>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Expected: sidebar shows template list with blue selection highlight, New Template button, theme toggle.

- [ ] **Step 3: Commit**

```bash
git add src/components/TemplateList.tsx
git commit -m "feat: TemplateList sidebar with selection, theme toggle, new template button"
```

---

## Task 9: Folder tree with context menu and inline rename

**Files:**
- Create: `src/components/FolderTree.tsx`

This is the most complex component. It renders a recursive collapsible tree, handles inline rename with validation, and provides a right-click context menu.

- [ ] **Step 1: Implement `src/components/FolderTree.tsx`**

```tsx
// src/components/FolderTree.tsx
import { useState, useRef, useEffect } from 'react'
import { ChevronRight, ChevronDown, FolderIcon, FolderOpenIcon } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu'
import { Collapsible, CollapsibleContent } from './ui/collapsible'
import { cn } from '@/lib/utils'
import { validateName } from '@/lib/validation'
import type { FolderNode } from '@/lib/models'

interface FolderTreeProps {
  nodes: FolderNode[]
  selectedPath: number[] | null
  onSelect: (path: number[]) => void
  onAddSubfolder: (path: number[]) => void
  onRename: (path: number[], newName: string) => void
  onDuplicate: (path: number[]) => void
  onDelete: (path: number[]) => void
}

interface NodeItemProps {
  node: FolderNode
  path: number[]
  selectedPath: number[] | null
  onSelect: (path: number[]) => void
  onAddSubfolder: (path: number[]) => void
  onRename: (path: number[], newName: string) => void
  onDuplicate: (path: number[]) => void
  onDelete: (path: number[]) => void
}

function pathsEqual(a: number[] | null, b: number[]): boolean {
  return a !== null && a.length === b.length && a.every((v, i) => v === b[i])
}

function NodeItem({
  node, path, selectedPath,
  onSelect, onAddSubfolder, onRename, onDuplicate, onDelete
}: NodeItemProps) {
  const [isOpen, setIsOpen] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(node.name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const isSelected = pathsEqual(selectedPath, path)

  useEffect(() => {
    if (isRenaming) {
      setRenameValue(node.name)
      setRenameError(null)
      setTimeout(() => inputRef.current?.select(), 0)
    }
  }, [isRenaming, node.name])

  const commitRename = () => {
    const result = validateName(renameValue)
    if (!result.valid) {
      setRenameError(result.error ?? 'Invalid name')
      return
    }
    onRename(path, renameValue.trim())
    setIsRenaming(false)
    setRenameError(null)
  }

  const cancelRename = () => {
    setIsRenaming(false)
    setRenameError(null)
    setRenameValue(node.name)
  }

  const hasChildren = node.children.length > 0

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1.5 px-1.5 py-1 rounded-md cursor-pointer select-none text-sm',
              isSelected
                ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
                : 'hover:bg-accent hover:text-foreground text-foreground/80'
            )}
            onClick={() => onSelect(path)}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen((o) => !o) }}
              className="flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              {hasChildren
                ? isOpen
                  ? <ChevronDown className="w-3 h-3" />
                  : <ChevronRight className="w-3 h-3" />
                : <span className="w-3 h-3 inline-block" />}
            </button>
            {isOpen && hasChildren
              ? <FolderOpenIcon className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
              : <FolderIcon className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />}

            {isRenaming ? (
              <div className="flex-1 flex flex-col">
                <input
                  ref={inputRef}
                  value={renameValue}
                  onChange={(e) => { setRenameValue(e.target.value); setRenameError(null) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename() }
                    if (e.key === 'Escape') cancelRename()
                  }}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  className={cn(
                    'w-full bg-background border rounded px-1 py-0 text-sm outline-none',
                    renameError ? 'border-red-500' : 'border-blue-400'
                  )}
                />
                {renameError && (
                  <span className="text-xs text-red-500 mt-0.5">{renameError}</span>
                )}
              </div>
            ) : (
              <span className="flex-1 truncate font-medium">{node.name}</span>
            )}
          </div>
        </ContextMenuTrigger>

        <ContextMenuContent className="w-44">
          <ContextMenuItem onClick={() => onAddSubfolder(path)}>
            Add Subfolder
          </ContextMenuItem>
          <ContextMenuItem onClick={() => { onSelect(path); setIsRenaming(true) }}>
            Rename
          </ContextMenuItem>
          <ContextMenuItem onClick={() => onDuplicate(path)}>
            Duplicate
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => onDelete(path)}
            className="text-red-500 focus:text-red-500"
          >
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <CollapsibleContent>
        <div className="ml-4">
          {node.children.map((child, i) => (
            <NodeItem
              key={i}
              node={child}
              path={[...path, i]}
              selectedPath={selectedPath}
              onSelect={onSelect}
              onAddSubfolder={onAddSubfolder}
              onRename={onRename}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function FolderTree({
  nodes, selectedPath, onSelect,
  onAddSubfolder, onRename, onDuplicate, onDelete
}: FolderTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No folders yet. Use "+ Folder" to add one.
      </div>
    )
  }
  return (
    <div className="space-y-0.5">
      {nodes.map((node, i) => (
        <NodeItem
          key={i}
          node={node}
          path={[i]}
          selectedPath={selectedPath}
          onSelect={onSelect}
          onAddSubfolder={onAddSubfolder}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add `rename-node` event listener to `NodeItem` in `FolderTree.tsx`**

Inside the `NodeItem` function, add this `useEffect` after the existing state declarations:

```tsx
// Listen for the Rename toolbar button's broadcast
useEffect(() => {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<number[]>).detail
    if (pathsEqual(detail, path)) setIsRenaming(true)
  }
  window.addEventListener('rename-node', handler)
  return () => window.removeEventListener('rename-node', handler)
}, [path])
```

- [ ] **Step 3: Verify tree renders in isolation**

Temporarily render `<FolderTree>` in `App.tsx` with a sample template and confirm expand/collapse, selection, right-click menu, and Rename button (via `window.dispatchEvent`) all work.

- [ ] **Step 4: Commit**

```bash
git add src/components/FolderTree.tsx
git commit -m "feat: FolderTree with recursive collapse, inline rename, right-click context menu"
```

---

## Task 10: Template editor panel

**Files:**
- Create: `src/components/TemplateEditor.tsx`

- [ ] **Step 1: Implement `src/components/TemplateEditor.tsx`**

```tsx
// src/components/TemplateEditor.tsx
import { useState, useEffect, useCallback } from 'react'
import { PlusIcon, CopyIcon, Trash2Icon, SaveIcon } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ScrollArea } from './ui/scroll-area'
import { FolderTree } from './FolderTree'
import { validateName } from '@/lib/validation'
import type { Template, FolderNode } from '@/lib/models'
import { cn } from '@/lib/utils'

// Tree mutation helpers
function addNodeAt(nodes: FolderNode[], path: number[], newNode: FolderNode): FolderNode[] {
  if (path.length === 0) return [...nodes, newNode]
  return nodes.map((n, i) =>
    i === path[0]
      ? { ...n, children: path.length === 1
          ? [...n.children, newNode]
          : addNodeAt(n.children, path.slice(1), newNode) }
      : n
  )
}

function renameNodeAt(nodes: FolderNode[], path: number[], name: string): FolderNode[] {
  return nodes.map((n, i) =>
    i === path[0]
      ? path.length === 1
        ? { ...n, name }
        : { ...n, children: renameNodeAt(n.children, path.slice(1), name) }
      : n
  )
}

function deleteNodeAt(nodes: FolderNode[], path: number[]): FolderNode[] {
  if (path.length === 1) return nodes.filter((_, i) => i !== path[0])
  return nodes.map((n, i) =>
    i === path[0] ? { ...n, children: deleteNodeAt(n.children, path.slice(1)) } : n
  )
}

function duplicateNodeAt(nodes: FolderNode[], path: number[]): FolderNode[] {
  if (path.length === 1) {
    const target = nodes[path[0]]
    const copy = JSON.parse(JSON.stringify(target)) as FolderNode
    copy.name = `${copy.name} Copy`
    return [...nodes.slice(0, path[0] + 1), copy, ...nodes.slice(path[0] + 1)]
  }
  return nodes.map((n, i) =>
    i === path[0] ? { ...n, children: duplicateNodeAt(n.children, path.slice(1)) } : n
  )
}

interface TemplateEditorProps {
  template: Template | null
  templates: Template[]
  saveSignal: number
  onSave: (t: Template) => void
  onDelete: (id: string) => void
  onDuplicate: (id: string) => void
  onDirtyChange: (dirty: boolean) => void
}

export function TemplateEditor({
  template, templates, saveSignal,
  onSave, onDelete, onDuplicate, onDirtyChange
}: TemplateEditorProps) {
  const [name, setName] = useState('')
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [selectedPath, setSelectedPath] = useState<number[] | null>(null)
  const [nameError, setNameError] = useState<string | null>(null)

  // Reset local state when selected template changes
  useEffect(() => {
    if (template) {
      setName(template.name)
      setFolders(JSON.parse(JSON.stringify(template.folders)))
      setSelectedPath(null)
      setNameError(null)
    }
  }, [template?.id])

  // Compute dirty state
  const isDirty = template
    ? name !== template.name || JSON.stringify(folders) !== JSON.stringify(template.folders)
    : false

  useEffect(() => {
    onDirtyChange(isDirty)
  }, [isDirty, onDirtyChange])

  // Name conflict check
  const nameConflict = templates.some((t) => t.name === name && t.id !== template?.id)

  const canSave = isDirty && !nameConflict && validateName(name).valid

  const handleSave = useCallback(() => {
    if (!template || !canSave) return
    onSave({ ...template, name, folders })
  }, [template, canSave, name, folders, onSave])

  // Respond to Cmd+S signal from App
  useEffect(() => {
    if (saveSignal > 0) handleSave()
  }, [saveSignal])

  // Empty state
  if (!template) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        Select or create a template to get started.
      </div>
    )
  }

  const handleAddFolder = () => {
    setFolders((prev) => [...prev, { name: 'New Folder', children: [] }])
  }

  const handleAddSubfolder = (path: number[]) => {
    setFolders((prev) => addNodeAt(prev, path, { name: 'New Folder', children: [] }))
  }

  const handleRename = (path: number[], newName: string) => {
    setFolders((prev) => renameNodeAt(prev, path, newName))
  }

  const handleDuplicateNode = (path: number[]) => {
    setFolders((prev) => duplicateNodeAt(prev, path))
  }

  const handleDeleteNode = (path: number[]) => {
    setFolders((prev) => deleteNodeAt(prev, path))
    setSelectedPath(null)
  }

  const handleNameChange = (val: string) => {
    setName(val)
    const result = validateName(val)
    if (!result.valid) {
      setNameError(result.error ?? null)
    } else if (templates.some((t) => t.name === val && t.id !== template.id)) {
      setNameError('Name already exists')
    } else {
      setNameError(null)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
        <div className="flex flex-col">
          <Input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className={cn('h-8 w-44 text-sm', nameError && 'border-red-500')}
          />
          {nameError && <span className="text-xs text-red-500 mt-0.5">{nameError}</span>}
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => onDuplicate(template.id)}>
          <CopyIcon className="w-3.5 h-3.5 mr-1.5" />
          Duplicate
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => onDelete(template.id)}
        >
          <Trash2Icon className="w-3.5 h-3.5 mr-1.5" />
          Delete
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={!canSave}
        >
          <SaveIcon className="w-3.5 h-3.5 mr-1.5" />
          Save
        </Button>
      </div>

      {/* Tree area */}
      <ScrollArea className="flex-1 px-3 py-2">
        <FolderTree
          nodes={folders}
          selectedPath={selectedPath}
          onSelect={setSelectedPath}
          onAddSubfolder={handleAddSubfolder}
          onRename={handleRename}
          onDuplicate={handleDuplicateNode}
          onDelete={handleDeleteNode}
        />
      </ScrollArea>

      {/* Action bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 border-t border-border">
        <Button variant="outline" size="sm" onClick={handleAddFolder}>
          <PlusIcon className="w-3 h-3 mr-1" />
          Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!selectedPath}
          onClick={() => selectedPath && handleAddSubfolder(selectedPath)}
        >
          <PlusIcon className="w-3 h-3 mr-1" />
          Subfolder
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!selectedPath}
          onClick={() => {
            if (selectedPath) {
              // Trigger inline rename via a ref would be cleaner;
              // for simplicity, dispatch a custom event FolderTree listens to
              window.dispatchEvent(new CustomEvent('rename-node', { detail: selectedPath }))
            }
          }}
        >
          Rename
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!selectedPath}
          className="text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-950"
          onClick={() => selectedPath && handleDeleteNode(selectedPath)}
        >
          Remove
        </Button>
        <div className="flex-1" />
        <GenerateProjectButton template={{ ...template, name, folders }} />
      </div>
    </div>
  )
}

// Inline import to avoid circular dependency
import { GenerateDialog } from './GenerateDialog'

function GenerateProjectButton({ template }: { template: Template }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Create Project
      </Button>
      <GenerateDialog template={template} open={open} onClose={() => setOpen(false)} />
    </>
  )
}
```

- [ ] **Step 2: Verify in browser**

```bash
npm run dev
```

Check: toolbar renders, name field edits update dirty state, Save button enables, tree mutations work (add/rename/delete/duplicate via context menu).

- [ ] **Step 3: Commit**

```bash
git add src/components/TemplateEditor.tsx src/components/FolderTree.tsx
git commit -m "feat: TemplateEditor with toolbar, tree mutations, dirty tracking, and save"
```

---

## Task 11: Generate / Create Project dialog

**Files:**
- Create: `src/components/GenerateDialog.tsx`

- [ ] **Step 1: Implement `src/components/GenerateDialog.tsx`**

```tsx
// src/components/GenerateDialog.tsx
import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { createProject } from '@/lib/generate'
import { validateName } from '@/lib/validation'
import { useToast } from './ui/use-toast'
import type { Template } from '@/lib/models'
import { cn } from '@/lib/utils'

interface GenerateDialogProps {
  template: Template
  open: boolean
  onClose: () => void
}

export function GenerateDialog({ template, open: isOpen, onClose }: GenerateDialogProps) {
  const [projectName, setProjectName] = useState('')
  const [destination, setDestination] = useState('')
  const [projectNameError, setProjectNameError] = useState<string | null>(null)
  const [destError, setDestError] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const { toast } = useToast()

  const handleBrowse = async () => {
    const selected = await open({ directory: true, multiple: false })
    if (typeof selected === 'string') setDestination(selected)
  }

  const handleProjectNameChange = (val: string) => {
    setProjectName(val)
    const result = validateName(val)
    setProjectNameError(result.valid ? null : (result.error ?? 'Invalid name'))
  }

  const canCreate =
    validateName(projectName).valid &&
    destination.trim().length > 0 &&
    !isCreating

  const handleCreate = async () => {
    if (!canCreate) return
    setIsCreating(true)
    setDestError(null)
    try {
      const result = await createProject(template, projectName.trim(), destination)
      toast({ title: 'Project created', description: result.path })
      onClose()
      setProjectName('')
      setDestination('')
    } catch (err: unknown) {
      const e = err as { code: string; message?: string }
      if (e.code === 'EXISTS') {
        setDestError('A folder at this path already exists')
      } else {
        setDestError(`Could not create project: ${e.message ?? 'Unknown error'}`)
      }
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Scaffold a folder structure from <strong>{template.name}</strong>
          </p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              placeholder="my-new-project"
              value={projectName}
              onChange={(e) => handleProjectNameChange(e.target.value)}
              className={cn(projectNameError && 'border-red-500')}
            />
            {projectNameError && (
              <p className="text-xs text-red-500">{projectNameError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="destination">Destination folder</Label>
            <div className="flex gap-2">
              <Input
                id="destination"
                placeholder="Choose a folder..."
                value={destination}
                readOnly
                className={cn('flex-1', destError && 'border-red-500')}
              />
              <Button variant="outline" size="sm" onClick={handleBrowse}>
                Browse
              </Button>
            </div>
            {destError && <p className="text-xs text-red-500">{destError}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!canCreate}>
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Add `Label` component if not already installed**

```bash
npx shadcn@latest add label
```

- [ ] **Step 3: Verify dialog end-to-end**

```bash
npm run tauri dev
```

1. Select a template with some folders
2. Click **Create Project**
3. Enter a project name and browse to a destination
4. Click **Create** → folders should appear on disk, toast shows path
5. Try the same name again → "folder already exists" error appears

- [ ] **Step 4: Commit**

```bash
git add src/components/GenerateDialog.tsx
git commit -m "feat: GenerateDialog with project name, folder picker, error handling, and toast"
```

---

## Task 12: Tauri configuration (permissions + window)

**Files:**
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Update `src-tauri/tauri.conf.json`**

```json
{
  "app": {
    "windows": [
      {
        "title": "ProjectCreator",
        "width": 900,
        "height": 600,
        "minWidth": 700,
        "minHeight": 450
      }
    ]
  },
  "bundle": {
    "identifier": "com.projectcreator.app"
  },
  "plugins": {
    "fs": {
      "scope": {
        "allow": [
          "$HOME/.projectcreator",
          "$HOME/.projectcreator/**",
          "$DESKTOP/**",
          "$DOCUMENT/**",
          "$HOME/**"
        ]
      }
    }
  },
  "security": {
    "capabilities": [
      {
        "identifier": "default",
        "description": "Default capabilities",
        "windows": ["main"],
        "permissions": [
          "core:default",
          "fs:allow-read-file",
          "fs:allow-write-file",
          "fs:allow-mkdir",
          "fs:allow-exists",
          "dialog:allow-open",
          "path:allow-resolve"
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Verify Tauri dev app still launches**

```bash
npm run tauri:dev
```

Expected: app window opens at 900×600, resizable, minimum 700×450.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/tauri.conf.json
git commit -m "chore: configure Tauri permissions, fs scope, and window min size"
```

---

## Task 13: End-to-end verification

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

Expected: all tests in models, validation, store, generate pass with no failures.

- [ ] **Step 2: Manual smoke test in Tauri dev**

```bash
npm run tauri:dev
```

Run through the full feature checklist:

- [ ] Create a new template → appears in sidebar
- [ ] Rename template via name input → Save enables → Cmd+S saves
- [ ] Duplicate template → copy appears with "Copy" suffix
- [ ] Delete template → adjacent template auto-selected
- [ ] Switch away from dirty template → discard prompt appears
- [ ] Create new template while dirty → discard prompt appears
- [ ] Add folders and subfolders via buttons
- [ ] Right-click folder → Add Subfolder, Rename, Duplicate, Delete all work
- [ ] Inline rename: Enter commits, Escape cancels, blur commits, invalid name stays open
- [ ] Toggle light/dark → persists after app restart
- [ ] Create Project → valid inputs → folders created on disk → toast shown
- [ ] Create Project → existing path → error message shown
- [ ] Window resize stops at 700×450 minimum

- [ ] **Step 3: Commit final verification**

```bash
git add -A
git commit -m "chore: end-to-end verification complete"
```

---

## Task 14: Production build

- [ ] **Step 1: Build for current platform**

```bash
npm run tauri:build
```

Expected: produces `.dmg` (macOS) or `.exe` installer (Windows) in `src-tauri/target/release/bundle/`

- [ ] **Step 2: Smoke test the built app**

Open the built binary, confirm it runs standalone (no dev server), all features work, theme persists.

- [ ] **Step 3: Final commit**

```bash
git add src-tauri/target/release/bundle/.gitkeep 2>/dev/null || true
git commit -m "chore: production build verified" --allow-empty
```

---

## Summary

| Task | Deliverable |
|------|-------------|
| 1 | Tauri + Vite + React scaffold |
| 2 | shadcn/ui New York + Tailwind |
| 3 | `models.ts` + tests |
| 4 | `validation.ts` + tests |
| 5 | `store.ts` + tests |
| 6 | `generate.ts` + tests |
| 7 | App shell, theme, layout |
| 8 | TemplateList sidebar |
| 9 | FolderTree + context menu + inline rename |
| 10 | TemplateEditor panel |
| 11 | GenerateDialog |
| 12 | Tauri config |
| 13 | End-to-end verification |
| 14 | Production build |
