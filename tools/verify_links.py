"""Check the page links the app actually uses (dist/data.js, after tools/page_fixes.py corrections).

For every indexed book and every item with a page we test the PDF page the app would open:
  name-on-page   the item's name appears somewhere in that page's text
  entry-on-page  the name starts a line there (a stats-table row or heading), i.e. the entry itself
Items whose names never appear near their page (e.g. "Grenade: Smoke, Aerodynamic" printed as "Smoke") can't be
verified by name and count as misses in both columns, so treat the numbers as a floor.

Usage: python tools/verify_links.py [BOOKCODE ...]
"""
import json
import os
import re
import sys

import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
DIST = os.path.join(HERE, "..", "dist")
norm = lambda s: re.sub(r"[^a-z0-9]", "", re.sub(r"\(.*?\)|\[.*?\]", "", s or "").lower())


def load(name, prefix):
    txt = open(os.path.join(DIST, name), encoding="utf-8").read()
    return json.loads(txt[len(prefix):-2])


def walk(o):
    if isinstance(o, list):
        for x in o:
            yield from walk(x)
    elif isinstance(o, dict):
        if isinstance(o.get("name"), str) and "source" in o and str(o.get("page", "")).isdigit():
            yield o
        for v in o.values():
            yield from walk(v)


def main(codes):
    books = load("books.js", "window.SR5BOOKS=")
    data = load("data.js", "window.SR5DATA=")
    items = {}
    for x in walk(data):
        items.setdefault(x["source"], set()).add((norm(x["name"]), int(x["page"])))
    tot_n = tot_l = tot_s = 0
    print(f"{'book':8} {'file':>4} {'offset':>6} {'items':>6}  name-on-page  entry-on-page")
    for code, b in sorted(books.items()):
        if codes and code not in codes:
            continue
        path = os.path.join(ROOT, "Shadowrun 5e", b["file"])
        if not os.path.exists(path):
            print(f"{code:8} MISSING {b['file']}")
            continue
        doc = pymupdf.open(path)
        loose = [norm(doc[i].get_text()) for i in range(len(doc))]
        lines = [[norm(l) for l in doc[i].get_text().splitlines() if l.strip()] for i in range(len(doc))]
        n = l = s = 0
        for key, pg in items.get(code, ()):
            if len(key) < 5:
                continue
            i = pg - 1 + b["offset"]
            n += 1
            if 0 <= i < len(loose):
                l += key in loose[i]
                s += any(t.startswith(key) for t in lines[i])
        tot_n, tot_l, tot_s = tot_n + n, tot_l + l, tot_s + s
        pct = lambda x: f"{100 * x // n:3d}%" if n else "  - "
        print(f"{code:8} {'yes':>4} {b['offset']:>6} {n:>6}  {pct(l):>12}  {pct(s):>13}")
    if tot_n:
        print(f"\noverall: name-on-page {100 * tot_l // tot_n}%, entry-on-page {100 * tot_s // tot_n}% of {tot_n} items")


if __name__ == "__main__":
    main(set(sys.argv[1:]))
