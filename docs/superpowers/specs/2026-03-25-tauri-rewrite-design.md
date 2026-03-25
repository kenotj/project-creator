# ProjectCreator — Tauri Rewrite Design

**Date:** 2026-03-25
**Status:** Approved

---

## Context

ProjectCreator is currently a Python desktop app (tkinter + customtkinter, ~800 lines). The goal is to convert it into a cross-platform Tauri app with a React + shadcn/ui frontend, preserving all existing features while upgrading the UI to a modern, polished design. The Python file is kept as reference but is no longer the active app.

---

## Approach

Scaffold Tauri into the existing repo (Approach A). All business logic moves to TypeScript using Tauri's built-in FS/Dialog/Path APIs — no custom Rust code required. The frontend is React + Vite + shadcn/ui (New York style). Existing Python tests are ported to Vitest.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri v2 |
| Frontend framework | React 18 + Vite |
| UI components | shadcn/ui (New York style, dark + light) |
| Styling | Tailwind CSS v4 |
| Language | TypeScript |
| Tests | Vitest |
| FS / Dialog / Path | `@tauri-apps/plugin-fs`, `@tauri-apps/plugin-dialog`, `@tauri-apps/api/path` |

---

## Repo Structure

```
project-creator/
  src/
    components/
      AppLayout.tsx         — root layout, wires sidebar + editor
      TemplateList.tsx      — compact sidebar with template list
      TemplateEditor.tsx    — editor panel with toolbar + tree + action bar
      FolderTree.tsx        — recursive collapsible tree with inline rename
      GenerateDialog.tsx    — modal: project name + destination + create
    lib/
      models.ts             — FolderNode, Template types
      store.ts              — TemplateStore: CRUD + JSON persistence via Tauri fs
      validation.ts         — validateName(): empty/whitespace/illegal chars
      generate.ts           — createProject(): recursive mkdir via Tauri fs
    App.tsx                 — top-level state, theme, Cmd/Ctrl+S shortcut
    main.tsx
  src-tauri/
    tauri.conf.json
    Cargo.toml
    src/main.rs             — Tauri boilerplate only, no custom commands
  tests/
    models.test.ts
    store.test.ts
    validation.test.ts
    generate.test.ts
  ProjectCreator.py         — kept as reference, not the active app
  package.json
  vite.config.ts
  tsconfig.json
```

---

## Layout — Compact Sidebar (Layout B)

```
┌─────────────────────────────────────────────────────┐
│ TEMPLATES         [☀️/🌙 toggle]                    │  ← sidebar header
│─────────────────────────────────────────────────────│
│ ● My Project    │  [Name input] [Duplicate][Delete][Save] │  ← toolbar
│   Web App       │─────────────────────────────────────────│
│   API Service   │  ▼ src                                  │
│                 │    ▼ components  ← right-click menu     │
│                 │      ui                                  │
│                 │      hooks                               │
│                 │    utils                                 │
│                 │  public                                  │
│─────────────────│─────────────────────────────────────────│
│ [+ New Template]│  [+Folder][+Subfolder][Rename][Remove]  [Create Project→] │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## UI Details

### Theme
- shadcn/ui **New York** style, dark `#09090b` background
- Light/dark toggle: pill switch with ☀️ (left) and 🌙 (right) inside; thumb slides left = light, right = dark; track turns blue in dark mode
- Persisted to `localStorage`

### Buttons
- Standard (1×) height for all action buttons
- shadcn `Button` variant: `outline` for secondary, `default` (blue) for Create Project, `destructive` for Delete/Remove

### Template Sidebar
- Selected template: blue highlight (`bg-blue-50 border-blue-200` light / `bg-blue-950 border-blue-800` dark)
- Blue dot indicator on active template
- `+ New Template` button pinned to sidebar footer

### Tree Editor
- Recursive `FolderTree` component using `@radix-ui/react-collapsible`
- Selected node highlighted in blue
- Inline rename: click Rename or context menu → node becomes an `<input>`, Enter commits, Escape cancels, clicking away (blur) also commits
- On commit, validate name: empty/illegal chars or duplicate sibling name shows a red input border and inline error below the node; the input stays open until the user corrects it or presses Escape to revert
- Right-click context menu (shadcn `DropdownMenu`):
  - Add Subfolder
  - Rename
  - Duplicate
  - — separator —
  - Delete (red)

### Toolbar
- Template name editable input (left)
- Duplicate, Delete, Save buttons (right)
- Save disabled + dimmed when no unsaved changes
- If the template name field matches an existing template name (other than itself), the Save button stays disabled and the name input shows a red border with an inline error: "Name already exists"

