#!/usr/bin/env python3
"""Offline tests for scripts/transfer_annotations.py: backup integrity, merging, conflicts and guarded apply.

Both APIs are replaced by an in-memory fake; no network access happens.
Run with: python3 -m unittest discover -s scripts -p test_transfer_annotations.py
"""

from __future__ import annotations

import contextlib
import copy
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import transfer_annotations as ta  # noqa: E402

VB, CB = "https://vercel.test", "https://cf.test"


def note(i, **kw):
    return {"id": i, "type": "sticky-note", "page": 1, "x": 0.1, "y": 0.2, "createdBy": "Ann",
            "createdAt": "2026-09-01T00:00:00.000Z", "text": "check this", "width": 0.06, "height": 0.06,
            "color": "#ffd166", **kw}


def highlight(i, **kw):
    return {"id": i, "type": "highlight", "page": 2, "x": 0.1, "y": 0.2, "createdBy": "Bo",
            "createdAt": "2026-09-02T00:00:00.000Z", "width": 0.3, "height": 0.02, "color": "#ffdf5d", "opacity": 0.42,
            "text": "level is not flow", "boxes": [{"x": 0.1, "y": 0.2, "width": 0.3, "height": 0.02}], **kw}


class Fake:
    """Stands in for both APIs. Documents are {pid: doc}; the Worker keeps whatever it is sent."""

    def __init__(self):
        self.docs = {"vercel": {}, "cloudflare": {}}
        self.posts, self.fail, self.mangle, self.after_post, self.n = [], {}, None, None, 0

    def set(self, side, pid, anns, revision="rev-1"):
        self.docs[side][pid] = {"paperId": pid, "version": 1, "revision": revision, "updatedAt": "2026-09-05T00:00:00Z",
                                "updatedBy": "x", "annotations": anns}

    def doc(self, side, pid):
        return self.docs[side].get(pid) or {"paperId": pid, "version": 1, "revision": None, "updatedAt": None,
                                            "updatedBy": None, "annotations": []}

    def get(self, url):
        if url in self.fail:
            return self.fail[url]
        side, base = ("vercel", VB) if url.startswith(VB) else ("cloudflare", CB)
        path = url[len(base):]
        if path == "/api/annotations":
            body = {"papers": {p: {} for p in self.docs[side]}, "notes": []}
        else:
            body = self.doc(side, path.rsplit("/", 1)[1])
        return 200, json.dumps(body, indent=1).encode()

    def post(self, url, data):
        assert url.startswith(CB + "/api/annotations/"), f"write outside Cloudflare: {url}"
        pid, body = url.rsplit("/", 1)[1], json.loads(data)
        self.posts.append((pid, body))
        self.n += 1
        anns = self.mangle(body["annotations"]) if self.mangle else body["annotations"]
        self.set("cloudflare", pid, copy.deepcopy(anns), revision=f"rev-new-{self.n}")
        if self.after_post:
            self.after_post(self)
        return 200, json.dumps(self.docs["cloudflare"][pid]).encode()


class Base(unittest.TestCase):
    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.tmp = Path(tmp.name)
        self.root, self.out = self.tmp / "repo", self.tmp / "backup"
        (self.root / "contributors" / "ann").mkdir(parents=True)
        (self.root / "contributors" / "_template").mkdir()
        (self.root / "annotations").mkdir()
        (self.root / "annotations" / "paper-9.json").write_text("{}")
        (self.root / "contributors" / "manifest.json").write_text(json.dumps({
            "teamCompiledPaper": {"id": "team-compiled-paper"},
            "contributors": [{"name": "Ann", "file": "./ann/papers.json", "greyLiteratureFile": "./ann/grey-literature.json"}]}))
        (self.root / "contributors" / "ann" / "papers.json").write_text(json.dumps({"papers": [{"id": 1}, {"id": 2}]}))
        (self.root / "contributors" / "ann" / "grey-literature.json").write_text(json.dumps({"greyLiterature": [{"id": "GL-01"}]}))
        (self.root / "contributors" / "_template" / "papers.json").write_text(json.dumps({"papers": [{"id": 777}]}))
        self.fake = Fake()
        for target, fn in (("http_get", self.fake.get), ("http_post", self.fake.post)):
            p = mock.patch.object(ta, target, fn)
            p.start()
            self.addCleanup(p.stop)

    def backup(self):
        return ta.backup(self.out, self.root, VB, CB, workers=3)

    def seed(self):
        """Paper 1 merges cleanly, paper 2 only exists on Vercel, paper 3 already matches."""
        f = self.fake
        f.set("cloudflare", "1", [note("n1"), note("n2")])
        f.set("vercel", "1", [note("n2"), note("n3"), note("n1", status="active")])
        f.set("vercel", "2", [highlight("h1"), note("n4", status="deleted", deletedBy="Bo", deletedAt="2026-09-03T00:00:00.000Z")], revision="v-2")
        f.set("cloudflare", "3", [note("n5")])
        f.set("vercel", "3", [note("n5")])

    def prepared(self):
        self.seed()
        self.backup()
        plan = ta.make_plan(self.out)
        self.assertFalse(plan["has_conflicts"], plan)
        return plan


