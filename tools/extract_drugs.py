"""Read drug entries out of your rulebook PDFs: Vector, Speed, Duration, Addiction Type / Rating / Threshold, Effect
and the flavor text that follows the stat block.

Entry shape (core rulebook p.411-412, and similar in the supplements):
    BLISS                                   <- title in the display font (any size, may be small caps)
    Vector: Inhalation, Injection           <- labelled stat lines (bold or plain)
    Speed: 1 Combat Turn
    Duration: (6 x Body) hours, minimum 1 hour
    Addiction Type: Both
    Effect: -1 Reaction, ... (may wrap onto a continuation line at the column's left edge)
      A tranquilizing narcotic, bliss is ...   <- flavor / side effects (first line indented)
Addiction Rating and Threshold are not in the entry: they come from the book's "Addiction Table" (rows of
substance | rating | threshold), which is read by position.

Like tools/extract_text.py this only reads PDFs you own, writes only to your disk (tools/drugs.json), and the output
shouldn't be shared.

Usage:  python tools/extract_drugs.py
Writes: tools/drugs.json   {uuid: {name, source, page, vector, speed, duration, addictionType, addictionRating,
                                   addictionThreshold, effect, flavor}}
"""
import collections
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

import pymupdf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from extract_text import Book, DATA_DIR, FIXES, PDF_DIR, base_name, load_books, norm, is_display_heading  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "drugs.json")

FIELDS = {
    "vector": "vector", "speed": "speed", "duration": "duration", "addiction type": "addictionType",
    "addiction rating": "addictionRating", "addiction threshold": "addictionThreshold",
    "effect": "effect", "effects": "effect", "penetration": "penetration", "power": "power",
}
FIELD_RE = re.compile(r"^\W*(vector|speed|duration|addiction type|addiction rating|addiction threshold|effects?|penetration|power)\s*:\s*(.*)$", re.I)


# The books' multiplication sign is stored as a dash glyph: "(12 x Body) hours" arrives as "(12\u2014Body) hours".
TIMES = re.compile(r"(\d+)\s*[\u2014\u2013\ufffd]\s*(?=(?:Body|Willpower|Logic|Strength|Agility|Reaction|Intuition|Charisma|Magic|Essence|Edge)\b)")


def fix_times(s):
    return TIMES.sub(lambda m: m.group(1) + " \u00d7 ", s) if isinstance(s, str) else s


def drug_items():
    """[(uuid, name, source, page)] for every gear entry in the Drugs category"""
    fixes = json.load(open(FIXES, encoding="utf-8")) if os.path.exists(FIXES) else {}
    root = ET.parse(os.path.join(DATA_DIR, "gear.xml")).getroot()
    out = []
    for g in root.iter("gear"):
        if g.findtext("category") == "Drugs" and g.findtext("id") and (g.findtext("page") or "").isdigit():
            uid = g.findtext("id")
            out.append((uid, g.findtext("name"), g.findtext("source"), int(fixes.get(uid, {}).get("to", g.findtext("page")))))
    return out


# ------------------------------------------------------------------ Addiction Table (by position)
def addiction_table(book):
    """{normalised substance: (rating, threshold)} read from any page titled 'Addiction table'"""
    table = {}
    for i in range(len(book.doc)):
        page = book.doc[i]
        text = page.get_text()
        if not re.search(r"addiction\s+table", text, re.I):
            continue
        cells, title = [], None
        for b in page.get_text("dict")["blocks"]:
            if b.get("type") != 0:
                continue
            for l in b["lines"]:
                t = "".join(s["text"] for s in l["spans"]).strip()
                if not t:
                    continue
                cells.append((l["bbox"][1], l["bbox"][0], t))
                if re.fullmatch(r"addiction\s+table", t, re.I):
                    title = (l["bbox"][1], l["bbox"][0])
        if title is None:
            continue
        # the table sits under its title, in the same column: ignore body text elsewhere on the page
        cells = [c for c in cells if c[0] >= title[0] and c[1] >= title[1] - 12]
        cells.sort()
        rows, anchor = [], None
        for y, x, t in cells:                           # cells of one table row share (almost) the same height
            if anchor is None or y - anchor > 3:
                rows.append([])
                anchor = y
            rows[-1].append((x, t))
        for row in rows:
            row.sort()
            nums = [t for _, t in row if re.fullmatch(r"\d{1,2}", t)]
            names = [t for _, t in row if not re.fullmatch(r"\d{1,2}", t)]
            if len(nums) >= 2 and names and len(names[0]) <= 40:
                table[norm(names[0])] = (int(nums[-2]), int(nums[-1]))
    return table


# ------------------------------------------------------------------ entries
def find_heading(book, key, listed):
    for d in (0, 1, -1, 2, -2, 3, -3):
        printed = listed + d
        pg = book.page(printed)
        if pg is None:
            continue
        lines, body = pg
        for i, l in enumerate(lines):
            if len(l.text) > 60 or FIELD_RE.match(l.text):
                continue
            if l.font == body[0] and not (l.flags & 16):
                continue                                # ordinary body text
            if norm(base_name(l.text)) == key:
                return printed, lines, body, i
    return None


