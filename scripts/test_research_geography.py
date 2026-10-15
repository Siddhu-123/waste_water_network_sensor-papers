#!/usr/bin/env python3
"""Behaviour tests for scripts/build_research_geography.py.

Each test builds a small throwaway library (manifest, contributor JSON, handmade PDFs) and runs the
builder through main(argv) with --root. Run with: python3 -m unittest scripts/test_research_geography.py
"""

from __future__ import annotations

import contextlib
import hashlib
import io
import json
import shutil
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_research_geography as brg  # noqa: E402

REPO = Path(__file__).resolve().parents[1]

FILLER = [
    "The sensors were housed in a sealed box and the readings of the loggers were stored for the analysis of the flow.",
    "A series of tests showed that the response of the device to the changes in the level of the water was stable.",
    "The results of the work are given in the tables and the figures that follow in the rest of this paper.",
]

SEED_PLACES = [
    {"id": "melbourne", "name": "Melbourne", "country": "Australia", "lat": -37.8136, "lon": 144.9631, "kind": "city"},
    {"id": "sydney", "name": "Sydney", "country": "Australia", "lat": -33.8688, "lon": 151.2093, "kind": "city"},
    {"id": "adelaide", "name": "Adelaide", "country": "Australia", "lat": -34.9285, "lon": 138.6007, "kind": "city"},
    {"id": "brisbane", "name": "Brisbane", "country": "Australia", "lat": -27.4698, "lon": 153.0251, "kind": "city"},
    {"id": "paris-fr", "name": "Paris", "country": "France", "lat": 48.8566, "lon": 2.3522, "kind": "city"},
    {"id": "paris-us", "name": "Paris", "country": "United States", "lat": 33.6609, "lon": -95.5555, "kind": "city"},
    {"id": "australia", "name": "Australia", "country": "Australia", "lat": -25.0, "lon": 134.0, "kind": "country"},
]


