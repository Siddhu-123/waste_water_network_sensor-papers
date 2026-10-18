(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    canvas: $("researchMapCanvas"), wrap: $("researchMapCanvasWrap"), layout: $("researchMapLayout"),
    error: $("researchMapError"), errorText: $("researchMapErrorText"), coverage: $("researchMapCoverage"),
    tooltip: $("researchMapTooltip"), results: $("researchMapResults"), top: $("researchMapTopPlaces"),
    selection: $("researchMapSelection"), status: $("researchMapStatus"), organizations: $("researchMapOrganizations"), country: $("researchMapCountry"),
    location: $("researchMapLocation"), type: $("researchMapType"), contributor: $("researchMapContributor"), organization: $("researchMapOrganization"),
    australia: $("researchMapAustralia"), section: $("researchMapSection"), squeeze: $("researchMapSqueeze"),
  };
  if (!el.canvas || !el.wrap) return;

  el.sidebar = document.querySelector(".research-map-sidebar");
  const ctx = el.canvas.getContext("2d", { alpha: false });
  const map = { width: 0, height: 0, dpr: 1, mask: null, landDots: [], pins: [], pointer: null, hover: null, raf: 0, lens: 150, zoom: 4, mapTop: 0, mapHeight: 0, base: null, client: null };
  // Land dots and the solid core of research markers share one radius.
  const DOT_RADIUS = 1.65;
  const HIT_RADIUS = { base: 12, lens: 28, touch: 20 };
  const GLOW_RADIUS = { base: 6.5, lens: 7.5 };
  const TYPE_RGB = { academic: [56, 189, 248], grey: [245, 158, 11] };
  const desktopQuery = window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)");
  const isDesktop = () => desktopQuery.matches;
  const rowData = new Map();
  const detail = { panel: null, row: null, key: "", pinned: false, timer: 0, roving: null };
  let data = null;
  let places = [];
  let records = [];
  let selectedPlace = null;
  let shortcuts = null;
  let selectedCountry = "";
  let selectedOrganization = "";
  let unmappedMode = false;
  let lastTouchAt = 0;
  let resizeObserver;
  const lensSnapCache = new Map();
  const latMin = -58;
  const latMax = 84;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[ch]);
  const safeUrl = (value) => {
    if (typeof value !== "string" || !value.trim() || value.trim() === "#") return "";
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) { return ""; }
  };
  const urlLooksLikePdf = (value) => {
    try { return new URL(value, window.location.href).pathname.toLowerCase().endsWith(".pdf"); }
    catch (_) { return false; }
  };
  const recordKey = (record) => `${record.type}:${record.id}`;
  const MAP_TYPES = ["academic", "grey"];
  const typeLabel = (type) => ({ academic: "Academic / peer-reviewed", grey: "Grey literature" }[type] || type);
  const contributorsFor = (record) => {
    const assigned = Array.isArray(record.assignedTo) ? record.assignedTo : [record.assignedTo];
    return [...new Set(assigned.flatMap((name) => String(name || "").split(",")).map((name) => name.trim()).filter(Boolean))];
  };
  const INITIALS = /^(?:[A-Z][A-Za-z]?\.[\s-]*)+$/;
  const YEAR_IN_CITATION = /\(((?:19|20)\d{2})[a-z]?\)\s*\.?\s*$/;
  const yearOf = (value) => {
    const direct = String(value ?? "").match(/^\s*((?:19|20)\d{2})\s*$/);
    return direct ? direct[1] : "";
  };
  const citationYear = (authors) => (String(authors || "").match(YEAR_IN_CITATION) || [])[1] || "";
  // Canonical metadata for a map record, matched on type and exact id.
  const canonicalFor = (record) => {
    const bundled = window.__BUNDLED_DATA__ || {};
    const pick = (live, bundledKey) => {
      for (const list of [live, bundled[bundledKey]]) {
        const found = Array.isArray(list) ? list.find((item) => String(item.id) === String(record.id)) : null;
        if (found) return found;
      }
      return null;
    };
    if (record.type === "academic") return pick(typeof papersData !== "undefined" ? papersData : null, "papers");
    if (record.type === "grey") return pick(typeof greyLitData !== "undefined" ? greyLitData : null, "greyLiterature");
    return null;
  };
  const publicationYear = (citation) => {
    const text = String(citation || "");
    const match = text.match(/\((?:v\d+,\s*)?((?:19|20)\d{2})\)\s*$/) || text.match(/\bpublished\b.*\b((?:19|20)\d{2})\s*$/i);
    return match ? match[1] : "";
  };
  const recordYear = (record, canonical) =>
    yearOf(record.year) || citationYear(record.authors) || yearOf(canonical?.year) || citationYear(canonical?.authors) || publicationYear(canonical?.journal);
  // Names of the actual authors, in order. Handles "Surname, I., Surname, I." and "Given Surname, Given Surname".
  const authorNames = (raw) => {
    const text = String(raw || "").replace(YEAR_IN_CITATION, "").replace(/[\s,;]*\bet al\.?$/i, "").trim();
    const tokens = text.replace(/\s*&\s*|\s+and\s+/g, ",").split(/[,;]/).map((t) => t.trim()).filter(Boolean);
    const names = [];
    for (let i = 0; i < tokens.length; i++) {
      names.push(tokens[i]);
      if (i + 1 < tokens.length && INITIALS.test(tokens[i + 1])) i++;
    }
    return names;
  };
  const recordAuthor = (record, canonical) => {
    if (record.type === "grey") {
      const people = authorNames(record.authors || canonical?.authors);
      const orgs = String(canonical?.organization || record.organization || "").split(";").map((name) => name.trim()).filter(Boolean);
      if (people.length) return people.length > 1 ? `${people[0]} et al.` : people[0];
      return orgs.length > 1 ? `${orgs[0]} et al.` : orgs[0] || "";
    }
    const names = authorNames(record.authors || canonical?.authors);
    const etAl = /\bet al\.?\s*(?:\(.*\))?$/i.test(String(record.authors || canonical?.authors || ""));
    if (!names.length) return "";
    return names.length > 1 || etAl ? `${names[0]} et al.` : names[0];
  };
  const titleMeta = (record) => {
    const canonical = canonicalFor(record);
    const author = recordAuthor(record, canonical) || "Author unavailable";
    const year = recordYear(record, canonical) || "Year unavailable";
    return `${escapeHtml(author)} · ${escapeHtml(year)}`;
  };
  // Organizations are individual names: collaborations split on ";" and on a spaced "/" or "&"
  // (so "Florida A&M" and "Texas A&M" stay whole); commas inside a name are kept.
  const collapseSpace = (value) => String(value ?? "").normalize("NFC").replace(/\s+/g, " ").trim();
  const orgKey = (name) => collapseSpace(name).toLowerCase();
  // The capture group keeps the official Defra name (it has a spaced "&") as one part of the split.
  const ORG_SPLIT = /(Department for Environment, Food & Rural Affairs \(Defra\))|\s*;\s*|\s+\/\s+|\s+&\s+/;
  // Exact spellings (case-insensitive, whole name) that refer to one organization, mapped to its canonical name.
  const ORG_ALIASES = new Map([
    ["SA Water Corporation", "SA Water"],
    ["Sydney Water Corporation", "Sydney Water"],
    ["WSAA", "Water Services Association of Australia (WSAA)"],
    ["The University of Sheffield", "University of Sheffield"],
    ["Eawag", "Eawag, Swiss Federal Institute of Aquatic Science and Technology"],
    ["US Environmental Protection Agency", "US Environmental Protection Agency (US EPA)"],
  ].map(([from, to]) => [orgKey(from), to]));
  const canonicalOrganization = (name) => ORG_ALIASES.get(orgKey(name)) || name;
  const splitOrganizations = (raw) => {
    const names = new Map();
    for (const part of collapseSpace(raw).split(ORG_SPLIT)) {
      const name = canonicalOrganization(collapseSpace(part));
      if (name && !names.has(orgKey(name))) names.set(orgKey(name), name);
    }
    return [...names.values()];
  };
  const recordOrganizations = (record) => {
    const own = collapseSpace(record.organization);
    return splitOrganizations(own || canonicalFor(record)?.organization);
  };
  const orgIndex = new Map();
  const recordOrgKeys = new Map();
  const organizationKeys = (record) => recordOrgKeys.get(recordKey(record)) || new Set();
  const matchesOrganization = (record) => !selectedOrganization || organizationKeys(record).has(orgKey(selectedOrganization));
  const placeCountry = (place) => place.kind === "country" ? (place.country || place.name) : place.country;
  const point = (lat, lon) => ({
    x: 18 + ((Number(lon) + 180) / 360) * (map.width - 36),
    y: map.mapTop + ((latMax - Number(lat)) / (latMax - latMin)) * map.mapHeight,
  });
  const inverse = (x, y) => ({
    lon: ((x - 18) / (map.width - 36)) * 360 - 180,
    lat: latMax - ((y - map.mapTop) / map.mapHeight) * (latMax - latMin),
  });

  function showError(message) {
    el.layout.hidden = true;
    el.error.hidden = false;
    el.errorText.textContent = message;
    el.coverage.textContent = "Map unavailable";
  }

  function init() {
    if (!isDesktop()) return false;
    if (data) return true;
    const incoming = window.RESEARCH_GEOGRAPHY_DATA;
    const land = window.RESEARCH_WORLD_LAND;
    if (!incoming || !Array.isArray(incoming.places) || !Array.isArray(incoming.records) || !incoming.records.length) {
      showError("No research location records were found. The map can be retried after the data file loads.");
      return false;
    }
    if (!land || !Array.isArray(land.features) || !land.features.length) {
      showError("World land geometry did not load. Reload the library after js/world-land.js is available.");
      return false;
    }
    data = incoming;
    places = incoming.places.filter((place) => place && place.id != null && Number.isFinite(Number(place.lat)) && Number.isFinite(Number(place.lon)));
    records = incoming.records.filter((record) => record && record.id != null && MAP_TYPES.includes(record.type)).map((record) => ({
      ...record,
      locations: Array.isArray(record.locations) ? record.locations : [],
    }));
    if (!places.length || !records.length) {
      showError("Research map data loaded without usable places or records. Check the geography data file and retry.");
      return false;
    }
    el.error.hidden = true;
    el.layout.hidden = false;
    buildFilters();
    buildShortcuts();
    observeResize();
    setSize();
    render();
    return true;
  }

  function buildFilters() {
    const countries = [...new Set(places.map(placeCountry).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const countryList = $("researchMapCountryOptions");
    countryList.innerHTML = countries.map((country) => `<option value="${escapeHtml(country)}"></option>`).join("");
    const locationList = $("researchMapLocationOptions");
    locationList.innerHTML = places.slice().sort((a, b) => a.name.localeCompare(b.name)).map((place) =>
      `<option value="${escapeHtml(place.kind === "city" ? `${place.name}, ${place.country}` : place.name)}"></option>`).join("");
    const contributors = [...new Set(records.flatMap(contributorsFor))].sort((a, b) => a.localeCompare(b));
    el.contributor.innerHTML = `<option value="all">All contributors</option>${contributors.map((person) => `<option value="${escapeHtml(person)}">${escapeHtml(person)}</option>`).join("")}`;
    buildOrganizations();
  }

  // Full alphabetical list over every record (mapped or not), independent of the other filters.
  function buildOrganizations() {
    orgIndex.clear(); recordOrgKeys.clear();
    for (const record of records) {
      const names = recordOrganizations(record);
      recordOrgKeys.set(recordKey(record), new Set(names.map(orgKey)));
      for (const name of names) {
        const entry = orgIndex.get(orgKey(name)) || { label: name, keys: new Set() };
        entry.keys.add(recordKey(record));
        orgIndex.set(orgKey(name), entry);
      }
    }
    const sorted = [...orgIndex].sort((a, b) => a[1].label.localeCompare(b[1].label, undefined, { sensitivity: "base", numeric: true }) || (a[0] < b[0] ? -1 : 1));
    el.organization.innerHTML = `<option value="">All companies / organizations</option>${sorted.map(([key, entry]) => `<option value="${escapeHtml(key)}">${escapeHtml(entry.label)} (${entry.keys.size})</option>`).join("")}`;
    el.organization.value = "";
  }

  function setOrganization(name) {
    const entry = orgIndex.get(orgKey(name));
    selectedOrganization = entry ? entry.label : "";
    el.organization.value = entry ? orgKey(name) : "";
  }

  // Shortcut places: the three Australian cities first, then the busiest other cities and countries.
  // Ranking uses all records; the counts shown are recomputed from the current filters in render().
  const SHORTCUT_LIMITS = { cities: 4, countries: 6 };
  function buildShortcuts() {
    const anchors = ["Adelaide", "Melbourne", "Sydney"].map((name) => places.find((p) => p.kind === "city" && p.name.toLowerCase() === name.toLowerCase() && (p.country || "").toLowerCase().includes("australia"))).filter(Boolean);
    const unique = (place) => recordsAtPlace(place, true).length;
    const savedType = el.type.value, savedContributor = el.contributor.value;
    el.type.value = "all"; el.contributor.value = "all";
    const otherCities = places.filter((p) => p.kind === "city" && !anchors.includes(p))
      .map((place) => ({ place, total: unique(place) })).filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total || a.place.name.localeCompare(b.place.name)).slice(0, SHORTCUT_LIMITS.cities).map((e) => e.place);
    const countryNames = [...new Set(places.map(placeCountry).filter(Boolean))];
    const countryPlaces = countryNames.map((name) =>
      places.find((p) => p.kind === "country" && placeCountry(p) === name) || { id: `country:${name}`, name, country: name, kind: "country" })
      .map((place) => ({ place, total: unique(place) })).filter((e) => e.total > 0)
      .sort((a, b) => b.total - a.total || a.place.name.localeCompare(b.place.name)).slice(0, SHORTCUT_LIMITS.countries).map((e) => e.place);
    el.type.value = savedType; el.contributor.value = savedContributor;
    shortcuts = { cities: [...anchors, ...otherCities], countries: countryPlaces };
    el.australia.hidden = !shortcuts.cities.length && !shortcuts.countries.length;
  }

  function renderShortcuts() {
    if (!shortcuts) return;
    const button = (place) => {
      const active = selectedPlace && String(selectedPlace.id) === String(place.id) && !unmappedMode;
      return `<button type="button" data-place="${escapeHtml(place.id)}"${active ? ' class="active" aria-pressed="true"' : ' aria-pressed="false"'}>${escapeHtml(place.name)}<b>${recordsAtPlace(place).length}</b></button>`;
    };
    const group = (label, list) => list.length ? `<span class="research-map-quick-label">${label}</span>${list.map(button).join("")}` : "";
    el.australia.innerHTML = group("Cities", shortcuts.cities) + group("Countries", shortcuts.countries);
  }

  function buildMask() {
    const scale = 4;
    const mask = document.createElement("canvas");
    mask.width = Math.ceil(map.width * scale);
    mask.height = Math.ceil(map.height * scale);
    const mctx = mask.getContext("2d", { willReadFrequently: true });
    mctx.fillStyle = "#000";
    mctx.fillRect(0, 0, mask.width, mask.height);
    mctx.beginPath();
    mctx.rect(18 * scale, map.mapTop * scale, (map.width - 36) * scale, map.mapHeight * scale);
    mctx.clip();
    mctx.fillStyle = "#fff";
    const coord = ([lon, lat]) => [
      (18 + ((lon + 180) / 360) * (map.width - 36)) * scale,
      (map.mapTop + ((latMax - lat) / (latMax - latMin)) * map.mapHeight) * scale,
    ];
    const ringPath = (ring) => {
      if (!ring || !ring.length) return;
      const [x0, y0] = coord(ring[0]);
      mctx.moveTo(x0, y0);
      for (let i = 1; i < ring.length; i++) { const [x, y] = coord(ring[i]); mctx.lineTo(x, y); }
      mctx.closePath();
    };
    for (const feature of window.RESEARCH_WORLD_LAND.features) {
      const geometry = feature.geometry;
      if (!geometry) continue;
      const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
      for (const polygon of polygons) {
        mctx.beginPath();
        polygon.forEach(ringPath);
        mctx.fill("evenodd");
      }
    }
    map.mask = { ctx: mctx, width: mask.width, height: mask.height, pixels: mctx.getImageData(0, 0, mask.width, mask.height).data };
  }

  function isLand(x, y) {
    const mx = Math.round(x * 4), my = Math.round(y * 4);
    if (!map.mask || mx < 0 || my < 0 || mx >= map.mask.width || my >= map.mask.height) return false;
    return map.mask.pixels[(my * map.mask.width + mx) * 4] > 100;
  }

  function nearestDot(target, dots) {
    let best = null, distance = Infinity;
    for (const dot of dots) {
      const d = (dot.x - target.x) ** 2 + (dot.y - target.y) ** 2;
      if (d < distance) { best = dot; distance = d; }
    }
    return best;
  }

  function buildLandDots(step = 6.1, start = 4, clip = null, transform = (p) => p) {
    const dots = [];
    const minX = clip ? clip.left : 4, maxX = clip ? clip.right : map.width - 3;
    const minY = clip ? clip.top : 4, maxY = clip ? clip.bottom : map.height - 3;
    const startX = clip ? Math.floor(clip.left / step) * step : start;
    const startY = clip ? Math.floor(clip.top / step) * step : start;
    for (let y = startY; y < maxY; y += step) for (let x = startX; x < maxX; x += step) {
      const source = transform({ x, y });
      if (isLand(source.x, source.y)) dots.push({ x, y });
    }
    return dots;
  }

  function snapPins(pins, dots) {
    return pins.map((pin) => ({ ...pin, point: nearestDot(pin.sourcePoint, dots) || pin.sourcePoint }));
  }

  function setSize() {
    const rect = el.canvas.getBoundingClientRect();
    if (!rect.width) return;
    map.width = rect.width;
    map.height = Math.max(310, Math.min(440, Math.round(rect.width * 0.55)));
    map.mapHeight = Math.min(map.height - 24, (map.width - 36) * ((latMax - latMin) / 360));
    map.mapTop = (map.height - map.mapHeight) / 2;
    map.dpr = Math.min(window.devicePixelRatio || 1, 2);
    el.canvas.style.height = `${map.height}px`;
    el.canvas.width = Math.round(map.width * map.dpr);
    el.canvas.height = Math.round(map.height * map.dpr);
    ctx.setTransform(map.dpr, 0, 0, map.dpr, 0, 0);
    buildMask();
    map.landDots = buildLandDots();
    map.pins = snapPins(map.pins.map((pin) => ({ ...pin, sourcePoint: point(pin.place.lat, pin.place.lon) })), map.landDots);
    map.pinGroups = groupPins(map.pins);
    map.lensGroups = [];
    lensSnapCache.clear();
    map.base = null;
    draw();
  }

  function observeResize() {
    if (resizeObserver || !("ResizeObserver" in window)) return;
    resizeObserver = new ResizeObserver(() => {
      if (!data || !isDesktop()) return;
      const width = el.canvas.getBoundingClientRect().width;
      if (width && (!map.mask || Math.abs(width - map.width) >= 0.5)) setSize();
    });
    resizeObserver.observe(el.wrap);
  }

  function suspend() {
    if (map.raf) { cancelAnimationFrame(map.raf); map.raf = 0; }
    map.pointer = null; map.hover = null; map.mask = null;
    map.base = null; map.landDots = []; map.lensDots = []; map.lensGroups = []; map.lensPins = [];
    el.tooltip.hidden = true;
    hideDetail();
  }

  function onDesktopChange() {
    if (!isDesktop()) { suspend(); return; }
    if (data) setSize();
    else init();
  }

  function filteredRecords(ignoreOrganization = false) {
    const type = el.type.value;
    const contributor = el.contributor.value;
    return records.filter((record) => (type === "all" || record.type === type) &&
      (contributor === "all" || contributorsFor(record).includes(contributor)) &&
      (ignoreOrganization || matchesOrganization(record)));
  }

  function locationsFor(record) { return record.locations.map((loc) => ({ ...loc, place: places.find((p) => String(p.id) === String(loc.placeId)) })).filter((loc) => loc.place); }

  function recordsAtPlace(place, ignoreOrganization = false) {
    const country = place.kind === "country" ? (place.country || place.name) : "";
    const result = new Map();
    for (const record of filteredRecords(ignoreOrganization)) {
      const matches = locationsFor(record).filter((loc) => String(loc.placeId) === String(place.id) || String(loc.place.parentPlaceId || "") === String(place.id) || (country && placeCountry(loc.place) === country));
      if (matches.length) result.set(recordKey(record), { record, locations: matches });
    }
    return [...result.values()];
  }

  function pinCounts() {
    const counts = new Map();
    for (const record of filteredRecords()) {
      const touched = new Set(locationsFor(record).map((loc) => String(loc.placeId)));
      for (const id of touched) counts.set(id, (counts.get(id) || new Set()).add(recordKey(record)));
    }
    return counts;
  }

  function render() {
    if (!data) return;
    el.organization.value = selectedOrganization ? orgKey(selectedOrganization) : "";
    const counts = pinCounts();
    const pins = places.filter((place) => (counts.get(String(place.id)) || new Set()).size > 0).map((place) => {
      const keys = counts.get(String(place.id));
      const typeCounts = Object.fromEntries(MAP_TYPES.map((type) => [type, new Set(filteredRecords().filter((record) => record.type === type && locationsFor(record).some((loc) => String(loc.placeId) === String(place.id))).map(recordKey)).size]));
      return { place, count: keys.size, typeCounts, recordKeys: [...keys], sourcePoint: point(place.lat, place.lon) };
    });
    map.pins = snapPins(pins, map.landDots);
    map.pinGroups = groupPins(map.pins);
    const unique = new Set(filteredRecords().map(recordKey)).size;
    const mapped = new Set(filteredRecords().filter((r) => locationsFor(r).length).map(recordKey)).size;
    el.coverage.textContent = `${mapped} of ${unique} records mapped · ${map.pins.length} places`;
    if (selectedPlace && !unmappedMode) showPlaceResults(selectedPlace);
    else if (unmappedMode) showUnmappedResults();
    else if (selectedCountry) renderCountrySelection();
    else showOverview();
    renderShortcuts();
    map.base = null;
    draw();
  }

  function groupPins(pins) {
    const groups = new Map();
    const recordTypes = new Map(records.map((record) => [recordKey(record), record.type]));
    for (const pin of pins) {
      const key = `${pin.point.x.toFixed(3)},${pin.point.y.toFixed(3)}`;
      if (!groups.has(key)) groups.set(key, { point: pin.point, pins: [], typeRecords: { academic: new Set(), grey: new Set() }, records: new Set(), typeCounts: { academic: 0, grey: 0 }, count: 0 });
      const group = groups.get(key); group.pins.push(pin);
      for (const key of pin.recordKeys) group.records.add(key);
      for (const key of pin.recordKeys) {
        const type = recordTypes.get(key);
        if (type) group.typeRecords[type]?.add(key);
      }
    }
    for (const group of groups.values()) { group.count = group.records.size; for (const type of Object.keys(group.typeCounts)) group.typeCounts[type] = group.typeRecords[type].size; }
    return [...groups.values()];
  }

  const byTitle = (a, b) => String(a.record.title || "").localeCompare(String(b.record.title || ""), undefined, { numeric: true, sensitivity: "base" });

  function renderTitleList(entries, selected, emptyHtml) {
    hideDetail();
    rowData.clear();
    detail.roving = null;
    if (!entries.length) { el.results.innerHTML = emptyHtml; return; }
    el.results.innerHTML = `<ul class="research-map-titles">${entries.slice().sort(byTitle).map(({ record, locations }, index) => {
      const key = recordKey(record);
      rowData.set(key, { record, locations, selected });
      return `<li><button type="button" class="research-map-title-row ${escapeHtml(record.type)}" data-record="${escapeHtml(key)}" tabindex="0" aria-controls="researchMapDetail"><span class="research-map-title-text">${escapeHtml(record.title || `Record ${record.id}`)}</span><span class="research-map-title-meta">${titleMeta(record)}</span></button></li>`;
    }).join("")}</ul>`;
    detail.roving = el.results.querySelector(".research-map-title-row");
  }

  function showOverview() {
    selectedPlace = null;
    $("researchMapResultsHeading").textContent = "Papers";
    const listed = filteredRecords();
    el.selection.textContent = `${listed.length} ${listed.length === 1 ? "record" : "records"}`;
    el.organizations.innerHTML = "";
    el.top.innerHTML = "";
    renderTitleList(listed.map((record) => ({ record, locations: locationsFor(record) })), null, `<p class="research-map-empty">No records match these filters.</p>`);
    el.status.textContent = `${listed.length} records listed`;
  }

  function showPlaceResults(place) {
    selectedPlace = place;
    $("researchMapResultsHeading").textContent = place.name;
    unmappedMode = false;
    const linked = recordsAtPlace(place);
    const country = place.kind === "country" ? (place.country || place.name) : place.country;
    const selectedCity = place.kind === "city";
    el.selection.textContent = `${place.name}${country && selectedCity ? `, ${country}` : ""} · ${linked.length} unique ${linked.length === 1 ? "record" : "records"}${place.kind === "country" ? " across this country" : ""}`;
    el.top.innerHTML = "";
    renderOrganizations(place);
    renderTitleList(linked, place, `<p class="research-map-empty">No records match ${escapeHtml(place.name)} and the current filters.</p>`);
    el.status.textContent = `${place.name}: ${linked.length} related records`;
    el.canvas.setAttribute("aria-label", `Interactive world map. ${place.name} selected, ${linked.length} related records. Select another location marker.`);
  }

  function renderOrganizations(place) {
    const counts = new Map();
    for (const { record } of recordsAtPlace(place, true)) {
      for (const key of organizationKeys(record)) {
        const entry = orgIndex.get(key);
        if (entry) counts.set(entry.label, (counts.get(entry.label) || 0) + 1);
      }
    }
    const entries = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const selectedKey = selectedOrganization ? orgKey(selectedOrganization) : "";
    el.organizations.innerHTML = entries.length ? `<div class="research-map-subhead">Organizations</div>${entries.map(([name, count]) => `<button type="button" class="research-map-place-row research-map-org-row${selectedKey === orgKey(name) ? " active" : ""}" aria-pressed="${selectedKey === orgKey(name)}" data-org="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><b>${count}</b></button>`).join("")}${selectedOrganization ? `<button type="button" class="research-map-clear-org" data-clear-org>Clear organization filter</button>` : ""}` : "";
  }

  function showUnmappedResults() {
    $("researchMapResultsHeading").textContent = "Unmapped & global";
    const unmapped = filteredRecords().filter((record) => locationsFor(record).length === 0);
    selectedPlace = null;
    el.selection.textContent = `${unmapped.length} records without a mapped location`;
    el.top.innerHTML = "";
    el.organizations.innerHTML = "";
    const anyMatch = filteredRecords().length > 0;
    renderTitleList(unmapped.map((record) => ({ record, locations: [] })), null, `<p class="research-map-empty">${anyMatch ? "Every record matching these filters has a mapped location." : "No records match these filters."}</p>`);
    el.status.textContent = `${unmapped.length} unmapped records`;
  }

  function renderRecord(record, matchedLocations, selected) {
    const authors = record.authors ? `<div class="research-map-record-authors">${escapeHtml(record.authors)}</div>` : "";
    const relation = matchedLocations.map((loc) => {
      const page = loc.page ? ` · p. ${escapeHtml(loc.page)}` : "";
      const evidence = loc.evidence ? `<p class="research-map-evidence">${escapeHtml(loc.evidence)}</p>` : "";
      const sourceUrl = safeUrl(loc.source);
      const source = sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">Source${page}</a>` : loc.source ? `<span>${escapeHtml(loc.source)}${page}</span>` : page ? `<span>Source${page}</span>` : "";
      const relationLabels = { study: "Study site", site: "Study site", organization: "Organization location", org: "Organization location", organization_location: "Organization location", scope: "Geographic scope", geographic_scope: "Geographic scope", affiliation: "Author affiliation", author_affiliation: "Author affiliation" };
      const label = relationLabels[String(loc.relation || "").toLowerCase().replace(/[ -]+/g, "_")] || "Geographic scope";
      const locationName = loc.place.kind === "country" ? (loc.place.country || loc.place.name) : `${loc.place.name}${loc.place.country ? `, ${loc.place.country}` : ""}`;
      return `<div class="research-map-relation"><span>${escapeHtml(label)} · ${escapeHtml(locationName)}</span>${evidence}<small>${source}</small></div>`;
    }).join("");
    const organization = record.organization ? `<div class="research-map-record-org">${escapeHtml(record.organization)}</div>` : "";
    const pdf = safeUrl(record.pdfUrl);
    const external = safeUrl(record.url);
    const linkedPdf = pdf || (urlLooksLikePdf(record.url) ? external : "");
    const links = [];
    const academic = record.type === "academic" && typeof papersData !== "undefined" && Array.isArray(papersData)
      ? papersData.find((paper) => String(paper.id) === String(record.id)) : null;
    const viewerUrl = (paper, fallback) => {
      if (paper && typeof getPdfViewerUrl === "function") return safeUrl(getPdfViewerUrl(paper));
      const viewer = new URL("./pdf-viewer.html", window.location.href);
      viewer.searchParams.set("paper", String(fallback.id));
      viewer.searchParams.set("pdf", fallback.pdfUrl || fallback.url || "");
      if (fallback.title) viewer.searchParams.set("title", fallback.title);
      if (window.BrowserIdentity?.hasName()) viewer.searchParams.set("user", window.BrowserIdentity.getName());
      return safeUrl(viewer.href);
    };
    if (record.type === "academic") {
      const href = viewerUrl(academic, { ...record, pdfUrl: record.pdfUrl || record.url });
      const sourcePdf = safeUrl(academic?.pdfUrl || record.pdfUrl || record.url);
      if (href && sourcePdf) links.push(`<a class="research-map-link primary" href="${escapeHtml(href)}" target="_blank" rel="noopener">PDF + Notes</a>`);
    }
    if (record.type === "grey") {
      if (linkedPdf) links.push(`<a class="research-map-link primary" href="${escapeHtml(linkedPdf)}" target="_blank" rel="noopener">Open PDF</a>`);
      if (external && external !== linkedPdf) links.push(`<a class="research-map-link" href="${escapeHtml(external)}" target="_blank" rel="noopener">Open report ↗</a>`);
    }
    if (record.type === "academic" && Number.isFinite(Number(record.id))) {
      links.push(`<button class="research-map-link summary" type="button" data-summary="${escapeHtml(record.id)}">Research summary</button>`);
    }
    const unmapped = matchedLocations.length === 0 ? `<p class="research-map-unmapped-reason">${escapeHtml(record.unmappedReason || "No location assigned")}</p>` : "";
    const assignedTo = contributorsFor(record).join(", ");
    return `<article class="research-map-record"><div class="research-map-record-top"><span class="research-map-type ${escapeHtml(record.type)}">${escapeHtml(typeLabel(record.type))}</span>${assignedTo ? `<span class="research-map-assignee">${escapeHtml(assignedTo)}</span>` : ""}</div><h4>${escapeHtml(record.title || `Record ${record.id}`)}</h4>${authors}${organization}${relation}${unmapped}<div class="research-map-record-links">${links.join("")}</div></article>`;
  }

  // The static layer (background, land dots, graticule, markers) is painted once per layout or filter
  // change and blitted each frame, so pointer movement only pays for the lens.
  function baseLayer() {
    const base = map.base;
    if (base && base.canvas.width === el.canvas.width && base.canvas.height === el.canvas.height) return base.canvas;
    const canvas = document.createElement("canvas");
    canvas.width = el.canvas.width; canvas.height = el.canvas.height;
    const g = canvas.getContext("2d", { alpha: false });
    g.setTransform(map.dpr, 0, 0, map.dpr, 0, 0);
    g.fillStyle = "#080d17";
    g.fillRect(0, 0, map.width, map.height);
    g.fillStyle = "rgba(210, 220, 233, 0.68)";
    for (const dot of map.landDots) { g.beginPath(); g.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = "rgba(110, 134, 163, 0.14)";
    g.lineWidth = 1;
    for (let lat = -30; lat <= 60; lat += 30) {
      const y = point(lat, 0).y;
      g.beginPath(); g.moveTo(18, y); g.lineTo(map.width - 18, y); g.stroke();
    }
    drawPins(g, false);
    map.base = { canvas };
    return canvas;
  }

  function draw() {
    if (!ctx || !map.width || !map.mask) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(baseLayer(), 0, 0);
    ctx.setTransform(map.dpr, 0, 0, map.dpr, 0, 0);
    if (map.pointer && !map.pointer.touch) drawLens();
    else { map.lensDots = []; map.lensPins = []; map.lensGroups = []; }
    map.hover = map.pointer && !map.pointer.touch ? hitTest(map.pointer, false) : null;
  }

  function drawPins(g, lens) {
    const bounds = lens ? lensBounds() : null;
    const groups = (lens ? map.lensGroups || [] : map.pinGroups || []).filter(({ point: { x, y } }) =>
      !lens || (x >= bounds.left - 4 && x <= bounds.right + 4 && y >= bounds.top - 4 && y <= bounds.bottom + 4));
    const glow = lens ? GLOW_RADIUS.lens : GLOW_RADIUS.base;
    const wedge = (x, y, index, count, radius) => {
      g.beginPath(); g.moveTo(x, y);
      g.arc(x, y, radius, -Math.PI / 2 + index * Math.PI * 2 / count, -Math.PI / 2 + (index + 1) * Math.PI * 2 / count);
      g.closePath();
    };
    const typesOf = (group) => MAP_TYPES.filter((type) => group.typeCounts[type] > 0);
    for (const group of groups) {
      const { x, y } = group.point;
      const types = typesOf(group);
      types.forEach((type, index) => {
        const [r, gr, b] = TYPE_RGB[type];
        const halo = g.createRadialGradient(x, y, DOT_RADIUS * 0.5, x, y, glow);
        halo.addColorStop(0, `rgba(${r}, ${gr}, ${b}, .55)`);
        halo.addColorStop(1, `rgba(${r}, ${gr}, ${b}, 0)`);
        wedge(x, y, index, types.length, glow);
        g.fillStyle = halo; g.fill();
      });
    }
    for (const group of groups) {
      const { x, y } = group.point;
      const types = typesOf(group);
      types.forEach((type, index) => {
        const [r, gr, b] = TYPE_RGB[type];
        wedge(x, y, index, types.length, DOT_RADIUS);
        g.fillStyle = `rgb(${r}, ${gr}, ${b})`; g.fill();
      });
      if (lens) for (const pin of group.pins) if (/^(Adelaide|Melbourne|Sydney)$/.test(pin.place.name)) {
        g.font = "600 11px Inter, sans-serif"; g.textBaseline = "middle";
        const labelWidth = g.measureText(pin.place.name).width;
        const labelX = Math.max(bounds.left + 5, Math.min(bounds.right - labelWidth - 5, x + 8));
        const labelY = Math.max(bounds.top + 10, Math.min(bounds.bottom - 10, y - 7));
        g.lineWidth = 3; g.strokeStyle = "#07101a"; g.strokeText(pin.place.name, labelX, labelY);
        g.fillStyle = "#f2fcff"; g.fillText(pin.place.name, labelX, labelY);
      }
    }
  }

  // The lens samples a fixed grid in map space, so dots slide with the magnified land instead of
  // being re-sampled on a screen grid every frame. Pins snap to that same grid, so they stay put.
  const LENS_STEP = 5.2;
  function lensSnap(pin) {
    const key = String(pin.place.id);
    if (lensSnapCache.has(key)) return lensSnapCache.get(key);
    const step = LENS_STEP / map.zoom;
    const ci = Math.round(pin.sourcePoint.x / step), cj = Math.round(pin.sourcePoint.y / step);
    let best = null, bestD = Infinity;
    for (let r = 0; r <= 8 && !best; r++) {
      for (let j = cj - r; j <= cj + r; j++) for (let i = ci - r; i <= ci + r; i++) {
        if (r && Math.max(Math.abs(i - ci), Math.abs(j - cj)) !== r) continue;
        const x = i * step, y = j * step;
        if (!isLand(x, y)) continue;
        const d = (x - pin.sourcePoint.x) ** 2 + (y - pin.sourcePoint.y) ** 2;
        if (d < bestD) { bestD = d; best = { x, y }; }
      }
    }
    const snapped = best || pin.sourcePoint;
    lensSnapCache.set(key, snapped);
    return snapped;
  }

  function drawLens() {
    const { x, y } = map.pointer;
    const zoom = map.zoom, half = map.lens / 2;
    const left = Math.max(1, Math.min(map.width - map.lens - 1, x - half));
    const top = Math.max(1, Math.min(map.height - map.lens - 1, y - half));
    const toLens = (p) => ({ x: x + (p.x - x) * zoom, y: y + (p.y - y) * zoom });
    ctx.save();
    ctx.beginPath(); ctx.rect(left, top, map.lens, map.lens); ctx.clip();
    ctx.fillStyle = "#080d17"; ctx.fillRect(left, top, map.lens, map.lens);
    ctx.fillStyle = "rgba(189, 208, 226, 0.58)";
    const step = LENS_STEP / zoom;
    const i0 = Math.ceil((x + (left - x) / zoom) / step), i1 = Math.floor((x + (left + map.lens - x) / zoom) / step);
    const j0 = Math.ceil((y + (top - y) / zoom) / step), j1 = Math.floor((y + (top + map.lens - y) / zoom) / step);
    const lensDots = [];
    ctx.beginPath();
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const sx = i * step, sy = j * step;
      if (!isLand(sx, sy)) continue;
      const dx = x + (sx - x) * zoom, dy = y + (sy - y) * zoom;
      lensDots.push({ x: dx, y: dy });
      ctx.moveTo(dx + DOT_RADIUS, dy); ctx.arc(dx, dy, DOT_RADIUS, 0, Math.PI * 2);
    }
    ctx.fill();
    map.lensDots = lensDots;
    map.lensPins = [];
    for (const pin of map.pins) {
      const at = toLens(lensSnap(pin));
      if (at.x >= left && at.x <= left + map.lens && at.y >= top && at.y <= top + map.lens) map.lensPins.push({ ...pin, point: at });
    }
    map.lensGroups = groupPins(map.lensPins);
    drawPins(ctx, true);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = "rgba(79, 232, 238, .92)"; ctx.lineWidth = 1.5; ctx.shadowColor = "rgba(45, 212, 222, .24)"; ctx.shadowBlur = 12; ctx.strokeRect(left + 0.75, top + 0.75, map.lens - 1.5, map.lens - 1.5); ctx.restore();
  }

  function localPoint(event) {
    const rect = el.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function schedule() { if (!map.raf) map.raf = requestAnimationFrame(frame); }
  function frame() {
    map.raf = 0;
    draw();
    updateHover();
  }
  function setPointer(point, touch = false) {
    map.pointer = { ...point, touch };
    schedule();
  }
  function updateHover() {
    if (map.hover && map.pointer && !map.pointer.touch) { placeTooltip(map.hover.group); el.canvas.style.cursor = "pointer"; }
    else { el.tooltip.hidden = true; el.canvas.style.cursor = "crosshair"; }
  }
  function nearestPin(x, y, lens = false, radius = HIT_RADIUS.base) {
    let winner = null, best = radius;
    const groups = lens ? map.lensGroups || [] : map.pinGroups || [];
    for (const group of groups) {
      const distance = Math.hypot(group.point.x - x, group.point.y - y);
      if (distance <= best) { best = distance; winner = group; }
    }
    return winner;
  }
  // One resolver for hover and click: the nearest marker dot inside a bounded radius,
  // searched in the lens when the pointer sits in it and on the base map otherwise.
  function hitTest(pos, touch) {
    const lens = !touch && pointerInsideLens(pos.x, pos.y);
    const group = nearestPin(pos.x, pos.y, lens, touch ? HIT_RADIUS.touch : lens ? HIT_RADIUS.lens : HIT_RADIUS.base);
    return group ? { group, lens } : null;
  }
  function lensBounds() {
    if (!map.pointer) return null;
    const left = Math.max(1, Math.min(map.width - map.lens - 1, map.pointer.x - map.lens / 2));
    const top = Math.max(1, Math.min(map.height - map.lens - 1, map.pointer.y - map.lens / 2));
    return { left, top, right: left + map.lens, bottom: top + map.lens };
  }
  function pointerInsideLens(x, y) { const b = lensBounds(); return b && x >= b.left && x <= b.right && y >= b.top && y <= b.bottom; }
  function describePin(group) {
    const types = Object.entries(group.typeCounts).filter(([, count]) => count).map(([type, count]) => `${typeLabel(type)}: ${count}`).join(" · ");
    const names = group.pins.map(({ place }) => `${place.name}${place.country ? `, ${place.country}` : ""}`);
    const precision = [...new Set(group.pins.map(({ place }) => place.precision || place.kind || "place"))].join("/");
    return `${names.join("; ")} · ${group.count} records · ${types} · approximate ${precision} center${names.length > 1 ? "s" : ""}`;
  }

  function choosePinGroup(group) {
    if (!group) return;
    if (group.pins.length === 1) { choosePlace(group.pins[0].place); return; }
    selectedPlace = null; selectedCountry = ""; unmappedMode = false;
    hideDetail();
    el.organizations.innerHTML = ""; el.results.innerHTML = "";
    $("researchMapResultsHeading").textContent = "Locations";
    const options = group.pins.map(({ place }) => `<button type="button" class="research-map-place-row" data-place="${escapeHtml(place.id)}"><span>${escapeHtml(place.name)}<small>${escapeHtml(place.country || place.kind || "")}</small></span><b>${recordsAtPlace(place).length}</b></button>`).join("");
    el.top.innerHTML = options;
    el.top.querySelector("button")?.focus({ preventScroll: true });
    el.selection.textContent = `${group.pins.length} locations`;
    el.status.textContent = `${group.pins.length} places share this map dot. Choose one in the sidebar.`;
  }

  function placeTooltip(group) {
    el.tooltip.textContent = describePin(group); el.tooltip.hidden = false;
    const x = Math.max(6, Math.min(map.width - el.tooltip.offsetWidth - 6, group.point.x + 13));
    const y = Math.max(5, Math.min(map.height - el.tooltip.offsetHeight - 6, group.point.y + 12));
    el.tooltip.style.transform = `translate(${x}px, ${y}px)`;
  }

  function trackPointer(event) {
    const touch = event.pointerType === "touch";
    map.client = { x: event.clientX, y: event.clientY, touch };
    map.pointer = { ...localPoint(event), touch };
    schedule();
  }
  el.canvas.addEventListener("pointerenter", trackPointer);
  el.canvas.addEventListener("pointermove", trackPointer);
  el.canvas.addEventListener("pointerleave", () => {
    map.pointer = null; map.hover = null; map.client = null;
    if (map.raf) { cancelAnimationFrame(map.raf); map.raf = 0; }
    el.tooltip.hidden = true; el.canvas.style.cursor = "crosshair"; draw();
  });
  // Scrolling or a layout shift moves the canvas under a still pointer; follow it from the last client position.
  function resyncPointer() {
    if (!map.client || map.client.touch) return;
    const rect = el.canvas.getBoundingClientRect();
    const x = map.client.x - rect.left, y = map.client.y - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) { map.pointer = null; map.client = null; }
    else map.pointer = { x, y, touch: false };
    schedule();
  }
  window.addEventListener("scroll", resyncPointer, { passive: true, capture: true });
  el.canvas.addEventListener("pointerdown", (event) => { if (event.pointerType === "touch") { lastTouchAt = Date.now(); setPointer(localPoint(event), true); } });
  el.canvas.addEventListener("click", (event) => {
    const pos = localPoint(event);
    const touch = event.pointerType === "touch" || map.pointer?.touch === true || Date.now() - lastTouchAt < 900;
    let hit;
    if (touch) hit = hitTest(pos, true);
    else {
      map.pointer = { ...pos, touch: false }; map.client = { x: event.clientX, y: event.clientY, touch: false };
      if (map.raf) { cancelAnimationFrame(map.raf); map.raf = 0; }
      draw(); hit = map.hover;
      schedule();
    }
    if (hit) { choosePinGroup(hit.group); return; }
    const source = !touch && hit === null && map.pointer ? { x: map.pointer.x + (pos.x - map.pointer.x) / map.zoom, y: map.pointer.y + (pos.y - map.pointer.y) / map.zoom } : pos;
    const coords = inverse(source.x, source.y);
    el.status.textContent = `Map position ${coords.lat.toFixed(1)} degrees latitude, ${coords.lon.toFixed(1)} degrees longitude`;
  });

  function choosePlace(place) {
    if (!place) return;
    selectedCountry = ""; unmappedMode = false; selectedPlace = place;
    el.country.value = place.kind === "country" ? (place.country || place.name) : "";
    el.location.value = place.kind === "city" ? `${place.name}, ${place.country}` : place.name;
    render();
  }

  el.country.addEventListener("input", () => {
    hideDetail();
    const value = el.country.value.trim();
    selectedCountry = value;
    const countryPlace = places.find((p) => p.kind === "country" && (p.name.toLowerCase() === value.toLowerCase() || (p.country || "").toLowerCase() === value.toLowerCase()));
    selectedPlace = countryPlace || null; unmappedMode = false;
    el.location.value = "";
    if (value && !countryPlace) {
      const country = places.find((p) => (p.country || "").toLowerCase() === value.toLowerCase());
      if (country) selectedPlace = { id: `country:${value}`, name: value, country: value, kind: "country", lat: country.lat, lon: country.lon };
    }
    if (!value) { selectedPlace = null; render(); }
    else renderCountrySelection();
  });
  function renderCountrySelection() {
    if (selectedPlace) showPlaceResults(selectedPlace);
    else if (selectedCountry) { el.selection.textContent = ""; el.top.innerHTML = ""; el.organizations.innerHTML = ""; el.results.innerHTML = `<p class="research-map-empty">No matching country</p>`; }
    draw();
  }
  el.location.addEventListener("input", () => {
    hideDetail();
    const rawValue = el.location.value.trim();
    const value = rawValue.toLowerCase();
    if (!value) { selectedPlace = null; selectedCountry = ""; unmappedMode = false; el.country.value = ""; render(); return; }
    const place = places.find((p) => p.name.toLowerCase() === value || `${p.name}, ${p.country || ""}`.toLowerCase() === value || (p.kind === "country" && (p.country || p.name).toLowerCase() === value));
    if (place) choosePlace(place);
    else { selectedPlace = null; selectedCountry = ""; unmappedMode = false; el.country.value = ""; el.selection.textContent = ""; el.results.innerHTML = `<p class="research-map-empty">No matching location</p>`; el.top.innerHTML = ""; el.organizations.innerHTML = ""; draw(); }
  });
  el.type.addEventListener("change", render);
  el.contributor.addEventListener("change", render);
  el.organization.addEventListener("change", () => { hideDetail(); setOrganization(el.organization.value); render(); });
  $("researchMapAll").addEventListener("click", () => { selectedCountry = ""; setOrganization(""); selectedPlace = null; unmappedMode = false; el.country.value = ""; el.location.value = ""; render(); });
  $("researchMapUnmapped").addEventListener("click", () => { selectedPlace = null; selectedCountry = ""; unmappedMode = true; el.country.value = ""; el.location.value = ""; render(); });
  el.australia.addEventListener("click", (event) => { const button = event.target.closest("[data-place]"); if (button) choosePlace(places.find((p) => String(p.id) === button.dataset.place)); });
  el.top.addEventListener("click", (event) => { const button = event.target.closest("[data-place]"); if (button) choosePlace(places.find((p) => String(p.id) === button.dataset.place)); });
  el.organizations.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-org]")) setOrganization("");
    else { const button = event.target.closest("[data-org]"); if (!button) return; setOrganization(button.dataset.org); }
    render();
  });
  el.results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-summary]");
    if (!button || typeof papersData === "undefined" || !Array.isArray(papersData)) return;
    const paper = papersData.find((entry) => String(entry.id) === String(button.dataset.summary));
    if (paper && typeof window.openSummary === "function") window.openSummary(Number(paper.id));
  });
  // Squeeze: collapse the map and its sidebar to the heading bar, expand to restore.
  const SQUEEZE_KEY = "researchMapSqueezed";
  function setSqueezed(on, remember = true) {
    el.section.classList.toggle("squeezed", on);
    el.squeeze.setAttribute("aria-expanded", String(!on));
    el.squeeze.textContent = on ? "Expand map" : "Squeeze map";
    el.squeeze.title = on ? "Show the map" : "Collapse the map";
    if (on) { map.pointer = null; map.hover = null; map.client = null; el.tooltip.hidden = true; hideDetail(); }
    else if (data && isDesktop()) requestAnimationFrame(setSize);
    if (remember) { try { localStorage.setItem(SQUEEZE_KEY, on ? "1" : "0"); } catch (_) { /* storage unavailable */ } }
  }
  el.squeeze.addEventListener("click", () => setSqueezed(!el.section.classList.contains("squeezed")));
  try { if (localStorage.getItem(SQUEEZE_KEY) === "1") setSqueezed(true, false); } catch (_) { /* storage unavailable */ }

  $("researchMapRetry").addEventListener("click", () => { if (init()) el.status.textContent = "Research map loaded."; });

  function observeResize() {
    if (resizeObserver || !isDesktop()) return;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => { if (data && isDesktop()) setSize(); });
      resizeObserver.observe(el.wrap);
    }
  }

  detail.panel = document.createElement("div");
  detail.panel.id = "researchMapDetail";
  detail.panel.className = "research-map-detail";
  detail.panel.setAttribute("role", "region");
  detail.panel.setAttribute("aria-label", "Paper details");
  detail.panel.tabIndex = -1;
  detail.panel.hidden = true;
  document.body.append(detail.panel);

  const DETAIL_WIDTH = 360;
  const DETAIL_EDGE = 8;
  const DETAIL_GAP = 4;
  // Fixed overlay, so it takes no layout space. It sits to the right of the sidebar when there
  // is room, otherwise it slides left over the sidebar edge to stay inside the viewport.
  function positionDetail() {
    if (!detail.row || detail.panel.hidden) return;
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    const rowBox = detail.row.getBoundingClientRect();
    const anchor = (el.sidebar || el.results).getBoundingClientRect();
    const width = Math.min(DETAIL_WIDTH, vw - DETAIL_EDGE * 2);
    const maxHeight = vh - DETAIL_EDGE * 2;
    detail.panel.style.width = `${width}px`;
    detail.panel.style.maxHeight = `${maxHeight}px`;
    const height = Math.min(detail.panel.offsetHeight, maxHeight);
    const left = Math.max(DETAIL_EDGE, Math.min(anchor.right + DETAIL_GAP, vw - width - DETAIL_EDGE));
    const top = Math.max(DETAIL_EDGE, Math.min(rowBox.top, vh - height - DETAIL_EDGE));
    detail.panel.style.left = `${left}px`;
    detail.panel.style.top = `${top}px`;
  }
  function hideDetail() {
    clearTimeout(detail.timer);
    detail.row?.classList.remove("active");
    detail.panel.hidden = true;
    detail.row = null; detail.key = "";
  }
  function showDetail(row) {
    if (!row || !isDesktop()) return;
    clearTimeout(detail.timer);
    const entry = rowData.get(row.dataset.record);
    if (!entry) return;
    detail.row?.classList.remove("active");
    detail.row = row; detail.key = row.dataset.record;
    row.classList.add("active");
    detail.panel.innerHTML = '<div class="research-map-detail-body">' + renderRecord(entry.record, entry.locations, entry.selected) + '<button type="button" class="research-map-detail-close">Close</button></div>';
    detail.panel.hidden = false;
    detail.panel.firstElementChild.scrollTop = 0;
    positionDetail();
  }
  function scheduleHide() {
    clearTimeout(detail.timer);
    detail.timer = setTimeout(() => {
      if (!detail.panel.matches(":hover") && !detail.row?.matches(":hover") &&
          !detail.panel.contains(document.activeElement) && document.activeElement !== detail.row) hideDetail();
    }, 250);
  }
  // Scrolling the list moves the row: follow it while it stays visible, close once it leaves the list.
  let repositionFrame = 0;
  window.addEventListener("scroll", (event) => {
    if (detail.panel.hidden || detail.panel.contains(event.target)) return;
    cancelAnimationFrame(repositionFrame);
    repositionFrame = requestAnimationFrame(() => {
      if (!detail.row || !detail.row.isConnected) { hideDetail(); return; }
      const rowBox = detail.row.getBoundingClientRect(), listBox = el.results.getBoundingClientRect();
      if (rowBox.bottom < listBox.top || rowBox.top > listBox.bottom) hideDetail();
      else positionDetail();
    });
  }, true);
  window.addEventListener("resize", hideDetail);
  el.results.addEventListener("pointerover", (event) => showDetail(event.target.closest("[data-record]")));
  el.results.addEventListener("pointerout", scheduleHide);
  el.results.addEventListener("focusin", (event) => showDetail(event.target.closest("[data-record]")));
  el.results.addEventListener("focusout", scheduleHide);
  el.results.addEventListener("click", (event) => {
    const row = event.target.closest("[data-record]");
    if (!row) return;
    showDetail(row);
    const link = detail.panel.querySelector("a.research-map-link");
    if (link) window.open(link.href, "_blank", "noopener");
    else detail.panel.focus();
  });
  el.results.addEventListener("keydown", (event) => {
    const row = event.target.closest("[data-record]");
    if (!row) return;
    const rows = [...el.results.querySelectorAll("[data-record]")];
    const index = rows.indexOf(row);
    let target;
    if (event.key === "ArrowDown") target = rows[Math.min(rows.length - 1, index + 1)];
    if (event.key === "ArrowUp") target = rows[Math.max(0, index - 1)];
    if (event.key === "Home") target = rows[0];
    if (event.key === "End") target = rows[rows.length - 1];
    if (target) { event.preventDefault(); target.focus(); target.scrollIntoView({ block: "nearest" }); }
    if (event.key === "ArrowRight") { event.preventDefault(); showDetail(row); (detail.panel.querySelector("a,button") || detail.panel).focus(); }
    if (event.key === "Escape") hideDetail();
  });
  detail.panel.addEventListener("pointerenter", () => clearTimeout(detail.timer));
  detail.panel.addEventListener("pointerleave", scheduleHide);
  detail.panel.addEventListener("focusout", scheduleHide);
  detail.panel.addEventListener("click", (event) => {
    if (event.target.closest(".research-map-detail-close")) { const row = detail.row; row?.focus(); hideDetail(); }
    const button = event.target.closest("[data-summary]");
    const paper = button && typeof papersData !== "undefined" ? papersData.find((p) => String(p.id) === button.dataset.summary) : null;
    if (paper && typeof window.openSummary === "function") window.openSummary(Number(paper.id));
  });
  detail.panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape" || event.key === "ArrowLeft") { event.preventDefault(); const row = detail.row; row?.focus(); hideDetail(); }
  });
  function desktopChanged() {
    if (isDesktop()) { if (init()) { observeResize(); setSize(); } }
    else { hideDetail(); map.pointer = null; map.hover = null; el.tooltip.hidden = true; resizeObserver?.disconnect(); resizeObserver = null; }
  }
  desktopQuery.addEventListener("change", desktopChanged);
  window.addEventListener("resize", () => { if (data && isDesktop() && !resizeObserver) setSize(); });
  init();

  window.ResearchMap = {
    selectPlace(id) { const place = places.find((p) => String(p.id) === String(id)); if (place) choosePlace(place); },
    showAll() { $("researchMapAll").click(); },
    showUnmapped() { $("researchMapUnmapped").click(); },
    getState() {
      const bounds = map.pointer && !map.pointer.touch ? lensBounds() : null;
      return {
        places: places.length, records: records.length, selectedPlace: selectedPlace?.id || null, unmapped: unmappedMode,
        selectedOrganization, organizations: orgIndex.size, filteredRecordKeys: filteredRecords().map(recordKey).sort(),
        markerCount: map.pins.length, baseLandDotCount: map.landDots.length, lensLandDotCount: map.lensDots?.length || 0,
        baseGrid: { startX: 4, startY: 4, step: 6.1 },
        lensGrid: bounds ? { startX: Math.floor(bounds.left / 5.2) * 5.2, startY: Math.floor(bounds.top / 5.2) * 5.2, step: 5.2, bounds, sourcePointer: { x: map.pointer.x, y: map.pointer.y }, zoom: map.zoom } : null,
        markerRadius: DOT_RADIUS, lensMarkerRadius: DOT_RADIUS,
      };
    },
    getMarkers() {
      return map.pins.map((pin, index) => {
        const lensPin = map.pointer && !map.pointer.touch ? map.lensPins?.find((entry) => entry.place.id === pin.place.id) : null;
        return { id: pin.place.id, name: pin.place.name, kind: pin.place.kind || "place", original: { lat: Number(pin.place.lat), lon: Number(pin.place.lon) }, base: { x: pin.point.x, y: pin.point.y, radius: DOT_RADIUS, onLandDot: map.landDots.some((dot) => dot.x === pin.point.x && dot.y === pin.point.y) }, lens: lensPin ? { x: lensPin.point.x, y: lensPin.point.y, radius: DOT_RADIUS, onLandDot: (map.lensDots || []).some((dot) => dot.x === lensPin.point.x && dot.y === lensPin.point.y) } : null, typeCounts: { ...pin.typeCounts }, recordCount: pin.count };
      });
    },
  };
})();
