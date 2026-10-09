"""Convert Chummer5a's XML game data into a single compact JS file for the app.

Usage:  python tools/build_data.py
Reads:  ../Chummer5.226.0/data/*.xml   (Chummer5a data, GPL-3.0)
Writes: dist/data.js                   (window.SR5DATA = {...})
"""
import json
import os
import sys
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
DATA_DIR = os.path.join(ROOT, "Chummer5.226.0", "data")
OUT_DIR = os.path.join(HERE, "..", "dist")

# files -> which top-level sections to keep (None = all)
FILES = {
    "books": ["books"],
    "metatypes": ["metatypes"],
    "priorities": ["prioritytables", "priorities"],
    "skills": ["skillgroups", "skills", "knowledgeskills", "categories"],
    "qualities": ["qualities"],
    "spells": ["spells"],
    "powers": ["powers", "enhancements"],
    "complexforms": ["complexforms"],
    "programs": ["programs"],
    "metamagic": ["metamagics", "arts"],
    "mentors": ["mentors"],
    "traditions": ["traditions", "spirits", "drainattributes"],
    "martialarts": ["martialarts", "techniques"],
    "weapons": ["weapons", "accessories", "categories"],
    "armor": ["armors", "mods", "categories"],
    "gear": ["gears", "categories"],
    "cyberware": ["grades", "cyberwares", "categories"],
    "bioware": ["grades", "biowares", "categories"],
    "lifestyles": ["lifestyles", "comforts", "neighborhoods", "securities", "qualities", "cities"],
    "vehicles": ["vehicles", "mods", "categories"],
    "contacts": None,
    "echoes": ["echoes"],
    "actions": ["actions"],
    "streams": ["traditions", "spirits"],
    "critterpowers": ["powers", "categories"],
}

# element names that must always be lists even if only one child exists
ALWAYS_LIST = {
    "quality", "gear", "weapon", "mod", "accessory", "metavariant", "metatype", "talent",
    "skill", "spell", "spec", "spirit", "grade", "cyberware", "bioware", "armor", "spellcategory",
    "select", "power", "technique", "martialart", "metamagic", "art", "subsystem", "program",
    "critterpower", "skillgroup",
}
DROP_TAGS = {"matches", "hide"}


FLATTEN = {("skillgroupchoices", "skillgroup"), ("selectmodsfromcategory", "category")}


def plural(k):
    return k[:-1] + "ies" if k.endswith("y") else k + "s"


def conv(e):
    kids = list(e)
    text = (e.text or "").strip()
    if not kids:
        if e.attrib:
            d = {("@" + k): v for k, v in e.attrib.items() if k != "xpath"}
            if text:
                d["_"] = text
            return d if len(d) > 0 else text
        return text
    d = {}
    for k in kids:
        if k.tag in DROP_TAGS:
            continue
        v = conv(k)
        if k.tag in d:
            if not isinstance(d[k.tag], list):
                d[k.tag] = [d[k.tag]]
            d[k.tag].append(v)
        elif k.tag in ALWAYS_LIST:
            d[k.tag] = [v]
        else:
            d[k.tag] = v
    if e.attrib:
        for k, v in e.attrib.items():
            if k != "xpath":
                d["@" + k] = v
    # <metatypes><metatype>..</metatype>..</metatypes>  ->  metatypes: [..]
    if len(d) == 1:
        (k, v), = d.items()
        if isinstance(v, list) and (e.tag == plural(k) or (e.tag, k) in FLATTEN):
            return v
    return d


def short_id(s, used):
    for n in (10, 14, 20, 36):
        k = s.replace("-", "")[:n]
        if k not in used or used[k] == s:
            used[k] = s
            return k
    return s


def load_page_fixes():
    """{uuid: corrected printed page} from tools/page_fixes.py (built from the PDFs), if it has been run."""
    p = os.path.join(HERE, "page_fixes.json")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        return {k: str(v["to"]) for k, v in json.load(fh).items()}


def load_blurbs():
    """{uuid: {text, page}} from tools/extract_text.py (built from your PDFs), if it has been run."""
    p = os.path.join(HERE, "blurbs.json")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


def load_drugs():
    """{uuid: drug record} from tools/extract_drugs.py (built from your PDFs), if it has been run."""
    p = os.path.join(HERE, "drugs.json")
    if not os.path.exists(p):
        return {}
    with open(p, encoding="utf-8") as fh:
        return json.load(fh)


DRUG_KEYS = ("vector", "speed", "duration", "addictionType", "addictionRating", "addictionThreshold", "penetration", "power", "effect", "flavor")


