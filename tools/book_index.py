"""Match the rulebook PDFs in ../Shadowrun 5e to Chummer book codes and work out each
PDF's page offset (printed page -> PDF page), so the app can deep-link to a rule.

Writes dist/books.js  (window.SR5BOOKS = {CODE: {file, offset, title}})
"""
import json, os, re, sys
import xml.etree.ElementTree as ET
import pymupdf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
PDF_DIR = os.path.join(ROOT, "Shadowrun 5e")
DATA = os.path.join(ROOT, "Chummer5.226.0", "data", "books.xml")
OUT = os.path.join(HERE, "..", "dist", "books.js")

# filename (lower) fragments that must map to a specific code when heuristics are ambiguous
OVERRIDE = {
    "shadowrun 5th edition.pdf": "SR5",
    "rigger-5-0.pdf": "R5",
    "shadowrun_5e_rigger_5.0_with_bookmarks.pdf": "R5",
    "shadows in focus - sioux nation.pdf": "SFCC",
    "shadowrun_5e_shadows_in_focus_-_sioux_nation_starving_the_masses.pdf": None,
    "shadowrun_5e_state_of_the_art.pdf": None,
}

def norm(s):
    s = s.lower().replace("&", "and").replace("_", " ").replace("-", " ")
    s = re.sub(r"\.pdf$", "", s)
    s = re.sub(r"\bshadowrun\b|\b5e\b|\b5th edition\b|\bshadows in focus\b|\bthe\b|[^a-z0-9 ]", " ", s)
    return set(t for t in s.split() if t)

def collect_samples():
    """{code: [(name, page)]} from every Chummer data file that lists a source + page."""
    ddir = os.path.dirname(DATA)
    samples = {}
    for fn in os.listdir(ddir):
        if not fn.endswith(".xml") or fn in ("books.xml", "references.xml"):
            continue
        try:
            root = ET.parse(os.path.join(ddir, fn)).getroot()
        except ET.ParseError:
            continue
        for e in root.iter():
            src = e.findtext("source")
            pg = e.findtext("page")
            nm = e.findtext("name")
            if src and nm and pg and pg.isdigit() and len(nm) >= 6:
                samples.setdefault(src, []).append((nm, int(pg)))
    return samples

def vote_offset(doc, samples, limit=400):
    pages = [re.sub(r"[^a-z0-9]", "", doc[i].get_text().lower()) for i in range(len(doc))]
    votes = {}
    seen = set()
    for nm, pg in samples[:limit * 3]:
        k = re.sub(r"[^a-z0-9]", "", re.sub(r"\(.*?\)|\[.*?\]", "", nm).lower())
        if len(k) < 6 or (k, pg) in seen:
            continue
        seen.add((k, pg))
        for off in range(-6, 24):
            i = pg - 1 + off
            if 0 <= i < len(pages) and k in pages[i]:
                votes[off] = votes.get(off, 0) + 1
    if not votes:
        return None, 0, 0
    ranked = sorted(votes.items(), key=lambda kv: -kv[1])
    top = ranked[0]
    second = ranked[1][1] if len(ranked) > 1 else 0
    return top[0], top[1], second

# Two PDFs use a scrambled font encoding, so their text can't be matched. Offsets checked by eye:
#   BLB: PDF page 161 is printed p.160 (Body Sculpt);  SFM: PDF page 18 is printed p.18 (Colt Manhunter)
MANUAL_OFFSETS = {"BLB": 1, "SFM": 0}


def printed_page_offset(doc):
    """Independent check: read the page numbers printed in headers/footers and vote on (pdf page - printed page)."""
    votes = {}
    n = len(doc)
    for i in range(n):
        lines = [l.strip() for l in doc[i].get_text().splitlines() if l.strip()]
        for l in lines[:3] + lines[-3:]:
            for m in re.finditer(r"(?:^|\s)(\d{1,3})(?:\s|$)", l):
                v = int(m.group(1))
                if 1 <= v <= n + 5:
                    votes[(i + 1) - v] = votes.get((i + 1) - v, 0) + 1
    if not votes:
        return None, 0, 0
    ranked = sorted(votes.items(), key=lambda kv: -kv[1])
    return ranked[0][0], ranked[0][1], (ranked[1][1] if len(ranked) > 1 else 0)


def snippet_key(t):
    return re.sub(r"[^a-z0-9]", "", (t or "").lower())[:28]