class BackupTests(Base):
    def test_backup_keeps_raw_bytes_hashes_and_union_of_ids(self):
        self.seed()
        self.fake.set("cloudflare", "only-cf", [note("z")])
        manifest = self.backup()
        self.assertEqual(manifest["paper_ids"], sorted({"1", "2", "3", "GL-01", "team-compiled-paper", "9", "only-cf"}))
        self.assertNotIn("777", manifest["paper_ids"])  # template folders are skipped
        self.assertEqual((self.out / "raw/cloudflare/paper-1.json").read_bytes(), self.fake.get(CB + "/api/annotations/1")[1])
        self.assertEqual(json.loads((self.out / "parsed/vercel/paper-2.json").read_bytes()), self.fake.doc("vercel", "2"))
        self.assertEqual(len([f for f in manifest["files"] if f["kind"] == "raw"]), 2 * (len(manifest["paper_ids"]) + 1))
        for f in manifest["files"]:
            data = (self.out / f["path"]).read_bytes()
            self.assertEqual((f["size"], f["sha256"]), (len(data), ta.sha(data)))
        self.assertRegex(manifest["created_utc"], r"^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$")
        ta.verify_backup(self.out)

    def test_refuses_output_inside_repo_or_existing_backup(self):
        with self.assertRaises(ta.TransferError):
            ta.backup(self.root / "backup", self.root, VB, CB)
        self.seed()
        self.backup()
        before = (self.out / "manifest.json").read_bytes()
        with self.assertRaises(ta.TransferError):
            self.backup()
        self.assertEqual((self.out / "manifest.json").read_bytes(), before)

    def test_write_new_never_overwrites(self):
        target = self.tmp / "f.json"
        ta.write_new(target, b"one")
        with self.assertRaises(FileExistsError):
            ta.write_new(target, b"two")
        self.assertEqual(target.read_bytes(), b"one")

    def test_http_error_or_bad_json_fails_without_writing_anything(self):
        for bad in ((500, b"boom"), (200, b"<html>"), (200, b"[]")):
            self.fake.fail = {CB + "/api/annotations/1": bad}
            with self.assertRaises(ta.TransferError):
                self.backup()
            self.assertFalse(self.out.exists() and any(self.out.iterdir()))
        self.fake.fail = {VB + "/api/annotations": (200, b'{"papers": {}}')}
        with self.assertRaises(ta.TransferError):
            self.backup()

    def test_verify_detects_tampering_and_missing_manifest(self):
        self.seed()
        self.backup()
        raw = self.out / "raw/vercel/paper-1.json"
        original = raw.read_bytes()
        raw.write_bytes(original.replace(b"n3", b"nX"))
        with self.assertRaises(ta.TransferError):
            ta.verify_backup(self.out)
        raw.write_bytes(original)
        (self.out / "parsed/cloudflare/paper-1.json").unlink()
        with self.assertRaises(ta.TransferError):
            ta.verify_backup(self.out)
        (self.out / "manifest.json").unlink()
        with self.assertRaises(ta.TransferError):
            ta.verify_backup(self.out)


