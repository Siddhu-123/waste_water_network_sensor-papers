#!/usr/bin/env python3
"""Build js/research-geography-data.js from the contributor manifest and local PDFs.

Records are rebuilt from the manifest on every run. Locations come from, in order:
  1. data/geography/reviewed.json (curated or hand-corrected mappings, always kept),
  2. the extraction cache (data/geography/extraction-cache.json) when the inputs are unchanged,
  3. a fresh, conservative rules-only extraction from the PDF text.
Compiled reviews are never extracted. Rules-only extraction maps a place only when a study-site
sentence (with page) names it and the gazetteer resolves it unambiguously; everything else stays
unmapped with a reason. No network access, no LLM, no credentials (remote PDFs only with
--fetch-remote). See docs/research-location-automation.md.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import re
import sys
import unicodedata
import zipfile
import zlib
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import unquote, urlsplit

RULES_VERSION = "2"
OUTPUT_PREFIX = "window.RESEARCH_GEOGRAPHY_DATA = "
GEO_DIR = "data/geography"
DEFAULT_OUTPUT = "js/research-geography-data.js"
MAX_SITES = 10
MAX_CANDIDATES = 12
SNIPPET_CHARS = 320
TYPE_ORDER = {"academic": 0, "grey": 1, "compiled": 2}

REASONS = {
    "no_pdf": "No local PDF in the library, so no full text was read.",
    "missing": "The local PDF is listed but missing from the repository.",
    "remote": "The PDF is hosted remotely and was not fetched.",
    "fetch_failed": "The remote PDF could not be fetched ({why}).",
    "scanned": "The PDF has no extractable text (scanned or image-only) and OCR was not available.",
    "unreadable": "The PDF text could not be read reliably with the available extractor.",
    "parse_failed": "The PDF could not be parsed ({why}).",
    "review": "The title or abstract describes a review or survey; no single study site was mapped.",
    "none": "No explicit study-site sentence found; header affiliations, reference lists and publisher text were excluded.",
    "ambiguous": "The study-site name '{name}' matches several places ({countries}) and the text gives no country.",
    "unknown": "The study-site name '{name}' is not in the gazetteer, so no coordinates were assigned.",
    "country_unsupported": "The study evidence names {country} but the gazetteer has no country-level position for it.",
    "synthetic": "Only synthetic or hypothetical networks are described; no real study site.",
    "too_many": "{count} different places use study-site wording; treated as a multi-site survey and not mapped.",
    "compiled": "Compiled review; not extracted and excluded from the map.",
}


# --------------------------------------------------------------------------------------
# small helpers
# --------------------------------------------------------------------------------------

def canon(value) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def dump_json(value) -> str:
    return json.dumps(value, indent=2, ensure_ascii=False) + "\n"


def write_if_changed(path: Path, text: str) -> bool:
    if path.is_file() and path.read_text(encoding="utf-8") == text:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(text, encoding="utf-8")
    temp.replace(path)
    return True


def read_json(path: Path, default=None):
    if not path.is_file():
        return default
    return json.loads(path.read_text(encoding="utf-8"))


def natural_key(value):
    return [int(part) if part.isdigit() else part for part in re.split(r"(\d+)", str(value))]


# --------------------------------------------------------------------------------------
# PDF text extraction
# --------------------------------------------------------------------------------------

class ExtractError(Exception):
    def __init__(self, code: str, why: str = ""):
        super().__init__(code)
        self.code = code
        self.why = why


def pdfplumber_version() -> str | None:
    try:
        import pdfplumber  # noqa: F401
    except Exception:
        return None
    return str(getattr(pdfplumber, "__version__", "unknown"))


def ocr_available() -> bool:
    import shutil
    try:
        import pytesseract  # noqa: F401
    except Exception:
        return False
    return shutil.which("tesseract") is not None


def choose_extractor(preference: str, ocr: bool) -> str:
    """Return a stable id such as 'pdfplumber-0.11.4', 'pdfplumber-0.11.4+ocr' or 'stdlib'."""
    version = pdfplumber_version()
    if preference == "pdfplumber" and version is None:
        raise SystemExit("--extractor pdfplumber requested but pdfplumber is not installed (pip install -r scripts/geography_requirements.txt)")
    if preference in ("auto", "pdfplumber") and version is not None:
        return f"pdfplumber-{version}" + ("+ocr" if ocr and ocr_available() else "")
    return "stdlib"


def _decode_pdf_string(raw: bytes) -> str:
    if raw[:2] == b"\xfe\xff":
        return raw[2:].decode("utf-16-be", errors="ignore")
    return raw.decode("latin-1").replace("\x00", "")


_ESCAPES = {ord("n"): 10, ord("r"): 13, ord("t"): 9, ord("b"): 8, ord("f"): 12}
_DELIMS = b" \t\r\n\x00\x0c()<>[]/%"


def _read_literal(buf: bytes, i: int) -> tuple[bytes, int]:
    out = bytearray()
    depth = 1
    i += 1
    while i < len(buf) and depth:
        c = buf[i]
        if c == 0x5C:  # backslash
            i += 1
            if i >= len(buf):
                break
            c = buf[i]
            if c in _ESCAPES:
                out.append(_ESCAPES[c])
            elif 0x30 <= c <= 0x37:
                digits = bytes(buf[i:i + 3])
                m = re.match(rb"[0-7]{1,3}", digits)
                out.append(int(m.group(), 8) & 0xFF)
                i += len(m.group()) - 1
            elif c in (10, 13):
                if c == 13 and buf[i + 1:i + 2] == b"\n":
                    i += 1
            else:
                out.append(c)
        elif c == 0x28:
            depth += 1
            out.append(c)
        elif c == 0x29:
            depth -= 1
            if depth:
                out.append(c)
        else:
            out.append(c)
        i += 1
    return bytes(out), i


def _content_text(buf: bytes) -> str:
    out: list[str] = []
    stack: list = []
    arr: list | None = None
    last_ty = None
    i, n = 0, len(buf)

    def put(text: str) -> None:
        out.append(text)

    def newline() -> None:
        if out and not out[-1].endswith("\n"):
            out.append("\n")

    while i < n:
        c = buf[i:i + 1]
        if c in (b" ", b"\t", b"\r", b"\n", b"\x00", b"\x0c"):
            i += 1
        elif c == b"%":
            while i < n and buf[i] not in (10, 13):
                i += 1
        elif c == b"(":
            raw, i = _read_literal(buf, i)
            (arr if arr is not None else stack).append(raw)
        elif c == b"<" and buf[i + 1:i + 2] == b"<":
            i += 2
        elif c == b">" and buf[i + 1:i + 2] == b">":
            i += 2
        elif c == b"<":
            end = buf.find(b">", i)
            end = n if end < 0 else end
            hexed = re.sub(rb"[^0-9A-Fa-f]", b"", buf[i + 1:end])
            if len(hexed) % 2:
                hexed += b"0"
            (arr if arr is not None else stack).append(bytes.fromhex(hexed.decode("ascii")))
            i = end + 1
        elif c == b"[":
            arr = []
            i += 1
        elif c == b"]":
            if arr is not None:
                stack.append(arr)
            arr = None
            i += 1
        elif c == b"/":
            j = i + 1
            while j < n and buf[j] not in _DELIMS:
                j += 1
            (arr if arr is not None else stack).append(("name", buf[i + 1:j]))
            i = j
        elif c in (b")", b">"):
            i += 1
        else:
            j = i
            while j < n and buf[j] not in _DELIMS:
                j += 1
            token = buf[i:j]
            i = max(j, i + 1)
            if re.fullmatch(rb"[-+]?(?:\d+\.?\d*|\.\d+)", token):
                (arr if arr is not None else stack).append(float(token))
                continue
            op = token.decode("latin-1")
            if op == "Tj" and stack and isinstance(stack[-1], bytes):
                put(_decode_pdf_string(stack[-1]))
            elif op == "TJ" and stack and isinstance(stack[-1], list):
                for item in stack[-1]:
                    if isinstance(item, bytes):
                        put(_decode_pdf_string(item))
                    elif isinstance(item, float) and item < -200:
                        put(" ")
            elif op in ("'", '"') and stack and isinstance(stack[-1], bytes):
                newline()
                put(_decode_pdf_string(stack[-1]))
            elif op == "T*":
                newline()
            elif op in ("Td", "TD") and len(stack) >= 2 and isinstance(stack[-1], float):
                if stack[-1] != 0:
                    newline()
            elif op == "Tm" and len(stack) >= 6 and isinstance(stack[-1], float):
                if last_ty is not None and stack[-1] != last_ty:
                    newline()
                elif last_ty is not None:
                    put(" ")
                last_ty = stack[-1]
            elif op == "ET":
                newline()
            if not token.startswith(b"-") or not token[1:2].isdigit():
                stack = []
    return "".join(out)


def stdlib_pdf_pages(data: bytes) -> list[str]:
    """Minimal text reader for simple PDFs (literal/hex text, optional Flate). Not a general parser."""
    if not data.startswith(b"%PDF"):
        raise ExtractError("parse_failed", "not a PDF file")
    objs: dict[int, bytes] = {}
    for m in re.finditer(rb"(?<!\d)(\d+)\s+(\d+)\s+obj\b(.*?)endobj", data, re.S):
        objs[int(m.group(1))] = m.group(3)

    def dict_of(num: int) -> bytes:
        return objs.get(num, b"").split(b"stream", 1)[0]

    def stream_of(num: int) -> bytes:
        body = objs.get(num, b"")
        m = re.search(rb"stream\r?\n(.*?)\r?\n?endstream", body, re.S)
        if not m:
            return b""
        head = body[:m.start()]
        raw = m.group(1)
        if b"/FlateDecode" in head:
            try:
                return zlib.decompressobj().decompress(raw)
            except zlib.error:
                return b""
        if b"/Filter" in head:
            return b""
        return raw

    page_nums: list[int] = []
    catalog = next((n for n in sorted(objs) if re.search(rb"/Type\s*/Catalog\b", dict_of(n))), None)
    root = None
    if catalog is not None:
        m = re.search(rb"/Pages\s+(\d+)\s+\d+\s+R", dict_of(catalog))
        root = int(m.group(1)) if m else None
    seen: set[int] = set()

    def walk(num: int) -> None:
        if num in seen or num not in objs:
            return
        seen.add(num)
        head = dict_of(num)
        if re.search(rb"/Type\s*/Pages\b", head):
            kids = re.search(rb"/Kids\s*\[(.*?)\]", head, re.S)
            for ref in re.findall(rb"(\d+)\s+\d+\s+R", kids.group(1) if kids else b""):
                walk(int(ref))
        elif re.search(rb"/Type\s*/Page\b", head):
            page_nums.append(num)

    if root is not None:
        walk(root)
    if not page_nums:
        page_nums = [n for n in sorted(objs) if re.search(rb"/Type\s*/Page\b", dict_of(n))]

    pages = []
    for num in page_nums:
        head = dict_of(num)
        m = re.search(rb"/Contents\s*(\[[^\]]*\]|\d+\s+\d+\s+R)", head)
        refs = [int(x) for x in re.findall(rb"(\d+)\s+\d+\s+R", m.group(1))] if m else []
        text = "\n".join(_content_text(stream_of(ref)) for ref in refs)
        pages.append(text)
    return pages


def pdfplumber_pages(data: bytes, ocr: bool) -> list[str]:
    import pdfplumber
    pages = []
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            for page in pdf.pages:
                text = page.extract_text() or ""
                if ocr and len(text.strip()) < 25:
                    try:
                        import pytesseract
                        text = pytesseract.image_to_string(page.to_image(resolution=200).original) or text
                    except Exception:
                        pass
                pages.append(text)
    except Exception as exc:  # pdfminer raises many unrelated types
        raise ExtractError("parse_failed", type(exc).__name__) from exc
    return pages


def extract_pages(data: bytes, extractor: str) -> list[str]:
    if extractor.startswith("pdfplumber"):
        pages = pdfplumber_pages(data, extractor.endswith("+ocr"))
    else:
        try:
            pages = stdlib_pdf_pages(data)
        except ExtractError:
            raise
        except Exception as exc:
            raise ExtractError("parse_failed", type(exc).__name__) from exc
    return [unicodedata.normalize("NFKC", p) for p in pages]


COMMON_WORDS = {"the", "and", "of", "in", "to", "was", "were", "is", "for", "with", "that", "this", "are", "by"}


def check_readable(pages: list[str]) -> None:
    joined = "\n".join(pages)
    if len(re.sub(r"\s", "", joined)) < 80:
        raise ExtractError("scanned")
    words = re.findall(r"[A-Za-z]{2,}", joined)
    common = sum(1 for w in words if w.lower() in COMMON_WORDS)
    if len(words) < 30 or common / max(len(words), 1) < 0.05:
        raise ExtractError("unreadable")


# --------------------------------------------------------------------------------------
# gazetteer
# --------------------------------------------------------------------------------------

TOKEN_RE = re.compile(r"[^\W_]+(?:['’][^\W_]+)*")
MAX_NGRAM = 5
# English words that are also city names; skipped unless clearly a proper noun in a locative phrase
COMMON_WORD_PLACES = {"reading", "mobile", "nice", "normal", "bath", "wells", "hope", "young", "orange", "mission", "sale", "union"}


def tokkey(token: str) -> str:
    stripped = "".join(c for c in unicodedata.normalize("NFKD", token) if not unicodedata.combining(c))
    return stripped.lower().replace("'", "").replace("’", "")


def name_key(name: str) -> str:
    return " ".join(tokkey(t) for t in TOKEN_RE.findall(name))


@dataclass(frozen=True)
class Place:
    id: str
    name: str
    country: str
    lat: float
    lon: float
    kind: str
    parent: str | None = None
    source: str = "seed"
    keys: tuple = ()

    def as_output(self) -> dict:
        out = {"id": self.id, "name": self.name, "country": self.country, "lat": self.lat, "lon": self.lon, "kind": self.kind}
        if self.parent:
            out["parentPlaceId"] = self.parent
        return out


@dataclass
class Mention:
    start: int
    end: int
    text: str
    kind: str  # place | country | context
    country: str | None = None
    candidates: list = field(default_factory=list)
    place: Place | None = None  # country mentions: the country-level place when the gazetteer has one


class Gazetteer:
    def __init__(self, seed: dict, countries: dict, geonames_path: Path | None = None):
        self.countries_by_code: dict[str, str] = countries.get("countries", {})
        self.country_keys: dict[str, str] = {}
        for name in self.countries_by_code.values():
            self.country_keys[name_key(name)] = name
        for name, aliases in countries.get("aliases", {}).items():
            for alias in aliases:
                self.country_keys[name_key(alias)] = name
        self.context_keys = {name_key(k): v for k, v in countries.get("contextRegions", {}).items()}
        self.places: list[Place] = []
        self.by_id: dict[str, Place] = {}
        self.index: dict[str, list[Place]] = {}
        self.seed_ids: set[str] = set()
        for raw in seed.get("places", []):
            keys = tuple(dict.fromkeys(name_key(n) for n in [raw["name"], *raw.get("aliases", [])]))
            place = Place(raw["id"], raw["name"], raw["country"], raw["lat"], raw["lon"], raw["kind"], raw.get("parentPlaceId"), "seed", keys)
            self._add(place)
            self.seed_ids.add(place.id)
        geonames_hash = ""
        if geonames_path is not None:
            geonames_hash = self._load_geonames(geonames_path)
        for place in self.places:
            if place.kind == "country":
                self.country_keys.setdefault(name_key(place.name), place.name)
        self.version = sha256_bytes(canon({"seed": seed, "countries": countries, "geonames": geonames_hash}).encode("utf-8"))[:16]

    def _add(self, place: Place) -> None:
        self.places.append(place)
        self.by_id[place.id] = place
        for key in place.keys:
            self.index.setdefault(key, []).append(place)

    def _load_geonames(self, path: Path) -> str:
        raw = path.read_bytes()
        if raw[:2] == b"PK":
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                members = [n for n in archive.namelist() if n.lower().endswith((".txt", ".tsv")) and "readme" not in n.lower()]
                if not members:
                    raise SystemExit(f"{path}: no .txt member in gazetteer zip")
                text = archive.read(sorted(members)[0]).decode("utf-8")
        else:
            text = raw.decode("utf-8")
        seed_places = list(self.places)
        for line in text.splitlines():
            cols = line.split("\t")
            if len(cols) < 9 or cols[6] != "P":
                continue
            country = self.countries_by_code.get(cols[8])
            if not country:
                continue
            keys = tuple(dict.fromkeys(k for k in (name_key(cols[1]), name_key(cols[2])) if k))
            try:
                lat, lon = round(float(cols[4]), 4), round(float(cols[5]), 4)
            except ValueError:
                continue
            if any(set(keys) & set(s.keys) and abs(s.lat - lat) < 1 and abs(s.lon - lon) < 1 for s in seed_places):
                continue
            self._add(Place(f"geonames-{cols[0]}", cols[1], country, lat, lon, "city", None, "geonames", keys))
        return sha256_bytes(raw)

    def country_place(self, country: str) -> Place | None:
        key = name_key(country)
        for place in self.index.get(key, []):
            if place.source == "seed" and (place.kind == "country" or place.name == country):
                return place
        for place in self.index.get(key, []):
            if place.country == country:
                return place
        return None

    def find_mentions(self, text: str) -> list[Mention]:
        toks = [(m.start(), m.end(), m.group()) for m in TOKEN_RE.finditer(text)]
        keys = [tokkey(t[2]) for t in toks]
        out: list[Mention] = []
        i = 0
        while i < len(toks):
            hit = None
            if toks[i][2][:1].isupper():
                for n in range(min(MAX_NGRAM, len(toks) - i), 0, -1):
                    window = toks[i:i + n]
                    if any(text[window[k][1]:window[k + 1][0]].strip(" .-/,") for k in range(n - 1)):
                        continue
                    if any(text[window[k][1]:window[k + 1][0]].count(",") for k in range(n - 1)) and n > 2:
                        continue
                    key = " ".join(keys[i:i + n])
                    hit = self._lookup(key, window, text)
                    if hit:
                        out.append(hit)
                        i += n
                        break
            if not hit:
                i += 1
        return out

    def _lookup(self, key: str, window, text: str) -> Mention | None:
        start, end = window[0][0], window[-1][1]
        raw = text[start:end]
        short = len(key.replace(" ", "")) <= 3
        if short and not all(t[2].isupper() for t in window):
            return None
        if key in COMMON_WORD_PLACES and key not in self.country_keys:
            return None
        if key in self.country_keys:
            country = self.country_keys[key]
            return Mention(start, end, raw, "country", country, [], self.country_place(country))
        candidates = self.index.get(key, [])
        seed_hits = [p for p in candidates if p.source == "seed"]
        if key in self.context_keys and not seed_hits:
            return Mention(start, end, raw, "context", self.context_keys[key])
        if candidates:
            return Mention(start, end, raw, "place", None, list(candidates))
        if key in self.context_keys:
            return Mention(start, end, raw, "context", self.context_keys[key])
        return None


# --------------------------------------------------------------------------------------
# page text -> labelled sentences
# --------------------------------------------------------------------------------------

@dataclass
class Sentence:
    page: int
    zone: str  # body | header | reference | publisher
    section: str  # front | intro | background | body | conclusion
    text: str


HEADER_END_RE = re.compile(r"^\W*(?:abstract|a\s*b\s*s\s*t\s*r\s*a\s*c\s*t|summary|keywords?|key\s+words|highlights|(?:\d+\.?\s*)?introduction)\b", re.I)
REFERENCES_RE = re.compile(r"^\W*(?:\d+\.?\s*)?(?:references|reference list|bibliography|literature cited|works cited)\W*$", re.I)
REF_LINE_RE = re.compile(r"^\s*(?:\[\d{1,3}\]|\d{1,3}\.\s+[A-Z][\w'’-]+,\s+[A-Z]\.)")
PUBLISHER_RE = re.compile(r"(?:©|\(c\)\s*\d{4}|copyright|licensee|creative commons|all rights reserved|\bissn\b|\bdoi\b|https?://|www\.|published by|publisher'?s note|e-?mail|corresponding author|\bpp\.\s*\d)", re.I)
HEADING_RE = re.compile(
    r"^(?:\d+(?:\.\d+)*\.?\s+)?(?P<name>abstract|introduction|background|literature review|related works?|related studies|"
    r"state of the art|previous work|methods?|methodology|materials and methods|study area|study site|case study|"
    r"experimental setup|data collection|results|results and discussion|discussion|conclusions?|conclusions and future work)\s*$",
    re.I,
)
BACKGROUND_SECTIONS = {"background", "literature review", "related work", "related works", "related studies", "state of the art", "previous work"}
ABBREVIATIONS = re.compile(r"\b(e\.g|i\.e|et al|Figs?|Eqs?|No|vs|approx|Dr|St|Mt|Inc|Ltd|Co|Dept|Univ|ca|cf|Tab|Sec|Refs?|U\.S|U\.K|D\.C)\.")


def split_sentences(paragraph: str) -> list[str]:
    protected = ABBREVIATIONS.sub(lambda m: m.group().replace(".", "\x00"), paragraph)
    parts = re.split(r"(?<=[.!?])\s+(?=[A-Z0-9\"“(\[])", protected)
    return [p.replace("\x00", ".").strip() for p in parts if p.strip()]


def join_lines(lines: list[str]) -> str:
    out = ""
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if out.endswith("-") and line[:1].islower() and len(out) > 1 and out[-2].isalpha():
            out = out[:-1] + line
        else:
            out = f"{out} {line}" if out else line
    return out


def segment(pages: list[str]) -> list[Sentence]:
    sentences: list[Sentence] = []
    in_references = False
    section = "front"
    for number, text in enumerate(pages, start=1):
        lines = text.splitlines()
        header_until = 0
        if number == 1:
            header_until = next((i for i, line in enumerate(lines) if HEADER_END_RE.match(line.strip())), min(15, len(lines)))
        buffer: list[str] = []
        buffer_zone = "body"
        buffer_section = section

        def flush() -> None:
            nonlocal buffer
            if buffer:
                for sentence in split_sentences(join_lines(buffer)):
                    sentences.append(Sentence(number, buffer_zone, buffer_section, sentence))
            buffer = []

        for index, raw in enumerate(lines):
            line = raw.strip()
            if not line:
                continue
            if REFERENCES_RE.match(line) or re.search(r"\b(?:References|Bibliography)\b", line):
                flush()
                in_references = True
                continue
            if in_references or REF_LINE_RE.match(line):
                zone = "reference"
            elif number == 1 and index < header_until:
                zone = "header"
            elif PUBLISHER_RE.search(line) or re.search(r"\.{4,}", line):
                zone = "publisher"
            else:
                zone = "body"
            heading = HEADING_RE.match(line) if zone == "body" else None
            if heading:
                flush()
                name = heading.group("name").lower()
                if name in BACKGROUND_SECTIONS:
                    section = "background"
                elif name in {"methods", "method", "methodology", "materials and methods", "study area", "study site", "case study", "experimental setup", "data collection"}:
                    section = "methods"
                elif name == "introduction":
                    section = "intro"
                elif name.startswith("conclusion"):
                    section = "conclusion"
                else:
                    section = "body"
                continue
            if zone != buffer_zone or section != buffer_section:
                flush()
                buffer_zone, buffer_section = zone, section
            buffer.append(line)
        flush()
    return sentences


# --------------------------------------------------------------------------------------
# study-site cue rules
# --------------------------------------------------------------------------------------

VERBS = (
    r"collected|gathered|obtained|acquired|retrieved|sampled|measured|recorded|logged|monitored|surveyed|installed|"
    r"deployed|conducted|carried out|performed|undertaken|implemented|tested|trialled|trialed|validated|evaluated|"
    r"applied|operated|calibrated|established"
)
NOUNS = (
    r"case stud(?:y|ies)|study (?:area|site|region|catchment|location|network|sites)|pilot (?:site|study|area)|"
    r"field (?:site|study|trial|campaign)|test ?bed|monitoring (?:site|campaign|area)|monitored catchment|"
    r"experimental (?:site|catchment)|demonstration site"
)
NOUNS_LOCATED = NOUNS + r"|catchment|sewer network|sewer system|wastewater network|drainage network|network|site|study"
PLACE_LEAD = (
    r"(?:the\s+)?(?:greater\s+)?(?:(?:city|town|suburb|region|catchment|area|district|municipality|borough|county|state|"
    r"province|metropolitan area)\s+of\s+)?$"
)
CUE_VERB = re.compile(rf"\b(?:{VERBS})\b[^.;:]{{0,80}}?\b(?:in|at|from|across|within|near|around|throughout)\s+{PLACE_LEAD}", re.I)
CUE_NOUN = re.compile(rf"\b(?:{NOUNS})\b\s*,?\s*(?:in|at|of|from|near|within)\s+{PLACE_LEAD}", re.I)
CUE_LOCATED = re.compile(rf"\b(?:{NOUNS_LOCATED})\b[^.;]{{0,60}}?\b(?:is|are|was|were)\s+(?:located|situated|based)\s+(?:in|at|within|near|on)\s+{PLACE_LEAD}", re.I)
CUE_SELECTED = re.compile(rf"^\W*(?:,[^,.;]{{0,40}},)?\s*(?:is|was)\s+(?:selected|chosen|used|adopted)\s+as\s+(?:the|a|an|our)\s+(?:{NOUNS})", re.I)
LIST_SEP = re.compile(r"^\s*(?:,|,?\s+and|,?\s+or|\s*&|,?\s+as well as)\s+(?:(?:in|at|from)\s+)?(?:the\s+)?$", re.I)
TAIL_GAP = re.compile(r"^\s*(?:,|\(|\s+in\s+|,\s*in\s+)\s*$", re.I)
ORG_BEFORE = re.compile(r"(?:university|institute|college|council|department|school|faculty|ministry|bureau|authority|corporation|company|laboratory|laboratories|centre|center|government|agency|office|society|association)\s+(?:of|for)\s+(?:the\s+)?$", re.I)
ORG_AFTER = re.compile(r"^\s*(?:[-–]\s*)?(?:university|institute|college|council|water|polytechnic|school|airport|campus|zoo|fc)\b", re.I)
REJECT_RE = re.compile(
    r"\b(?:previous(?:ly)?|prior|earlier|literature|et al\.?|studies|researchers|authors|reported|reviewed|e\.g\.|such as|"
    r"for example|for instance|according to|as in|similar to|compared (?:to|with)|unlike|other (?:studies|cities|works))\b",
    re.I,
)
SYNTHETIC_RE = re.compile(
    r"\b(?:synthetic|hypothetical|illustrative|virtual (?:network|catchment|city|site)|artificial (?:network|catchment)|"
    r"benchmark (?:network|problem)|example network|generated network|test network|toy (?:network|example))\b",
    re.I,
)
SELF_RE = re.compile(r"\b(?:this (?:study|paper|work|research|article)|we|our|the present (?:study|work)|case study)\b", re.I)
REVIEW_TITLE_RE = re.compile(r"\b(?:review|survey|state[- ]of[- ]the[- ]art|overview|systematic|bibliometric|meta-analysis|roadmap)\b", re.I)
REVIEW_ABSTRACT_RE = re.compile(r"\b(?:this|the present)\s+(?:paper|article|study|work)\s+(?:reviews?|surveys?|summari[sz]es|synthesi[sz]es)\b|\bsystematic (?:literature )?review\b", re.I)
UNKNOWN_NAME_RE = re.compile(r"(?P<name>[A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,2})")
NOT_A_PLACE = {"the", "this", "these", "those", "a", "an", "table", "figure", "fig", "section", "eq", "equation", "appendix", "python", "matlab", "swmm", "epa", "scada", "iot", "lora", "lorawan"}
SKIP_UNKNOWN_FIRST = NOT_A_PLACE | {"our", "its", "their", "each", "all", "both"}


def snippet(text: str, around: int | None = None) -> str:
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= SNIPPET_CHARS:
        return text
    if around is None:
        return text[:SNIPPET_CHARS - 1].rstrip() + "…"
    start = max(0, around - SNIPPET_CHARS // 2)
    end = min(len(text), start + SNIPPET_CHARS)
    start = max(0, end - SNIPPET_CHARS)
    cut = text[start:end]
    if start > 0:
        cut = "…" + cut.split(" ", 1)[-1]
    if end < len(text):
        cut = cut.rsplit(" ", 1)[0] + "…"
    return cut


def cue_for(text: str, mention: Mention) -> str | None:
    before = text[:mention.start]
    for name, pattern in (("verb", CUE_VERB), ("noun", CUE_NOUN), ("located", CUE_LOCATED)):
        if pattern.search(before):
            return name
    if CUE_SELECTED.search(text[mention.end:mention.end + 120]):
        return "selected"
    return None


def tail_country(text: str, mentions: list[Mention], index: int) -> str | None:
    """Country named right after a place ('Melbourne, Australia', 'Melbourne (Victoria)')."""
    if index + 1 >= len(mentions):
        return None
    nxt = mentions[index + 1]
    if not TAIL_GAP.match(text[mentions[index].end:nxt.start]):
        return None
    if nxt.kind in ("country", "context"):
        return nxt.country
    countries = {c.country for c in nxt.candidates if c.kind in ("region", "country")}
    return countries.pop() if len(countries) == 1 and all(c.kind in ("region", "country") for c in nxt.candidates) else None


def context_countries(own: Mention, around: list[tuple[str, list[Mention]]]) -> set:
    found = set()
    for _, mentions in around:
        for m in mentions:
            if m is own:
                continue
            if m.kind in ("country", "context"):
                found.add(m.country)
            elif m.kind == "place" and all(c.kind in ("region", "country") for c in m.candidates):
                found.update(c.country for c in m.candidates)
    return found


def analyze(pages: list[str], title: str, gaz: Gazetteer) -> dict:
    """Return the cacheable analysis: status, reason, sites, candidates, mention counts."""
    sentences = segment(pages)
    mention_lists = [gaz.find_mentions(s.text) for s in sentences]

    counts: dict[str, Counter] = {}
    for sentence, mentions in zip(sentences, mention_lists):
        for m in mentions:
            if m.kind == "context":
                continue
            counts.setdefault(m.text, Counter())[sentence.zone] += 1
    mention_summary = [
        {"name": name, **{zone: c.get(zone, 0) for zone in ("body", "header", "reference", "publisher")}}
        for name, c in sorted(counts.items(), key=lambda kv: (-sum(kv[1].values()), kv[0]))[:MAX_CANDIDATES]
    ]

    result = {"status": "unmapped", "reason": "", "sites": [], "candidates": [], "mentions": mention_summary}
    candidates: list[dict] = result["candidates"]

    def reject(m: Mention, sentence: Sentence, why: str, place: Place | None = None) -> None:
        if len(candidates) < MAX_CANDIDATES:
            candidates.append({"name": m.text, "placeId": place.id if place else None, "page": sentence.page, "reason": why, "text": snippet(sentence.text, m.start)})

    early = " ".join(s.text for s in sentences if s.page <= 2 and s.zone == "body")[:6000]
    if REVIEW_TITLE_RE.search(title) or REVIEW_ABSTRACT_RE.search(early):
        result["reason"] = REASONS["review"]
        return result

    sites: dict[str, dict] = {}
    problems: list[tuple[str, dict]] = []  # (kind, detail) in discovery order

    for si, (sentence, mentions) in enumerate(zip(sentences, mention_lists)):
        if sentence.zone != "body":
            continue
        text = sentence.text
        around = [
            (sentences[j].text, mention_lists[j])
            for j in range(max(0, si - 1), min(len(sentences), si + 2))
            if sentences[j].page == sentence.page and sentences[j].zone == "body"
        ]
        chain_end = -1
        consumed: set[int] = set()
        for mi, m in enumerate(mentions):
            if mi in consumed or m.kind == "context":
                continue
            cue = cue_for(text, m)
            if cue is None and m.kind == "place" and chain_end >= 0 and LIST_SEP.match(text[chain_end:m.start]):
                cue = "list"
            if cue is None:
                continue
            if m.text.casefold() in {"university", "college", "march", "may", "june", "july", "august", "metro"}:
                reject(m, sentence, "non-geographic-word")
                continue
            if re.search(r"acknowledg|financial support|funded by|funding|grant number|sponsor", text, re.I):
                reject(m, sentence, "funding-or-acknowledgement")
                continue
            if re.match(r"^\s+(?:Pan\s+Creek|Creek|District|County|Province|University)\b", text[m.end:], re.I):
                reject(m, sentence, "partial-feature-name")
                continue
            if cue == "noun" and sentence.section != "methods" and not re.search(r"\b(?:this study|our|we|the present study|proposed model)\b", text, re.I):
                reject(m, sentence, "noun-mention-without-own-study")
                continue
            if sentence.section == "background":
                reject(m, sentence, "background-section")
                continue
            if sentence.section == "intro" and not SELF_RE.search(text):
                reject(m, sentence, "introduction-without-own-study")
                continue
            if REJECT_RE.search(text):
                reject(m, sentence, "review-wording")
                continue
            if SYNTHETIC_RE.search(text):
                reject(m, sentence, "synthetic-wording")
                problems.append(("synthetic", {}))
                continue
            if ORG_BEFORE.search(text[:m.start]) or ORG_AFTER.match(text[m.end:m.end + 40]):
                reject(m, sentence, "organization-name")
                continue

            strong = tail_country(text, mentions, mi)
            if strong is not None and mi + 1 < len(mentions):
                consumed.add(mi + 1)
            chain_end = mentions[mi + 1].end if strong is not None and mi + 1 < len(mentions) else m.end

            place: Place | None
            how = "unique-name"
            if m.kind == "country":
                place = m.place
                how = "country"
                if place is None:
                    reject(m, sentence, "country-unsupported")
                    problems.append(("country_unsupported", {"country": m.country}))
                    continue
            else:
                pool = m.candidates
                if strong is not None:
                    pool = [c for c in pool if c.country == strong]
                    how = "tail-country"
                    if not pool:
                        reject(m, sentence, "country-conflict")
                        continue
                if any(c.source == "geonames" for c in pool) and strong is None:
                    ctx = context_countries(m, around)
                    if not ctx:
                        reject(m, sentence, "new-city-without-country-context")
                        problems.append(("ambiguous", {"name": m.text, "countries": ", ".join(sorted({c.country for c in pool})[:4])}))
                        continue
                    pool = [c for c in pool if c.country in ctx]
                    if not pool:
                        reject(m, sentence, "country-conflict")
                        continue
                    how = "context-country"
                if len(pool) > 1:
                    ctx = context_countries(m, around)
                    narrowed = [c for c in pool if c.country in ctx]
                    if len(narrowed) >= 1:
                        pool, how = narrowed, "context-country"
                if len({c.id for c in pool}) > 1:
                    countries = sorted({c.country for c in pool})
                    reject(m, sentence, "ambiguous")
                    problems.append(("ambiguous", {"name": m.text, "countries": ", ".join(countries[:4])}))
                    continue
                place = pool[0]
            if place.id not in sites:
                sites[place.id] = {
                    "placeId": place.id,
                    "name": place.name,
                    "country": place.country,
                    "relation": "study",
                    "page": sentence.page,
                    "evidence": snippet(text, m.start),
                    "match": how,
                }
        # a locative cue followed by a capitalised phrase the gazetteer does not know
        known_starts = {m.start for m in mentions}
        own_study = sentence.section != "intro" or SELF_RE.search(text)
        if sentence.section != "background" and own_study and not REJECT_RE.search(text) and not SYNTHETIC_RE.search(text):
            for pattern in (CUE_VERB, CUE_NOUN, CUE_LOCATED):
                for hit in re.finditer(pattern.pattern.replace("$", "(?=(?P<tail>[A-Z]))"), text, re.I):
                    start = hit.end()
                    cap = UNKNOWN_NAME_RE.match(text[start:])
                    if cap and start not in known_starts and cap.group("name").split()[0].lower() not in SKIP_UNKNOWN_FIRST:
                        name = cap.group("name")
                        problems.append(("unknown", {"name": name}))
                        if len(candidates) < MAX_CANDIDATES:
                            candidates.append({"name": name, "placeId": None, "page": sentence.page, "reason": "unknown-name", "text": snippet(text, start)})

    if sites:
        if len(sites) > MAX_SITES:
            result["reason"] = REASONS["too_many"].format(count=len(sites))
            return result
        result["status"] = "mapped"
        result["sites"] = list(sites.values())
        return result

    for kind in ("ambiguous", "country_unsupported", "unknown", "synthetic"):
        detail = next((d for k, d in problems if k == kind), None)
        if detail is not None:
            result["reason"] = REASONS[kind].format(**detail)
            return result
    result["reason"] = REASONS["none"]
    return result


# --------------------------------------------------------------------------------------
# manifest / records
# --------------------------------------------------------------------------------------

def load_sources(root: Path) -> list[dict]:
    manifest_path = root / "contributors/manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    out: list[dict] = []
    seen: set[str] = set()

    def add(kind: str, item: dict, origin: str) -> None:
        if "id" not in item:
            raise SystemExit(f"{origin}: record without id")
        key = f"{kind}:{item['id']}"
        if key in seen:
            raise SystemExit(f"Duplicate source identity {key}")
        seen.add(key)
        out.append({"type": kind, "id": item["id"], "key": key, "raw": item})

    for contributor in manifest.get("contributors", []):
        for kind, field_name, array_name in (("academic", "file", "papers"), ("grey", "greyLiteratureFile", "greyLiterature")):
            source = contributor.get(field_name)
            if not source:
                continue
            payload = json.loads((root / "contributors" / source.removeprefix("./")).read_text(encoding="utf-8"))
            for item in payload.get(array_name, []):
                add(kind, item, source)
            if kind == "academic":
                for item in payload.get("compiledPapers", []):
                    add("compiled", item, source)
    team = manifest.get("teamCompiledPaper")
    if isinstance(team, dict):
        add("compiled", team, "manifest teamCompiledPaper")
    return out


def metadata_digest(raw: dict) -> str:
    keys = ("title", "authors", "pdfUrl", "url", "organization")
    return sha256_bytes(canon({k: raw.get(k, "") for k in keys}).encode("utf-8"))


def resolve_pdf(root: Path, pdf_url: str) -> tuple[str, Path | None]:
    if not pdf_url or pdf_url == "#":
        return "none", None
    parsed = urlsplit(pdf_url)
    if parsed.scheme in ("http", "https"):
        return "remote", None
    if parsed.scheme or parsed.netloc:
        return "none", None
    relative = parsed.path.removeprefix("./")
    for candidate in (root / relative, root / unquote(relative)):
        try:
            resolved = candidate.resolve()
        except OSError:
            continue
        if resolved.is_file() and resolved.is_relative_to(root.resolve()):
            return "local", resolved
    return "missing", None


def base_record(source: dict, organization: str) -> dict:
    raw = source["raw"]
    return {
        "id": source["id"],
        "type": source["type"],
        "title": raw.get("title", ""),
        "authors": raw.get("authors", ""),
        "assignedTo": raw.get("assignedTo", ""),
        "organization": organization,
        "pdfUrl": raw.get("pdfUrl", ""),
        "url": raw.get("url", ""),
    }


def fetch_remote(url: str, max_bytes: int, timeout: float) -> bytes:
    from urllib.request import Request, urlopen
    request = Request(url, headers={"User-Agent": "research-geography-builder/1"})
    try:
        with urlopen(request, timeout=timeout) as response:
            data = response.read(max_bytes + 1)
    except Exception as exc:
        raise ExtractError("fetch_failed", type(exc).__name__) from exc
    if len(data) > max_bytes:
        raise ExtractError("fetch_failed", f"larger than {max_bytes // (1024 * 1024)} MB")
    if not data.startswith(b"%PDF"):
        raise ExtractError("fetch_failed", "not a PDF")
    return data


# --------------------------------------------------------------------------------------
# build
# --------------------------------------------------------------------------------------

@dataclass
class Options:
    root: Path
    output: Path
    cache: Path
    reviewed: Path
    seed: Path
    countries: Path
    gazetteer: Path | None = None
    report: Path | None = None
    extractor: str = "auto"
    ocr: bool = False
    fetch_remote: bool = False
    max_remote: int = 20
    max_fetch_mb: int = 25
    fetch_timeout: float = 20.0
    write_cache: bool = True
    check: bool = False
    accept_changes: bool = False


@dataclass
class BuildResult:
    text: str
    data: dict
    cache: dict
    stats: Counter
    report: dict
    changed: bool = False


def location_from_site(site: dict, pdf_url: str) -> dict:
    return {"placeId": site["placeId"], "relation": "study", "evidence": site["evidence"], "source": pdf_url, "page": site["page"]}


def build(options: Options) -> BuildResult:
    root = options.root
    seed = read_json(options.seed)
    countries = read_json(options.countries, {})
    if seed is None:
        raise SystemExit(f"Missing gazetteer seed: {options.seed}")
    gaz = Gazetteer(seed, countries, options.gazetteer)
    reviewed_doc = read_json(options.reviewed, {"version": 1, "records": []})
    reviewed = {f"{r['type']}:{r['id']}": r for r in reviewed_doc.get("records", [])}
    reviewed_order = {key: i for i, key in enumerate(reviewed)}
    old_cache = (read_json(options.cache, {}) or {}).get("entries", {})
    extractor = choose_extractor(options.extractor, options.ocr)
    max_bytes = options.max_fetch_mb * 1024 * 1024

    sources = load_sources(root)
    stats: Counter = Counter()
    new_cache: dict[str, dict] = {}
    records: list[tuple[tuple, dict]] = []
    report_rows: list[dict] = []
    remote_budget = options.max_remote
    accepted_hashes: dict[str, dict] = {}

    for position, source in enumerate(sources):
        key, kind, raw = source["key"], source["type"], source["raw"]
        meta = metadata_digest(raw)
        pdf_url = raw.get("pdfUrl", "")
        pdf_kind, pdf_path = resolve_pdf(root, pdf_url)
        pdf_bytes = pdf_path.read_bytes() if pdf_path else None
        pdf_hash = sha256_bytes(pdf_bytes) if pdf_bytes is not None else None
        order = (reviewed_order.get(key, len(reviewed_order) + position), position)
        row = {"key": key}

        entry = reviewed.get(key)
        if entry is not None:
            organization = raw.get("organization", "") if kind == "grey" else entry.get("organization", raw.get("organization", ""))
            record = base_record(source, organization)
            record["locations"] = json.loads(json.dumps(entry.get("locations", [])))
            record["unmappedReason"] = entry.get("unmappedReason", "")
            changes = []
            if "pdfSha256" in entry and entry["pdfSha256"] != pdf_hash:
                changes.append("pdf")
            if "metadataSha256" in entry and entry["metadataSha256"] != meta:
                changes.append("metadata")
            if changes and options.accept_changes:
                accepted_hashes[key] = {"pdfSha256": pdf_hash, "metadataSha256": meta}
                changes = []
            if changes:
                record["sourceChanged"] = True
                stats["source_changed"] += 1
            stats["reviewed"] += 1
            row.update(status="source_changed" if changes else "reviewed", changed=changes)
            records.append((order, record))
            report_rows.append(row)
            continue

        record = base_record(source, raw.get("organization", "") if kind == "grey" else "")
        if kind == "compiled":
            record["locations"] = []
            record["unmappedReason"] = REASONS["compiled"]
            stats["compiled_stub"] += 1
            row.update(status="compiled_stub")
            records.append((order, record))
            report_rows.append(row)
            continue

        # fetching state is part of the cache key so a later --fetch-remote run recomputes
        will_fetch = pdf_kind == "remote" and options.fetch_remote
        cache_key = sha256_bytes(canon({
            "pdf": pdf_hash, "pdfKind": pdf_kind, "remote": pdf_url if pdf_kind == "remote" else None,
            "fetched": will_fetch, "meta": meta, "extractor": extractor, "rules": RULES_VERSION,
            "gazetteer": gaz.version,
        }).encode("utf-8"))
        cached = old_cache.get(key)
        if cached and cached.get("key") == cache_key:
            result = cached
            stats["cached"] += 1
        else:
            result = {"key": cache_key, "pdfSha256": pdf_hash, "metadataSha256": meta, "extractor": extractor, "gazetteer": gaz.version}
            try:
                if pdf_kind == "none":
                    raise ExtractError("no_pdf")
                if pdf_kind == "missing":
                    raise ExtractError("missing")
                if pdf_kind == "remote":
                    if not options.fetch_remote:
                        raise ExtractError("remote")
                    if remote_budget <= 0:
                        raise ExtractError("fetch_failed", "per-run fetch limit reached")
                    remote_budget -= 1
                    pdf_bytes = fetch_remote(pdf_url, max_bytes, options.fetch_timeout)
                    result["pdfSha256"] = sha256_bytes(pdf_bytes)
                pages = extract_pages(pdf_bytes, extractor)
                check_readable(pages)
                analysis = analyze(pages, raw.get("title", ""), gaz)
                result.update(analysis)
                result["pageCount"] = len(pages)
                stats["extracted"] += 1
            except ExtractError as exc:
                result.update(status="unmapped", reason=REASONS[exc.code].format(why=exc.why), sites=[], candidates=[], mentions=[])
                stats["extracted" if exc.code in ("scanned", "unreadable", "parse_failed") else "skipped"] += 1
        new_cache[key] = result

        record["locations"] = [location_from_site(s, pdf_url) for s in result.get("sites", [])]
        record["unmappedReason"] = "" if record["locations"] else result.get("reason") or REASONS["none"]
        stats["mapped" if record["locations"] else "unmapped"] += 1
        row.update(status="mapped" if record["locations"] else "unmapped", reason=record["unmappedReason"])
        records.append((order, record))
        report_rows.append(row)

    stats["removed_from_cache"] = len(set(old_cache) - set(new_cache))
    records.sort(key=lambda item: item[0])
    final_records = [r for _, r in records]

    needed: dict[str, Place] = {}
    for record in final_records:
        for location in record["locations"]:
            place = gaz.by_id.get(location["placeId"])
            if place is None:
                raise SystemExit(f"{record['type']}:{record['id']} references unknown place {location['placeId']} (is the --gazetteer file the one used when this was reviewed?)")
            needed[place.id] = place
    seed_places = [p for p in gaz.places if p.source == "seed"]
    extra = sorted((p for pid, p in needed.items() if p.source != "seed"), key=lambda p: p.id)
    data = {
        "automation": {"engine": "study-site-rules", "version": RULES_VERSION},
        "attribution": {"cities": "GeoNames, CC BY 4.0", "url": "https://www.geonames.org/", "notice": "./geography-data-notice.txt"},
        "places": [p.as_output() for p in [*seed_places, *extra]], "records": final_records,
    }
    text = OUTPUT_PREFIX + json.dumps(data, indent=2, ensure_ascii=False) + ";\n"
    cache = {"version": 1, "rulesVersion": RULES_VERSION, "entries": dict(sorted(new_cache.items(), key=lambda kv: natural_key(kv[0])))}
    # run-dependent counters (cache hits, fetches) stay out of the report so it is reproducible
    steady = {k: v for k, v in stats.items() if k not in ("cached", "extracted", "skipped", "removed_from_cache")}
    report = {"extractor": extractor, "gazetteer": gaz.version, "counts": dict(sorted(steady.items())), "records": report_rows}
    result = BuildResult(text, data, cache, stats, report)
    result.accepted_hashes = accepted_hashes  # type: ignore[attr-defined]
    return result


# --------------------------------------------------------------------------------------
# baseline import (one-off migration from the curated JS file)
# --------------------------------------------------------------------------------------

SEED_ALIASES = {"shoalhaven-nowra": ["Shoalhaven", "Nowra"], "washington-dc": ["Washington DC", "Washington D.C."]}


def parse_js_data(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if not text.startswith(OUTPUT_PREFIX):
        raise SystemExit(f"{path}: unexpected format")
    return json.loads(text[len(OUTPUT_PREFIX):].rstrip().removesuffix(";"))


def import_baseline(options: Options, js_path: Path) -> None:
    data = parse_js_data(js_path)
    sources = {s["key"]: s for s in load_sources(options.root)}
    records = []
    for record in data["records"]:
        key = f"{record['type']}:{record['id']}"
        source = sources.get(key)
        if source is None:
            print(f"skipping {key}: not in manifest", file=sys.stderr)
            continue
        kind, path = resolve_pdf(options.root, source["raw"].get("pdfUrl", ""))
        pdf_hash = sha256_bytes(path.read_bytes()) if path else None
        records.append({
            "type": record["type"], "id": record["id"], "organization": record.get("organization", ""),
            "locations": record["locations"], "unmappedReason": record.get("unmappedReason", ""),
            "pdfSha256": pdf_hash, "metadataSha256": metadata_digest(source["raw"]),
        })
    places = []
    for place in data["places"]:
        item = dict(place)
        if place["id"] in SEED_ALIASES:
            item["aliases"] = SEED_ALIASES[place["id"]]
        places.append(item)
    write_if_changed(options.seed, dump_json({"version": 1, "places": places}))
    write_if_changed(options.reviewed, dump_json({"version": 1, "records": records}))
    print(f"imported {len(records)} reviewed records and {len(places)} seed places")


# --------------------------------------------------------------------------------------
# cli
# --------------------------------------------------------------------------------------

def default_root() -> Path:
    return Path(__file__).resolve().parents[1]


def parse_args(argv: list[str] | None) -> tuple[argparse.Namespace, Options]:
    parser = argparse.ArgumentParser(description="Generate research geography data from the manifest and PDFs.")
    parser.add_argument("--root", type=Path, default=default_root(), help="repository root (default: parent of scripts/)")
    parser.add_argument("--output", type=Path, help=f"generated JS file (default: {DEFAULT_OUTPUT} under --root)")
    parser.add_argument("--cache", type=Path, help=f"JSON extraction cache (default: {GEO_DIR}/extraction-cache.json)")
    parser.add_argument("--reviewed", type=Path, help=f"curated/hand-corrected mappings (default: {GEO_DIR}/reviewed.json)")
    parser.add_argument("--seed", type=Path, help=f"gazetteer seed places (default: {GEO_DIR}/gazetteer_seed.json)")
    parser.add_argument("--countries", type=Path, help=f"country names/aliases (default: {GEO_DIR}/countries.json)")
    parser.add_argument("--gazetteer", type=Path, help="optional GeoNames cities15000 .zip or .txt (tab separated)")
    parser.add_argument("--report", type=Path, help="write a per-record status report (JSON) to this path")
    parser.add_argument("--extractor", choices=["auto", "pdfplumber", "stdlib"], default="pdfplumber")
    parser.add_argument("--ocr", action="store_true", help="OCR near-empty pages when pytesseract and tesseract are installed")
    parser.add_argument("--fetch-remote", action="store_true", help="download http(s) PDFs (off by default)")
    parser.add_argument("--max-remote", type=int, default=20, help="most remote PDFs fetched per run")
    parser.add_argument("--max-fetch-mb", type=int, default=25, help="size limit per fetched PDF")
    parser.add_argument("--no-cache-write", action="store_true", help="do not write the extraction cache")
    parser.add_argument("--check", action="store_true", help="write nothing; exit 1 if the output file is out of date")
    parser.add_argument("--accept-source-changes", action="store_true", help="re-pin reviewed.json hashes for records flagged sourceChanged")
    parser.add_argument("--import-baseline", type=Path, metavar="JS", help="one-off: create reviewed.json and gazetteer_seed.json from an existing generated JS file")
    args = parser.parse_args(argv)
    root = args.root.resolve()

    def rel(value: Path | None, default: str) -> Path:
        path = value if value is not None else Path(default)
        return path if path.is_absolute() else (root / path if value is None else Path.cwd() / path)

    options = Options(
        root=root,
        output=rel(args.output, DEFAULT_OUTPUT),
        cache=rel(args.cache, f"{GEO_DIR}/extraction-cache.json"),
        reviewed=rel(args.reviewed, f"{GEO_DIR}/reviewed.json"),
        seed=rel(args.seed, f"{GEO_DIR}/gazetteer_seed.json"),
        countries=rel(args.countries, f"{GEO_DIR}/countries.json"),
        gazetteer=(args.gazetteer if args.gazetteer is None or args.gazetteer.is_absolute() else Path.cwd() / args.gazetteer),
        report=(None if args.report is None else (args.report if args.report.is_absolute() else Path.cwd() / args.report)),
        extractor=args.extractor,
        ocr=args.ocr,
        fetch_remote=args.fetch_remote,
        max_remote=args.max_remote,
        max_fetch_mb=args.max_fetch_mb,
        write_cache=not args.no_cache_write,
        check=args.check,
        accept_changes=args.accept_source_changes,
    )
    return args, options


def main(argv: list[str] | None = None) -> int:
    args, options = parse_args(argv)
    if args.import_baseline:
        import_baseline(options, args.import_baseline if args.import_baseline.is_absolute() else Path.cwd() / args.import_baseline)
        return 0
    try:
        result = build(options)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"build failed: {exc}", file=sys.stderr)
        return 2
    summary = ", ".join(f"{k}={v}" for k, v in sorted(result.stats.items()))
    if options.check:
        current = options.output.read_text(encoding="utf-8") if options.output.is_file() else None
        if current != result.text:
            print(f"{options.output} is out of date ({summary})", file=sys.stderr)
            return 1
        print(f"{options.output} is up to date ({summary})")
        return 0
    if options.accept_changes and result.accepted_hashes:  # type: ignore[attr-defined]
        doc = read_json(options.reviewed)
        for entry in doc["records"]:
            update = result.accepted_hashes.get(f"{entry['type']}:{entry['id']}")  # type: ignore[attr-defined]
            if update:
                entry.update(update)
        write_if_changed(options.reviewed, dump_json(doc))
    result.changed = write_if_changed(options.output, result.text)
    if options.write_cache:
        write_if_changed(options.cache, dump_json(result.cache))
    if options.report:
        write_if_changed(options.report, dump_json(result.report))
    print(f"{'wrote' if result.changed else 'unchanged'} {options.output} ({len(result.data['records'])} records, {len(result.data['places'])} places; {summary})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
