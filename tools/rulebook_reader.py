"""Read item descriptions and drug profiles out of *your own* rulebook PDFs, for the desktop app's
Settings -> "Read descriptions from my PDFs" button. Same extraction as tools/extract_text.py / extract_drugs.py,
but driven by tools/catalog.json (written by tools/build_data.py) instead of a Chummer install, so it works in a
shared copy of the app. Packaged into rulebook-reader.exe by tools/make_share.mjs.

Usage:  rulebook_reader.py --pdfs <folder> --catalog <catalog.json> --out <descriptions.json>
Prints one JSON object per line on stdout ({"stage", "i", "n", "label"} progress, then {"done": ...}) for the app.
Writes: {version, folder, created, books: {code: {file, offset, title, pages}}, text: {id: [text, page]},
         drugs: {id: {...fields, page}}, unmatched: [pdf file names]}
The output is quoted from the PDFs on this computer; it stays on this computer.
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import book_index  # noqa: E402
from extract_drugs import extract_drug_records  # noqa: E402
from extract_text import extract_texts  # noqa: E402

DRUG_KEYS = ("vector", "speed", "duration", "addictionType", "addictionRating", "addictionThreshold", "penetration", "power", "effect", "flavor")


def emit(**kw):
    print(json.dumps(kw, ensure_ascii=False), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdfs", required=True)
    ap.add_argument("--catalog", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    # progress goes to stdout as JSON; the scripts' own log lines go to stderr
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    log = lambda m: print(m, file=sys.stderr, flush=True)  # noqa: E731
    if not os.path.isdir(a.pdfs):
        emit(error=f"Folder not found: {a.pdfs}")
        return 2
    cat = json.load(open(a.catalog, encoding="utf-8"))
    t0 = time.time()

    pdfs = sorted(f for f in os.listdir(a.pdfs) if f.lower().endswith(".pdf"))
    if not pdfs:
        emit(error="There are no PDF files in that folder.")
        return 2
    unmatched = []   # PDFs that aren't any SR5 book we know (a duplicate copy of a book isn't listed)
    books = book_index.index_pdfs(a.pdfs, cat["books"], cat["samples"], known=cat.get("known"), log=log,
                                  progress=lambda i, n, f: emit(stage="books", i=i, n=n, label=f), unmatched=unmatched)

    items = [tuple(x) for x in cat["items"]]
    found = extract_texts(books, items, a.pdfs, log=log, progress=lambda i, n, code: emit(stage="text", i=i, n=n, label=books[code]["title"]))
    emit(stage="drugs", i=0, n=1, label="Drug profiles")
    drugs, _missing = extract_drug_records(books, [tuple(x) for x in cat["drugs"]], a.pdfs, log=log)

    out = {
        "version": 1,
        "folder": os.path.abspath(a.pdfs),
        "created": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "books": {c: {k: b[k] for k in ("file", "offset", "title", "pages")} for c, b in books.items()},
        "text": {k: [v["text"], v["page"]] for k, v in found.items()},
        "drugs": {k: {**{f: v[f] for f in DRUG_KEYS if f in v}, "page": v["page"]} for k, v in drugs.items()},
        "unmatched": unmatched,
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    tmp = a.out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, a.out)
    emit(done=True, books=len(books), text=len(out["text"]), drugs=len(out["drugs"]), unmatched=unmatched,
         seconds=round(time.time() - t0))
    return 0


if __name__ == "__main__":
    sys.exit(main())
