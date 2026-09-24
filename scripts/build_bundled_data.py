#!/usr/bin/env python3
"""Build bundled-data.js for offline and file:// protocol support."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRIBUTORS_DIR = ROOT / "contributors"

def build_bundled_data():
    manifest_path = CONTRIBUTORS_DIR / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    all_papers = []
    all_compiled = []
    all_grey = []

    for contributor in manifest.get("contributors", []):
        name = contributor.get("name", "Unknown")
        file_path = (manifest_path.parent / contributor["file"]).resolve()
        contributor_data = json.loads(file_path.read_text(encoding="utf-8"))

        papers = contributor_data.get("papers", [])
        for paper in papers:
            if not paper.get("assignedTo"):
                paper["assignedTo"] = name
            all_papers.append(paper)

        compiled = contributor_data.get("compiledPapers", [])
        for cp in compiled:
            if not cp.get("assignedTo"):
                cp["assignedTo"] = name
            all_compiled.append(cp)

        if "greyLiteratureFile" in contributor:
            grey_path = (manifest_path.parent / contributor["greyLiteratureFile"]).resolve()
            grey_data = json.loads(grey_path.read_text(encoding="utf-8"))
            items = grey_data.get("greyLiterature", [])
            for item in items:
                if not item.get("assignedTo"):
                    item["assignedTo"] = name
            all_grey.extend(items)

    team_compiled = manifest.get("teamCompiledPaper")
    if team_compiled:
        team_compiled["isTeam"] = True
        all_compiled.append(team_compiled)

    summaries_path = ROOT / "summaries.json"
    summaries = json.loads(summaries_path.read_text(encoding="utf-8")) if summaries_path.is_file() else {}

    findings_path = ROOT / "contributors/rijoy-john/compiled-papers/GREY_LITERATURE_FINDINGS.md"
    findings_md = findings_path.read_text(encoding="utf-8") if findings_path.is_file() else ""

    bundle = {
        "manifest": manifest,
        "papers": all_papers,
        "compiledPapers": all_compiled,
        "summaries": summaries,
        "greyLiterature": all_grey,
        "findingsMarkdown": findings_md
    }

    output_path = ROOT / "js/bundled-data.js"
    js_content = "// Auto-generated bundled data for offline / file:// protocol fallback\n"
    js_content += "window.__BUNDLED_DATA__ = " + json.dumps(bundle, indent=2, ensure_ascii=False) + ";\n"
    output_path.write_text(js_content, encoding="utf-8")
    print(f"Successfully generated {output_path} ({len(all_papers)} papers, {len(all_grey)} grey lit items)")

if __name__ == "__main__":
    build_bundled_data()
