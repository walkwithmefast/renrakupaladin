"""Pull each item's rules blurb out of your rulebook PDFs.

For every item in Chummer's data (with a book + page) we look on and around its page for the entry that introduces it:
  * a title set in the book's display font   ("Analytical Mind", "FIREBALL", "Squatter")
  * or a bold run-in heading                 ("AR gloves: Available in numerous styles ...")
and keep the text that follows, up to the next entry. The result is a short quote (with the page it came from), so the
app can show the rulebook's own wording next to an item.

The output is derived from the PDFs you own. It is written only to your own disk (tools/blurbs.json, dist/blurbs.js);
don't publish or share those files.

Usage:  python tools/extract_text.py [BOOKCODE ...]      (needs dist/books.js and tools/page_fixes.json)
Writes: tools/blurbs.json     {uuid: {"text": "...", "page": N, "source": "SR5", "name": "..."}}
"""
import collections
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
FIXES = os.path.join(HERE, "page_fixes.json")
OUT = os.path.join(HERE, "blurbs.json")

MAX_CHARS = 1000            # a quote, not a chapter; the app links to the full entry
MIN_CHARS = 40
METADATA = re.compile(r"^(type|range|damage|duration|drain|cost|availability|avail|essence|capacity|rating|device rating|"
                      r"attack|sleaze|data processing|firewall|programs|acceleration|handling|speed|body|armor|pilot|sensor|"
                      r"seats|page|karma|target|fading)\b\s*:", re.I)
# a cost set in the display font right under the title, without a colon: "5 KARMA", "5 KARMA PER LEVEL" (FA's
# "mastery quality" entries - Close Combat Mage and others). Without this, the collector mistook it for the next
# entry's own heading and returned an empty/near-empty quote.
COST_HEADING = re.compile(r"^\d+(?:\s*[-–]\s*\d+)?\s*karma(\s+per\s+\w+)?$", re.I)


def is_metadata(text):
    return bool(METADATA.match(text) or COST_HEADING.match(text))


FOOTER = re.compile(r"^(\d{1,3}\s+.{3,60}\s*>>|<<\s*.{3,60}\s+\d{1,3}|>>\s*.{3,40}\s*<<|\d{1,3}|.{3,40}\s+>>)$")


def norm(s):
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\(.*?\)|\[.*?\]", "", s or "").lower())


def base_name(s):
    """heading text without a trailing cost / qualifier: 'Analytical Mind (5 Karma)' -> 'Analytical Mind'"""
    s = re.split(r"[:(\[]", s, maxsplit=1)[0]
    return s.strip(" .,-–—")


# ------------------------------------------------------------------ page parsing
class Line:
    __slots__ = ("col", "x0", "x1", "y0", "text", "font", "size", "flags", "color", "first", "full")

    def __init__(self, col, x0, x1, y0, text, sp, first, full):
        self.col, self.x0, self.x1, self.y0, self.text = col, x0, x1, y0, text
        self.font, self.size, self.flags, self.color = sp["font"], sp["size"], sp["flags"], sp["color"]
        self.first, self.full = first, full   # first = text of the first span


def parse_page(page):
    """Reading-ordered lines of one page plus the page's body font."""
    W, H = page.rect.width, page.rect.height
    raw, weight = [], collections.Counter()
    for b in page.get_text("dict")["blocks"]:
        if b.get("type") != 0:
            continue
        for l in b["lines"]:
            sp = l["spans"]
            text = "".join(s["text"] for s in sp).strip()
            if not text:
                continue
            x0, y0, x1, _ = l["bbox"]
            if y0 < 40 or y0 > H - 38 or FOOTER.match(text):      # running headers / footers
                continue
            s0 = sp[0]
            for s in sp:
                weight[(s["font"], round(s["size"], 1))] += len(s["text"])
            full = (x1 - x0) > W * 0.62
            col = 0 if (x0 < W * 0.5 - 12 or full) else 1
            raw.append(Line(col, x0, x1, y0, text, s0, s0["text"].strip(), full))
    body = weight.most_common(1)[0][0] if weight else ("", 0)
    raw.sort(key=lambda l: (l.col, round(l.y0 / 3), l.x0))
    # fragments of one justified line arrive as separate "lines" at (almost) the same height: glue them back together
    merged = []
    for l in raw:
        p = merged[-1] if merged else None
        if p is not None and p.col == l.col and abs(p.y0 - l.y0) < 3 and l.x0 >= p.x0 and p.font == l.font and not p.full:
            p.text = p.text + " " + l.text
            p.x1 = max(p.x1, l.x1)
        else:
            merged.append(l)
    return merged, body