### Empty State
- When no template is selected, the editor panel shows a centered hint: "Select or create a template to get started."
- All bottom action bar buttons are disabled in this state

### After Delete
- After deleting a template, auto-select the next closest template in the list (previous item, or next if none); if the list is empty, clear the editor to the empty state

### Bottom Action Bar
- `+ Folder`, `+ Subfolder`, `Rename`, `Remove` (left)
- `Create Project` blue button (right)
- `+ Folder` and `Create Project` disabled when no template selected; `+ Folder` does NOT require a node to be selected (appends to tree root)
- `+ Subfolder`, `Rename`, `Remove` require both a template AND a tree node to be selected

### Create Project Dialog (shadcn `Dialog`)
- Project name field with real-time validation (illegal chars, empty)
- Destination folder field + `Browse` button (native folder picker via `plugin-dialog`)
- `Create` button disabled until both fields are valid
- `createProject()` returns `{ ok: true, path: string }` on success or throws a typed `ProjectError`:
  - `{ code: 'EXISTS' }` — target path already exists
  - `{ code: 'UNKNOWN', message: string }` — permission denied, disk full, etc.
- Success: toast notification showing the full path created
- `EXISTS` error: inline error below the destination field — "A folder at this path already exists"
- `UNKNOWN` error: inline error below the destination field — "Could not create project: \<message\>"

---

## Data Model (TypeScript port of Python)

```ts
interface FolderNode {
  name: string
  children: FolderNode[]
}

interface Template {
  id: string        // uuid — generated on load if missing (legacy migration)
  name: string
  folders: FolderNode[]
}
```

Persistence: `~/.projectcreator/templates.json` (same path as Python app).

**Legacy migration:** `loadTemplates()` assigns a `crypto.randomUUID()` to any record missing an `id`, then immediately re-saves the file. This is a one-time migration that preserves all existing template data.

---

## Logic Layer (lib/)

| Module | Responsibilities |
|--------|-----------------|
| `models.ts` | Types + serialization helpers |
| `store.ts` | `loadTemplates()`, `saveTemplates()`, `addTemplate()`, `updateTemplate()`, `deleteTemplate()`, `duplicateTemplate()`, `uniqueName()` |
| `validation.ts` | `validateName(name)` → `{ valid: boolean, error?: string }` |
| `generate.ts` | `createProject(template, projectName, destDir)` → recursive `mkdir` via `@tauri-apps/plugin-fs` |

---

## State Management

- `App.tsx` owns: `templates[]`, `selectedId`, `isDirty`, `theme`
- `TemplateEditor` manages local pending tree state (name input + tree edits) and reports `isDirty` upward via an `onDirtyChange(isDirty: boolean)` callback prop — `App.tsx` sets its own `isDirty` from this callback
- Unsaved-changes guard: before switching template, deleting the active template (via toolbar Delete), OR creating a new template (sidebar "+ New Template"), prompt "You have unsaved changes. Discard them?" if `isDirty`
- Duplicate (toolbar) operates on the last-saved version of the template and does NOT trigger the unsaved-changes guard
- Keyboard shortcut: `Cmd+S` / `Ctrl+S` triggers save

---

## Tests (Vitest — port of Python test suite)

| File | Coverage |
|------|---------|
| `models.test.ts` | FolderNode serialization, round-trips |
| `validation.test.ts` | Empty/whitespace/illegal chars, valid names |
| `store.test.ts` | CRUD, persistence, unique naming, malformed JSON handling |
| `generate.test.ts` | Empty template, nested structure, `EXISTS` error, `UNKNOWN` error |

---

## Tauri Permissions Required

```json
{
  "permissions": [
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-mkdir",
    "fs:allow-exists",
    "dialog:allow-open",
    "path:allow-resolve"
  ],
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
}
```

## Window Configuration

Minimum size: `minWidth: 700, minHeight: 450` (matching the Python app). Set in `tauri.conf.json` under `windows[0]`.

---

## Verification

1. `npm run tauri dev` — app opens, both panels render
2. Create / rename / duplicate / delete a template
3. Add folders and subfolders via buttons and context menu
4. Inline rename via context menu (Enter to commit, Esc to cancel)
5. Unsaved-changes guard triggers when switching templates dirty
6. Cmd+S saves
7. Create Project dialog: validation, Browse picker, successful mkdir
8. Toggle light/dark — persists on restart
9. `npm run test` — all Vitest tests pass
10. Build: `npm run tauri build` — produces macOS `.dmg` and Windows `.exe`
