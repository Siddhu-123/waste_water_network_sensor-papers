# Wastewater Research Corpus

This repository contains the Paper 1 wastewater-sensor literature viewer. It stores research-paper PDFs, 8-step summaries, contributor metadata, and topic-level compiled papers.

Open [`index.html`](./index.html) to use the viewer.

## Repository layout

```text
sensor_papers/
├── index.html                         Dynamic viewer with nested filters & squeeze toggle
├── summaries.json                     Shared 8-step summaries
├── scripts/
│   └── validate_repo.py               Automated repository consistency validator
├── contributors/
│   ├── manifest.json                  Registered contributors & team compiled paper entry
│   ├── team_compiled_paper.pdf        Team-wide compiled paper PDF
│   ├── team_compiled_paper.json       Team compiled paper metadata
│   ├── _template/papers.json          Copy this for a new contribution
│   └── <contributor>/
│       ├── papers.json                Research-paper and compiled-paper metadata
│       ├── papers/                    Individual research-paper PDFs
│       └── compiled-papers/           Topic-level compiled-paper PDFs
```

The 23 initial research papers and the individual [compiled Paper 1 PDF](./contributors/satya-siddhartha/compiled-papers/paper-1.pdf) are stored in [`contributors/satya-siddhartha/`](./contributors/satya-siddhartha/). They remain assigned to **Satya Siddhartha**.

All paper records across contributors are loaded dynamically from their respective JSON files. `index.html` contains no hardcoded paper data.

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
3. Choose a unique numeric paper ID. Check the latest papers across all contributors to ensure your ID is unique (e.g. 24, 25, ...).
4. Place the PDF in your contributor's `papers/` folder.
5. Add the record to `papers.json`. Use a PDF path beginning with `./contributors/`.
6. Add the matching 8-step entry to [`summaries.json`](./summaries.json) using the same numeric ID.

Template for `summaries.json`:

```json
  "24": {
    "assignedTo": "Your Name",
    "topic": "Sensors",
    "filterCategory": "Level & Flow",
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

Template for `papers.json`:

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

## Team compiled paper

The team compiled paper is the collaborative review authored together by the entire team:

- **PDF location:** [`contributors/team_compiled_paper.pdf`](./contributors/team_compiled_paper.pdf)
- **Metadata location:** [`contributors/team_compiled_paper.json`](./contributors/team_compiled_paper.json) and registered under `teamCompiledPaper` in [`contributors/manifest.json`](./contributors/manifest.json).
- **Structure:**
  ```json
  "teamCompiledPaper": {
    "id": "team-compiled-paper",
    "title": "Optimal Sensor Placement for Wastewater Network Monitoring",
    "topic": "OSP",
    "filterCategory": "Compiled Review",
    "assignedTo": "Team",
    "description": "Team's compiled literature review on Optimal Sensor Placement for Wastewater Network Monitoring.",
    "pdfUrl": "./contributors/team_compiled_paper.pdf"
  }
  ```
- Because only one team compiled paper exists at a time, it sits directly in the `contributors/` root folder rather than inside any individual teammate's directory.

## Add a contributor compiled paper (single or co-authored)

A contributor compiled paper is a review, report, or thesis document written by an individual contributor or co-authored by 2 or 3 teammates.

1. Put the PDF in `contributors/<your-slug>/compiled-papers/`.
2. Name the file `<first-author-first-name>_<published-year>_<paper-name>.pdf`, using the paper title as the paper name and underscores between every word.
3. Add an entry to the `compiledPapers` array in your `papers.json`.
4. Set `id`, `title`, `topic`, `filterCategory`, `assignedTo`, `description`, and `pdfUrl`.

### Single-author compiled paper:
```json
{
  "id": "abraham-sa-wastewater-data",
  "title": "Public Wastewater Network Data in South Australia",
  "topic": "OSP",
  "filterCategory": "Compiled Review",
  "assignedTo": "Abraham",
  "description": "Abraham's compiled review on public wastewater network data in South Australia.",
  "pdfUrl": "./contributors/abraham/compiled-papers/Public Wastewater Network Data in South Australia.pdf"
}
```

### Co-authored compiled paper (2 or 3 teammates):
When two or three teammates collaborate on a compiled paper, `assignedTo` can be set as an array of names or a comma-separated string:
```json
{
  "id": "abraham-ashis-review",
  "title": "Joint Review on Acoustic Sensor Placement",
  "topic": "OSP",
  "filterCategory": "Compiled Review",
  "assignedTo": ["Abraham", "Ashis Jose"],
  "description": "Co-authored compiled paper by Abraham and Ashis Jose.",
  "pdfUrl": "./contributors/abraham/compiled-papers/joint_review.pdf"
}
```
*Co-authored papers will automatically appear when filtering by either teammate's name, and will list all co-authors on the card.*

## How the viewer and filters work

- **Topic:** Shows topics found in research papers and compiled papers. Selecting a topic dynamically refines the user dropdown and category pills.
- **User:** Shows registered contributors with material matching the selected topic.
- **Category buttons:** Filter research papers by specific subcategories within the active topic.
- **Squeeze filters:** Click **Squeeze filters** to hide the search, topic, user, and category controls while keeping the current selection summary visible. Click **Expand filters** to restore them.
- **Mobile layout:** On small screens, filters stack vertically, category buttons wrap, compiled-paper cards use one column, and research papers become readable cards with full-width actions.
- **Layered Compiled Papers Shelves:**
  - **When "User: All" is selected:**
    - **Top Shelf (`👥 Team Compiled Paper`):** Displays the collaborative team review across the top.
    - **Bottom Shelf (`📄 Contributor Compiled Papers`):** Displays individual and co-authored compiled reviews underneath.
  - **When a specific user is selected (e.g. "Abraham"):**
    - The team paper is hidden.
    - Only that teammate's individual and co-authored compiled papers are displayed.
- **Squeeze / Expand Toggle (`▲ Squeeze / ▼ Expand`):**
  - Click the **Squeeze** button in the compiled papers header to minimize the section into a slim ~48px strip (`All topics compiled papers · X available [▼ Expand]`).
  - This immediately pulls the research papers table front-and-center so users can inspect research papers on first glance.
  - Click **Expand** to restore the stacked shelves at any time.

## Possible duplicate uploads

The viewer keeps suspected duplicates visible. It first compares DOI values; when no DOI is available, it compares the normalized title, first author, and year. The later upload receives a small warning badge beside its title showing the existing paper ID and earlier uploader. Review the badge before deleting or replacing either record.

Research-paper IDs must still be unique. Duplicate DOI or title/author/year matches are reported as validation warnings so contributors can review them without blocking a valid upload.

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
- every PDF path points to an existing file in the repository;
- the research-paper ID is unique;
- the DOI is valid; review any duplicate-identity warnings;
- papers without a DOI are reviewed for repeated title, first author, and year;
- compiled-paper IDs are unique;
- contributor names match the manifest exactly;
- co-authored `assignedTo` lists contain valid registered contributors;
- `topic`, `filterCategory`, and `assignedTo` are correct.

Run the repository validator before committing:

```bash
python3 scripts/validate_repo.py
```

For a local browser check, run a static server from this directory:
```bash
python3 -m http.server 8000
```
and open `http://localhost:8000`. GitHub Actions runs the same validator on pushes and pull requests.
