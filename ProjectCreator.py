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
        return {"name": self.name, "children": [c.to_dict() for c in self.children]}it

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


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

_ILLEGAL_CHARS = set('\\/:*?"<>|')


def validate_name(name: str):
    """Return (True, '') if valid, else (False, error_message)."""
    stripped = name.strip()
    if not stripped:
        return False, "Name cannot be empty."
    for ch in stripped:
        if ch in _ILLEGAL_CHARS:
            return False, f"Illegal character: '{ch}'"
    return True, ""


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

    def __init__(self, master, store: TemplateStore, on_select, on_new, on_duplicate, on_delete, **kwargs):
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
        ctk.CTkButton(btn_frame, text="+ New", width=70, command=on_new).pack(side="left", padx=(0, 4))
        ctk.CTkButton(btn_frame, text="Duplicate", width=80, command=on_duplicate).pack(side="left", padx=4)
        ctk.CTkButton(btn_frame, text="Delete", width=70, fg_color="#8b2020",
                      hover_color="#a83232", command=on_delete).pack(side="left", padx=4)

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


class TemplateEditorPanel(ctk.CTkFrame):
    """Right panel: template name field + tree editor + save button."""

    def __init__(self, master, store: TemplateStore, **kwargs):
        super().__init__(master, **kwargs)
        self._store = store
        self._current_saved_name: Optional[str] = None  # name as last saved
        self._dirty = False
        self._rename_entry = None
        self._rename_iid = None
        self._rename_original = None
        self._rename_error_label = None

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
        self._dirty = True
        self._update_button_states()

    def _on_tree_select(self, _event=None):
        self._update_button_states()

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
        self._rename_error_label = None

        self._rename_entry.bind("<Return>", lambda _: self._commit_rename())
        self._rename_entry.bind("<Escape>", lambda _: self._cancel_rename())
        self._rename_entry.bind("<FocusOut>", lambda _: self._commit_rename())

    def _cancel_rename(self):
        if self._rename_entry and hasattr(self._rename_entry, 'winfo_exists') and self._rename_entry.winfo_exists():
            self._rename_entry.destroy()
        self._rename_entry = None
        if hasattr(self, '_rename_error_label') and self._rename_error_label:
            if self._rename_error_label.winfo_exists():
                self._rename_error_label.destroy()
            self._rename_error_label = None
        self._rename_iid = None

    def _commit_rename(self):
        if not self._rename_entry or not self._rename_entry.winfo_exists():
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
            if hasattr(self, '_rename_error_label') and self._rename_error_label and self._rename_error_label.winfo_exists():
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

    def _rename_selected(self):
        sel = self._tree.selection()
        if not sel:
            return
        iid = sel[0]
        self._start_inline_rename(iid, self._tree.item(iid, "text"))

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

        # Select parent if it has one, else next/prev sibling at root level
        if parent:
            self._tree.selection_set(parent)
            return
        remaining = list(self._tree.get_children(""))
        if not remaining:
            return
        new_sel = remaining[idx] if idx < len(remaining) else remaining[idx - 1]
        self._tree.selection_set(new_sel)

    def _tree_to_folders(self) -> List[FolderNode]:
        def node_from_iid(iid: str) -> FolderNode:
            name = self._tree.item(iid, "text")
            children = [node_from_iid(c) for c in self._tree.get_children(iid)]
            return FolderNode(name=name, children=children)
        return [node_from_iid(iid) for iid in self._tree.get_children("")]

    def _save(self):
        # Commit any open inline rename first
        self._commit_rename()
        # Re-check after potential commit
        name = self._name_var.get().strip()
        ok, _ = validate_name(name)
        if not ok:
            return

        name_conflict = (
            self._store.has_name(name)
            and name != self._current_saved_name
        )
        if name_conflict:
            return

        template = Template(name=name, folders=self._tree_to_folders())
        saved_name = self._current_saved_name
        if saved_name is None:
            self._store.add(template)
        else:
            self._store.update(saved_name, template)

        self._current_saved_name = name
        self._dirty = False
        self._update_button_states()
        # Notify App to refresh the list
        self.event_generate("<<TemplateSaved>>")

    def _update_button_states(self):
        has_selection = bool(self._tree.selection())
        self._btn_add_sub.configure(state="normal" if has_selection else "disabled")
        self._btn_rename.configure(state="normal" if has_selection else "disabled")

        name = self._name_var.get().strip()
        name_ok, _ = validate_name(name)
        # Duplicate name check (against other saved templates, excluding the current one)
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

    # ---- Tree helpers ------------------------------------------------------

    def _insert_node(self, parent_iid: str, node: FolderNode) -> str:
        iid = self._tree.insert(parent_iid, "end", text=node.name)
        for child in node.children:
            self._insert_node(iid, child)
        return iid


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
            self, store=self._store,
            on_select=self._on_template_selected,
            on_new=self._new_template,
            on_duplicate=self._duplicate_template,
            on_delete=self._delete_template,
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

        # Listen for save events from editor panel
        self._editor_panel.bind("<<TemplateSaved>>", self._on_template_saved)

    def _on_template_selected(self, name: Optional[str]):
        if name is None:
            return
        if not self._confirm_discard():
            prev = self._editor_panel._current_saved_name
            if prev:
                self._list_panel.refresh(select_name=prev)
            return
        self._editor_panel.load_template(name)

    def _on_template_saved(self, event=None):
        name = self._editor_panel._current_saved_name
        self._list_panel.refresh(select_name=name)

    def _confirm_discard(self) -> bool:
        if not self._editor_panel.is_dirty:
            return True
        return messagebox.askyesno(
            "Unsaved Changes",
            "You have unsaved changes. Discard and continue?",
            parent=self,
        )

    def _new_template(self):
        if not self._confirm_discard():
            return
        name = self._store.unique_new_name()
        template = Template(name=name, folders=[])
        self._store.add(template)
        self._list_panel.refresh(select_name=name)
        self._editor_panel.load_template(name)
        self._editor_panel.mark_dirty()

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
        self._editor_panel.load_template(copy_name)

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

    def _generate(self):
        name = self._list_panel.selected_name()
        if not name:
            messagebox.showwarning("No Template", "Select a template first.", parent=self)
            return
        template = self._store.get(name)
        if template is None:
            return
        GenerateDialog(self, template, self._store)


if __name__ == "__main__":
    app = App()
    app.mainloop()
