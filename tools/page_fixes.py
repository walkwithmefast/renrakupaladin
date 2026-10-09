"""Correct individual Chummer page references using the PDFs themselves.

Chummer's data lists ONE page per item, but in some sections that page is off by one or more compared with where the
item's entry (usually a stats-table row or a heading) actually sits in the PDFs. For every item we look at the pages
around its listed page and prefer, in order:
    1. a page where the name starts a line (a table row or heading)    <- the stats / the entry itself
    2. a page where the name appears anywhere in the text               <- at least it is discussed there
and keep the nearest page to the listed one. Items with no evidence anywhere nearby are left untouched.

Usage:  python tools/page_fixes.py          (needs dist/books.js from tools/book_index.py)
Writes: tools/page_fixes.json   {uuid: {"name","source","from","to"}}   consumed by tools/build_data.py
"""
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
DATA_DIR = os.path.join(ROOT, "Chummer5.226.0", "data")
PDF_DIR = os.path.join(ROOT, "Shadowrun 5e")
BOOKS_JS = os.path.join(HERE, "..", "dist", "books.js")
OUT = os.path.join(HERE, "page_fixes.json")

WINDOW = 3          # how many pages either side of the listed page we are willing to move
MIN_NAME = 5        # ignore names shorter than this once normalised; too generic to trust


def norm(s):
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\(.*?\)|\[.*?\]", "", s or "").lower())


def load_books():
    txt = open(BOOKS_JS, encoding="utf-8").read()
    return json.loads(txt[len("window.SR5BOOKS="):-2])


def collect_items():
    """[(uuid, name, source, page, file)] for every item in Chummer's data that names a book page."""
    out = []
    for fn in sorted(os.listdir(DATA_DIR)):
        if not fn.endswith(".xml") or fn in ("books.xml", "references.xml"):
            continue
        try:
            root = ET.parse(os.path.join(DATA_DIR, fn)).getroot()
        except ET.ParseError:
            continue
        for e in root.iter():
            uid, name, src, pg = e.findtext("id"), e.findtext("name"), e.findtext("source"), e.findtext("page")
            if uid and name and src and pg and pg.isdigit() and len(uid) >= 30:
                out.append((uid, name, src, int(pg), fn[:-4]))
    return out


class BookText:
    """Per-page text of one PDF, both as a loose blob and as line starts."""

    def __init__(self, path):
        doc = pymupdf.open(path)
        self.loose, self.lines = [], []
        for i in range(len(doc)):
            raw = doc[i].get_text()
            self.loose.append(norm(raw))
            self.lines.append([norm(l) for l in raw.splitlines() if l.strip()])

    def strict(self, i, key):
        return any(l.startswith(key) for l in self.lines[i])

    def found(self, i, key):
        return key in self.loose[i]


def best_page(bt, offset, listed, key):
    """Return (page, kind) where kind is 'keep' | 'strict' | 'loose'; page is a printed page number."""
    def idx(p):
        return p - 1 + offset

    def ok(p):
        return 0 <= idx(p) < len(bt.loose)

    if ok(listed) and bt.strict(idx(listed), key):
        return listed, "keep"
    strict = [p for d in range(1, WINDOW + 1) for p in (listed + d, listed - d) if p >= 1 and ok(p) and bt.strict(idx(p), key)]
    if strict:
        return strict[0], "strict"          # already ordered nearest-first
    if ok(listed) and bt.found(idx(listed), key):
        return listed, "keep"
    loose = [p for d in range(1, WINDOW + 1) for p in (listed + d, listed - d) if p >= 1 and ok(p) and bt.found(idx(p), key)]
    if loose:
        return loose[0], "loose"
    return listed, "keep"


# Chummer lists the core lifestyles on p.369, but the book itself says they are on p.373 (core p.56 and the section
# heading in the PDF). That is further than the search window, so it is corrected by hand.
MANUAL = {
    ("SR5", "lifestyles"): {"default": 373, "prefix": {"hospitalized": 374}, "only": {"street", "squatter", "low", "middle", "high", "luxury", "hospitalized"}},
}


def apply_manual(items, fixes):
    for uid, name, src, pg, fn in items:
        rule = MANUAL.get((src, fn))
        if not rule:
            continue
        low = name.lower().strip()
        head = re.split(r"[ ,(]", low)[0]
        if head not in rule["only"]:
            continue
        to = rule["prefix"].get(head, rule["default"])
        if to != pg:
            fixes[uid] = {"name": name, "source": src, "file": fn, "from": pg, "to": to, "how": "manual"}


def main():
    books = load_books()
    items = collect_items()
    by_src = {}
    for it in items:
        by_src.setdefault(it[2], []).append(it)
    fixes, summary = {}, []
    for code, b in sorted(books.items()):
        path = os.path.join(PDF_DIR, b["file"])
        if not os.path.exists(path) or code not in by_src:
            continue
        bt = BookText(path)
        seen, n, moved = set(), 0, 0
        for uid, name, src, pg, fn in by_src[code]:
            key = norm(name)
            if len(key) < MIN_NAME or (key, pg) in seen:
                continue
            seen.add((key, pg))
            n += 1
            new, kind = best_page(bt, b["offset"], pg, key)
            if new != pg:
                moved += 1
                fixes[uid] = {"name": name, "source": src, "file": fn, "from": pg, "to": new, "how": kind}
        summary.append((code, n, moved))
    # every duplicate of a fixed (name, page) in the same book gets the same fix
    dup = {}
    for uid, name, src, pg, fn in items:
        for f in list(fixes.values()):
            if f["source"] == src and f["from"] == pg and norm(f["name"]) == norm(name):
                dup[uid] = {"name": name, "source": src, "file": fn, "from": pg, "to": f["to"], "how": f["how"]}
    fixes.update(dup)
    apply_manual(items, fixes)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(fixes, fh, ensure_ascii=False, indent=0)
    print(f"{'book':8} {'checked':>7} {'corrected':>9}")
    for code, n, moved in summary:
        if moved:
            print(f"{code:8} {n:7} {moved:9}")
    print(f"\n{len(fixes)} page references corrected -> tools/page_fixes.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