def parse_entry(book, printed, lines, body, idx):
    head = lines[idx]
    col_x0 = head.x0
    fields, cur, cur_line = {}, None, None
    j = idx + 1
    while j < len(lines) and lines[j].font == head.font and lines[j].col == head.col and lines[j].y0 - lines[j - 1].y0 < 16 and not FIELD_RE.match(lines[j].text):
        j += 1                                          # "AISA (EAU DE VIVRE, / TEX-MEX TEA)": the title's second line
    # stat block: labelled lines, plus wrapped continuation lines sitting at the column's left edge
    while j < len(lines):
        l = lines[j]
        m = FIELD_RE.match(l.text)
        if m:
            cur = FIELDS[m.group(1).lower()]
            cur_line = l
            fields[cur] = m.group(2).strip()
            j += 1
            continue
        plain = l.font != head.font and not (l.flags & 16) and "bold" not in l.font.lower()
        # a wrapped value sits back at the title's left edge, or (for bulleted lists) deeper than the bullet it belongs to
        wrapped = l.x0 <= col_x0 + 2 or (cur_line is not None and l.x0 >= cur_line.x0 + 10 and l.size < cur_line.size)
        if cur and l.col == head.col and wrapped and plain and not l.text.startswith("("):
            prev = fields[cur]
            fields[cur] = (prev[:-1] + l.text) if (prev.endswith("-") and l.text[:1].islower()) else (prev + " " + l.text).strip()
            j += 1
            continue
        break
    if len(fields) < 2:
        return None
    # flavor: everything after the stat block up to the next title
    parts, stream, pg = [], lines, printed
    while True:
        while j < len(stream):
            l = stream[j]
            j += 1
            if l.font != body[0] and len(l.text) < 60 and not FIELD_RE.match(l.text):
                return fields, parts                    # next entry's title
            if FIELD_RE.match(l.text) and (l.flags & 16 or l.font != body[0]):
                return fields, parts
            parts.append(l)
            if sum(len(p.text) for p in parts) > 2500:
                return fields, parts
        if not parts or re.search(r"[.!?\"”)]\s*$", parts[-1].text):
            return fields, parts
        pg += 1
        nxt = book.page(pg)
        if nxt is None:
            return fields, parts
        stream, body = nxt
        j = 0
        if len(parts) > 40:
            return fields, parts


def paragraphs(parts):
    paras, cur, prev = [], "", None
    for l in parts:
        new_par = prev is not None and l.col == prev.col and l.x0 > prev.x0 + 6 and 8 <= l.y0 - prev.y0 <= 16
        if new_par and cur:
            paras.append(cur)
            cur = ""
        if cur.endswith("-") and l.text[:1].islower():
            cur = cur[:-1] + l.text
        else:
            cur = (cur + " " + l.text).strip()
        prev = l
    if cur:
        paras.append(cur)
    return "\n\n".join(re.sub(r"\s+", " ", p).strip() for p in paras)


def extract_drug_records(books, items_list, pdf_dir, log=print):
    """items_list: [(key, name, source, page)] -> ({key: drug record}, [(code, name, page) not found])"""
    by_src = collections.defaultdict(list)
    for it in items_list:
        by_src[it[2]].append(it)
    result, missing = {}, []
    for code, items in sorted(by_src.items()):
        b = books.get(code)
        if not b or not os.path.exists(os.path.join(pdf_dir, b["file"])):
            continue
        book = Book(os.path.join(pdf_dir, b["file"]), b["offset"])
        table = addiction_table(book)
        for uid, name, src, page in items:
            key = norm(base_name(name))
            hit = find_heading(book, key, page)
            entry = parse_entry(book, *hit) if hit else None
            if not entry:
                missing.append((code, name, page))
                continue
            fields, parts = entry
            rec = {"name": name, "source": src, "page": hit[0], **{k: fix_times(v) for k, v in fields.items()}, "flavor": fix_times(paragraphs(parts))}
            if key in table:                                    # the Addiction Table is authoritative for rating / threshold
                rec["addictionRating"], rec["addictionThreshold"] = str(table[key][0]), str(table[key][1])
            result[uid] = rec
        log(f"{code:5} {len(items):3} drugs -> {sum(1 for u in items if u[0] in result):3} read   (addiction table rows: {len(table)})")
    return result, missing


def main():
    result, missing = extract_drug_records(load_books(), drug_items(), PDF_DIR)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False)
    print(f"\n{len(result)} drugs -> tools/drugs.json;  not found: {len(missing)}")
    for m in missing[:14]:
        print("   missing:", m)
    return 0


if __name__ == "__main__":
    sys.exit(main())
