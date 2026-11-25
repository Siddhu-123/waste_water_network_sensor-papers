#!/usr/bin/env python3
"""Stage only public library assets for a GitHub Pages deployment."""
import argparse
import base64
import hashlib
import html
import re
import shutil
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

WORKER = "https://pdf-annotations.sidcode3535.workers.dev"


class InlineCode(HTMLParser):
    """Collects inline <script> bodies and inline event handler attributes."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.scripts, self.handlers, self._in_script, self._buf = [], [], False, []

    def handle_starttag(self, tag, attrs):
        for name, value in attrs:
            if name.lower().startswith("on") and value:
                self.handlers.append(value)
        if tag == "script" and not dict(attrs).get("src"):
            self._in_script, self._buf = True, []

    def handle_data(self, data):
        if self._in_script:
            self._buf.append(data)

    def handle_endtag(self, tag):
        if tag == "script" and self._in_script:
            self.scripts.append("".join(self._buf))
            self._in_script = False


def sha(text):
    return "'sha256-" + base64.b64encode(hashlib.sha256(text.encode("utf-8")).digest()).decode() + "'"


def add_csp(page, extra_connect=""):
    """Add a Content-Security-Policy that allows only this page's own inline code."""
    text = page.read_text(encoding="utf-8")
    if 'http-equiv="Content-Security-Policy"' in text:
        return
    # Raw script bodies are hashed exactly as written; the parser keeps them verbatim.
    found = InlineCode()
    found.feed(text)
    hashes = sorted({sha(s) for s in found.scripts} | {sha(h) for h in found.handlers})
    policy = "; ".join([
        "default-src 'self'",
        "script-src 'self'" + (" 'unsafe-hashes' " if found.handlers else " ") + " ".join(hashes),
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com data:",
        "img-src 'self' data: blob:",
        "connect-src 'self' " + WORKER + (" " + extra_connect if extra_connect else ""),
        "worker-src 'self' blob:",
        "frame-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
    ])
    meta = '<meta http-equiv="Content-Security-Policy" content="' + html.escape(policy, quote=True) + '" />'
    text, n = re.subn(r"(<meta charset=[^>]*>)", lambda m: m.group(1) + "\n    " + meta, text, count=1, flags=re.I)
    if not n:
        raise SystemExit(f"{page.name}: no <meta charset> to place the security policy after")
    page.write_text(text, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output", type=Path, default=Path("_site"))
    parser.add_argument("--extra-connect", default="", help="extra connect-src origins, for local testing only")
    args = parser.parse_args()
    root = args.root.resolve()
    output = args.output.resolve()
    if output == root or output in root.parents:
        parser.error("output must not replace the source checkout")
    if output.exists():
        parser.error("output already exists; choose a fresh staging directory")
    output.mkdir(parents=True)
    for name in ("index.html", "pdf-viewer.html", "view.html", "annotation-config.js", "summaries.json", ".nojekyll"):
        source = root / name
        if source.is_file():
            shutil.copy2(source, output / name)
    for name in ("js", "css", "contributors", "annotations", "assets", "images", "r", "vendor"):
        source = root / name
        if source.is_dir():
            shutil.copytree(source, output / name, ignore=shutil.ignore_patterns(".DS_Store", "__pycache__"))
    notice = root / "data/geography/NOTICE.md"
    if notice.is_file():
        shutil.copy2(notice, output / "geography-data-notice.txt")
    if not (output / "index.html").is_file():
        parser.error("source index.html is missing")
    for name in ("index.html", "pdf-viewer.html"):
        if (output / name).is_file():
            add_csp(output / name, args.extra_connect)
    print(f"Staged public library at {output}")

if __name__ == "__main__":
    main()