class MergeTests(unittest.TestCase):
    def doc(self, *anns):
        return {"annotations": list(anns)}

    def test_keeps_cloudflare_order_then_vercel_only_with_exact_objects(self):
        cf = [note("b"), note("a")]
        vercel_only = note("c", deletedDevice="phone", status="deleted", deletedAt="2026-09-03T00:00:00.000Z")
        m = ta.merge_paper(self.doc(*cf), self.doc(note("a"), vercel_only, note("b")))
        self.assertEqual([a["id"] for a in m["desired"]], ["b", "a", "c"])
        self.assertIs(m["desired"][2], vercel_only)
        self.assertEqual(m["added"], ["c"])

    def test_identical_and_cloudflare_only_is_a_noop(self):
        m = ta.merge_paper(self.doc(note("a"), note("only")), self.doc(note("a")))
        self.assertEqual((m["status"], m["added"], m["conflicts"]), ("noop", [], []))

    def test_absent_default_difference_resolves_keeping_cloudflare_object(self):
        cf = note("a")
        m = ta.merge_paper(self.doc(cf), self.doc(note("a", status="active")))
        self.assertEqual(m["status"], "noop")
        self.assertEqual(m["resolved"][0]["fields"], ["status"])
        self.assertIs(m["desired"][0], cf)

    def test_semantic_differences_are_conflicts_with_both_variants(self):
        cases = {
            "deleted": (note("a"), note("a", status="deleted", deletedAt="2026-09-03T00:00:00.000Z")),
            "text": (note("a"), note("a", text="other")),
            "createdAt": (note("a"), note("a", createdAt="2026-09-09T00:00:00.000Z")),
            "deleted-vs-active": (note("a", status="active"), note("a", status="deleted")),
            "x": (highlight("a"), highlight("a", x=0.5)),
        }
        for name, (c, v) in cases.items():
            m = ta.merge_paper(self.doc(c), self.doc(v))
            self.assertEqual(m["status"], "conflict", name)
            conflict = m["conflicts"][0]
            self.assertEqual((conflict["cloudflare"], conflict["vercel"]), (c, v), name)
        self.assertEqual(ta.merge_paper(self.doc(*[cases["deleted"][0]]), self.doc(cases["deleted"][1]))["conflicts"][0]["reason"],
                         "deleted status differs")

    def test_annotation_the_worker_would_alter_or_reject_is_a_conflict(self):
        for bad in (note("a", deletedDevice="phone"), note("a", text=""), note("a", page=0)):
            m = ta.merge_paper(self.doc(), self.doc(bad))
            self.assertEqual(m["status"], "conflict", bad)
        self.assertEqual(ta.merge_paper(self.doc(), self.doc(highlight("h"), note("n")))["status"], "write")

    def test_duplicate_ids_in_a_source_are_a_conflict(self):
        m = ta.merge_paper(self.doc(note("a"), note("a")), self.doc())
        self.assertEqual(m["status"], "conflict")


