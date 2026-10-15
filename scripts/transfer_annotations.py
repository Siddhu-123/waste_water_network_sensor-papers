#!/usr/bin/env python3
"""Backup-first reconciliation of PDF annotations from the Vercel API into the Cloudflare Worker.

    transfer_annotations.py backup --output DIR   read-only GETs of both APIs, written to DIR (outside the repo)
    transfer_annotations.py plan   --output DIR   merge the verified backup into DIR/plan.json (no network)
    transfer_annotations.py apply  --output DIR [--apply]
                                                  re-check, then POST to Cloudflare only (dry run without --apply)

Nothing here writes to Vercel. Existing backup, plan and receipt files are never overwritten.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path
from urllib import error, request
from urllib.parse import quote

REPO = Path(__file__).resolve().parents[1]
VERCEL = "https://waste-water-network-sensor-papers-two.vercel.app"
CLOUDFLARE = "https://pdf-annotations.sidcode3535.workers.dev"
ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$")
SIDES = ("vercel", "cloudflare")
HEADERS = {"User-Agent": "Mozilla/5.0", "Origin": "https://siddhu-123.github.io",
           "Accept": "application/json", "Cache-Control": "no-cache"}
# An absent key and this explicit value mean the same thing to the viewer.
DEFAULTS = {"status": "active", "title": "", "text": "", "boxes": []}


class TransferError(Exception):
    pass


def utc():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha(data):
    return hashlib.sha256(data).hexdigest()


def canon(obj):
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def pretty(obj):
    return (json.dumps(obj, indent=2, ensure_ascii=False) + "\n").encode()


def write_new(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "xb") as f:  # "x": refuse to overwrite
        f.write(data)


def same(a, b):
    """JSON equality that ignores 1 vs 1.0 and dict key order but not booleans or list order."""
    if isinstance(a, dict):
        return isinstance(b, dict) and a.keys() == b.keys() and all(same(a[k], b[k]) for k in a)
    if isinstance(a, list):
        return isinstance(b, list) and len(a) == len(b) and all(map(same, a, b))
    if isinstance(a, bool) or isinstance(b, bool):
        return a is b
    return a == b


# ---------------------------------------------------------------- HTTP

def _call(req):
    try:
        with request.urlopen(req, timeout=30) as r:
            return r.status, r.read()
    except error.HTTPError as e:
        return e.code, e.read()
    except OSError as e:
        raise TransferError(f"{req.get_method()} {req.full_url}: {e}") from e


def http_get(url):
    return _call(request.Request(url, headers=HEADERS))


def http_post(url, body):
    return _call(request.Request(url, data=body, method="POST", headers={**HEADERS, "Content-Type": "application/json"}))


def check_summary(d, url):
    notes = d.get("notes") if isinstance(d, dict) else None
    if not (isinstance(d, dict) and isinstance(d.get("papers"), dict) and isinstance(notes, list)
            and all(isinstance(n, dict) and n.get("paperId") not in (None, "") for n in notes)):
        raise TransferError(f"{url}: malformed summary")


def check_doc(d, url, pid):
    anns = d.get("annotations") if isinstance(d, dict) else None
    if not (isinstance(anns, list) and str(d.get("paperId")) == pid
            and all(isinstance(a, dict) and isinstance(a.get("id"), str) for a in anns)):
        raise TransferError(f"{url}: malformed document for paper {pid}")


def fetch_json(url, check):
    status, raw = http_get(url)
    if status != 200:
        raise TransferError(f"GET {url} returned HTTP {status}")
    try:
        parsed = json.loads(raw)
    except ValueError as e:
        raise TransferError(f"GET {url}: invalid JSON ({e})") from e
    check(parsed, url)
    return {"url": url, "status": status, "raw": raw, "parsed": parsed}


def summary_url(base):
    return f"{base}/api/annotations"


def doc_url(base, pid):
    return f"{base}/api/annotations/{quote(pid, safe='')}"


def fetch_doc(base, pid):
    return fetch_json(doc_url(base, pid), lambda d, u: check_doc(d, u, pid))


# ---------------------------------------------------------------- backup

def load(path):
    try:
        return json.loads(Path(path).read_bytes())
    except (OSError, ValueError) as e:
        raise TransferError(f"cannot read {path}: {e}") from e


def contributor_ids(root):
    c = root / "contributors"
    files, ids = set(), set()
    if (c / "manifest.json").exists():
        m = load(c / "manifest.json")
        if m.get("teamCompiledPaper"):
            ids.add(str(m["teamCompiledPaper"]["id"]))
        for entry in m.get("contributors", []):
            for key in ("file", "greyLiteratureFile"):
                if entry.get(key):
                    if not (c / entry[key]).is_file():
                        raise TransferError(f"manifest lists missing file {entry[key]}")
                    files.add(c / entry[key])
    for pattern in ("*/papers.json", "*/grey-literature.json"):
        files |= {p for p in c.glob(pattern) if not p.parent.name.startswith("_")}
    for p in files:
        d = load(p)
        for item in (d.get("papers") or []) + (d.get("greyLiterature") or []) + (d.get("compiledPapers") or []):
            ids.add(str(item["id"]))
    return ids


def summary_ids(summary):
    return {str(k) for k in summary["papers"]} | {str(n["paperId"]) for n in summary["notes"]}


def local_ids(root):
    return {m.group(1) for p in (root / "annotations").glob("paper-*.json")
            if (m := re.fullmatch(r"paper-(.+)\.json", p.name))}


def check_output(out, root):
    out, root = Path(out).resolve(), Path(root).resolve()
    if out == root or root in out.parents:
        raise TransferError(f"--output must be outside the repo ({root})")
    if out.exists() and (not out.is_dir() or any(out.iterdir())):
        raise TransferError(f"{out} already exists and is not empty; backups are never overwritten")
    return out


def backup(out, root=REPO, vercel=VERCEL, cloudflare=CLOUDFLARE, workers=6):
    root = Path(root)
    out = check_output(out, root)
    bases = {"vercel": vercel.rstrip("/"), "cloudflare": cloudflare.rstrip("/")}
    workers = max(1, min(int(workers), 8))
    with ThreadPoolExecutor(workers) as pool:
        summaries = dict(zip(SIDES, pool.map(lambda s: fetch_json(summary_url(bases[s]), check_summary), SIDES)))
        sources = {
            "contributors": contributor_ids(root),
            "vercel_summary": summary_ids(summaries["vercel"]["parsed"]),
            "cloudflare_summary": summary_ids(summaries["cloudflare"]["parsed"]),
            "local_annotations": local_ids(root),
        }
        ids = sorted(set().union(*sources.values()))
        bad = [i for i in ids if not ID_RE.match(i)]
        if bad:
            raise TransferError(f"invalid paper IDs: {bad}")
        jobs = [(s, i) for i in ids for s in SIDES]
        docs = dict(zip(jobs, pool.map(lambda j: fetch_doc(bases[j[0]], j[1]), jobs)))  # raises on first failure

    files = []

    def save(rel, data, kind, side, entry=None):
        write_new(out / rel, data)
        files.append({"path": rel, "kind": kind, "side": side, "sha256": sha(data), "size": len(data),
                      **({"url": entry["url"], "http_status": entry["status"]} if entry else {})})

    for side in SIDES:
        e = summaries[side]
        save(f"raw/{side}/summary.json", e["raw"], "raw", side, e)
        save(f"parsed/{side}/summary.json", pretty(e["parsed"]), "parsed", side)
    for (side, pid), e in docs.items():
        save(f"raw/{side}/paper-{pid}.json", e["raw"], "raw", side, e)
        save(f"parsed/{side}/paper-{pid}.json", pretty(e["parsed"]), "parsed", side)
    manifest = {"tool": "transfer_annotations", "created_utc": utc(), "bases": bases, "paper_ids": ids,
                "id_sources": {k: sorted(v) for k, v in sources.items()}, "files": files, "complete": True}
    write_new(out / "manifest.json", pretty(manifest))  # written last: no manifest, no valid backup
    return manifest


def verify_backup(out):
    out = Path(out)
    mpath = out / "manifest.json"
    if not mpath.is_file():
        raise TransferError(f"{out}: no manifest.json (backup incomplete)")
    manifest = load(mpath)
    if manifest.get("complete") is not True:
        raise TransferError("backup manifest is not marked complete")
    paths = {f["path"] for f in manifest["files"]}
    for f in manifest["files"]:
        p = out / f["path"]
        data = p.read_bytes() if p.is_file() else None
        if data is None or len(data) != f["size"] or sha(data) != f["sha256"]:
            raise TransferError(f"backup file failed verification: {f['path']}")
        if f["kind"] == "parsed" and json.loads(data) != json.loads((out / f["path"].replace("parsed/", "raw/", 1)).read_bytes()):
            raise TransferError(f"parsed copy differs from raw bytes: {f['path']}")
    for side in SIDES:
        for pid in manifest["paper_ids"] + ["summary"]:
            name = "summary" if pid == "summary" else f"paper-{pid}"
            for kind in ("raw", "parsed"):
                if f"{kind}/{side}/{name}.json" not in paths:
                    raise TransferError(f"backup missing {kind}/{side}/{name}.json")
    return manifest, sha(mpath.read_bytes())


# ---------------------------------------------------------------- Cloudflare normalizer (port of cloudflare-backend/src/index.js)

def js_num(v):
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        try:
            return float(v) if v.strip() else 0.0
        except ValueError:
            return math.nan
    return math.nan


def clamp(v, lo, hi):
    n = js_num(v)
    if math.isnan(n):
        raise ValueError("non-numeric value")
    return max(lo, min(hi, n))


def in_range(v, lo, hi):
    n = js_num(v)
    return not math.isnan(n) and lo <= n <= hi


def first(*vals):
    return next((v for v in vals if v is not None), None)


def cf_normalize(v):
    """What the Worker would store for annotation v; raises ValueError where it rejects it."""
    if not isinstance(v, dict) or v.get("type") not in ("highlight", "sticky-note"):
        raise ValueError("unsupported annotation")
    aid = str(v.get("id") or "").strip()
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,120}", aid):
        raise ValueError("invalid id")
    page = js_num(first(v.get("page"), v.get("pageNumber")))
    if not math.isfinite(page) or page != int(page) or not 1 <= page <= 10000:
        raise ValueError("invalid page")
    n = {"id": aid, "type": v["type"], "page": int(page),
         "x": clamp(first(v.get("x"), v.get("relativeX"), 0), 0, 1),
         "y": clamp(first(v.get("y"), v.get("relativeY"), 0), 0, 1),
         "createdBy": str(v.get("createdBy") or "Unknown contributor")[:120],
         "createdAt": str(v.get("createdAt") or "")[:40]}
    if not n["createdAt"]:
        raise ValueError("missing createdAt (Worker would invent one)")
    if v["type"] == "highlight":
        color, opacity = str(v.get("color") or "#ffdf5d"), js_num(first(v.get("opacity"), 0.42))
        n["width"], n["height"] = clamp(first(v.get("width"), 0.05), 0.0001, 1), clamp(first(v.get("height"), 0.02), 0.0001, 1)
        n["color"] = color if re.fullmatch(r"#[0-9a-fA-F]{6}", color) else "#ffdf5d"
        n["opacity"] = opacity if in_range(opacity, 0.05, 1) else 0.42
        if isinstance(v.get("text"), str) and v["text"].strip():
            n["text"] = v["text"].strip()[:2000]
        if isinstance(v.get("boxes"), list) and v["boxes"]:
            n["boxes"] = [{k: clamp(b.get(k), lo, 1) for k, lo in (("x", 0), ("y", 0), ("width", 0.0001), ("height", 0.0001))}
                          for b in v["boxes"][:100] if isinstance(b, dict) and all(k in b and in_range(b[k], -1e308, 1e308) for k in ("x", "y", "width", "height"))]
    else:
        text = str(v.get("text") or "").strip()
        if not text:
            raise ValueError("empty note text")
        n["text"] = text[:3000]
        if isinstance(v.get("title"), str) and v["title"]:
            n["title"] = v["title"].strip()[:120]
        if v.get("status") in ("deleted", "active"):
            n["status"] = v["status"]
        for key, size in (("deletedBy", 120), ("deletedAt", 40)):
            if isinstance(v.get(key), str) and v[key]:
                n[key] = v[key].strip()[:size]
        n["width"] = float(v["width"]) if in_range(v.get("width"), 0.01, 0.3) else 0.06
        n["height"] = float(v["height"]) if in_range(v.get("height"), 0.01, 0.3) else 0.06
        n["color"] = v["color"] if re.fullmatch(r"#[0-9a-fA-F]{6}", str(v.get("color") or "")) else "#ffd166"
    return n


# ---------------------------------------------------------------- merge / plan

def diff_fields(c, v):
    return sorted(k for k in c.keys() | v.keys() if not (k in c and k in v and same(c[k], v[k])))


def harmless(c, v, fields):
    """Every differing field is absent on one side and the documented default on the other."""
    return all(k in DEFAULTS and (k in c) != (k in v) and same((c if k in c else v)[k], DEFAULTS[k]) for k in fields)


def merge_paper(cf_doc, vc_doc):
    """Cloudflare order first, then Vercel-only annotations; annotation objects are kept untouched."""
    cf, vc = cf_doc["annotations"], vc_doc["annotations"]
    out = {"status": "noop", "desired": list(cf), "added": [], "resolved": [], "conflicts": []}
    for name, anns in (("cloudflare", cf), ("vercel", vc)):
        dupes = sorted({a["id"] for a in anns if sum(b["id"] == a["id"] for b in anns) > 1})
        if dupes:
            out["conflicts"].append({"id": None, "reason": f"duplicate ids in {name}: {dupes}", "cloudflare": None, "vercel": None})
    cf_by = {a["id"]: a for a in cf}
    for v in vc:
        c = cf_by.get(v["id"])
        if c is None:
            out["desired"].append(v)
            out["added"].append(v["id"])
        elif not same(c, v):
            fields = diff_fields(c, v)
            entry = {"id": v["id"], "fields": fields, "cloudflare": c, "vercel": v}
            if harmless(c, v, fields):
                out["resolved"].append({**entry, "kept": "cloudflare", "reason": "only absent-default metadata differs"})
            else:
                reason = "deleted status differs" if "status" in fields and "deleted" in (c.get("status"), v.get("status")) \
                    else "annotation fields differ"
                out["conflicts"].append({**entry, "reason": reason})
    if out["added"]:
        out["status"] = "write"
        for a in out["desired"]:
            try:
                if not same(cf_normalize(a), a):
                    out["conflicts"].append({"id": a["id"], "reason": "Cloudflare would store this annotation differently",
                                             "cloudflare": cf_by.get(a["id"]), "vercel": a, "stored_as": cf_normalize(a)})
            except ValueError as e:
                out["conflicts"].append({"id": a["id"], "reason": f"Cloudflare would reject this annotation: {e}",
                                         "cloudflare": cf_by.get(a["id"]), "vercel": a})
    if out["conflicts"]:
        out["status"] = "conflict"
    return out


def read_side(out, side, name):
    return json.loads((Path(out) / f"raw/{side}/{name}.json").read_bytes())


def make_plan(out):
    out = Path(out)
    manifest, msha = verify_backup(out)
    papers = {}
    for pid in manifest["paper_ids"]:
        cf, vc = (read_side(out, s, f"paper-{pid}") for s in ("cloudflare", "vercel"))
        m = merge_paper(cf, vc)
        papers[pid] = {**m, "cloudflare_revision": cf.get("revision"), "vercel_revision": vc.get("revision"),
                       "cloudflare_doc_sha256": sha(canon(cf)), "vercel_doc_sha256": sha(canon(vc))}
    plan = {"created_utc": utc(), "backup_manifest_sha256": msha, "bases": manifest["bases"],
            "content_sha256": sha(canon(papers)), "has_conflicts": any(p["status"] == "conflict" for p in papers.values()),
            "papers": papers, "completed": True}
    write_new(out / "plan.json", pretty(plan))
    return plan


def load_plan(out):
    out = Path(out)
    manifest, msha = verify_backup(out)
    plan = load(out / "plan.json")
    if plan.get("completed") is not True or plan.get("content_sha256") != sha(canon(plan.get("papers"))):
        raise TransferError("plan.json is incomplete or has been edited")
    if plan["backup_manifest_sha256"] != msha:
        raise TransferError("plan.json was made from a different backup")
    return plan


# ---------------------------------------------------------------- apply

def ensure_unchanged(plan, pid):
    p, bases = plan["papers"][pid], plan["bases"]
    for side in SIDES:
        doc = fetch_doc(bases[side], pid)["parsed"]
        if sha(canon(doc)) != p[f"{side}_doc_sha256"]:
            raise TransferError(f"{side} document for paper {pid} changed since the backup; aborting")


def verify_written(desired, doc):
    """Field-level comparison of the stored annotations with the desired list."""
    stored, problems = doc["annotations"], []
    if len(stored) != len(desired):
        problems.append(f"count {len(stored)} != {len(desired)}")
    for i, want in enumerate(desired):
        got = stored[i] if i < len(stored) else None
        if got is None or got.get("id") != want["id"]:
            problems.append({"index": i, "id": want["id"], "problem": "missing or out of order"})
        elif not same(got, want):
            problems.append({"index": i, "id": want["id"], "fields": diff_fields(got, want)})
    return problems


def apply_plan(out, do_apply=False, author="Annotation transfer"):
    out = Path(out)
    plan = load_plan(out)
    if plan["has_conflicts"]:
        raise TransferError("plan has unresolved conflicts; nothing will be written")
    todo = [pid for pid, p in plan["papers"].items() if p["status"] == "write"]
    for pid in todo:
        ensure_unchanged(plan, pid)
    if not do_apply:
        return {"dry_run": True, "would_write": todo}
    run = out / f"apply-{utc().replace(':', '')}"
    receipts = []
    base = plan["bases"]["cloudflare"]  # the only host this tool ever POSTs to
    try:
        for pid in todo:
            p = plan["papers"][pid]
            ensure_unchanged(plan, pid)  # immediately before the write
            body = canon({"paperId": pid, "revision": p["cloudflare_revision"], "author": author, "annotations": p["desired"]})
            write_new(run / f"paper-{pid}.request.json", body)
            status, raw = http_post(doc_url(base, pid), body)
            write_new(run / f"paper-{pid}.response.json", raw)
            if status != 200:
                raise TransferError(f"POST paper {pid} returned HTTP {status}; see {run}")
            fresh = fetch_doc(base, pid)
            problems = verify_written(p["desired"], fresh["parsed"])
            receipt = {"paperId": pid, "http_status": status, "response_sha256": sha(raw), "sent_revision": p["cloudflare_revision"],
                       "new_revision": fresh["parsed"].get("revision"), "verified": not problems, "problems": problems}
            write_new(run / f"paper-{pid}.verify.json", pretty({**receipt, "document": fresh["parsed"]}))
            receipts.append(receipt)
            if problems:
                raise TransferError(f"verification failed for paper {pid}: {problems}")
    finally:
        if receipts:
            write_new(run / "receipts.json", pretty(receipts))
    return {"dry_run": False, "written": todo, "receipts": receipts, "directory": str(run)}


# ---------------------------------------------------------------- CLI

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("backup", "plan", "apply"):
        s = sub.add_parser(name)
        s.add_argument("--output", required=True, help="directory outside the repo")
    b = sub.choices["backup"]
    b.add_argument("--root", default=str(REPO))
    b.add_argument("--vercel", default=VERCEL)
    b.add_argument("--cloudflare", default=CLOUDFLARE)
    b.add_argument("--workers", type=int, default=6)
    a = sub.choices["apply"]
    a.add_argument("--apply", action="store_true", help="perform the writes (otherwise a dry run)")
    a.add_argument("--author", default="Annotation transfer")
    args = ap.parse_args(argv)
    try:
        if args.cmd == "backup":
            m = backup(args.output, args.root, args.vercel, args.cloudflare, args.workers)
            print(f"backup complete: {len(m['paper_ids'])} papers, {len(m['files'])} files in {args.output}")
        elif args.cmd == "plan":
            plan = make_plan(args.output)
            counts = {}
            for p in plan["papers"].values():
                counts[p["status"]] = counts.get(p["status"], 0) + 1
            print(f"plan written: {counts}")
            return 2 if plan["has_conflicts"] else 0
        else:
            print(json.dumps(apply_plan(args.output, args.apply, args.author), indent=2))
    except (TransferError, OSError) as e:
        print(f"error: {e}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