def make_pdf(pages: list[list[str]]) -> bytes:
    """Minimal single-font PDF with uncompressed text, one Td line per string."""
    def esc(s: str) -> str:
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")

    objs: list[bytes] = [b"", b"", b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"]
    kids = []
    for lines in pages:
        body = ["BT /F1 11 Tf 72 740 Td"]
        for i, line in enumerate(lines):
            if i:
                body.append("0 -14 Td")
            body.append(f"({esc(line)}) Tj")
        body.append("ET")
        stream = "\n".join(body).encode("latin-1")
        content_num = len(objs) + 2
        page_num = len(objs) + 1
        objs.append(f"<< /Type /Page /Parent 2 0 R /Contents {content_num} 0 R /Resources << /Font << /F1 3 0 R >> >> >>".encode())
        objs.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
        kids.append(f"{page_num} 0 R")
    objs[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objs[1] = f"<< /Type /Pages /Kids [{' '.join(kids)}] /Count {len(kids)} /MediaBox [0 0 612 792] >>".encode()
    out = bytearray(b"%PDF-1.4\n")
    for number, body in enumerate(objs, start=1):
        out += f"{number} 0 obj\n".encode() + body + b"\nendobj\n"
    out += b"trailer\n<< /Root 1 0 R >>\n%%EOF\n"
    return bytes(out)


def paper_pdf(study: list[str] | None = None, header: list[str] | None = None, refs: list[str] | None = None,
              title: str = "Level monitoring in combined sewers", intro: list[str] | None = None) -> bytes:
    page1 = [title, "A. Author and B. Author", *(header or []), "Abstract", *FILLER[:2]]
    if intro:
        page1 += ["1. Introduction", *intro]
    page2 = ["Methods", *(study or []), *FILLER[2:]]
    pages = [page1, page2]
    if refs:
        pages.append(["References", *refs])
    return make_pdf(pages)


class Library:
    """Throwaway library root: manifest, one contributor, PDFs, geography data."""

    def __init__(self, base: Path):
        self.root = base / "lib"
        self.academic: list[dict] = []
        self.grey: list[dict] = []
        self.compiled: list[dict] = []
        self.team: dict = {"id": "team", "title": "Team compiled paper", "pdfUrl": "pdfs/team.pdf"}
        self.pdfs: dict[str, bytes] = {"pdfs/team.pdf": paper_pdf(["Data were collected in Melbourne."])}
        self.root.mkdir()
        (self.root / "data/geography").mkdir(parents=True)
        shutil.copy(REPO / "data/geography/countries.json", self.root / "data/geography/countries.json")
        (self.root / "data/geography/gazetteer_seed.json").write_text(json.dumps({"version": 1, "places": SEED_PLACES}))

    def paper(self, pid, title="Sensor paper", pdf: bytes | None = None, pdf_url: str | None = None, kind="academic"):
        name = f"pdfs/{kind}-{pid}.pdf"
        if pdf_url is None:
            pdf_url = name
            if pdf is not None:
                self.pdfs[name] = pdf
        if kind == "academic":
            self.academic.append({"id": pid, "title": title, "authors": "A. Author", "pdfUrl": pdf_url})
        else:
            self.grey.append({"id": pid, "title": title, "organization": "Water Agency", "pdfUrl": pdf_url, "url": "https://example.org"})

    def write(self) -> "Library":
        contrib = self.root / "contributors/alice"
        contrib.mkdir(parents=True, exist_ok=True)
        (contrib / "papers.json").write_text(json.dumps({"papers": self.academic, "compiledPapers": self.compiled}))
        (contrib / "grey.json").write_text(json.dumps({"greyLiterature": self.grey}))
        (self.root / "contributors/manifest.json").write_text(json.dumps({
            "contributors": [{"file": "alice/papers.json", "greyLiteratureFile": "alice/grey.json"}],
            "teamCompiledPaper": self.team,
        }))
        for name, data in self.pdfs.items():
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
        return self

    def build(self, *extra: str) -> tuple[int, str]:
        out = io.StringIO()
        err = io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = brg.main(["--root", str(self.root), "--extractor", "pdfplumber", *extra])
        return code, out.getvalue() + err.getvalue()

    @property
    def output_path(self) -> Path:
        return self.root / "js/research-geography-data.js"

    def data(self) -> dict:
        return brg.parse_js_data(self.output_path)

    def record(self, kind: str, pid) -> dict:
        return next(r for r in self.data()["records"] if r["type"] == kind and r["id"] == pid)

    def place(self, place_id: str) -> dict:
        return next(p for p in self.data()["places"] if p["id"] == place_id)

    def place_ids(self, kind: str, pid) -> list[str]:
        return [loc["placeId"] for loc in self.record(kind, pid)["locations"]]


class GeographyTestCase(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.lib = Library(Path(self._tmp.name))

    def built(self) -> Library:
        self.lib.write()
        code, text = self.lib.build()
        self.assertEqual(code, 0, text)
        return self.lib


class StudySiteExtraction(GeographyTestCase):
    def test_explicit_city_with_country_is_mapped_with_sentence_and_page(self):
        sentence = "Water level data were collected in Melbourne, Australia over a period of six months."
        self.lib.paper(1, pdf=paper_pdf([sentence]))
        lib = self.built()
        record = lib.record("academic", 1)
        self.assertEqual(lib.place_ids("academic", 1), ["melbourne"])
        location = record["locations"][0]
        self.assertEqual(location["relation"], "study")
        self.assertEqual(location["page"], 2)
        self.assertEqual(location["source"], "pdfs/academic-1.pdf")
        self.assertIn("collected in Melbourne, Australia", location["evidence"])
        self.assertEqual(record["unmappedReason"], "")
        self.assertEqual(lib.place("melbourne")["lat"], -37.8136)

    def test_affiliation_and_reference_mentions_are_not_study_sites(self):
        self.lib.paper(2, pdf=paper_pdf(
            ["The loggers were calibrated against a reference gauge before the trials began."],
            header=["Department of Civil Engineering, University of Sydney, Sydney, Australia"],
            refs=["[1] Smith, J. Sensors in Adelaide sewers. Journal of Water, 2020.",
                  "[2] Lee, K. Monitoring trials carried out in Brisbane. Water Research, 2019."],
        ))
        lib = self.built()
        record = lib.record("academic", 2)
        self.assertEqual(record["locations"], [])
        self.assertIn("header affiliations, reference lists", record["unmappedReason"])

    def test_university_and_background_mentions_are_rejected(self):
        self.lib.paper(3, pdf=paper_pdf([
            "The model was validated against data from the University of Adelaide.",
            "Previous work installed loggers in Brisbane.",
            "Such trials are common, for example in Sydney.",
        ]))
        lib = self.built()
        self.assertEqual(lib.place_ids("academic", 3), [])
        self.assertTrue(lib.record("academic", 3)["unmappedReason"])

    def test_introduction_sentence_about_other_work_is_rejected(self):
        self.lib.paper(4, pdf=paper_pdf(
            intro=["Sensors were deployed in Brisbane by a utility to track overflows."],
        ))
        lib = self.built()
        self.assertEqual(lib.place_ids("academic", 4), [])

    def test_multiple_clear_sites_are_all_mapped(self):
        self.lib.paper(5, pdf=paper_pdf([
            "Data were collected in Melbourne and Sydney.",
            "A second trial was conducted in Adelaide, Australia.",
        ]))
        lib = self.built()
        self.assertEqual(sorted(lib.place_ids("academic", 5)), ["adelaide", "melbourne", "sydney"])

    def test_duplicate_site_is_listed_once(self):
        self.lib.paper(6, pdf=paper_pdf([
            "Data were collected in Melbourne.",
            "Further samples were taken in Melbourne during winter.",
        ]))
        self.assertEqual(self.built().place_ids("academic", 6), ["melbourne"])

    def test_review_paper_is_not_mapped_even_with_cue_sentence(self):
        self.lib.paper(7, title="A review of sensors for sewer monitoring",
                       pdf=paper_pdf(["Data were collected in Melbourne."], title="A review of sensors for sewer monitoring"))
        lib = self.built()
        self.assertEqual(lib.place_ids("academic", 7), [])
        self.assertIn("review", lib.record("academic", 7)["unmappedReason"])

    def test_synthetic_network_is_not_a_real_site(self):
        self.lib.paper(8, pdf=paper_pdf(["A synthetic network was tested in Melbourne for illustration."]))
        lib = self.built()
        self.assertEqual(lib.place_ids("academic", 8), [])
        self.assertIn("synthetic", lib.record("academic", 8)["unmappedReason"].lower())

    def test_country_only_study_maps_when_gazetteer_has_the_country(self):
        self.lib.paper(9, pdf=paper_pdf(["The field trial was carried out in Australia."]))
        self.assertEqual(self.built().place_ids("academic", 9), ["australia"])

    def test_country_without_seed_position_stays_unmapped(self):
        self.lib.paper(10, pdf=paper_pdf(["The field trial was carried out in Ghana."]))
        lib = self.built()
        self.assertEqual(lib.place_ids("academic", 10), [])
        self.assertIn("Ghana", lib.record("academic", 10)["unmappedReason"])

    def test_unknown_city_is_unmapped_with_its_name_and_no_coordinates(self):
        self.lib.paper(11, pdf=paper_pdf(["Data were collected in Zonkville, Australia."]))
        lib = self.built()
        self.assertEqual(lib.place_ids("academic", 11), [])
        self.assertIn("Zonkville", lib.record("academic", 11)["unmappedReason"])
        self.assertNotIn("Zonkville", json.dumps(lib.data()["places"]))


class CorpusFalsePositives(GeographyTestCase):
    def test_month_and_institution_names_are_not_sites(self):
        seed_path = self.lib.root / "data/geography/gazetteer_seed.json"
        seed = json.loads(seed_path.read_text())
        seed["places"].extend([
            {"id": "march", "name": "March", "country": "United Kingdom", "lat": 52.55, "lon": 0.08, "kind": "city"},
            {"id": "university", "name": "University", "country": "United States", "lat": 34.36, "lon": -89.5, "kind": "city"},
        ])
        seed_path.write_text(json.dumps(seed))
        self.lib.paper(101, pdf=paper_pdf(["Samples were collected in March 2012.",
            "Tests were carried out in the laboratory at the University of Bradford."]))
        self.lib.write()
        self.lib.build()
        self.assertEqual(self.lib.place_ids("academic", 101), [])

    def test_funding_and_toc_mentions_are_not_sites(self):
        self.lib.paper(101, pdf=paper_pdf([
            "We implemented the models and acknowledge financial support from Hong Kong.",
            "Figure 1: Sensors were installed in Melbourne .................... 25",
        ]))
        self.lib.write()
        self.lib.build()
        self.assertEqual(self.lib.place_ids("academic", 101), [])

    def test_a_district_name_cannot_resolve_to_an_unrelated_city(self):
        self.lib.paper(101, pdf=paper_pdf(["The site is located in the Melbourne District and has a sewer system."]))
        self.lib.write()
        self.lib.build()
        self.assertEqual(self.lib.place_ids("academic", 101), [])

class CountryAmbiguity(GeographyTestCase):
    def test_duplicate_name_without_context_is_left_unmapped(self):
        self.lib.paper(20, pdf=paper_pdf(["The pilot was conducted in Paris."]))
        lib = self.built()
        self.assertEqual(lib.place_ids("academic", 20), [])
        reason = lib.record("academic", 20)["unmappedReason"]
        self.assertIn("Paris", reason)
        self.assertIn("France", reason)

    def test_country_after_the_name_picks_the_right_place(self):
        self.lib.paper(21, pdf=paper_pdf(["The pilot was conducted in Paris, France."]))
        self.lib.paper(22, pdf=paper_pdf(["The pilot was conducted in Paris, Texas."]))
        lib = self.built()
        self.assertEqual(lib.place_ids("academic", 21), ["paris-fr"])
        self.assertEqual(lib.place_ids("academic", 22), ["paris-us"])

    def test_country_in_nearby_sentence_disambiguates(self):
        self.lib.paper(23, pdf=paper_pdf([
            "The pilot was conducted in Paris.",
            "The catchment lies in the north of Texas.",
        ]))
        self.assertEqual(self.built().place_ids("academic", 23), ["paris-us"])

    def test_conflicting_country_is_not_forced(self):
        self.lib.paper(24, pdf=paper_pdf(["Data were collected in Melbourne, France."]))
        self.assertEqual(self.built().place_ids("academic", 24), [])


class SourceKinds(GeographyTestCase):
    def test_grey_metadata_and_organization_come_from_source(self):
        self.lib.paper("g1", kind="grey", pdf_url="#", title="Utility guide")
        lib = self.built()
        record = lib.record("grey", "g1")
        self.assertEqual(record["organization"], "Water Agency")
        self.assertEqual(record["locations"], [])
        self.assertIn("No local PDF", record["unmappedReason"])

    def test_compiled_records_are_stubs_and_never_extracted(self):
        self.lib.compiled.append({"id": "c1", "title": "Compiled review", "pdfUrl": "pdfs/c1.pdf"})
        self.lib.pdfs["pdfs/c1.pdf"] = paper_pdf(["Data were collected in Sydney."])
        lib = self.built()
        for pid in ("c1", "team"):
            record = lib.record("compiled", pid)
            self.assertEqual(record["locations"], [])
            self.assertIn("excluded from the map", record["unmappedReason"])

    def test_missing_pdf_remote_pdf_and_scanned_pdf_have_reasons_and_no_pin(self):
        self.lib.paper(30, pdf_url="pdfs/not-there.pdf")
        self.lib.paper(31, pdf_url="https://example.org/paper.pdf")
        self.lib.paper(32, pdf=make_pdf([[""]]))
        lib = self.built()
        self.assertIn("missing", lib.record("academic", 30)["unmappedReason"])
        self.assertIn("remote", lib.record("academic", 31)["unmappedReason"].lower())
        self.assertIn("no extractable text", lib.record("academic", 32)["unmappedReason"])
        for pid in (30, 31, 32):
            self.assertEqual(lib.record("academic", pid)["locations"], [])

    @unittest.skipUnless(brg.ocr_available(), "OCR engine not installed")
    def test_scanned_pdf_is_ocr_processed_in_the_pipeline(self):
        from PIL import Image, ImageDraw, ImageFont
        image = Image.new("RGB", (1800, 1400), "white")
        draw = ImageDraw.Draw(image)
        font = ImageFont.truetype("DejaVuSans.ttf", 34)
        lines = ["Field measurements", "Abstract", "The readings of the sensors were stored for the analysis of the flow.",
                 "This study reports the results of the field measurements.", "Methods",
                 "Data were collected in Melbourne, Australia.",
                 "The sensors were installed in the network and the readings were stable."]
        for index, line in enumerate(lines):
            draw.text((70, 70 + index * 100), line, font=font, fill="black")
        output = io.BytesIO()
        image.save(output, format="PDF", resolution=180)
        self.lib.paper(101, pdf=output.getvalue())
        self.lib.write()
        code, log = self.lib.build("--ocr")
        self.assertEqual(code, 0, log)
        self.assertEqual(self.lib.place_ids("academic", 101), ["melbourne"])

    def test_corrupt_pdf_is_reported_not_raised(self):
        self.lib.paper(33, pdf=b"this is not a pdf")
        lib = self.built()
        self.assertEqual(lib.record("academic", 33)["locations"], [])
        self.assertTrue(lib.record("academic", 33)["unmappedReason"])

    def test_remote_fetch_is_opt_in_and_bounded(self):
        remote = paper_pdf(["Data were collected in Adelaide."])
        self.lib.paper(34, pdf_url="https://example.org/a.pdf")
        self.lib.paper(35, pdf_url="https://example.org/b.pdf")
        self.lib.write()
        with mock.patch.object(brg, "fetch_remote", return_value=remote) as fetch:
            code, text = self.lib.build()
            self.assertEqual(code, 0, text)
            fetch.assert_not_called()
            code, text = self.lib.build("--fetch-remote", "--max-remote", "1")
            self.assertEqual(code, 0, text)
            self.assertEqual(fetch.call_count, 1)
        self.assertEqual(self.lib.place_ids("academic", 34), ["adelaide"])
        self.assertEqual(self.lib.place_ids("academic", 35), [])
        self.assertIn("limit", self.lib.record("academic", 35)["unmappedReason"])


class Lifecycle(GeographyTestCase):
    def test_second_run_is_byte_identical_and_uses_the_cache(self):
        self.lib.paper(40, pdf=paper_pdf(["Data were collected in Melbourne, Australia."]))
        self.lib.paper(41, pdf=paper_pdf(["The loggers were calibrated in the laboratory."]))
        self.lib.write()
        self.assertEqual(self.lib.build("--report", str(self.lib.root / "report.json"))[0], 0)
        cache = self.lib.root / "data/geography/extraction-cache.json"
        first = (self.lib.output_path.read_bytes(), cache.read_bytes(), (self.lib.root / "report.json").read_bytes())
        code, text = self.lib.build("--report", str(self.lib.root / "report.json"))
        self.assertEqual(code, 0, text)
        self.assertIn("unchanged", text)
        self.assertIn("cached=2", text)
        second = (self.lib.output_path.read_bytes(), cache.read_bytes(), (self.lib.root / "report.json").read_bytes())
        self.assertEqual(first, second)

    def test_new_manifest_entry_is_mapped_automatically_and_removed_one_disappears(self):
        self.lib.paper(50, pdf=paper_pdf(["Data were collected in Melbourne."]))
        self.lib.paper(51, pdf=paper_pdf(["Data were collected in Sydney."]))
        self.lib.write()
        self.assertEqual(self.lib.build()[0], 0)
        self.lib.paper(52, pdf=paper_pdf(["Data were collected in Adelaide."]))
        self.lib.academic = [p for p in self.lib.academic if p["id"] != 50]
        self.lib.write()
        self.assertEqual(self.lib.build()[0], 0)
        ids = [r["id"] for r in self.lib.data()["records"] if r["type"] == "academic"]
        self.assertEqual(ids, [51, 52])
        self.assertEqual(self.lib.place_ids("academic", 52), ["adelaide"])
        cache = json.loads((self.lib.root / "data/geography/extraction-cache.json").read_text())
        self.assertNotIn("academic:50", cache["entries"])

    def test_changed_pdf_for_unreviewed_record_is_re_extracted(self):
        self.lib.paper(60, pdf=paper_pdf(["Data were collected in Melbourne."]))
        self.lib.write()
        self.assertEqual(self.lib.build()[0], 0)
        self.assertEqual(self.lib.place_ids("academic", 60), ["melbourne"])
        (self.lib.root / "pdfs/academic-60.pdf").write_bytes(paper_pdf(["Data were collected in Sydney."]))
        code, text = self.lib.build()
        self.assertEqual(code, 0, text)
        self.assertEqual(self.lib.place_ids("academic", 60), ["sydney"])

    def test_changed_metadata_invalidates_the_cache(self):
        self.lib.paper(61, title="Original title", pdf=paper_pdf(["Data were collected in Melbourne."]))
        self.lib.write()
        self.assertEqual(self.lib.build()[0], 0)
        self.lib.academic[0]["title"] = "A review of everything"
        self.lib.write()
        self.assertEqual(self.lib.build()[0], 0)
        self.assertEqual(self.lib.record("academic", 61)["title"], "A review of everything")

    def test_gazetteer_change_invalidates_the_cache(self):
        self.lib.paper(62, pdf=paper_pdf(["Data were collected in Zonkville, Australia."]))
        self.lib.write()
        self.assertEqual(self.lib.build()[0], 0)
        self.assertEqual(self.lib.place_ids("academic", 62), [])
        seed_path = self.lib.root / "data/geography/gazetteer_seed.json"
        seed = json.loads(seed_path.read_text())
        seed["places"].append({"id": "zonkville", "name": "Zonkville", "country": "Australia", "lat": -30.0, "lon": 140.0, "kind": "city"})
        seed_path.write_text(json.dumps(seed))
        self.assertEqual(self.lib.build()[0], 0)
        self.assertEqual(self.lib.place_ids("academic", 62), ["zonkville"])

    def test_cache_holds_bounded_evidence_not_full_text(self):
        self.lib.paper(70, pdf=paper_pdf(["Data were collected in Melbourne."]))
        self.lib.write()
        self.assertEqual(self.lib.build()[0], 0)
        cache_text = (self.lib.root / "data/geography/extraction-cache.json").read_text()
        for line in FILLER:
            self.assertNotIn(line, cache_text)
        for location in self.lib.record("academic", 70)["locations"]:
            self.assertLessEqual(len(location["evidence"]), brg.SNIPPET_CHARS + 2)

    def test_check_mode_reports_stale_output_and_writes_nothing(self):
        self.lib.paper(71, pdf=paper_pdf(["Data were collected in Melbourne."]))
        self.lib.write()
        self.assertEqual(self.lib.build("--check")[0], 1)
        self.assertFalse(self.lib.output_path.exists())
        self.assertEqual(self.lib.build()[0], 0)
        self.assertEqual(self.lib.build("--check")[0], 0)
        self.lib.output_path.write_text(self.lib.output_path.read_text().replace("Melbourne", "Sydney"))
        self.assertEqual(self.lib.build("--check")[0], 1)


class CuratedMappings(GeographyTestCase):
    def reviewed_from_first_run(self) -> Library:
        lib = self.built()
        code, text = lib.build("--import-baseline", str(lib.output_path))
        self.assertEqual(code, 0, text)
        return lib

    def test_curated_location_wins_over_what_the_pdf_says(self):
        self.lib.paper(80, pdf=paper_pdf(["Data were collected in Melbourne."]))
        lib = self.reviewed_from_first_run()
        reviewed_path = lib.root / "data/geography/reviewed.json"
        reviewed = json.loads(reviewed_path.read_text())
        reviewed["records"][0]["locations"][0].update(placeId="adelaide", evidence="Curated note: Adelaide trial site.")
        reviewed_path.write_text(json.dumps(reviewed))
        code, text = lib.build()
        self.assertEqual(code, 0, text)
        self.assertEqual(lib.place_ids("academic", 80), ["adelaide"])
        self.assertNotIn("sourceChanged", lib.record("academic", 80))

    def test_curated_unmapped_record_stays_unmapped_despite_new_extraction_rules(self):
        self.lib.paper(81, pdf=paper_pdf(["Nothing about places here."]))
        lib = self.reviewed_from_first_run()
        self.assertEqual(lib.place_ids("academic", 81), [])
        (lib.root / "pdfs/academic-81.pdf").write_bytes(paper_pdf(["Nothing about places here."]))
        code, _ = lib.build()
        self.assertEqual(code, 0)
        self.assertEqual(lib.place_ids("academic", 81), [])

    def test_changed_source_keeps_curated_mapping_and_is_flagged(self):
        self.lib.paper(82, pdf=paper_pdf(["Data were collected in Melbourne."]))
        lib = self.reviewed_from_first_run()
        (lib.root / "pdfs/academic-82.pdf").write_bytes(paper_pdf(["Data were collected in Sydney."]))
        code, text = lib.build()
        self.assertEqual(code, 0, text)
        record = lib.record("academic", 82)
        self.assertEqual(lib.place_ids("academic", 82), ["melbourne"])
        self.assertTrue(record["sourceChanged"])
        self.assertIn("source_changed=1", text)

    def test_accepting_source_changes_clears_the_flag_and_keeps_the_mapping(self):
        self.lib.paper(83, pdf=paper_pdf(["Data were collected in Melbourne."]))
        lib = self.reviewed_from_first_run()
        (lib.root / "pdfs/academic-83.pdf").write_bytes(paper_pdf(["Data were collected in Sydney."]))
        self.assertTrue(lib.build()[0] == 0 and lib.record("academic", 83)["sourceChanged"])
        code, text = lib.build("--accept-source-changes")
        self.assertEqual(code, 0, text)
        self.assertNotIn("sourceChanged", lib.record("academic", 83))
        code, text = lib.build()
        self.assertEqual(code, 0, text)
        self.assertNotIn("sourceChanged", lib.record("academic", 83))
        self.assertEqual(lib.place_ids("academic", 83), ["melbourne"])

    def test_reviewed_record_order_is_kept_and_new_records_follow(self):
        self.lib.paper(90, pdf=paper_pdf(["Data were collected in Melbourne."]))
        self.lib.paper(91, pdf=paper_pdf(["Data were collected in Sydney."]))
        lib = self.reviewed_from_first_run()
        reviewed_path = lib.root / "data/geography/reviewed.json"
        reviewed = json.loads(reviewed_path.read_text())
        reviewed["records"].reverse()
        reviewed_path.write_text(json.dumps(reviewed))
        lib.paper(89, pdf=paper_pdf(["Data were collected in Adelaide."]))
        lib.write()
        self.assertEqual(lib.build()[0], 0)
        ids = [r["id"] for r in lib.data()["records"] if r["type"] == "academic"]
        self.assertEqual(ids, [91, 90, 89])


class Gazetteer(GeographyTestCase):
    def geonames(self, rows: list[list[str]], zipped: bool = True) -> Path:
        text = "\n".join("\t".join(r) for r in rows) + "\n"
        path = Path(self._tmp.name) / ("cities15000.zip" if zipped else "cities15000.txt")
        if zipped:
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("cities15000.txt", text)
        else:
            path.write_text(text)
        return path

    ROW = ["2694762", "Linköping", "Linkoping", "", "58.41", "15.62", "P", "PPLA", "SE"] + [""] * 10

    def test_cached_geonames_zip_resolves_new_cities(self):
        self.lib.paper(100, pdf=paper_pdf(["Data were collected in Linkoping, Sweden."]))
        self.lib.write()
        code, text = self.lib.build()
        self.assertEqual(code, 0, text)
        self.assertEqual(self.lib.place_ids("academic", 100), [])
        code, text = self.lib.build("--gazetteer", str(self.geonames([self.ROW])))
        self.assertEqual(code, 0, text)
        self.assertEqual(self.lib.place_ids("academic", 100), ["geonames-2694762"])
        place = self.lib.place("geonames-2694762")
        self.assertEqual((place["country"], place["kind"]), ("Sweden", "city"))
        self.assertEqual(len(self.lib.data()["places"]), len(SEED_PLACES) + 1)

    def test_geonames_name_in_several_countries_needs_country_context(self):
        rows = [
            ["1", "Springfield", "Springfield", "", "39.8", "-89.6", "P", "PPLA", "US"] + [""] * 10,
            ["2", "Springfield", "Springfield", "", "-27.7", "152.9", "P", "PPL", "AU"] + [""] * 10,
        ]
        gaz = str(self.geonames(rows, zipped=False))
        self.lib.paper(101, pdf=paper_pdf(["Data were collected in Springfield."]))
        self.lib.paper(102, pdf=paper_pdf(["Data were collected in Springfield, Australia."]))
        self.lib.write()
        code, text = self.lib.build("--gazetteer", gaz)
        self.assertEqual(code, 0, text)
        self.assertEqual(self.lib.place_ids("academic", 101), [])
        self.assertEqual(self.lib.place_ids("academic", 102), ["geonames-2"])


class RealRepository(unittest.TestCase):
    @unittest.skipUnless((REPO / "data/geography/reviewed.json").is_file() and (REPO / "js/research-geography-data.js").is_file(),
                         "baseline snapshot not present")
    def test_first_run_reproduces_the_curated_dataset(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp) / "out.js"
            out = io.StringIO()
            with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
                code = brg.main(["--root", str(REPO), "--output", str(output), "--no-cache-write"])
            self.assertEqual(code, 0, out.getvalue())
            expected = (REPO / "js/research-geography-data.js").read_bytes()
            self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(), hashlib.sha256(expected).hexdigest())


class PdfReader(unittest.TestCase):
    def test_reads_lines_per_page_and_escapes(self):
        pages = brg.stdlib_pdf_pages(make_pdf([["First (page) line", "Second line"], ["Other page"]]))
        self.assertEqual(len(pages), 2)
        self.assertEqual(pages[0].split("\n")[:2], ["First (page) line", "Second line"])
        self.assertIn("Other page", pages[1])


if __name__ == "__main__":
    unittest.main()
