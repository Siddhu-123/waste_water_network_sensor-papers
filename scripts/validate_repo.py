#!/usr/bin/env python3
"""Validate contributor metadata, summaries, IDs, duplicate identities, and PDF paths."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Optional
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[1]
CONTRIBUTORS_DIR = ROOT / "contributors"
DOI_PATTERN = re.compile(r"10\.\d{4,9}/[-._;()/:A-Z0-9]+", re.IGNORECASE)
YEAR_PATTERN = re.compile(r"\b(?:19|20)\d{2}\b")
LEGACY_SPARSE_OWNER = "Satya Siddhartha"
LEGACY_SPARSE_IDS = set(range(1, 24))


class Validation:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.warnings: list[str] = []

    def error(self, message: str) -> None:
        self.errors.append(message)

    def warning(self, message: str) -> None:
        self.warnings.append(message)


def load_json(path: Path, validation: Validation):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        validation.error(f"Missing JSON file: {path.relative_to(ROOT)}")
    except (OSError, json.JSONDecodeError) as error:
        validation.error(f"Cannot read {path.relative_to(ROOT)}: {error}")
    return None


def normalize_text(value) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", str(value or "").lower())).strip()


def normalize_doi(value) -> str:
    match = DOI_PATTERN.search(str(value or ""))
    if not match:
        return ""
    return match.group(0).lower().rstrip(".,;:)]}>")


def first_year(*values) -> str:
    for value in values:
        match = YEAR_PATTERN.search(str(value or ""))
        if match:
            return match.group(0)
    return ""


def resolve_local_pdf(value, label: str, validation: Validation) -> None:
    if not isinstance(value, str) or not value.strip():
        validation.error(f"{label}: pdfUrl is required")
        return

    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        validation.error(f"{label}: pdfUrl must point to a repository file: {value}")
        return

    relative_path = parsed.path[2:] if parsed.path.startswith("./") else parsed.path
    target = (ROOT / relative_path).resolve()
    try:
        target.relative_to(ROOT.resolve())
    except ValueError:
        validation.error(f"{label}: pdfUrl escapes the repository: {value}")
        return

    if not target.is_file():
        validation.error(f"{label}: PDF does not exist: {value}")


def paper_identity(paper: dict, summary: Optional[dict]) -> Optional[tuple[str, str]]:
    summary = summary or {}
    doi = normalize_doi(
        paper.get("doi")
        or paper.get("doiUrl")
        or summary.get("doi")
        or summary.get("citation")
    )
    if doi:
        return ("doi", doi)

    title = normalize_text(paper.get("title"))
    authors = normalize_text(paper.get("authors"))
    year = first_year(paper.get("year"), paper.get("authors"), summary.get("citation"))
    if title and authors:
        return ("title", f"{title}|{authors.split()[0]}|{year}")

    citation = normalize_text(summary.get("citation"))
    return ("citation", citation) if citation else None


def validate() -> Validation:
    validation = Validation()
    manifest_path = CONTRIBUTORS_DIR / "manifest.json"
    manifest = load_json(manifest_path, validation)
    summaries = load_json(ROOT / "summaries.json", validation)
    if not isinstance(manifest, dict) or not isinstance(summaries, dict):
        return validation

    entries = manifest.get("contributors")
    if not isinstance(entries, list) or not entries:
        validation.error("contributors/manifest.json must contain a non-empty contributors array")
        return validation

    names: set[str] = set()
    slugs: set[str] = set()
    all_manifest_names = {
        entry.get("name")
        for entry in entries
        if isinstance(entry, dict) and isinstance(entry.get("name"), str) and entry["name"].strip()
    }
    paper_ids: dict[int, str] = {}
    compiled_ids: dict[str, str] = {}
    compiled_paths: dict[str, str] = {}
    paper_records: list[tuple[str, dict, Optional[dict]]] = []
    legacy_sparse_records = 0

    for entry in entries:
        if not isinstance(entry, dict):
            validation.error("Each manifest contributor must be an object")
            continue

        name = entry.get("name")
        slug = entry.get("slug")
        file_value = entry.get("file")
        if not all(isinstance(value, str) and value.strip() for value in (name, slug, file_value)):
            validation.error("Each manifest contributor needs name, slug, and file")
            continue
        if name in names:
            validation.error(f"Duplicate contributor name: {name}")
        if slug in slugs:
            validation.error(f"Duplicate contributor slug: {slug}")
        names.add(name)
        slugs.add(slug)

        contributor_path = (manifest_path.parent / file_value).resolve()
        try:
            contributor_path.relative_to(CONTRIBUTORS_DIR.resolve())
        except ValueError:
            validation.error(f"{name}: manifest file escapes contributors/: {file_value}")
            continue

        contributor_data = load_json(contributor_path, validation)
        if not isinstance(contributor_data, dict):
            continue
        if contributor_data.get("contributor") != name:
            validation.error(
                f"{name}: contributor field must exactly match the manifest name"
            )

        papers = contributor_data.get("papers", [])
        if not isinstance(papers, list):
            validation.error(f"{name}: papers must be an array")
            papers = []
        compiled_papers = contributor_data.get("compiledPapers", [])
        if not isinstance(compiled_papers, list):
            validation.error(f"{name}: compiledPapers must be an array")
            compiled_papers = []

        for index, paper in enumerate(papers, start=1):
            label = f"{name} paper #{index}"
            if not isinstance(paper, dict):
                validation.error(f"{label}: record must be an object")
                continue

            paper_id = paper.get("id")
            if isinstance(paper_id, bool) or not isinstance(paper_id, int) or paper_id < 1:
                validation.error(f"{label}: id must be a positive integer")
                continue
            if paper_id in paper_ids:
                validation.error(
                    f"Duplicate research-paper ID {paper_id}: {paper_ids[paper_id]} and {name}"
                )
            paper_ids[paper_id] = name

            for field in ("topic", "filterCategory"):
                if not isinstance(paper.get(field), str) or not paper[field].strip():
                    validation.error(f"{label}: {field} is required")
            if paper.get("assignedTo") and paper["assignedTo"] != name:
                validation.error(f"{label}: assignedTo must match {name}")
            resolve_local_pdf(paper.get("pdfUrl"), label, validation)

            summary = summaries.get(str(paper_id))
            if not isinstance(summary, dict):
                validation.error(f"{label}: missing summaries.json entry for id {paper_id}")
            else:
                for field in ("topic", "filterCategory", "assignedTo"):
                    paper_value = paper.get(field)
                    summary_value = summary.get(field)
                    if paper_value and summary_value and paper_value != summary_value:
                        validation.error(
                            f"{label}: {field} differs between papers.json and summaries.json"
                        )

            missing_full_fields = [
                field
                for field in ("title", "authors", "journal", "categoryKey", "categoryLabel")
                if not isinstance(paper.get(field), str) or not paper[field].strip()
            ]
            if missing_full_fields:
                is_existing_sparse_record = (
                    name == LEGACY_SPARSE_OWNER and paper_id in LEGACY_SPARSE_IDS
                )
                if is_existing_sparse_record:
                    legacy_sparse_records += 1
                else:
                    validation.error(
                        f"{label}: missing required fields: {', '.join(missing_full_fields)}"
                    )

            if paper.get("doi") and not normalize_doi(paper["doi"]):
                validation.error(f"{label}: doi is not a valid DOI")
            paper_records.append((name, paper, summary if isinstance(summary, dict) else None))

        for index, compiled in enumerate(compiled_papers, start=1):
            label = f"{name} compiled paper #{index}"
            if not isinstance(compiled, dict):
                validation.error(f"{label}: record must be an object")
                continue
            compiled_id = compiled.get("id")
            if not isinstance(compiled_id, str) or not compiled_id.strip():
                validation.error(f"{label}: id must be a non-empty string")
            elif compiled_id in compiled_ids:
                validation.error(
                    f"Duplicate compiled-paper ID {compiled_id}: {compiled_ids[compiled_id]} and {name}"
                )
            else:
                compiled_ids[compiled_id] = name

            for field in ("title", "topic", "description"):
                if not isinstance(compiled.get(field), str) or not compiled[field].strip():
                    validation.error(f"{label}: {field} is required")
            assigned = compiled.get("assignedTo")
            if isinstance(assigned, list):
                if not assigned or not all(isinstance(a, str) and a.strip() for a in assigned):
                    validation.error(f"{label}: assignedTo list must contain non-empty author names")
                elif name not in assigned:
                    validation.error(f"{label}: assignedTo list must include {name}")
                else:
                    for author in assigned:
                        if author not in all_manifest_names and author not in ("Team", "All"):
                            validation.error(f"{label}: unknown assigned contributor '{author}'")
            elif isinstance(assigned, str) and assigned.strip():
                assigned_authors = [a.strip() for a in assigned.split(",") if a.strip()]
                if not assigned_authors:
                    validation.error(f"{label}: assignedTo cannot be empty")
                elif len(assigned_authors) > 1:
                    if name not in assigned_authors:
                        validation.error(f"{label}: assignedTo must include {name}")
                    for author in assigned_authors:
                        if author not in all_manifest_names and author not in ("Team", "All"):
                            validation.error(f"{label}: unknown assigned contributor '{author}'")
                elif assigned != name and assigned not in ("Team", "All"):
                    validation.error(f"{label}: assignedTo must match {name}")
            else:
                validation.error(f"{label}: assignedTo is required")
            resolve_local_pdf(compiled.get("pdfUrl"), label, validation)
            pdf_url = compiled.get("pdfUrl")
            if isinstance(pdf_url, str):
                if pdf_url in compiled_paths:
                    validation.error(
                        f"Compiled PDF path is reused by {compiled_paths[pdf_url]} and {label}: {pdf_url}"
                    )
                compiled_paths[pdf_url] = label

    summary_ids = {key for key in summaries if re.fullmatch(r"\d+", str(key))}
    paper_id_strings = {str(paper_id) for paper_id in paper_ids}
    for missing in sorted(summary_ids - paper_id_strings, key=int):
        validation.error(f"summaries.json contains unknown research-paper id {missing}")
    for missing in sorted(paper_id_strings - summary_ids, key=int):
        validation.error(f"Research-paper id {missing} has no summaries.json entry")

    identities: dict[tuple[str, str], str] = {}
    for owner, paper, summary in paper_records:
        identity = paper_identity(paper, summary)
        if identity is None:
            continue
        label = f"{owner} paper {paper.get('id')}"
        if identity in identities:
            validation.warning(
                f"Possible duplicate paper identity ({identity[0]}: {identity[1]}): {identities[identity]} and {label}. Review the website indicator before removing either record."
            )
        else:
            identities[identity] = label

    if legacy_sparse_records:
        validation.warning(
            f"{legacy_sparse_records} existing Paper 1 records use compact metadata; new records must include full paper fields."
        )

    return validation


def main() -> int:
    validation = validate()
    for warning in validation.warnings:
        print(f"WARNING: {warning}")
    if validation.errors:
        for error in validation.errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Validation failed with {len(validation.errors)} error(s).", file=sys.stderr)
        return 1

    print(
        "Validation passed: contributor files, summaries, IDs, duplicate identities, and PDF paths are consistent."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
