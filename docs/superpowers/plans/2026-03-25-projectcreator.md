# ProjectCreator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite `ProjectCreator.py` as a cross-platform desktop GUI app (macOS + Windows) that lets users create, save, and manage folder-structure templates and generate project directories from them.

**Architecture:** Single Python file (`ProjectCreator.py`) split into two layers: a pure-Python business logic layer (FolderNode, Template, TemplateStore, validate_name, generate_project) that is fully unit-tested, and a GUI layer (TemplateListPanel, TemplateEditorPanel, App) built on customtkinter + ttk.Treeview. Templates are persisted as JSON at `~/.projectcreator/templates.json` using pathlib throughout.

**Tech Stack:** Python 3.8+, customtkinter, tkinter + ttk, json, pathlib, dataclasses, pytest

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `ProjectCreator.py` | Rewrite | Main app — business logic + GUI (single file) |
| `tests/__init__.py` | Create | Makes tests a package |
| `tests/test_logic.py` | Create | Unit tests for all non-GUI logic |

All paths below are relative to:
`~/Library/CloudStorage/GoogleDrive-kennethotj@gmail.com/My Drive/01. PAIPAI/Projects/`

---

## Task 1: Bootstrap

**Files:**
- Create: `tests/__init__.py`
- Create: `tests/test_logic.py`

- [ ] **Step 1: Install dependencies**

```bash
pip install customtkinter pytest
```

Expected: both install without error.

- [ ] **Step 2: Create the tests package**

Create `tests/__init__.py` (empty file).

- [ ] **Step 3: Write a placeholder test to verify pytest works**

Create `tests/test_logic.py`:

```python
def test_bootstrap():
    assert True
```

- [ ] **Step 4: Run tests**

```bash
cd "/Users/kennethong/Library/CloudStorage/GoogleDrive-kennethotj@gmail.com/My Drive/01. PAIPAI/Projects"
pytest tests/ -v
```

Expected: `1 passed`.

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "feat: add test bootstrap for ProjectCreator"
```

---

## Task 2: FolderNode data model

**Files:**
- Create: `ProjectCreator.py` (initial skeleton)
- Modify: `tests/test_logic.py`

- [ ] **Step 1: Write failing tests for FolderNode**

Replace `tests/test_logic.py` with:

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from ProjectCreator import FolderNode


def test_foldernode_leaf_roundtrip():
    node = FolderNode(name="Output", children=[])
    d = node.to_dict()
    assert d == {"name": "Output", "children": []}
    restored = FolderNode.from_dict(d)
    assert restored.name == "Output"
    assert restored.children == []


def test_foldernode_nested_roundtrip():
    child = FolderNode(name="Day 01", children=[])
    parent = FolderNode(name="Input", children=[child])
    d = parent.to_dict()
    assert d == {"name": "Input", "children": [{"name": "Day 01", "children": []}]}
    restored = FolderNode.from_dict(d)
    assert restored.name == "Input"
    assert len(restored.children) == 1
    assert restored.children[0].name == "Day 01"


def test_foldernode_from_dict_missing_children():
    # children key may be absent in hand-edited JSON
    node = FolderNode.from_dict({"name": "Docs"})
    assert node.children == []
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_logic.py -v
```