class PlanAndApplyTests(Base):
    def test_plan_records_merge_and_revisions(self):
        plan = self.prepared()
        p1, p2, p3 = (plan["papers"][i] for i in "123")
        self.assertEqual(([a["id"] for a in p1["desired"]], p1["status"], p1["cloudflare_revision"]), (["n1", "n2", "n3"], "write", "rev-1"))
        self.assertEqual(p1["resolved"][0]["id"], "n1")
        self.assertEqual((p2["status"], p2["cloudflare_revision"], p2["vercel_revision"]), ("write", None, "v-2"))
        self.assertEqual(p3["status"], "noop")
        self.assertEqual(plan["papers"]["1"]["vercel_doc_sha256"], ta.sha(ta.canon(self.fake.doc("vercel", "1"))))
        with self.assertRaises(FileExistsError):
            ta.make_plan(self.out)

    def test_conflicts_block_every_write(self):
        self.seed()
        self.fake.set("vercel", "3", [note("n5", text="changed")])
        self.backup()
        plan = ta.make_plan(self.out)
        self.assertTrue(plan["has_conflicts"])
        with self.assertRaisesRegex(ta.TransferError, "conflicts"):
            ta.apply_plan(self.out, do_apply=True)
        self.assertEqual(self.fake.posts, [])

    def test_dry_run_and_cli_do_not_post(self):
        self.prepared()
        self.assertEqual(ta.apply_plan(self.out), {"dry_run": True, "would_write": ["1", "2"]})
        with contextlib.redirect_stdout(io.StringIO()) as buf:
            self.assertEqual(ta.main(["apply", "--output", str(self.out)]), 0)
        self.assertIn('"dry_run": true', buf.getvalue())
        self.assertEqual(self.fake.posts, [])

    def test_apply_writes_cloudflare_only_with_revision_and_preserves_tombstones(self):
        self.prepared()
        result = ta.apply_plan(self.out, do_apply=True)
        self.assertEqual(result["written"], ["1", "2"])
        self.assertEqual([(pid, b["revision"]) for pid, b in self.fake.posts], [("1", "rev-1"), ("2", None)])
        stored2 = self.fake.doc("cloudflare", "2")["annotations"]
        self.assertEqual(stored2, self.fake.doc("vercel", "2")["annotations"])
        self.assertEqual(stored2[1]["status"], "deleted")
        self.assertEqual(stored2[1]["deletedAt"], "2026-09-03T00:00:00.000Z")
        self.assertEqual(self.fake.doc("cloudflare", "3")["annotations"], [note("n5")])  # noop paper untouched
        self.assertEqual(self.fake.docs["vercel"]["1"]["annotations"][1], note("n3"))
        run = Path(result["directory"])
        receipts = json.loads((run / "receipts.json").read_bytes())
        self.assertTrue(all(r["verified"] for r in receipts))
        for pid in "12":
            for suffix in ("request", "response", "verify"):
                self.assertTrue((run / f"paper-{pid}.{suffix}.json").is_file())
        self.assertEqual(json.loads((run / "paper-1.request.json").read_bytes())["annotations"][0]["id"], "n1")

    def test_apply_aborts_if_a_document_changed_since_the_backup(self):
        self.prepared()
        self.fake.set("cloudflare", "2", [note("late")], revision="rev-other")
        with self.assertRaisesRegex(ta.TransferError, "changed"):
            ta.apply_plan(self.out, do_apply=True)
        self.assertEqual(self.fake.posts, [])
        self.fake.docs["cloudflare"].pop("2")
        self.fake.docs["vercel"]["1"]["annotations"].append(note("n9"))
        with self.assertRaisesRegex(ta.TransferError, "vercel document"):
            ta.apply_plan(self.out, do_apply=True)
        self.assertEqual(self.fake.posts, [])

    def test_apply_rechecks_each_paper_immediately_before_its_write(self):
        self.prepared()
        self.fake.after_post = lambda f: f.set("cloudflare", "2", [note("late")], revision="rev-other") if f.n == 1 else None
        with self.assertRaisesRegex(ta.TransferError, "paper 2 changed"):
            ta.apply_plan(self.out, do_apply=True)
        self.assertEqual([pid for pid, _ in self.fake.posts], ["1"])
        run = next(self.out.glob("apply-*"))
        self.assertEqual(len(json.loads((run / "receipts.json").read_bytes())), 1)

    def test_post_verification_compares_every_field(self):
        self.prepared()
        self.fake.mangle = lambda anns: [{k: v for k, v in a.items() if k != "color"} for a in anns]
        with self.assertRaisesRegex(ta.TransferError, "verification failed"):
            ta.apply_plan(self.out, do_apply=True)
        receipts = json.loads((next(self.out.glob("apply-*")) / "receipts.json").read_bytes())
        self.assertFalse(receipts[0]["verified"])
        self.assertEqual(receipts[0]["problems"][0]["fields"], ["color"])

    def test_http_failure_on_post_is_recorded_and_raised(self):
        self.prepared()
        with mock.patch.object(ta, "http_post", lambda url, data: (409, b'{"error":"annotation_conflict"}')):
            with self.assertRaisesRegex(ta.TransferError, "HTTP 409"):
                ta.apply_plan(self.out, do_apply=True)
        run = next(self.out.glob("apply-*"))
        self.assertEqual((run / "paper-1.response.json").read_bytes(), b'{"error":"annotation_conflict"}')

    def test_apply_needs_an_intact_backup_and_plan(self):
        self.prepared()
        plan_path = self.out / "plan.json"
        original = plan_path.read_bytes()
        edited = json.loads(original)
        edited["papers"]["1"]["desired"].append(note("sneaky"))
        plan_path.write_text(json.dumps(edited))
        with self.assertRaisesRegex(ta.TransferError, "edited"):
            ta.apply_plan(self.out, do_apply=True)
        plan_path.write_bytes(original)
        (self.out / "raw/cloudflare/paper-1.json").write_bytes(b"{}")
        with self.assertRaises(ta.TransferError):
            ta.apply_plan(self.out, do_apply=True)
        (self.out / "plan.json").unlink()
        with self.assertRaises(ta.TransferError):
            ta.apply_plan(self.out)
        self.assertEqual(self.fake.posts, [])

    def test_cli_exit_codes(self):
        self.seed()
        err = io.StringIO()
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
            self.assertEqual(ta.main(["backup", "--output", str(self.root / "inside"), "--root", str(self.root),
                                      "--vercel", VB, "--cloudflare", CB]), 1)
            self.assertEqual(ta.main(["backup", "--output", str(self.out), "--root", str(self.root),
                                      "--vercel", VB, "--cloudflare", CB]), 0)
            self.assertEqual(ta.main(["plan", "--output", str(self.out)]), 0)
            self.assertEqual(ta.main(["plan", "--output", str(self.out)]), 1)  # plan.json is never replaced
        self.assertIn("outside the repo", err.getvalue())


class NormalizerPortTests(unittest.TestCase):
    def test_typical_annotations_are_fixed_points(self):
        for a in (note("a"), note("b", title="t", status="deleted", deletedBy="x", deletedAt="2026-09-03T00:00:00.000Z"), highlight("h")):
            self.assertTrue(ta.same(ta.cf_normalize(a), a), a)

    def test_worker_changes_are_visible(self):
        self.assertNotIn("deletedDevice", ta.cf_normalize(note("a", deletedDevice="phone")))
        self.assertEqual(ta.cf_normalize(note("a", x=3))["x"], 1)
        self.assertEqual(ta.cf_normalize(note("a", color="red"))["color"], "#ffd166")


if __name__ == "__main__":
    unittest.main()
