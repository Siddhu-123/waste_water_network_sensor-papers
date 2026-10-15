# Automatic research-location extraction

Implemented in `scripts/build_research_geography.py` and `.github/workflows/validate.yml`. Every push to `main` builds, validates and publishes the generated static library through GitHub Pages Actions. Pull requests run the same processing and tests without deployment.

## What exists

- The library reads contributor metadata and local PDFs. The map reads a generated `js/research-geography-data.js` file.
- `.github/workflows/validate.yml` installs the pinned PDF parser and OCR engine, restores the incremental cache, tests ingestion, regenerates geography and browser data, validates both, then stages and deploys public assets.
- The parent workspace has a pdfplumber extraction example at `output/research-library-2026-10-13/extract.py`. The builder uses pdfplumber in the same way when it is installed.
- The map currently includes 55 academic and 83 grey-literature records. Compiled reviews are in the dataset (the validator requires them) but are excluded from the map display.

## Files

| Path | Role |
| --- | --- |
| `scripts/build_research_geography.py` | The builder. Production runs require pdfplumber; OCR is enabled in Actions. |
| `scripts/geography_requirements.txt` | Pinned `pdfplumber` and `pytesseract` dependencies. |
| `scripts/test_research_geography.py` | Behaviour tests (`python3 -m unittest scripts/test_research_geography.py`). They build throwaway libraries with real pdfplumber extraction through `--root`, including new/changed papers and false-positive cases. The scan test runs when Tesseract is installed. |
| `data/geography/reviewed.json` | Snapshot of the 143 existing records: locations, unmapped reasons, academic `organization`, original order, and the PDF and metadata hashes they were reviewed against. This is the human-override layer. |
| `data/geography/gazetteer_seed.json` | The 61 existing places plus search aliases (for example Shoalhaven, Nowra, Washington DC). |
| `data/geography/countries.json` | Country names, aliases, and state/province names used only as country context. |
| `data/geography/extraction-cache.json` | Default local cache path. CI uses `.cache/research-geography/extraction-cache.json` and Actions cache; neither is committed or published. Contains bounded evidence, never full text. |

`reviewed.json` and `gazetteer_seed.json` were created once with `--import-baseline js/research-geography-data.js`. A run with those files and no changes to the library reproduces the existing JS file byte for byte (checked by a test).

## How a build works

1. Records are rebuilt from `contributors/manifest.json` and the contributor JSON files: academic, grey, and compiled (including `teamCompiledPaper`). Removed manifest entries disappear from the output and from the cache.
2. A record in `reviewed.json` keeps its locations and reason exactly. Its current PDF and metadata hashes are compared with the pinned ones; a difference sets `sourceChanged: true` on the record and changes nothing else. `--accept-source-changes` re-pins the hashes once someone has looked.
3. Compiled records get an empty-location stub with a reason and are never extracted.
4. Any other record is extracted from its local PDF unless the cache entry matches. The cache key covers the PDF SHA-256, the title/authors/URL digest, the extractor id (pdfplumber version, OCR on or off, or `stdlib`), the rules version, and a hash of the seed, country file and optional GeoNames file. Changing any of these re-extracts that record.
5. Output is sorted (reviewed order first, then manifest order), contains no timestamps, and is written only when its content changes.

## Extraction rules

- Page text is split into sentences and labelled by zone: page-1 header (everything before the abstract or introduction), reference list, publisher/licence/DOI/e-mail lines, and body. Only body sentences count.
- A place counts as a study site only when its sentence has a study-site cue in front of it: a verb such as collected, measured, installed, deployed or validated followed by in/at/from; a noun such as case study, study area, pilot site, field trial or test bed; or "was located in" after such a noun. Later items of a list ("Melbourne and Sydney", "Melbourne, Sydney, and Adelaide") share the cue. Multiple sites in one paper are all mapped.
- A sentence is rejected for background or related-work sections, introduction sentences that do not refer to the authors' own study, wording such as previous, et al., for example or compared with, synthetic or hypothetical networks, and organisation names ("University of Adelaide"). Papers whose title or opening text describes a review or survey are left unmapped. A paper with more than 10 distinct sites is left unmapped as a multi-site survey.
- Place names come from the seed and the optional GeoNames file. A name that exists in several countries is mapped only if the text names the country directly after it ("Paris, France", "Paris, Texas") or a neighbouring body sentence on the same page names one. Otherwise the reason says which countries match. A name that is not in the gazetteer stays unmapped and the reason gives the name. No coordinates are ever guessed.
- Country-only evidence maps to a country place only when the gazetteer already has one (the seed has Australia, United States, United Kingdom, China, Canada, Brazil and Ireland). Other countries stay unmapped with a reason.
- Each mapped location stores the sentence (at most about 320 characters), the page number, and the PDF path. Rejected and unresolved candidates are saved in the cache with the rejection reason.

