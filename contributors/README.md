# Contributor guide

Each contributor has one folder and one metadata file:

```text
contributors/<your-slug>/
├── papers.json
├── papers/
└── compiled-papers/
```

The website reads every contributor file listed in [`manifest.json`](./manifest.json). Do not edit `index.html` for normal additions.

## Individual research papers

Add records to the `papers` array in your own `papers.json` file. Each record needs:

- a unique numeric `id`;
- `title`, `authors`, and `journal`;
- `topic`, `filterCategory`, and the exact `assignedTo` name;
- `categoryKey` and `categoryLabel` for the research-paper table;
- a repository-relative `pdfUrl`.

Put the PDF in your own `papers/` folder. Add the matching eight-step summary to the root [`summaries.json`](../summaries.json).

## Compiled papers

Add complete reviews or reports to the `compiledPapers` array in the same `papers.json` file. Put each PDF in your `compiled-papers/` folder.

```json
{
  "compiledPapers": [
    {
      "id": "your-name-algorithms-review-v1",
      "title": "Your compiled paper title",
      "topic": "Algorithms",
      "filterCategory": "Compiled Review",
      "assignedTo": "Your Registered Name",
      "description": "One-sentence description.",
      "pdfUrl": "./contributors/your-slug/compiled-papers/algorithms-review-v1.pdf"
    }
  ]
}
```

Compiled papers are shown automatically when their topic is selected. They do not need a `summaries.json` entry unless you want them to appear in the 8-step summary system.

## Rules

1. Use the exact contributor name from [`manifest.json`](./manifest.json).
2. Keep individual paper IDs unique. Paper IDs **1–23** belong to the existing Paper 1 collection.
3. Keep compiled-paper string IDs unique.
4. Use paths beginning with `./contributors/` in JSON files.
5. Keep topic spelling consistent. `Algorithms` and `algorithm` would create different filters.
6. Validate JSON and test the page locally before committing.

Copy [`_template/papers.json`](./_template/papers.json) when starting a new contributor record.
