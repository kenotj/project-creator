# ProjectCreator — Design Spec
Date: 2026-03-25

## Overview

Rework `ProjectCreator.py` into an interactive desktop GUI application that lets the user define reusable folder-structure templates and generate project directories from them. Runs on macOS and Windows. Minimum Python version: **3.8**.

## Goals

- Define, save, and manage named folder-structure templates inside the app
- Generate project folders/subfolders on disk from a chosen template
- Single-file Python script with minimal dependencies
- Works identically on macOS and Windows

## Non-Goals

- No file content generation (only folder structure)
- No network/cloud sync
- No drag-and-drop reordering
- No full keyboard accessibility (v1)

---

## UI Layout

### Left Panel — `TemplateListPanel`

- Scrollable list of saved template names
- Buttons: `+ New`, `Duplicate`, `Delete`
- Clicking a name selects that template and loads it into the right panel

**Unsaved changes guard:** if the right panel is dirty (see Dirty State below), selecting a different template or clicking `Delete` shows a confirmation dialog: "You have unsaved changes. Discard and continue?" Confirmed → discard and proceed. Cancelled → do nothing.

**Empty state:** right panel is disabled with hint text "Select or create a template to get started."

**`+ New`:** creates a blank template named "New Template" (or "New Template 2", "New Template 3" etc. if that name is taken), loads it into the right panel. A brand-new template is considered **dirty from the moment it is created**, so switching away from it without saving triggers the unsaved-changes guard.

**`Duplicate`:** copies the last *saved* state of the selected template. Naming algorithm: try `"<original_name> Copy"` first; if taken, try `"<original_name> Copy 2"`, `"<original_name> Copy 3"`, etc. (always appended to the *original* name, never chained). Determine the available name before writing. The duplicate becomes the active selection and is immediately saved to disk (starts clean, not dirty).

**`Delete`:** if the right panel is dirty, show the unsaved-changes confirmation first ("Discard unsaved changes?"). If confirmed (or if panel is clean), then show the delete confirmation ("Delete this template?"). If the user confirms delete, remove the template and select the next item in the list; if none remain, return to empty state.

**Duplicate template names:** not allowed. The name conflict is caught at the moment of save or duplicate, not during typing.

---

### Right Panel — `TemplateEditorPanel`

**Template name field (top):**
- Renames the template itself (not a folder)
- The list panel reflects the name change only after `Save Template` is clicked (not live)
- An empty name or a name that matches another template's saved name disables `Save Template` (an inline error label appears)

**Tree view (`ttk.Treeview`):**
- Shows folder hierarchy, expandable/collapsible
- Styled (background, foreground, font) to visually match the active `customtkinter` theme
- On template load: tree is fully collapsed and scroll position is reset to the first row

**Buttons:**
- `Add Folder` — appends a new top-level node named `"New Folder"`, selects it, enters inline rename mode
- `Add Subfolder` — **disabled when no node is selected**; when a node is selected, appends a child named `"New Folder"`, selects it, enters inline rename mode
- `Rename` — enters inline rename mode for the selected node; **disabled when no node is selected**
- `Delete` (folder) — removes the selected node and all its children. If the deleted node had a parent, select the parent. If it was a top-level node, select the next sibling; if no next sibling, select the previous sibling; if none, clear the selection.

**Inline rename mode:**
- A `tkinter.Entry` widget is dynamically sized and positioned over the selected tree cell using `treeview.bbox(item, column)` to get pixel coordinates, then placed with `place()`. This is the one case where pixel values from widget geometry are used — this is intentional and does not conflict with the "no hardcoded panel sizes" principle, which applies to fixed widths/heights on layout containers.
- Width: matches the bounding box width of the cell
- If the row has scrolled out of view, bbox returns empty string — in that case, cancel rename silently and do nothing
- **Commit:** `Enter` key or focus-out (clicking elsewhere). On commit, trim the value, validate (non-empty, no illegal chars). If invalid: shake/highlight the Entry and keep it open with an error label below. If valid: apply the name to the node.
- **Cancel:** `Escape` key restores the original name and removes the Entry

**`Save Template`:**
- Persists current name + tree state to `TemplateStore`, writes JSON to disk, marks panel as clean
- **Disabled when:** panel is clean, name is empty, or name conflicts with another saved template
- **`Ctrl+S` (Windows) / `Cmd+S` (macOS):** bound app-wide. If a rename Entry is currently open, commit it first, then trigger Save. If commit fails validation, Save does not proceed.

---

### Bottom Bar

**`Generate Project` button:**

Opens a dialog with:
1. **Project Name** — text field; validated live (empty or illegal chars → `Generate` button disabled + inline error)
2. **Destination** — read-only field showing selected path + `Browse…` button; `tkinter.filedialog.askdirectory` (no manual path typing). No destination selected → `Generate` button disabled.

