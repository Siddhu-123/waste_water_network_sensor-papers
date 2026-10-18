# Geographic reference data

`cities15000.zip` was downloaded from https://download.geonames.org/export/dump/cities15000.zip on 15 October 2026.
SHA-256: `d5cc2af747cdb2defd31f7baa815240fb9cc0145902469de01d059eaceb23011`.

City coordinates and names: GeoNames, licensed under CC BY 4.0: https://creativecommons.org/licenses/by/4.0/ .
Source documentation: https://download.geonames.org/export/dump/readme.txt .
The original archive is retained unchanged for reproducible geographic resolution. Generated GeoNames place IDs retain their `geonames-` prefix.

`gazetteer_seed.json` preserves this library's pre-existing curated places and aliases. `reviewed.json` preserves existing human mappings and source hashes.
The extractor adds only supported city matches from GeoNames; it does not treat all city names mentioned in a paper as study sites.

On 18 October 2026, the Bellinge town anchor was corrected against GeoNames
2624193. Stonyfell (8348251), Moreton Bay's administrative region (7839376)
and Sefton borough (3333192) were checked against the GeoNames country dumps.
New source-supported places use GeoNames references 2634219 (West Yorkshire),
4736286 (Texas), 2160517 (Launceston), 2159166 (Lake Macquarie), 12047267
(Noosa), and the Australian state records 2155400, 2145234, 2152274 and 2058645.
Qingdao and Weihai use GeoNames 1797929 and 1791673 respectively, matching the
separate pilot and field experiments explicitly named in the source paper.
The country dumps are available at https://download.geonames.org/export/dump/.

These coordinates represent a city, region, lake or country, rather than exact
sensor positions. The rendered dots snap to the land-dot grid. Location evidence
in `reviewed.json` distinguishes study sites, affiliations and geographic scope.
The GL-46 location is supported separately by SA Water's 2018–19 annual report,
page 43; its existing local PDF is a different TasWater case study and is retained.