class Book:
    def __init__(self, path, offset):
        self.doc = pymupdf.open(path)
        self.offset = offset
        self.cache = {}

    def page(self, printed):
        i = printed - 1 + self.offset
        if not (0 <= i < len(self.doc)):
            return None
        if i not in self.cache:
            self.cache[i] = parse_page(self.doc[i])
        return self.cache[i]


def is_display_heading(l, body):
    if l.color == 0xFFFFFF:                     # table header text on a dark band
        return False
    if len(l.text) > 70 or l.font == body[0]:
        return False
    if l.size < body[1] + 0.4:
        return False
    return True


def is_runin(l, body):
    """bold lead-in such as 'AR gloves: Available in ...'"""
    bold = bool(l.flags & 16) or "bold" in l.font.lower()
    return bold and ":" in l.first and len(l.first) < 60 and l.font != "" and (l.x0 > 0)


def entry_text(book, printed, idx, lines, body, name_key):
    """Collect the entry starting at lines[idx] until the next entry; may continue into the next column / page."""
    out = []
    first = lines[idx]
    runin = not is_display_heading(first, body)
    if runin:
        after = first.text[len(first.first):].strip() if first.text.startswith(first.first) else first.text
        if after:
            out.append((first, after))
    col_x0 = min((l.x0 for l in lines if l.col == first.col), default=first.x0)
    j = idx + 1
    stream = lines
    pg = printed
    while True:
        while j < len(stream):
            l = stream[j]
            j += 1
            if is_display_heading(l, body):
                if is_metadata(l.text):             # 'Cost: 5 Karma' / '5 Karma per level' right under the title
                    continue
                return out
            if is_runin(l, body) and l.x0 > col_x0 + 3:
                if is_metadata(l.text):
                    continue
                return out
            if is_metadata(l.text) and (l.flags & 16 or "bold" in l.font.lower() or l.font != body[0]):
                continue
            if l.font != body[0] and l.text.startswith("(") and len(l.text) < 50:      # "(Indirect, Elemental)"
                continue
            out.append((l, l.text))
            if sum(len(t) for _, t in out) > MAX_CHARS * 1.6:
                return out
        # ran out of lines: continue on the next page only when the sentence is clearly unfinished
        if not out or re.search(r"[.!?:\"”)]\s*$", out[-1][1]):
            return out
        pg += 1
        nxt = book.page(pg)
        if nxt is None:
            return out
        stream, body = nxt
        j = 0
        if len(out) > 60:
            return out


# running page headers that some books print inside the text area:  ">> TECHNOCRITTERS << 145", "44 >> DEMOLITION DERBY << NAME"
INLINE_HEADER = re.compile(r"(?:\b\d{1,3}\s+)?(?:>>|<<)\s*[A-Z0-9][A-Z0-9 '\u2019&:.,!?/-]{2,60}?\s*(?:<<|>>)(?:\s+\d{1,3}\b)?")
TABLE_JUNK = re.compile(r"ACC\s+DAM\s+AP|^SHADOWRUN,\s|\bAVAIL\s+COST\b")


def clean_text(t):
    """strip page furniture that slipped into a quote; return '' when what is left is a table, not prose"""
    t = INLINE_HEADER.sub(" ", t)
    t = re.sub(r"[ \t]{2,}", " ", t)
    t = re.sub(r"\s+([,.;:!?])", r"\1", t)
    m = TABLE_JUNK.search(t)
    if m:                                   # a table starts here: keep the prose before it, if there is any
        t = t[:m.start()].rstrip()
    return t.strip() if len(t) >= MIN_CHARS else ""


def tidy(parts):
    """[(line, text)] -> readable paragraph(s)"""
    paras, cur, prev = [], [], None
    for l, t in parts:
        indent = prev is not None and l.col == prev.col and l.x0 > prev.x0 + 6 and 8 <= l.y0 - prev.y0 <= 16
        if indent and cur:
            paras.append(cur)
            cur = []
        cur.append(t)
        prev = l
    if cur:
        paras.append(cur)
    text = []
    for p in paras:
        s = ""
        for t in p:
            if s.endswith("-") and t[:1].islower():
                s = s[:-1] + t                  # soft hyphen at a line break: 'final-' + 'izing'
            else:
                s = (s + " " + t) if s else t
        text.append(re.sub(r"\s+", " ", s).strip())
    out = clean_text("\n\n".join(x for x in text if x))
    if len(out) > MAX_CHARS:
        cut = out[:MAX_CHARS]
        m = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
        out = (cut[:m + 1] if m > MAX_CHARS * 0.45 else cut.rsplit(" ", 1)[0]) + " …"
    return out


