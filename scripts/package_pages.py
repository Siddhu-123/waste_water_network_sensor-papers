#!/usr/bin/env python3
"""Stage only public library assets for a GitHub Pages deployment."""
import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path, default=Path("_site"))
    args = parser.parse_args()
    root = args.root.resolve()
    output = args.output.resolve()
    if output == root or output in root.parents:
        parser.error("output must not replace the source checkout")
    if output.exists():
        parser.error("output already exists; choose a fresh staging directory")
    output.mkdir(parents=True)
    for name in ("index.html", "pdf-viewer.html", "annotation-config.js", "summaries.json", ".nojekyll"):
        source = root / name
        if source.is_file():
            shutil.copy2(source, output / name)
    for name in ("js", "css", "contributors", "annotations", "assets", "images"):
        source = root / name
        if source.is_dir():
            shutil.copytree(source, output / name, ignore=shutil.ignore_patterns(".DS_Store", "__pycache__"))
    notice = root / "data/geography/NOTICE.md"
    if notice.is_file():
        shutil.copy2(notice, output / "geography-data-notice.txt")
    if not (output / "index.html").is_file():
        parser.error("source index.html is missing")
    print(f"Staged public library at {output}")

if __name__ == "__main__":
    main()
