# Contributor paper files

Each contributor has one `papers.json` file. Add new papers to your own file only; the website reads every file listed in [`manifest.json`](./manifest.json).

## Paper record

Copy the example from [`_template/papers.json`](./_template/papers.json), then update:

- `id`: a unique number across the whole website;
- `assignedTo`: the contributor's exact registered name;
- `topic`: the broad research area, such as `Sensors` or `Algorithms`;
- `filterCategory`: the category shown after that topic is selected;
- `pdfUrl`: the relative path to the PDF;
- `summaryKey`: the matching entry ID in the shared `summaries.json` file.

Place PDFs in a folder named `papers` inside the contributor's folder. Keep the existing Paper 1 IDs **1–23** unchanged; new contributions begin at **24**.

The current contributors are:

- Satya Siddhartha
- Abraham
- Ashis Jose
- Rijoy John
- Wimukthi
