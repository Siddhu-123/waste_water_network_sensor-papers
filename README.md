# Wastewater Research Corpus

This repository contains the Paper 1 wastewater-sensor literature viewer. It stores research-paper PDFs, 8-step summaries, contributor metadata, and topic-level compiled papers.

Open [`index.html`](./index.html) to use the viewer.

## Repository layout

```text
sensor_papers/
├── index.html                         Website and nested filters
├── summaries.json                     Shared 8-step summaries
├── contributors/
│   ├── manifest.json                  Registered contributors
│   ├── _template/papers.json          Copy this for a new contribution
│   └── <contributor>/
│       ├── papers.json                Research-paper and compiled-paper metadata
│       ├── papers/                    Individual research-paper PDFs
│       └── compiled-papers/           Topic-level compiled-paper PDFs
```

The current 23 research papers and the [compiled Paper 1 PDF](./contributors/satya-siddhartha/compiled-papers/paper-1.pdf) are stored in [`contributors/satya-siddhartha/`](./contributors/satya-siddhartha/). They remain assigned to **Satya Siddhartha**.

## Registered contributors

Use the exact names already listed in [`contributors/manifest.json`](./contributors/manifest.json):

- Satya Siddhartha
- Abraham
- Ashis Jose
- Rijoy John
- Wimukthi

Do not rename a contributor folder or change the registered name without updating the manifest.

## Add an individual research paper

1. Open your own `contributors/<your-slug>/papers.json` file.
2. Copy the structure from [`contributors/_template/papers.json`](./contributors/_template/papers.json).
3. Choose a unique numeric paper ID. IDs **1–23** are already used; the next new paper is **24**.
4. Place the PDF in your contributor's `papers/` folder.
5. Add the record to `papers.json`. Use a PDF path beginning with `./contributors/`.
6. Add the matching 8-step entry to [`summaries.json`](./summaries.json) using the same numeric ID.

Template:

```json
  "": {
    "assignedTo": "",
    "topic": "",
    "filterCategory": "",
    "citation": "",
    "intro": "",
    "methods": "",
    "scope": "",
    "usefulness": "",
    "limitations": "",
    "conclusions": "",
    "reflection": ""
  }
```

7. Add the DOI when the paper has one. Use the canonical value, such as `10.1234/example-doi`.
8. Set `assignedTo`, `topic`, and `filterCategory` in both metadata locations so the nested filters remain correct.

Template:

```json
{
  "id": ,
  "title": "",
  "authors": "",
  "journal": "",
  "categoryKey": "",
  "categoryLabel": "",
  "topic": "",
  "filterCategory": "",
  "assignedTo": "",
  "doi": "",
  "pdfUrl": "",
  "scholarUrl": ""
}
```

Example:

```json
{
  "id": 24,
  "title": "Paper title",
  "authors": "Authors (year)",
  "journal": "Journal, volume, pages",
  "categoryKey": "other",
  "categoryLabel": "Network optimisation",
  "topic": "Algorithms",
  "filterCategory": "Network optimisation",
  "assignedTo": "Abraham",
  "doi": "10.1234/example-doi",
  "pdfUrl": "./contributors/abraham/papers/paper-24.pdf",
  "scholarUrl": "https://scholar.google.com/"
}
```

## Add a compiled paper for a topic

A compiled paper is a complete review, report, or thesis-style document. It is separate from the individual research-paper list.

1. Put the PDF in `contributors/<your-slug>/compiled-papers/`. Name the file `<first-author-first-name>_<published-year>_<paper-name>.pdf`, using the paper title as the paper name and underscores between every word (e.g. `Antonietta_2023_Two_different_approaches_for_monitoring_planning_in_sewer_networks.pdf`).
2. Add a `compiledPapers` array to your contributor's `papers.json`.
3. Give the compiled paper a unique string ID.
4. Set its `topic`, `assignedTo`, `title`, `description`, and `pdfUrl`.

Example:

```json
"compiledPapers": [
  {
    "id": "abraham-algorithms-review-v1",
    "title": "Algorithms for Wastewater Network Monitoring",
    "topic": "Algorithms",
    "filterCategory": "Compiled Review",
    "assignedTo": "Abraham",
    "description": "Compiled review of algorithmic approaches.",
    "pdfUrl": "./contributors/abraham/compiled-papers/algorithms-review-v1.pdf"
  }
]
```

The website loads compiled papers automatically. Their topic is added to the topic filter, and the compiled-paper panel updates when a topic or user is selected. A compiled paper does not need an entry in `summaries.json` unless you also want an 8-step summary for it.

## How the filters work

- **Topic:** shows topics found in individual papers and compiled papers.
- **User:** shows only contributors with material in the selected topic.
- **Category buttons:** show categories used by the individual research papers in that topic.
- **Compiled papers panel:** shows matching compiled PDFs for the selected topic, user, and search text.

Normal additions do not require editing `index.html`. Edit the HTML only when changing the website itself.

## Shared summaries

[`summaries.json`](./summaries.json) contains the shared 8-step content for individual research papers:

1. Citation
2. Introduction
3. Aims and research methods
4. Scope
5. Usefulness
6. Limitations
7. Conclusions
8. Reflection

The top-level key must match the research-paper `id` in the contributor file. Keep IDs unique across the whole repository.

## Before committing

Check that:

- the JSON files are valid;
- every PDF path points to a file in the repository;
- the research-paper ID is unique;
- the DOI is not already used;
- papers without a DOI do not repeat the same title, first author, and year;
- compiled-paper IDs are unique;
- contributor names match the manifest exactly;
- `topic`, `filterCategory`, and `assignedTo` are correct.

Run the repository validator before committing:

```bash
python3 scripts/validate_repo.py
```

For a local browser check, run a static server from this directory and open `index.html`. The website loads contributor files dynamically, so opening the HTML directly from Finder may not load JSON files in some browsers. GitHub Actions runs the same validator on pushes and pull requests.