## Usage

```
python3 scripts/build_research_geography.py --output /tmp/geo.js          # build somewhere safe
python3 scripts/build_research_geography.py                                # write js/research-geography-data.js
python3 scripts/build_research_geography.py --check                        # exit 1 if the output is stale, write nothing
python3 scripts/build_research_geography.py --gazetteer cities15000.zip    # add GeoNames cities15000
python3 scripts/build_research_geography.py --report report.json           # per-record status
python3 scripts/build_research_geography.py --accept-source-changes        # re-pin hashes for sourceChanged records
```

Other flags: `--root` (repository root, used by the tests), `--cache`, `--reviewed`, `--seed`, `--countries`, `--extractor auto|pdfplumber|stdlib`, `--ocr`, `--no-cache-write`, `--fetch-remote`, `--max-remote N`, `--max-fetch-mb N`.

For real papers, install the extras first: `pip install -r scripts/geography_requirements.txt`. Without pdfplumber the builder falls back to a small built-in reader that handles only simple text PDFs; most journal PDFs then end up unmapped with the reason "could not be read reliably" or "no extractable text". That is a safe failure, not a silent guess.

## Failure handling

A record with no PDF (`#`), a missing file, a remote PDF that was not fetched, a PDF with no text layer, an unreadable or corrupt PDF, or no qualifying sentence is output with empty locations and a specific `unmappedReason`. Remote PDFs are fetched only with `--fetch-remote`, at most `--max-remote` per run, with a size limit and a timeout, and only if the response starts with `%PDF`.

## Limitations

- Rules only. No language model, no credentials, no network by default. Study sites phrased in ways the cues do not cover are missed; the reason reads "No explicit study-site sentence found".
- A fresh corpus run with pdfplumber exposed false matches in dates, acknowledgements, table-of-contents entries and partial feature names. These cases now have regression checks and stricter rejection rules. This is a conservative first version, not a measured accuracy percentage. Existing reviewed records are preserved rather than replaced by that exploratory run.
- Sentence evidence from PDFs with poor line structure can be a long run of text cut at about 320 characters.
- The controlled extraction tests run with the real pdfplumber engine. The OCR test is exercised in CI with Tesseract; it skips on machines without that engine.
- GeoNames cities15000 only covers places with about 15,000 people or more; smaller towns stay unmapped. The pinned archive is included under `data/geography/cities15000.zip` and passed by CI. Country centroids beyond the seed are not included. Newly discovered cities require country context and an unambiguous full-name match.
- Multi-column layouts can interleave lines, so a study cue and its place can end up in different sentences.

## Publishing and maintenance

GitHub Pages uses the Actions publishing source. The build stages `index.html`, the viewer, JS/CSS, PDFs and public fallback annotations into `_site`, excluding backend code, caches, and processing data. The generated map data is the artifact that is published; no bot commits or extra API key are required. GeoNames attribution travels with the map data and a standalone notice file.

The committed geography JS is a reproducible snapshot. After additions, the deployed GitHub Pages copy is regenerated even if that snapshot was not manually edited. Vercel does not run this new Actions build, so it remains on its source snapshot until its own deployment flow is adapted or retired. Backend migration is separate from this static-site pipeline.

For a local rebuild:

```sh
python -m pip install -r scripts/geography_requirements.txt
python scripts/build_research_geography.py --extractor pdfplumber --gazetteer data/geography/cities15000.zip --cache .cache/research-geography/extraction-cache.json
python scripts/build_bundled_data.py
python scripts/validate_repo.py
python scripts/validate_research_geography.py
```

Add `--ocr` when Tesseract is installed. No remote PDFs are fetched by default: add the PDF to the library for automatic extraction. Remote or absent PDFs still receive an unmapped record automatically.

For a correction, edit `reviewed.json` and add any new place to `gazetteer_seed.json`. Changed sources retain the reviewed mapping and are flagged in the processing report. Use `--accept-source-changes` only after checking that a preserved mapping still applies. The map does not display processing metadata as extra UI instructions.

## Parser references

- GROBID document segmentation: https://grobid.readthedocs.io/en/latest/Principles/
- PyMuPDF text extraction and OCR alternative: https://pymupdf.readthedocs.io/en/latest/recipes-ocr.html