Expected: ImportError (ProjectCreator doesn't exist yet).

- [ ] **Step 3: Create ProjectCreator.py with FolderNode**

Create `ProjectCreator.py`:

```python
"""ProjectCreator — folder-structure template manager."""
from __future__ import annotations

import copy
import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional


# ---------------------------------------------------------------------------
# Data model
# ---------------------------------------------------------------------------

@dataclass
class FolderNode:
    name: str
    children: List["FolderNode"] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {"name": self.name, "children": [c.to_dict() for c in self.children]}

    @staticmethod
    def from_dict(d: dict) -> "FolderNode":
        return FolderNode(
            name=d["name"],
            children=[FolderNode.from_dict(c) for c in d.get("children", [])],
        )


@dataclass
class Template:
    name: str
    folders: List[FolderNode] = field(default_factory=list)
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_logic.py -v
```

Expected: `3 passed`.

- [ ] **Step 5: Commit**

```bash
git add ProjectCreator.py tests/test_logic.py
git commit -m "feat: add FolderNode data model with serialization"
```

---

## Task 3: validate_name

**Files:**
- Modify: `ProjectCreator.py`
- Modify: `tests/test_logic.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_logic.py`:

```python
from ProjectCreator import validate_name


def test_valid_name():
    ok, msg = validate_name("01. Input")
    assert ok is True
    assert msg == ""


def test_empty_name_invalid():
    ok, msg = validate_name("   ")
    assert ok is False
    assert "empty" in msg.lower()


def test_illegal_char_slash():
    ok, msg = validate_name("my/folder")
    assert ok is False


def test_illegal_char_colon():
    ok, msg = validate_name("C:drive")
    assert ok is False


def test_illegal_chars_all():
    illegal = ['\\', '/', ':', '*', '?', '"', '<', '>', '|']
    for ch in illegal:
        ok, _ = validate_name(f"name{ch}here")
        assert ok is False, f"Expected False for char: {ch!r}"


def test_name_is_trimmed():
    ok, msg = validate_name("  valid  ")
    assert ok is True  # leading/trailing spaces are stripped before validation
```

- [ ] **Step 2: Run — verify fail**

```bash
pytest tests/test_logic.py::test_valid_name -v
```

Expected: ImportError (validate_name not defined).

- [ ] **Step 3: Implement validate_name in ProjectCreator.py**

Add after the `Template` dataclass:

```python
# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

_ILLEGAL_CHARS = set('\\/: *?"<>|')


def validate_name(name: str):
    """Return (True, '') if valid, else (False, error_message)."""
    stripped = name.strip()
    if not stripped:
        return False, "Name cannot be empty."
    for ch in stripped:
        if ch in _ILLEGAL_CHARS:
            return False, f"Illegal character: '{ch}'"
    return True, ""
```

- [ ] **Step 4: Run — verify pass**

```bash
pytest tests/test_logic.py -v
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ProjectCreator.py tests/test_logic.py
git commit -m "feat: add validate_name with illegal character rules"
```

---

## Task 4: TemplateStore

**Files:**
- Modify: `ProjectCreator.py`
- Modify: `tests/test_logic.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_logic.py`:

```python
import tempfile
from ProjectCreator import TemplateStore, Template, FolderNode


def _make_store():
    """Create a TemplateStore backed by a temp file."""
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False)
    tmp.close()
    path = Path(tmp.name)
    path.unlink()  # store should handle non-existent file
    return TemplateStore(path=path)


def test_store_empty_on_missing_file():
    store = _make_store()
    assert store.get_names() == []


def test_store_add_and_get():
    store = _make_store()
    t = Template(name="Video Project", folders=[FolderNode(name="Input", children=[])])
    store.add(t)
    assert "Video Project" in store.get_names()
    retrieved = store.get("Video Project")
    assert retrieved is not None
    assert retrieved.folders[0].name == "Input"


def test_store_persists_across_instances():
    store = _make_store()
    path = store.path
    store.add(Template(name="Persistent", folders=[]))
    store2 = TemplateStore(path=path)
    assert "Persistent" in store2.get_names()


def test_store_update():
    store = _make_store()
    store.add(Template(name="Old Name", folders=[]))
    store.update("Old Name", Template(name="New Name", folders=[]))
    assert "New Name" in store.get_names()
    assert "Old Name" not in store.get_names()


def test_store_delete():
    store = _make_store()
    store.add(Template(name="ToDelete", folders=[]))
    store.delete("ToDelete")
    assert "ToDelete" not in store.get_names()


def test_store_has_name():
    store = _make_store()
    store.add(Template(name="Exists", folders=[]))
    assert store.has_name("Exists") is True
    assert store.has_name("Missing") is False


def test_unique_copy_name_no_conflict():
    store = _make_store()
    store.add(Template(name="MyTemplate", folders=[]))
    assert store.unique_copy_name("MyTemplate") == "MyTemplate Copy"


def test_unique_copy_name_conflict():
    store = _make_store()
    store.add(Template(name="MyTemplate", folders=[]))
    store.add(Template(name="MyTemplate Copy", folders=[]))
    assert store.unique_copy_name("MyTemplate") == "MyTemplate Copy 2"


def test_unique_new_name_no_conflict():
    store = _make_store()
    assert store.unique_new_name() == "New Template"


def test_unique_new_name_conflict():
    store = _make_store()
    store.add(Template(name="New Template", folders=[]))
    assert store.unique_new_name() == "New Template 2"


def test_store_malformed_json_starts_empty():
    tmp = tempfile.NamedTemporaryFile(suffix=".json", delete=False, mode="w")
    tmp.write("not valid json {{")
    tmp.close()
    store = TemplateStore(path=Path(tmp.name))
    assert store.get_names() == []
```

- [ ] **Step 2: Run — verify fail**

```bash
pytest tests/test_logic.py -k "store" -v
```

Expected: ImportError (TemplateStore not defined).

- [ ] **Step 3: Implement TemplateStore in ProjectCreator.py**

Add after the validation section:

```python
# ---------------------------------------------------------------------------
# Template store
# ---------------------------------------------------------------------------

_STORE_PATH = Path.home() / ".projectcreator" / "templates.json"


class TemplateStore:
    def __init__(self, path: Path = _STORE_PATH):
        self.path = path
        self.templates: List[Template] = []
        self._load()

    # -- persistence ---------------------------------------------------------

    def _load(self):
        if not self.path.exists():
            self.templates = []
            return
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
            self.templates = [
                Template(
                    name=t["name"],
                    folders=[FolderNode.from_dict(f) for f in t.get("folders", [])],
                )
                for t in data
            ]
        except Exception:
            self.templates = []

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(
                [{"name": t.name, "folders": [f.to_dict() for f in t.folders]}
                 for t in self.templates],
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )

    # -- CRUD ----------------------------------------------------------------

    def get_names(self) -> List[str]:
        return [t.name for t in self.templates]

    def get(self, name: str) -> Optional[Template]:
        for t in self.templates:
            if t.name == name:
                return t
        return None

    def add(self, template: Template):
        self.templates.append(template)
        self._save()

    def update(self, old_name: str, template: Template):
        for i, t in enumerate(self.templates):
            if t.name == old_name:
                self.templates[i] = template
                self._save()
                return
        raise KeyError(f"Template '{old_name}' not found")

    def delete(self, name: str):
        self.templates = [t for t in self.templates if t.name != name]
        self._save()

    def has_name(self, name: str) -> bool:
        return any(t.name == name for t in self.templates)

    # -- naming helpers ------------------------------------------------------

    def unique_copy_name(self, original_name: str) -> str:
        candidate = f"{original_name} Copy"
        if not self.has_name(candidate):
            return candidate
        i = 2
        while self.has_name(f"{original_name} Copy {i}"):
            i += 1
        return f"{original_name} Copy {i}"

    def unique_new_name(self) -> str:
        candidate = "New Template"
        if not self.has_name(candidate):
            return candidate
        i = 2
        while self.has_name(f"New Template {i}"):
            i += 1
        return f"New Template {i}"
```

- [ ] **Step 4: Run — verify pass**

```bash
pytest tests/test_logic.py -v
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ProjectCreator.py tests/test_logic.py
git commit -m "feat: add TemplateStore with JSON persistence and naming helpers"
```

---

## Task 5: generate_project logic

**Files:**
- Modify: `ProjectCreator.py`
- Modify: `tests/test_logic.py`

- [ ] **Step 1: Write failing tests**

Append to `tests/test_logic.py`:

```python
import tempfile
from ProjectCreator import generate_project, FolderNode


def test_generate_empty_template_creates_root():
    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "MyProject"
        generate_project(dest, folders=[])
        assert dest.is_dir()


def test_generate_creates_nested_folders():
    with tempfile.TemporaryDirectory() as tmp:
        folders = [
            FolderNode("Input", [
                FolderNode("Day 01", []),
                FolderNode("Day 02", []),
            ]),
            FolderNode("Output", []),
        ]
        dest = Path(tmp) / "VideoProject"
        generate_project(dest, folders=folders)
        assert (dest / "Input").is_dir()
        assert (dest / "Input" / "Day 01").is_dir()
        assert (dest / "Input" / "Day 02").is_dir()
        assert (dest / "Output").is_dir()


def test_generate_raises_if_root_exists():
    with tempfile.TemporaryDirectory() as tmp:
        dest = Path(tmp) / "Existing"
        dest.mkdir()
        try:
            generate_project(dest, folders=[])
            assert False, "Should have raised"
        except FileExistsError:
            pass
```

- [ ] **Step 2: Run — verify fail**

```bash
pytest tests/test_logic.py -k "generate" -v
```

Expected: ImportError.

- [ ] **Step 3: Implement generate_project**

Add after TemplateStore:

```python
# ---------------------------------------------------------------------------
# Project generation
# ---------------------------------------------------------------------------

def generate_project(root: Path, folders: List[FolderNode]):
    """Create root directory and all subfolders from the template tree.

    Raises FileExistsError if root already exists.
    Does NOT rollback on partial failure — caller shows error dialog.
    """
    if root.exists():
        raise FileExistsError(f"'{root}' already exists.")
    root.mkdir(parents=True)
    _create_children(root, folders)


def _create_children(parent: Path, nodes: List[FolderNode]):
    for node in nodes:
        child = parent / node.name
        child.mkdir()
        _create_children(child, node.children)
```

- [ ] **Step 4: Run all tests**

```bash
pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add ProjectCreator.py tests/test_logic.py
git commit -m "feat: add generate_project with recursive folder creation"
```

---

## Task 6: App window skeleton + TemplateListPanel (display only)

**Files:**
- Modify: `ProjectCreator.py`

The GUI layer is not unit-tested. Each GUI task ends with a manual smoke test.

- [ ] **Step 1: Add imports and App skeleton at the bottom of ProjectCreator.py**

Append to `ProjectCreator.py`:

```python
# ---------------------------------------------------------------------------
# GUI
# ---------------------------------------------------------------------------

import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import customtkinter as ctk

ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

# Colors derived from CTk theme for Treeview styling
_BG = "#2b2b2b"
_FG = "#dcddde"
_SELECT_BG = "#1f538d"
_FONT = ("Segoe UI", 12) if os.name == "nt" else ("SF Pro Text", 12)


class TemplateListPanel(ctk.CTkFrame):
    """Left panel: scrollable list of template names + New/Duplicate/Delete."""

    def __init__(self, master, store: TemplateStore, on_select, **kwargs):
        super().__init__(master, **kwargs)
        self._store = store
        self._on_select = on_select  # callback(name: str | None)

        # Title
        ctk.CTkLabel(self, text="Templates", font=ctk.CTkFont(size=14, weight="bold")).pack(
            padx=10, pady=(10, 4), anchor="w"
        )

        # Listbox inside a frame for border
        list_frame = ctk.CTkFrame(self)
        list_frame.pack(fill="both", expand=True, padx=10, pady=4)

        scrollbar = ttk.Scrollbar(list_frame, orient="vertical")
        self._listbox = tk.Listbox(
            list_frame,
            yscrollcommand=scrollbar.set,
            bg=_BG, fg=_FG,
            selectbackground=_SELECT_BG,
            selectforeground=_FG,
            borderwidth=0,
            highlightthickness=0,
            font=_FONT,
            activestyle="none",
        )
        scrollbar.config(command=self._listbox.yview)
        scrollbar.pack(side="right", fill="y")
        self._listbox.pack(side="left", fill="both", expand=True)
        self._listbox.bind("<<ListboxSelect>>", self._on_listbox_select)

        # Buttons
        btn_frame = ctk.CTkFrame(self, fg_color="transparent")
        btn_frame.pack(fill="x", padx=10, pady=(4, 10))
        ctk.CTkButton(btn_frame, text="+ New", width=70, command=self._new).pack(side="left", padx=(0, 4))
        ctk.CTkButton(btn_frame, text="Duplicate", width=80, command=self._duplicate).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="Delete", width=70, fg_color="#8b2020",
                      hover_color="#a83232", command=self._delete).pack(side="left", padx=4)

        self.refresh()

    # -- public API ----------------------------------------------------------

    def refresh(self, select_name: Optional[str] = None):
        """Reload list from store. Optionally select a specific name."""
        self._listbox.delete(0, "end")
        for name in self._store.get_names():
            self._listbox.insert("end", name)
        if select_name:
            names = self._store.get_names()
            if select_name in names:
                idx = names.index(select_name)
                self._listbox.selection_set(idx)
                self._listbox.see(idx)

    def selected_name(self) -> Optional[str]:
        sel = self._listbox.curselection()
        if not sel:
            return None
        return self._listbox.get(sel[0])

    def select_index(self, idx: int):
        count = self._listbox.size()
        if count == 0:
            self._on_select(None)
            return
        idx = max(0, min(idx, count - 1))
        self._listbox.selection_clear(0, "end")
        self._listbox.selection_set(idx)
        self._listbox.see(idx)
        self._on_select(self._listbox.get(idx))

    # -- internal ------------------------------------------------------------

    def _on_listbox_select(self, _event=None):
        name = self.selected_name()
        self._on_select(name)

    def _new(self):
        # Implemented in Task 11 (requires dirty-state check from App)
        pass

    def _duplicate(self):
        # Implemented in Task 11
        pass

    def _delete(self):
        # Implemented in Task 11
        pass
```

- [ ] **Step 2: Add TemplateEditorPanel stub and App class**

Append to `ProjectCreator.py`:

```python
class TemplateEditorPanel(ctk.CTkFrame):
    """Right panel: template name field + tree editor + save button."""

    def __init__(self, master, store: TemplateStore, **kwargs):
        super().__init__(master, **kwargs)
        self._store = store
        self._current_saved_name: Optional[str] = None  # name as last saved
        self._dirty = False

        # Hint label shown when no template is selected
        self._hint = ctk.CTkLabel(
            self, text="Select or create a template to get started.",
            text_color="gray"
        )
        self._hint.place(relx=0.5, rely=0.5, anchor="center")

        # --- Editor widgets (hidden until a template is loaded) ---
        self._editor_frame = ctk.CTkFrame(self, fg_color="transparent")

        # Name field
        name_row = ctk.CTkFrame(self._editor_frame, fg_color="transparent")
        name_row.pack(fill="x", padx=10, pady=(10, 2))
        ctk.CTkLabel(name_row, text="Template Name:").pack(side="left")
        self._name_var = tk.StringVar()
        self._name_entry = ctk.CTkEntry(name_row, textvariable=self._name_var, width=200)
        self._name_entry.pack(side="left", padx=(8, 0))
        self._name_error = ctk.CTkLabel(name_row, text="", text_color="#e05252")
        self._name_error.pack(side="left", padx=8)
        self._name_var.trace_add("write", self._on_name_changed)

        # Tree view
        tree_frame = ctk.CTkFrame(self._editor_frame)
        tree_frame.pack(fill="both", expand=True, padx=10, pady=4)
        self._tree = ttk.Treeview(tree_frame, show="tree", selectmode="browse")
        self._style_tree()
        tree_vsb = ttk.Scrollbar(tree_frame, orient="vertical", command=self._tree.yview)
        self._tree.configure(yscrollcommand=tree_vsb.set)
        tree_vsb.pack(side="right", fill="y")
        self._tree.pack(side="left", fill="both", expand=True)
        self._tree.bind("<<TreeviewSelect>>", self._on_tree_select)

        # Tree buttons
        tree_btn_row = ctk.CTkFrame(self._editor_frame, fg_color="transparent")
        tree_btn_row.pack(fill="x", padx=10, pady=2)
        self._btn_add = ctk.CTkButton(tree_btn_row, text="Add Folder", width=100, command=self._add_folder)
        self._btn_add.pack(side="left", padx=(0, 4))
        self._btn_add_sub = ctk.CTkButton(tree_btn_row, text="Add Subfolder", width=110, command=self._add_subfolder)
        self._btn_add_sub.pack(side="left", padx=4)
        self._btn_rename = ctk.CTkButton(tree_btn_row, text="Rename", width=80, command=self._rename_selected)
        self._btn_rename.pack(side="left", padx=4)
        self._btn_del_folder = ctk.CTkButton(
            tree_btn_row, text="Delete", width=80,
            fg_color="#8b2020", hover_color="#a83232",
            command=self._delete_folder
        )
        self._btn_del_folder.pack(side="left", padx=4)

        # Save button row
        save_row = ctk.CTkFrame(self._editor_frame, fg_color="transparent")
        save_row.pack(fill="x", padx=10, pady=(4, 10))
        self._btn_save = ctk.CTkButton(save_row, text="Save Template", command=self._save)
        self._btn_save.pack(side="right")

        self._update_button_states()

    # ---- Styling -----------------------------------------------------------

    def _style_tree(self):
        style = ttk.Style()
        style.theme_use("default")
        style.configure(
            "Custom.Treeview",
            background=_BG, foreground=_FG,
            fieldbackground=_BG,
            rowheight=24,
            font=_FONT,
        )
        style.map("Custom.Treeview", background=[("selected", _SELECT_BG)])
        self._tree.configure(style="Custom.Treeview")

    # ---- Public API --------------------------------------------------------

    @property
    def is_dirty(self) -> bool:
        return self._dirty

    def load_template(self, name: Optional[str]):
        """Load a template by name into the editor, or show hint if None."""
        self._cancel_rename()
        if name is None:
            self._editor_frame.place_forget()
            self._hint.place(relx=0.5, rely=0.5, anchor="center")
            self._current_saved_name = None
            self._dirty = False
            return

        template = self._store.get(name)
        if template is None:
            return

        self._hint.place_forget()
        self._editor_frame.place(relx=0, rely=0, relwidth=1, relheight=1)

        self._name_var.set(template.name)
        self._current_saved_name = template.name
        self._dirty = False

        # Populate tree
        self._tree.delete(*self._tree.get_children())
        for folder in template.folders:
            self._insert_node("", folder)

        self._update_button_states()

    def mark_dirty(self):
        self._dirty = True
        self._update_button_states()

    # ---- Stub methods (implemented in later tasks) -------------------------

    def _on_name_changed(self, *_):
        pass  # Task 9

    def _on_tree_select(self, _event=None):
        self._update_button_states()

    def _add_folder(self):
        pass  # Task 10

    def _add_subfolder(self):
        pass  # Task 10

    def _rename_selected(self):
        pass  # Task 10

    def _delete_folder(self):
        pass  # Task 10

    def _save(self):
        pass  # Task 11

    def _cancel_rename(self):
        pass  # Task 10

    def _update_button_states(self):
        has_selection = bool(self._tree.selection())
        self._btn_add_sub.configure(state="normal" if has_selection else "disabled")
        self._btn_rename.configure(state="normal" if has_selection else "disabled")
        self._btn_save.configure(state="disabled")  # Task 11 enables this

    # ---- Tree helpers ------------------------------------------------------

    def _insert_node(self, parent_iid: str, node: FolderNode) -> str:
        iid = self._tree.insert(parent_iid, "end", text=node.name)
        for child in node.children:
            self._insert_node(iid, child)
        return iid
```

- [ ] **Step 3: Add App class and main entry**

Append to `ProjectCreator.py`:

```python
class App(ctk.CTk):
    def __init__(self):
        super().__init__()
        self.title("ProjectCreator")
        self.geometry("900x600")
        self.minsize(700, 450)

        self._store = TemplateStore()

        # Layout: left panel | right panel
        self.grid_columnconfigure(0, weight=0, minsize=200)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=0)

        self._list_panel = TemplateListPanel(
            self, store=self._store, on_select=self._on_template_selected,
            width=220,
        )
        self._list_panel.grid(row=0, column=0, sticky="nsew", padx=(8, 4), pady=8)

        self._editor_panel = TemplateEditorPanel(self, store=self._store)
        self._editor_panel.grid(row=0, column=1, sticky="nsew", padx=(4, 8), pady=8)

        # Bottom bar
        bottom = ctk.CTkFrame(self, fg_color="transparent")
        bottom.grid(row=1, column=0, columnspan=2, sticky="ew", padx=8, pady=(0, 8))
        self._btn_generate = ctk.CTkButton(
            bottom, text="Generate Project", width=160, command=self._generate
        )
        self._btn_generate.pack(side="right")

        # Keyboard shortcut Ctrl+S / Cmd+S
        modifier = "Command" if os.name != "nt" else "Control"
        self.bind_all(f"<{modifier}-s>", lambda _e: self._editor_panel._save())

    def _on_template_selected(self, name: Optional[str]):
        self._editor_panel.load_template(name)

    def _generate(self):
        pass  # Task 12


if __name__ == "__main__":
    app = App()
    app.mainloop()
```

- [ ] **Step 4: Smoke test — run the app**

```bash
python ProjectCreator.py
```

Expected: window opens with two panels, left shows template list (empty on first run), right shows hint text.

- [ ] **Step 5: Commit**

```bash
git add ProjectCreator.py
git commit -m "feat: add App skeleton with TemplateListPanel and TemplateEditorPanel stubs"
```

---

## Task 7: Load template into the tree

**Files:**
- Modify: `ProjectCreator.py` (TemplateEditorPanel._on_name_changed, tree population — verify with a manually added template)

- [ ] **Step 1: Manually add a test template via Python REPL to verify loading**

```python
from pathlib import Path
from ProjectCreator import TemplateStore, Template, FolderNode

store = TemplateStore()
store.add(Template(
    name="Video Project",
    folders=[
        FolderNode("01. Input", [FolderNode("Day 01", []), FolderNode("Day 02", [])]),
        FolderNode("02. Output", []),
    ]
))
print(store.get_names())
```

Expected: `['Video Project']`

- [ ] **Step 2: Run the app and verify the template loads into the tree**

```bash
python ProjectCreator.py
```

Click "Video Project" in the left panel. Expected: tree shows `01. Input` and `02. Output` with nested children visible when expanded.

- [ ] **Step 3: Verify tree resets on template switch**

Create a second template in the REPL, run the app, click between them. Expected: tree shows different content each time, always fully collapsed on load.

- [ ] **Step 4: Commit** (no code changes if working, just confirm)

```bash
git commit --allow-empty -m "chore: verify template tree loading works correctly"
```

---

## Task 8: Inline rename mode

**Files:**
- Modify: `ProjectCreator.py`

- [ ] **Step 1: Implement _start_inline_rename and _cancel_rename in TemplateEditorPanel**

Replace the stub `_cancel_rename` method and add `_start_inline_rename`:

```python
def _start_inline_rename(self, iid: str, original_name: str):
    """Place an Entry widget over the tree cell for inline editing."""
    self._cancel_rename()  # ensure no previous entry is open

    bbox = self._tree.bbox(iid, "#0")
    if not bbox:
        return  # item scrolled out of view — abort silently
    x, y, w, h = bbox

    self._rename_entry = tk.Entry(
        self._tree,
        font=_FONT,
        bg="#3a3a3a", fg=_FG,
        insertbackground=_FG,
        relief="flat",
        bd=1,
    )
    self._rename_entry.place(x=x, y=y, width=w, height=h)
    self._rename_entry.insert(0, original_name)
    self._rename_entry.select_range(0, "end")
    self._rename_entry.focus_set()

    self._rename_iid = iid
    self._rename_original = original_name
    self._rename_error_label: Optional[ctk.CTkLabel] = None

    self._rename_entry.bind("<Return>", lambda _: self._commit_rename())
    self._rename_entry.bind("<Escape>", lambda _: self._cancel_rename())
    self._rename_entry.bind("<FocusOut>", lambda _: self._commit_rename())

def _cancel_rename(self):
    if hasattr(self, "_rename_entry") and self._rename_entry and self._rename_entry.winfo_exists():
        self._rename_entry.destroy()
        self._rename_entry = None
    if hasattr(self, "_rename_error_label") and self._rename_error_label:
        self._rename_error_label.destroy()
        self._rename_error_label = None
    self._rename_iid = None

def _commit_rename(self):
    if not hasattr(self, "_rename_entry") or not self._rename_entry or not self._rename_entry.winfo_exists():
        return
    raw = self._rename_entry.get()
    new_name = raw.strip()

    # Validate
    ok, err_msg = validate_name(new_name)
    if ok:
        # Check for duplicate sibling
        siblings = self._sibling_names(self._rename_iid)
        if new_name != self._rename_original and new_name in siblings:
            ok, err_msg = False, "A sibling folder with this name already exists."

    if not ok:
        self._rename_entry.configure(bg="#5a2020")
        if self._rename_error_label and self._rename_error_label.winfo_exists():
            self._rename_error_label.configure(text=err_msg)
        else:
            self._rename_error_label = ctk.CTkLabel(
                self._editor_frame, text=err_msg, text_color="#e05252"
            )
            self._rename_error_label.place(x=10, y=self._rename_entry.winfo_y() + 30)
        return  # keep entry open

    self._tree.item(self._rename_iid, text=new_name)
    self._cancel_rename()
    self.mark_dirty()

def _sibling_names(self, iid: str) -> List[str]:
    parent = self._tree.parent(iid)
    siblings = self._tree.get_children(parent)
    return [self._tree.item(s, "text") for s in siblings if s != iid]
```

Also add `_rename_entry = None` and `_rename_iid = None` to `__init__` after the style call:

```python
self._rename_entry = None
self._rename_iid = None
```

- [ ] **Step 2: Wire _rename_selected to use _start_inline_rename**

Replace the stub:

```python
def _rename_selected(self):
    sel = self._tree.selection()
    if not sel:
        return
    iid = sel[0]
    self._start_inline_rename(iid, self._tree.item(iid, "text"))
```

- [ ] **Step 3: Smoke test inline rename**

Run app, load a template, select a folder, click `Rename`. Expected: Entry appears over the cell. Type a new name, press Enter — name updates. Press Escape — restores original.

- [ ] **Step 4: Test duplicate sibling rejection**

Rename a folder to the same name as a sibling. Expected: Entry turns red, error label appears, rename is blocked.

- [ ] **Step 5: Commit**

```bash
git add ProjectCreator.py
git commit -m "feat: implement inline rename mode with Entry overlay and validation"
```

---

## Task 9: Tree buttons — Add Folder, Add Subfolder, Delete folder

**Files:**
- Modify: `ProjectCreator.py`

- [ ] **Step 1: Implement _add_folder and _add_subfolder**

Replace stubs:

```python
def _add_folder(self):
    iid = self._tree.insert("", "end", text="New Folder")
    self._tree.selection_set(iid)
    self._tree.see(iid)
    self.mark_dirty()
    self._start_inline_rename(iid, "New Folder")

def _add_subfolder(self):
    sel = self._tree.selection()
    if not sel:
        return
    parent_iid = sel[0]
    self._tree.item(parent_iid, open=True)
    iid = self._tree.insert(parent_iid, "end", text="New Folder")
    self._tree.selection_set(iid)
    self._tree.see(iid)
    self.mark_dirty()
    self._start_inline_rename(iid, "New Folder")
```

- [ ] **Step 2: Implement _delete_folder**

Replace stub:

```python
def _delete_folder(self):
    sel = self._tree.selection()
    if not sel:
        return
    iid = sel[0]
    parent = self._tree.parent(iid)
    siblings = list(self._tree.get_children(parent))
    idx = siblings.index(iid)

    self._tree.delete(iid)
    self.mark_dirty()

    # Select parent if it has one, else next/prev sibling
    if parent:
        self._tree.selection_set(parent)
        return
    remaining = list(self._tree.get_children(""))
    if not remaining:
        return
    new_sel = remaining[idx] if idx < len(remaining) else remaining[idx - 1]
    self._tree.selection_set(new_sel)
```

- [ ] **Step 3: Smoke test all three buttons**

Run app, load a template.
- Click `Add Folder` → new "New Folder" appears at top level in rename mode.
- Select a folder, click `Add Subfolder` → child appears.
- Select a folder, click `Delete` → removed, correct node selected.

- [ ] **Step 4: Commit**

```bash
git add ProjectCreator.py
git commit -m "feat: implement Add Folder, Add Subfolder, and Delete folder buttons"
```

---

## Task 10: Dirty state tracking + Save Template

**Files:**
- Modify: `ProjectCreator.py`

- [ ] **Step 1: Implement _tree_to_foldernode_list — convert Treeview state back to FolderNode list**

Add helper method to TemplateEditorPanel:

```python
def _tree_to_folders(self) -> List[FolderNode]:
    def node_from_iid(iid: str) -> FolderNode:
        name = self._tree.item(iid, "text")
        children = [node_from_iid(c) for c in self._tree.get_children(iid)]
        return FolderNode(name=name, children=children)
    return [node_from_iid(iid) for iid in self._tree.get_children("")]
```

- [ ] **Step 2: Implement _on_name_changed to update Save button state**

Replace stub:

```python
def _on_name_changed(self, *_):
    self._dirty = True
    self._update_button_states()
```

- [ ] **Step 3: Update _update_button_states to properly enable/disable Save**

Replace stub:

```python
def _update_button_states(self):
    has_selection = bool(self._tree.selection())
    self._btn_add_sub.configure(state="normal" if has_selection else "disabled")
    self._btn_rename.configure(state="normal" if has_selection else "disabled")

    name = self._name_var.get().strip()
    name_ok, _ = validate_name(name)
    # Duplicate name check (against other saved templates)
    name_conflict = (
        name_ok
        and self._store.has_name(name)
        and name != self._current_saved_name
    )

    if name_ok and not name_conflict:
        self._name_error.configure(text="")
    elif not name_ok:
        self._name_error.configure(text="Name is invalid.")
    else:
        self._name_error.configure(text="Name already exists.")

    can_save = self._dirty and name_ok and not name_conflict
    self._btn_save.configure(state="normal" if can_save else "disabled")
```

- [ ] **Step 4: Implement _save**

Replace stub:

```python
def _save(self):
    # Commit any open inline rename first
    self._commit_rename()
    # Re-check (commit might have failed validation)
    name = self._name_var.get().strip()
    ok, _ = validate_name(name)
    if not ok:
        return

    template = Template(name=name, folders=self._tree_to_folders())
    if self._current_saved_name is None:
        self._store.add(template)
    else:
        self._store.update(self._current_saved_name, template)

    self._current_saved_name = name
    self._dirty = False
    self._update_button_states()
    # Notify App to refresh the list
    self.event_generate("<<TemplateSaved>>", data=name)
```

- [ ] **Step 5: Handle <<TemplateSaved>> in App.__init__**

Add to App.__init__ after grid calls:

```python
self._editor_panel.bind("<<TemplateSaved>>", self._on_template_saved)
```

Add method to App:

```python
def _on_template_saved(self, event=None):
    name = self._editor_panel._current_saved_name
    self._list_panel.refresh(select_name=name)
```

- [ ] **Step 6: Smoke test Save Template**

Run app. Load "Video Project", rename a folder, click `Save Template`. Expected: button goes disabled after save. Restart app — changes persist.

- [ ] **Step 7: Test Ctrl+S / Cmd+S**

Make a change, press the shortcut. Expected: template saved without clicking the button.

- [ ] **Step 8: Commit**

```bash
git add ProjectCreator.py
git commit -m "feat: implement dirty state tracking and Save Template with Ctrl+S binding"
```

---

## Task 11: Left panel actions (New, Duplicate, Delete) + unsaved-changes guard

**Files:**
- Modify: `ProjectCreator.py`

- [ ] **Step 1: Add _confirm_discard helper to App**

```python
def _confirm_discard(self) -> bool:
    """Return True if it's safe to proceed (no unsaved changes, or user discarded)."""
    if not self._editor_panel.is_dirty:
        return True
    return messagebox.askyesno(
        "Unsaved Changes",
        "You have unsaved changes. Discard and continue?",
        parent=self,
    )
```

- [ ] **Step 2: Wire up left panel button callbacks through App**

The list panel's button commands need access to App logic. Provide callbacks at construction time. Replace TemplateListPanel.__init__ signature to accept them:

```python
def __init__(self, master, store: TemplateStore, on_select, on_new, on_duplicate, on_delete, **kwargs):
    ...
    ctk.CTkButton(btn_frame, text="+ New", width=70, command=on_new).pack(...)
    ctk.CTkButton(btn_frame, text="Duplicate", width=80, command=on_duplicate).pack(...)
    ctk.CTkButton(btn_frame, text="Delete", width=70, ..., command=on_delete).pack(...)
```

Remove `self._new`, `self._duplicate`, `self._delete` methods from TemplateListPanel.

Update App.__init__ to pass callbacks:

```python
self._list_panel = TemplateListPanel(
    self, store=self._store,
    on_select=self._on_template_selected,
    on_new=self._new_template,
    on_duplicate=self._duplicate_template,
    on_delete=self._delete_template,
    width=220,
)
```

- [ ] **Step 3: Implement _new_template, _duplicate_template, _delete_template in App**

```python
def _new_template(self):
    if not self._confirm_discard():
        return
    name = self._store.unique_new_name()
    template = Template(name=name, folders=[])
    self._store.add(template)
    self._list_panel.refresh(select_name=name)
    self._editor_panel.load_template(name)
    self._editor_panel.mark_dirty()  # new template is dirty from creation

def _duplicate_template(self):
    name = self._list_panel.selected_name()
    if not name:
        return
    copy_name = self._store.unique_copy_name(name)
    original = self._store.get(name)
    if original is None:
        return
    import copy as _copy
    dup = Template(name=copy_name, folders=_copy.deepcopy(original.folders))
    self._store.add(dup)
    self._list_panel.refresh(select_name=copy_name)
    self._editor_panel.load_template(copy_name)  # starts clean

def _delete_template(self):
    name = self._list_panel.selected_name()
    if not name:
        return
    if not self._confirm_discard():
        return
    if not messagebox.askyesno("Delete Template", f"Delete '{name}'?", parent=self):
        return
    names = self._store.get_names()
    idx = names.index(name)
    self._store.delete(name)
    self._list_panel.refresh()
    remaining = self._store.get_names()
    if remaining:
        new_idx = min(idx, len(remaining) - 1)
        self._list_panel.select_index(new_idx)
    else:
        self._editor_panel.load_template(None)
```

- [ ] **Step 4: Update _on_template_selected to check unsaved changes**

Replace:

```python
def _on_template_selected(self, name: Optional[str]):
    if name is None:
        return
    if not self._confirm_discard():
        # Restore previous selection in listbox
        prev = self._editor_panel._current_saved_name
        if prev:
            self._list_panel.refresh(select_name=prev)
        return
    self._editor_panel.load_template(name)
```

- [ ] **Step 5: Smoke test all left panel actions**

- `+ New` → blank template loads, dirty, Save adds it to list
- `Duplicate` → copy appears in list, starts clean
- `Delete` → confirm dialog, template removed, next selected
- Switch templates with unsaved changes → discard prompt

- [ ] **Step 6: Commit**

```bash
git add ProjectCreator.py
git commit -m "feat: implement New, Duplicate, Delete template actions with unsaved-changes guard"
```

---

## Task 12: Generate Project dialog

**Files:**
- Modify: `ProjectCreator.py`

- [ ] **Step 1: Implement _generate in App**

Replace stub:

```python
def _generate(self):
    name = self._list_panel.selected_name()
    if not name:
        messagebox.showwarning("No Template", "Select a template first.", parent=self)
        return
    template = self._store.get(name)
    if template is None:
        return
    GenerateDialog(self, template, self._store)
```

- [ ] **Step 2: Implement GenerateDialog**

Add before App class:

```python
class GenerateDialog(ctk.CTkToplevel):
    def __init__(self, master, template: Template, store: TemplateStore):
        super().__init__(master)
        self.title("Generate Project")
        self.geometry("480x220")
        self.resizable(False, False)
        self.grab_set()  # modal
        self._template = template
        self._destination: Optional[str] = None

        pad = {"padx": 16, "pady": 6}

        # Project name row
        name_row = ctk.CTkFrame(self, fg_color="transparent")
        name_row.pack(fill="x", **pad)
        ctk.CTkLabel(name_row, text="Project Name:", width=120, anchor="w").pack(side="left")
        self._name_var = tk.StringVar()
        self._name_var.trace_add("write", self._validate)
        ctk.CTkEntry(name_row, textvariable=self._name_var, width=280).pack(side="left", padx=(8, 0))

        self._name_error = ctk.CTkLabel(self, text="", text_color="#e05252")
        self._name_error.pack(anchor="w", padx=16)

        # Destination row
        dest_row = ctk.CTkFrame(self, fg_color="transparent")
        dest_row.pack(fill="x", **pad)
        ctk.CTkLabel(dest_row, text="Destination:", width=120, anchor="w").pack(side="left")
        self._dest_label = ctk.CTkLabel(dest_row, text="(none selected)", anchor="w", width=220)
        self._dest_label.pack(side="left", padx=(8, 0))
        ctk.CTkButton(dest_row, text="Browse…", width=80, command=self._browse).pack(side="left", padx=(8, 0))

        # Buttons
        btn_row = ctk.CTkFrame(self, fg_color="transparent")
        btn_row.pack(side="bottom", fill="x", padx=16, pady=12)
        ctk.CTkButton(btn_row, text="Cancel", width=80, fg_color="gray40",
                      command=self.destroy).pack(side="right", padx=(8, 0))
        self._btn_generate = ctk.CTkButton(btn_row, text="Generate", width=100, command=self._generate)
        self._btn_generate.pack(side="right")

        self._validate()

    def _browse(self):
        path = filedialog.askdirectory(parent=self, title="Select destination folder")
        if path:
            self._destination = path
            self._dest_label.configure(text=path)
        self._validate()

    def _validate(self, *_):
        name = self._name_var.get().strip()
        ok, err = validate_name(name)
        if not ok:
            self._name_error.configure(text=err or "Invalid project name.")
        else:
            self._name_error.configure(text="")
        ready = ok and self._destination is not None
        self._btn_generate.configure(state="normal" if ready else "disabled")

    def _generate(self):
        name = self._name_var.get().strip()
        root = Path(self._destination) / name
        try:
            generate_project(root, self._template.folders)
        except FileExistsError:
            messagebox.showerror(
                "Folder Exists",
                f"'{root}' already exists. Choose a different name or destination.",
                parent=self,
            )
            return
        except Exception as exc:
            messagebox.showerror(
                "Generation Failed",
                f"Failed at path '{root}':\n{exc}",
                parent=self,
            )
            return
        messagebox.showinfo("Success", f"Project created at:\n{root}", parent=self)
        self.destroy()
```

- [ ] **Step 3: Smoke test Generate Project**

Run app. Load a template. Click `Generate Project`. Fill in name + destination. Click `Generate`. Expected: success dialog, folder structure created on disk. Verify with Finder/Explorer.

- [ ] **Step 4: Test existing folder rejection**

Generate into the same location twice. Expected: error dialog on second attempt, no duplicate creation.

- [ ] **Step 5: Commit**

```bash
git add ProjectCreator.py
git commit -m "feat: implement GenerateDialog with project name validation and folder creation"
```

---

## Task 13: Final validation + cross-platform check

**Files:**
- Modify: `ProjectCreator.py` (minor fixes only)
- Modify: `tests/test_logic.py`

- [ ] **Step 1: Run the full test suite**

```bash
pytest tests/ -v
```

Expected: all pass.

- [ ] **Step 2: Verify success criteria manually**

Work through each criterion in the spec:

1. Create a template with nested folders → restart app → template still present ✓
2. Generate into existing folder → error dialog, disk unchanged ✓
3. Generate creates exact folder structure ✓
4. Success dialog shows correct full path ✓
5. Invalid folder name (e.g. `my/folder`) rejected inline ✓
6. Duplicate template name rejected on save ✓
7. Switching template with unsaved changes → confirmation dialog ✓
8. Ctrl+S / Cmd+S saves (commits open rename first) ✓
9. `Add Subfolder` / `Rename` disabled when nothing selected ✓
10. Inline rename: Enter/focus-out commits, Escape cancels ✓
11. App runs on macOS and Windows (pathlib throughout) ✓

- [ ] **Step 3: Fix any issues found during manual verification**

(Make fixes as needed before final commit.)

- [ ] **Step 4: Final commit**

```bash
git add ProjectCreator.py tests/
git commit -m "feat: ProjectCreator GUI app — complete implementation"
```

---

## Notes for the implementer

- **Python 3.8 compat:** use `List`, `Optional` from `typing` — not `list[...]` or `str | None` syntax (those require 3.10+).
- **`copy.deepcopy`:** used in Duplicate to avoid shared FolderNode references between templates.
- **Treeview iids:** auto-generated by tkinter — do not store them across tree reloads; always derive from current tree state.
- **`event_generate("<<TemplateSaved>>")`:** the `data` parameter is not reliably passed in all tkinter versions on Windows; use `_editor_panel._current_saved_name` directly (as shown in Task 10).
- **macOS vs Windows modifier:** `os.name == "nt"` detects Windows; use `"Control"` on Windows and `"Command"` on macOS for keyboard shortcuts.
