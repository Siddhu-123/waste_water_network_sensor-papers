# Geographic reference data

`cities15000.zip` was downloaded from https://download.geonames.org/export/dump/cities15000.zip on 15 October 2026.
SHA-256: `d5cc2af747cdb2defd31f7baa815240fb9cc0145902469de01d059eaceb23011`.

City coordinates and names: GeoNames, licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ .
Source documentation: https://download.geonames.org/export/dump/readme.txt .
The original archive is retained unchanged for reproducible geographic resolution. Generated GeoNames place IDs retain their `geonames-` prefix.

`gazetteer_seed.json` preserves this library's pre-existing curated places and aliases. `reviewed.json` preserves existing human mappings and source hashes.
The extractor adds only supported city matches from GeoNames; it does not treat all city names mentioned in a paper as study sites.