def load_book_list():
    """[{code, name, snippet, page}] from Chummer's books.xml (snippet/page: Chummer's own "is this that book?" check)"""
    root = ET.parse(DATA).getroot()
    books = []
    for b in root.find("books"):
        m = [x for x in b.iter("match") if x.findtext("language") == "en-us"]
        books.append({
            "code": b.findtext("code"), "name": b.findtext("name"),
            "snippet": m[0].findtext("text") if m else None,
            "page": int(m[0].findtext("page")) if m and (m[0].findtext("page") or "").isdigit() else None,
        })
    return books


def code_by_filename(f, books):
    code = OVERRIDE.get(f.lower(), "?")
    if code != "?":
        return code
    ft = norm(f)
    best, score = None, 0
    for b in books:
        if not b["tokens"] or "German-Only" in b["name"]:
            continue
        inter = len(ft & b["tokens"])
        s = inter / max(len(b["tokens"]), 1) - 0.01 * len(ft - b["tokens"])
        if s > score and inter >= 1:
            best, score = b, s
    return best["code"] if best and score >= 0.6 else None


def code_by_content(doc, books):
    """the book whose books.xml snippet is printed in this PDF's first 40 pages (for PDFs with unfamiliar names)"""
    early = [re.sub(r"[^a-z0-9]", "", doc[i].get_text().lower()) for i in range(min(len(doc), 40))]
    for b in books:
        k = snippet_key(b["snippet"])
        if len(k) >= 12 and "German-Only" not in b["name"] and any(k in p for p in early):
            return b["code"]
    return None


def index_pdfs(pdf_dir, books, samples, known=None, log=print, progress=None, unmatched=None):
    """{code: {file, offset, title, pages, guess, verified}} for the PDFs in pdf_dir.
    known: [{file, code, pages}] - PDFs already identified elsewhere (the same file name and page count is taken
    as the same PDF, e.g. a friend's copy of the same books); unknown names fall back to the file name, then to
    the book's text. unmatched: a list to collect the PDFs that couldn't be identified as any book."""
    books = [{**b, "tokens": norm(b["name"])} for b in books]
    known = known or []
    out = {}
    files = sorted(f for f in os.listdir(pdf_dir) if f.lower().endswith(".pdf"))
    for n_file, f in enumerate(files):
        if progress:
            progress(n_file, len(files), f)
        try:
            doc = pymupdf.open(os.path.join(pdf_dir, f))
        except Exception as e:  # noqa
            log(f"error {f} {e}")
            continue
        same = [k for k in known if k["file"].lower() == f.lower() and k.get("pages") == len(doc)]
        code = same[0]["code"] if same else code_by_filename(f, books)
        if not code and f.lower() not in OVERRIDE:          # OVERRIDE -> None means "deliberately not this book"
            code = code_by_content(doc, books)
        if not code:
            log(f"no book match: {f}")
            if unmatched is not None:
                unmatched.append(f)
            continue
        b = next((x for x in books if x["code"] == code), None)
        if b is None:
            continue
        offset = None
        verified = False
        try:
            if b["snippet"] and b["page"] is not None:
                k = snippet_key(b["snippet"])
                for i in range(min(len(doc), 40)):
                    if k and k in re.sub(r"[^a-z0-9]", "", doc[i].get_text().lower()):
                        offset = i + 1 - b["page"]
                        break
            n = len(doc)
            voted, v1, v2 = vote_offset(doc, samples.get(code, []))
            if voted is not None and v1 >= 3 and v1 >= 2 * v2:
                offset = voted
            # printed page numbers are the strongest evidence when the PDF has them
            po, c1, c2 = printed_page_offset(doc)
            verified = False
            if po is not None and c1 >= 15 and c1 >= 5 * max(c2, 1):
                if offset is not None and offset != po:
                    log(f"   note: {code} name-vote offset {offset} != footer offset {po}; using footer")
                offset, verified = po, True
            # the scrambled-font PDFs: only trust the hand-checked offset for the very same file
            if code in MANUAL_OFFSETS and (not known or same):
                offset, verified = MANUAL_OFFSETS[code], True
        except Exception as e:  # noqa
            log(f"error {f} {e}")
            continue
        if code in out:
            # prefer the file with bookmarks / larger page count
            if n <= out[code]["pages"]:
                continue
        out[code] = {"file": f, "offset": offset if offset is not None else 0, "title": b["name"], "pages": n,
                     "guess": offset is None, "verified": verified}
        log(f"{code:8} {f:75} offset={offset}")
    return out


def main():
    out = index_pdfs(PDF_DIR, load_book_list(), collect_samples())
    js = "window.SR5BOOKS=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(js)
    print(len(out), "books indexed")

if __name__ == "__main__":
    sys.exit(main())
