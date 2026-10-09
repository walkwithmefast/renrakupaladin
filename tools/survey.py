import sys, xml.etree.ElementTree as ET, collections
d = "Chummer5.226.0/data/"
def survey(fn, depth=3):
    root = ET.parse(d+fn).getroot()
    print("=====", fn)
    for sec in root:
        kids = list(sec)
        print(f"<{sec.tag}> children={len(kids)}", ("first: <%s>" % kids[0].tag) if kids else (sec.text or "").strip()[:60])
        if kids and len(kids[0]):
            ex = kids[0]
            tags = collections.Counter()
            for k in kids:
                for c in k: tags[c.tag]+=1
            print("   fields:", dict(tags))
for f in sys.argv[1:]: survey(f)