# names Chummer uses that the book prints differently
ALIASES = {"medium": "middle"}


def name_keys(name):
    """normalised headings to look for, most specific first"""
    keys = [norm(base_name(name))]
    head = name.split(",")[0].strip()
    if head and norm(head) not in keys:
        keys.append(norm(head))                 # "Hospitalized, Basic" -> "Hospitalized"
    keys += [ALIASES[k] for k in list(keys) if k in ALIASES]
    return [k for k in keys if len(k) >= 3]


def find_entry(book, name, listed):
    """Try the listed page first, then its neighbours; return (text, page) or None."""
    keys = name_keys(name)
    if not keys:
        return None
    for key in keys:
        for d in (0, 1, -1, 2, -2):
            printed = listed + d
            pg = book.page(printed)
            if pg is None:
                continue
            lines, body = pg
            for i, l in enumerate(lines):
                if is_display_heading(l, body):
                    head = base_name(l.text)
                elif is_runin(l, body) and len(key) >= 4:       # short names are only trusted as real titles
                    head = base_name(l.first)
                else:
                    continue
                if norm(head) != key:
                    continue
                txt = tidy(entry_text(book, printed, i, lines, body, key))
                if len(txt) >= MIN_CHARS:
                    return txt, printed
    return None


# ------------------------------------------------------------------ driver
def load_books():
    t = open(BOOKS_JS, encoding="utf-8").read()
    return json.loads(t[len("window.SR5BOOKS="):-2])


def collect_items():
    fixes = json.load(open(FIXES, encoding="utf-8")) if os.path.exists(FIXES) else {}
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
                page = int(fixes.get(uid, {}).get("to", pg))
                out.append((uid, name, src, page, fn[:-4]))
    return out


def reclean():
    """apply clean_text to an existing tools/blurbs.json without re-reading the PDFs"""
    data = json.load(open(OUT, encoding="utf-8"))
    kept, dropped, changed = {}, 0, 0
    for uid, v in data.items():
        t = clean_text(v["text"])
        if len(t) < MIN_CHARS:
            dropped += 1
            continue
        changed += t != v["text"]
        kept[uid] = {**v, "text": t}
    json.dump(kept, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"cleaned {changed} excerpts, dropped {dropped} that were tables; {len(kept)} remain")
    return 0


def extract_texts(books, items, pdf_dir, codes=None, result=None, stats=None, log=print, progress=None):
    """items: [(key, name, source, page, datafile)] -> {key: {text, page, source, name, file}} for every entry found.
    books: {code: {file, offset}} (tools/book_index.py); progress(i, n, code) is called per book."""
    result = {} if result is None else result
    stats = collections.defaultdict(lambda: [0, 0]) if stats is None else stats
    by_src = collections.defaultdict(list)
    for it in items:
        by_src[it[2]].append(it)
    todo = [(code, b) for code, b in sorted(books.items())
            if (not codes or code in codes) and code in by_src and os.path.exists(os.path.join(pdf_dir, b["file"]))]
    for n_book, (code, b) in enumerate(todo):
        if progress:
            progress(n_book, len(todo), code)
        book = Book(os.path.join(pdf_dir, b["file"]), b["offset"])
        found = 0
        for uid, name, src, page, fn in by_src[code]:
            stats[(code, fn)][0] += 1
            hit = find_entry(book, name, page)
            if hit:
                text, pg = hit
                result[uid] = {"text": text, "page": pg, "source": src, "name": name, "file": fn}
                stats[(code, fn)][1] += 1
                found += 1
        log(f"{code:6} {len(by_src[code]):5} items  ->  {found:5} with text")
    return result


def main(codes):
    if codes == {"--clean"}:
        return reclean()
    books = load_books()
    items = collect_items()
    result, stats = {}, collections.defaultdict(lambda: [0, 0])
    if os.path.exists(OUT) and codes:
        result = json.load(open(OUT, encoding="utf-8"))
    extract_texts(books, items, PDF_DIR, codes=codes, result=result, stats=stats)
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(result, fh, ensure_ascii=False)
    print(f"\n{len(result)} blurbs -> tools/blurbs.json")
    print("\nby data file (all books processed):")
    per = collections.defaultdict(lambda: [0, 0])
    for (code, fn), (n, h) in stats.items():
        per[fn][0] += n
        per[fn][1] += h
    for fn, (n, h) in sorted(per.items(), key=lambda kv: -kv[1][0]):
        if n >= 15:
            print(f"  {fn:14} {h:5}/{n:5}  {100 * h // n:3d}%")
    return 0


if __name__ == "__main__":
    sys.exit(main(set(sys.argv[1:])))
