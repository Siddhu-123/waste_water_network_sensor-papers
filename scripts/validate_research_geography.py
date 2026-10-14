#!/usr/bin/env python3
"""Validate the research geography dataset against contributor source metadata."""

from __future__ import annotations

import json
import math
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "js/research-geography-data.js"
RELATIONS = {"study", "organization", "scope", "affiliation"}


def identity(kind: str, value) -> tuple[str, str]:
    return kind, json.dumps(value, sort_keys=True, ensure_ascii=False)


def local_path(value: str) -> Path | None:
    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc or value == "#":
        return None
    return (ROOT / parsed.path.removeprefix("./")).resolve()


def main() -> int:
    errors: list[str] = []

    def error(message: str) -> None:
        errors.append(message)

    if not DATA_FILE.is_file():
        print(f"Missing dataset: {DATA_FILE.relative_to(ROOT)}", file=sys.stderr)
        return 1

    reader = (
        "const fs=require('fs'),vm=require('vm');"
        "const window={};vm.runInNewContext(fs.readFileSync(process.argv[1],'utf8'),{window});"
        "process.stdout.write(JSON.stringify(window.RESEARCH_GEOGRAPHY_DATA));"
    )
    try:
        result = subprocess.run(
            ["node", "-e", reader, str(DATA_FILE)],
            check=True,
            capture_output=True,
            text=True,
        )
        data = json.loads(result.stdout)
    except (OSError, subprocess.CalledProcessError, json.JSONDecodeError) as exc:
        print(f"Cannot read geography dataset with node: {exc}", file=sys.stderr)
        return 1

    expected: dict[tuple[str, str], dict] = {}

    def add_sources(kind: str, entries, label: str) -> None:
        if not isinstance(entries, list):
            error(f"{label}: expected an array")
            return
        for item in entries:
            if not isinstance(item, dict) or "id" not in item:
                error(f"{label}: source record needs an id")
                continue
            key = identity(kind, item["id"])
            if key in expected:
                error(f"Duplicate source identity {kind}:{item['id']}")
            expected[key] = item

    try:
        manifest = json.loads((ROOT / "contributors/manifest.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Cannot read contributors/manifest.json: {exc}", file=sys.stderr)
        return 1

    for contributor in manifest.get("contributors", []):
        if not isinstance(contributor, dict):
            error("Manifest contributor entry must be an object")
            continue
        for kind, field, array_name in (
            ("academic", "file", "papers"),
            ("grey", "greyLiteratureFile", "greyLiterature"),
        ):
            source = contributor.get(field)
            if not source:
                continue
            path = (ROOT / "contributors" / source.removeprefix("./")).resolve()
            try:
                payload = json.loads(path.read_text(encoding="utf-8"))
            except (OSError, json.JSONDecodeError) as exc:
                error(f"Cannot read {source}: {exc}")
                continue
            add_sources(kind, payload.get(array_name), source)
            if kind == "academic":
                add_sources("compiled", payload.get("compiledPapers", []), f"{source}:compiledPapers")

    team = manifest.get("teamCompiledPaper")
    if isinstance(team, dict):
        add_sources("compiled", [team], "manifest teamCompiledPaper")
    else:
        error("Manifest teamCompiledPaper must be an object")

    if not isinstance(data, dict):
        error("RESEARCH_GEOGRAPHY_DATA must be an object")
        data = {}
    places = data.get("places")
    records = data.get("records")
    if not isinstance(places, list):
        error("places must be an array")
        places = []
    if not isinstance(records, list):
        error("records must be an array")
        records = []

    place_ids: set[str] = set()
    places_by_id: dict[str, dict] = {}
    for index, place in enumerate(places):
        label = f"place #{index + 1}"
        if not isinstance(place, dict) or "id" not in place:
            error(f"{label}: place needs an id")
            continue
        key = identity("place", place["id"])[1]
        if key in place_ids:
            error(f"{label}: duplicate place id {place['id']}")
        place_ids.add(key)
        places_by_id[key] = place
        for field in ("name", "country"):
            if not isinstance(place.get(field), str) or not place[field].strip():
                error(f"{label}: {field} is required")
        if place.get("kind") not in ("city", "country", "region"):
            error(f"{label}: kind must be city, region or country")
        for coordinate, low, high in (("lat", -90, 90), ("lon", -180, 180)):
            value = place.get(coordinate)
            if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or not low <= value <= high:
                error(f"{label}: {coordinate} must be finite and within [{low}, {high}]")

    seen: set[tuple[str, str]] = set()
    records_by_key: dict[tuple[str, str], dict] = {}
    for index, record in enumerate(records):
        label = f"record #{index + 1}"
        if not isinstance(record, dict):
            error(f"{label}: expected an object")
            continue
        kind, record_id = record.get("type"), record.get("id")
        if kind not in ("academic", "grey", "compiled") or "id" not in record:
            error(f"{label}: type or id is invalid")
            continue
        key = identity(kind, record_id)
        if key in seen:
            error(f"{label}: duplicate identity {kind}:{record_id}")
        seen.add(key)
        records_by_key[key] = record
        source = expected.get(key)
        if source is None:
            error(f"{label}: unknown source identity {kind}:{record_id}")
        else:
            for field in ("title", "pdfUrl"):
                if record.get(field) != source.get(field):
                    error(f"{label}: {field} does not match source metadata")

        pdf_url = record.get("pdfUrl")
        if isinstance(pdf_url, str) and pdf_url.strip():
            path = local_path(pdf_url)
            if path is not None and not path.is_file() and pdf_url != "#":
                error(f"{label}: local pdfUrl does not exist: {pdf_url}")

        locations = record.get("locations")
        if not isinstance(locations, list):
            error(f"{label}: locations must be an array")
            locations = []
        if not locations and not (isinstance(record.get("unmappedReason"), str) and record["unmappedReason"].strip()):
            error(f"{label}: unmappedReason is required when locations is empty")
        for loc_index, location in enumerate(locations):
            loc_label = f"{label} location #{loc_index + 1}"
            if not isinstance(location, dict):
                error(f"{loc_label}: expected an object")
                continue
            if location.get("relation") not in RELATIONS:
                error(f"{loc_label}: relation must be one of {', '.join(sorted(RELATIONS))}")
            place_key = identity("place", location.get("placeId"))[1]
            if place_key not in places_by_id:
                error(f"{loc_label}: unknown placeId {location.get('placeId')}")
            if not isinstance(location.get("evidence"), str) or not location["evidence"].strip():
                error(f"{loc_label}: evidence is required")
            source_ref = location.get("source")
            if not isinstance(source_ref, str) or not source_ref.strip():
                error(f"{loc_label}: source is required")
                continue
            source_path = local_path(source_ref)
            if source_path is not None and not source_path.is_file() and not source_ref.startswith("#"):
                error(f"{loc_label}: local source path does not exist: {source_ref}")
            if urlsplit(source_ref).path.lower().endswith(".pdf"):
                page = location.get("page")
                if isinstance(page, bool) or not isinstance(page, int) or page < 1:
                    error(f"{loc_label}: PDF source needs a positive integer page")

    for key in expected.keys() - seen:
        error(f"Missing record for {key[0]}:{json.loads(key[1])}")

    for paper_id, city_names in ((31, {"adelaide", "stonyfell"}), (11, {"melbourne"}), (41, {"sydney"})):
        record = records_by_key.get(identity("academic", paper_id))
        if record is None:
            continue
        linked = any(
            isinstance(location, dict)
            and location.get("relation") == "study"
            and (place := places_by_id.get(identity("place", location.get("placeId"))[1])) is not None
            and isinstance(place.get("name"), str)
            and place["name"].strip().lower() in city_names
            for location in record.get("locations", [])
        )
        if not linked:
            error(f"academic:{paper_id} needs a city study location: {' or '.join(sorted(city_names))}")

    paper_one = records_by_key.get(identity("academic", 1), {})
    for location in paper_one.get("locations", []):
        if not isinstance(location, dict) or location.get("relation") != "study":
            continue
        place = places_by_id.get(identity("place", location.get("placeId"))[1], {})
        if str(place.get("name", "")).strip().lower() == "sydney":
            error("academic:1 must not map Sydney as a study location")

    if errors:
        print("Research geography validation failed:", file=sys.stderr)
        for message in errors:
            print(f"- {message}", file=sys.stderr)
        return 1
    print(f"Research geography valid: {len(records)} records, {len(places)} places")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
