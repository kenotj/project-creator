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


# ---------------------------------------------------------------------------
# TemplateStore tests
# ---------------------------------------------------------------------------

import tempfile
from pathlib import Path
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


# ---------------------------------------------------------------------------
# Project generation tests
# ---------------------------------------------------------------------------

from ProjectCreator import generate_project


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