On `Generate`:
1. Validate project name
2. Check `Path(destination) / project_name` — if it exists → error dialog, abort, nothing written
3. `os.makedirs(root_path)` to create root
4. Recursively walk `FolderNode` tree calling `os.makedirs` for each node
5. On complete success → confirmation dialog: "Project created at: `<full_path>`"
6. On any failure mid-write → error dialog showing the OS error message and the path that failed; **already-created subdirectories are left as-is** (no rollback)

**Empty template:** creates the root folder only (no error, no warning).

---

## Dirty State

The right panel is **dirty** when any of the following has changed since the last save (or since the template was created/loaded):
- The template name field differs from the saved name
- Any folder node has been added, deleted, or renamed
- The tree structure (parent-child relationships) has changed

`Save Template` → clean. Loading a different template (or creating new one) → clean, but only after the discard confirmation if currently dirty.

---

## Data Model

```python
@dataclass
class FolderNode:
    name: str
    children: list['FolderNode']

@dataclass
class Template:
    name: str
    folders: list[FolderNode]
```

### JSON Storage

File: `~/.projectcreator/templates.json` (via `pathlib.Path.home()`)
Created automatically on first save. If missing or malformed → start with empty list, no crash.

Top-level: JSON array of template objects. Each template has exactly two keys: `"name"` (string) and `"folders"` (array). Each folder node has exactly two keys: `"name"` (string) and `"children"` (array of folder nodes). No other keys.

```json
[
  {
    "name": "Video Project",
    "folders": [
      {
        "name": "01. Input",
        "children": [
          { "name": "Day 01", "children": [] },
          { "name": "Day 02", "children": [] }
        ]
      },
      { "name": "02. Output", "children": [] }
    ]
  }
]
```

Nesting depth: unbounded.

---

## Validation Rules

Applied to **all folder names, the template name, and the project name**:
- Non-empty after stripping whitespace
- Does not contain any of: `\ / : * ? " < > |` (Windows superset; covers macOS)
- Value is trimmed before saving

**Duplicate sibling folder names:** two nodes at the same level under the same parent may not share a name (they would collide on disk). This is caught at **inline rename commit** — if the new name already exists among siblings, the Entry stays open with an inline error. Duplicate template names (at the template list level) are caught at Save/Duplicate, not during typing.

---

## Architecture

| Class | Responsibility |
|---|---|
| `FolderNode` | Recursive data model for a folder and its children |
| `TemplateStore` | Load/save JSON; CRUD on templates |
| `TemplateListPanel` | Left panel — list, selection, new/duplicate/delete |
| `TemplateEditorPanel` | Right panel — name field, tree editor, save button |
| `App` | Main window; wires panels together, owns bottom bar, app-wide key bindings |

**Layout:** no hardcoded pixel sizes on layout containers; use `grid`/`pack` weights and padding for HiDPI compatibility. Exception: dynamic pixel values derived from `widget.bbox()` for the inline rename Entry overlay.

**Path handling:** `pathlib.Path` for all file I/O. No string path concatenation.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| `templates.json` missing or malformed | Start with empty list, no crash |
| Project root folder already exists | Error dialog; nothing written |
| Invalid folder or project name | Inline error; action blocked |
| Duplicate template name | Inline error; Save disabled |
| Unsaved changes on template switch/delete | Confirmation dialog |
| Partial write failure during generation | Error dialog; created dirs left as-is |

---

## Dependencies

| Package | Purpose | Install |
|---|---|---|
| `customtkinter` | Modern-looking theme | `pip install customtkinter` |
| `tkinter` + `ttk` | GUI base + Treeview | Built into Python 3.8+ |
| `json`, `pathlib`, `os`, `dataclasses` | Data / filesystem | stdlib |

---

## Success Criteria

1. A template with nested folders persists across app restarts
2. Generating into an existing folder shows an error dialog and leaves disk unchanged
3. `Generate Project` creates the exact folder structure on disk matching the template tree
4. Success dialog shows the correct full path after generation
5. Invalid folder/project names are rejected inline; Save/Generate is disabled
6. Duplicate template names are rejected; `Save Template` is disabled
7. Switching or deleting a template with unsaved changes (including a new unsaved template) shows a confirmation dialog
8. `Ctrl+S` / `Cmd+S` saves the template (committing any open inline rename first)
9. `Add Subfolder` and `Rename` buttons are disabled when no tree node is selected
10. Inline rename commits on Enter/focus-out, cancels on Escape
11. All file I/O uses `pathlib.Path`; app runs without code changes on macOS and Windows
