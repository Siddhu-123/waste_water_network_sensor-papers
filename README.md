# Wastewater Research Library

> A static browser library for the Capstone PG-S2-22 team's wastewater sensor papers, compiled reviews and utility reports.

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black) ![HTML/CSS](https://img.shields.io/badge/HTML%2FCSS-E34F26?logo=html5&logoColor=white) ![Python](https://img.shields.io/badge/Python-3776AB?logo=python&logoColor=white) ![Web](https://img.shields.io/badge/platform-web-blue) ![Status](https://img.shields.io/badge/status-active-brightgreen)

Open [`index.html`](./index.html), or use the shared library link: https://siddhu-123.github.io/waste_water_network_sensor-papers/index.html. A direct Vercel deployment is also available at https://waste-water-network-sensor-papers-two.vercel.app/.

## At a glance

| | |
|---|---|
| **What** | Searchable corpus: 58 research papers, 5 compiled reviews, 1 team paper and 111 grey-literature reports |
| **Stack** | Vanilla JavaScript, vendored PDF.js, Python scripts, Cloudflare Worker for shared notes |
| **Status** | Active |
| **Run it** | `python3 -m http.server 8000`, then open `http://localhost:8000` |

## Features

- Nested topic, user and category filters with a squeeze/expand toggle.
- 8-step summaries in `summaries.json` and contributor profile cards.
- PDF.js viewer with a table of contents, true publisher page labels and click-to-jump navigation.
- Shared rectangular highlights and draggable sticker notes, stored as normalized coordinates.
- Team and contributor compiled-paper shelves, plus a grey-literature tab.
- Duplicate detection by DOI, then by normalized title, first author and year.
- Research map generated from paper PDFs in CI, with reviewed overrides.
- Repository consistency validator run locally and in GitHub Actions.

## Progress

| Area / Feature | Status | Notes |
|---|---|---|
| Viewer, filters and compiled-paper shelves | ✅ Done | Paper data is loaded from contributor JSON, not hardcoded in HTML |
| PDF viewer, summaries and shared annotations | ✅ Done | Cloudflare Worker is the default annotation store |
| Grey-literature catalogue and research map | ✅ Done | Map data is regenerated on pushes to `main` |
| Validator and GitHub Actions build | ✅ Done | Tests, geography build, validation and Pages deploy |
| Atomic writes and auth parity on Cloudflare | ⏳ Planned | Review recommends D1 conditional updates; GitHub OAuth routes are not ported |
| Retire the Vercel store after another comparison | ⏳ Planned | Vercel remains deployed with its original data |

## Quick start

Prerequisites: Python 3. No package install is needed to view the library.

1. From this directory, run `python3 -m http.server 8000`.
2. Open http://localhost:8000 and use the topic, user and category filters.
3. Click **PDF + Notes** beside a paper to open the PDF viewer.
4. Run `python3 scripts/validate_repo.py` before committing.

GitHub Actions runs the same validator on pushes and pull requests, then publishes the site to GitHub Pages from `main`.

## Project structure

```text
.
├── index.html              # Main viewer with nested filters
├── pdf-viewer.html         # PDF.js viewer with highlights and notes
├── view.html, r/           # Additional view pages
├── css/, js/               # Stylesheets and viewer modules
├── vendor/pdfjs-3.11.174/  # Bundled PDF.js
├── contributors/           # Manifest, templates and per-member paper folders
├── summaries.json          # Shared 8-step paper summaries
├── annotations/            # Optional committed annotation fallback
├── api/, server/           # Vercel OAuth and annotation routes
├── cloudflare-backend/     # Cloudflare Worker annotation API
├── data/geography/         # Reviewed mappings and gazetteer data
├── scripts/                # Data builders, validators and transfer tools
└── docs/                   # Backend review and location-automation notes
```

## Tech stack

- Vanilla JavaScript and modular CSS; no frontend build step.
- PDF.js 3.11.174 is vendored under `vendor/`.
- Python 3 scripts build bundled data, geography data and validate the repository.
- Cloudflare Worker plus KV holds shared annotations by default (`cloudflare-backend/`).
- Vercel Blob and the GitHub OAuth routes remain as a separate, alternate store.
- GitHub Pages hosts the viewer; GitHub Actions builds, validates and deploys it.

## How it works

All paper records are loaded from contributor JSON files; `index.html` contains no hardcoded paper data. Every push to `main` runs `.github/workflows/validate.yml`: it tests ingestion, regenerates geography and browser data, validates both and publishes the site. Pull requests run the same steps without deploying.

`annotation-config.js` sets the API base in this order: `?api=` query, saved localStorage override, Cloudflare Worker, then same origin. Overrides are accepted only for the live Worker or a local server. Shared saves use the Cloudflare Worker; Vercel remains a separate store, not a synced copy. On `file://` pages shared saving is disabled, and the viewer can load a committed JSON fallback from `annotations/` and download a local backup. See [the backend review](docs/cloudflare-backend-review.md) for the transfer status and open items.

For PDFs without embedded bookmarks, the viewer reconstructs headings from text lines using baseline clustering and font metrics. It shows publisher page labels, such as Roman front matter followed by printed page numbers, in the table of contents and toolbar.

The Vercel backend is still present as an alternate store: it keeps one JSON object per paper in Blob under `annotations/paper-<paperId>.json`, checks the Blob revision ETag on save, and needs `BLOB_READ_WRITE_TOKEN`. GitHub OAuth is optional there.

The viewer keeps suspected duplicates visible with a warning badge showing the earlier paper ID and uploader. It compares DOIs first, then normalized title, first author and year. Duplicate identities are validation warnings, not errors.

## Adding content

Use the exact contributor names in [`contributors/manifest.json`](./contributors/manifest.json). Do not rename a contributor folder or change a registered name without updating the manifest.

### Research paper

1. Open your own `contributors/<your-slug>/papers.json`, copying [`contributors/_template/papers.json`](./contributors/_template/papers.json) if needed.
2. Pick a numeric ID unique across all contributors and put the PDF in your `papers/` folder.
3. Add a record with `pages`, `size` (for example `"1.2 MB"`) and a `pdfUrl` beginning `./contributors/`.
4. Add the matching 8-step entry to [`summaries.json`](./summaries.json) under the same numeric ID.
5. Add the canonical DOI when one exists, and set `assignedTo`, `topic` and `filterCategory` in both metadata locations so nested filters stay correct.

The 8 steps are citation, intro, aims and research methods, scope, usefulness, limitations, conclusions and reflection.

### Compiled paper

The single team paper lives at the `contributors/` root: [`team_compiled_paper.pdf`](./contributors/team_compiled_paper.pdf) with metadata in `team_compiled_paper.json`, registered as `teamCompiledPaper`. The team report PDF is registered as `teamProjectReport`.

For an individual or co-authored review (2 or 3 teammates):

1. Put the PDF in `contributors/<your-slug>/compiled-papers/` named `<first-author-first-name>_<published-year>_<paper-name>.pdf`, with underscores between words.
2. Add an entry to the `compiledPapers` array in your `papers.json` with `id`, `title`, `topic`, `filterCategory`, `assignedTo`, `description`, `pages`, `size` and `pdfUrl`.
3. For co-authors, use an array of names or a comma-separated string. The paper appears under either contributor's filter and lists all co-authors.

### Grey literature

Grey literature covers utility reports, overflow case studies, design standards, regulator guidelines, sensor manuals and drainage master plans.

1. Put the PDF in `contributors/<your-slug>/grey/` named `GL_<Year>_<Org>_<ShortTitle>.pdf`. A web-only document can use `url` with `pdfUrl` set to `"#"` or omitted.
2. Make sure your manifest entry defines `greyLiteratureFile` (and optionally `findingsDocument`); add it if missing. Copy the record template from [`contributors/_template/grey-literature.json`](./contributors/_template/grey-literature.json).
3. Add the record to the contributor's `grey-literature.json`. `id`, `title` and `organization` are required; optional fields are `year`, `category`, `summary`, `assignedTo`, `pdfUrl`, `url`, `pages`, `size`, `keyTakeaways` and an 8-key `steps` object. The viewer matches `organization` to utility badge colours and renders all 8 steps when present, otherwise it falls back to `summary` and `keyTakeaways`.
4. Update `totalCount` at the top of that file.
5. Run `python3 scripts/validate_repo.py`, then `python3 -m http.server 8000` and check the **Grey Literature & Utility Reports** tab for badges, filters, PDF links and modals.

## Before committing

- JSON is valid; PDF paths beginning `./` exist; research and compiled-paper IDs are unique.
- DOIs are valid; papers without a DOI are checked for repeated title, first author and year.
- Contributor names match the manifest; co-author lists use registered names.
- `topic`, `filterCategory` and `assignedTo` are correct; grey-literature records have `title` and `organization`.
- Manifest `greyLiteratureFile` and `findingsDocument` paths resolve, and grey-literature `pdfUrl` paths point to existing PDFs.

Run `python3 scripts/validate_repo.py`.

## Research map

Adding or changing contributor metadata and PDFs on `main` runs the GitHub Actions build before publishing. It extracts study locations, regenerates map data and validates the library; ambiguous, missing or unreadable locations stay unmapped with a reason, and compiled reviews are excluded from map display. Human corrections belong in `data/geography/reviewed.json`. Details: [automatic location processing](docs/research-location-automation.md) and the [GeoNames notice](data/geography/NOTICE.md).

## Credits

Compiled by the Capstone PG-S2-22 team: Satya Siddhartha, Abraham, Ashis Jose, Rijoy John and Wimukthi. The team paper and project report are listed in `contributors/manifest.json`.