def write_catalog(items, drugs):
    """tools/catalog.json: what tools/rulebook_reader.py needs to read descriptions out of someone else's PDFs
    without a Chummer install - every item's app id + name + book + page, the book list, and name/page samples per
    book (to work out a PDF's page offset). Names and page numbers only: no rulebook text, safe to ship."""
    sys.path.insert(0, HERE)
    import book_index
    samples = {code: lst[:1200] for code, lst in book_index.collect_samples().items()}
    known = []
    books_js = os.path.join(OUT_DIR, "books.js")
    if os.path.exists(books_js):
        t = open(books_js, encoding="utf-8").read()
        for code, b in json.loads(t[len("window.SR5BOOKS="):t.rindex(";")]).items():
            known.append({"file": b["file"], "code": code, "pages": b.get("pages")})
    cat = {"version": 1, "books": book_index.load_book_list(), "samples": samples, "known": known,
           "items": items, "drugs": drugs}
    with open(os.path.join(HERE, "catalog.json"), "w", encoding="utf-8") as f:
        json.dump(cat, f, ensure_ascii=False, separators=(",", ":"))
    print(f"wrote tools/catalog.json  ({len(items)} items, {len(drugs)} drugs, {len(cat['books'])} books)")


def main():
    blurbs = load_blurbs()
    drugs = load_drugs()
    cat_items, cat_drugs = [], []
    drug_out = {}
    text_out = {}
    fixes = load_page_fixes()
    n_fixed = 0
    out = {}
    used = {}
    n_items = 0
    for name, sections in FILES.items():
        path = os.path.join(DATA_DIR, name + ".xml")
        if not os.path.exists(path):
            print("skip", name)
            continue
        root = ET.parse(path).getroot()
        d = {}
        for sec in root:
            if sections is not None and sec.tag not in sections:
                continue
            items = []
            for it in sec:
                if it.tag in DROP_TAGS:
                    continue
                v = conv(it)
                # hidden items are internal (auto-granted); keep for lookups, flag so pickers skip them
                if isinstance(v, dict) and it.find("hide") is not None and sec.tag != "categories":
                    v["hide"] = 1
                if isinstance(v, dict) and "id" in v and len(v["id"]) >= 30:
                    if v["id"] in fixes:
                        v["page"] = fixes[v["id"]]
                        n_fixed += 1
                    b = blurbs.get(v["id"])
                    uuid = v["id"]
                    dr = drugs.get(v["id"])
                    listed = str(v.get("page") or "")        # the page the reader should look on (before the found-page override)
                    src = v.get("source") if isinstance(v.get("source"), str) else None
                    if b:
                        v["page"] = str(b["page"])          # the page the entry itself was found on: the most exact link
                    if dr:
                        v["page"] = str(dr["page"])
                    v["id"] = short_id(v["id"], used)
                    if src and listed.isdigit() and isinstance(v.get("name"), str):
                        cat_items.append([v["id"], v["name"], src, int(listed), name])
                        if name == "gear" and v.get("category") == "Drugs":
                            cat_drugs.append([v["id"], v["name"], src, int(listed)])
                    if b:
                        text_out[v["id"]] = [b["text"], b["page"]]
                    if dr:
                        drug_out[v["id"]] = {k: dr[k] for k in DRUG_KEYS if k in dr} | {"page": dr["page"]}
                items.append(v)
            d[sec.tag] = items
            n_items += len(items)
        out[name] = d
    os.makedirs(OUT_DIR, exist_ok=True)
    js = "window.SR5DATA=" + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n"
    with open(os.path.join(OUT_DIR, "data.js"), "w", encoding="utf-8") as f:
        f.write(js)
    # rulebook excerpts live in their own file: they come from your PDFs and are not part of the game data
    with open(os.path.join(OUT_DIR, "blurbs.js"), "w", encoding="utf-8") as f:
        f.write("window.SR5TEXT=" + json.dumps(text_out, ensure_ascii=False, separators=(",", ":")) + ";\n")
        f.write("window.SR5DRUGS=" + json.dumps(drug_out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print(f"wrote dist/blurbs.js  ({len(text_out)} rulebook excerpts, {len(drug_out)} drug entries)")
    print(f"wrote dist/data.js  {len(js)/1e6:.2f} MB  ({n_items} entries in {len(out)} files, {n_fixed} page references corrected)")
    write_catalog(cat_items, cat_drugs)


if __name__ == "__main__":
    sys.exit(main())
