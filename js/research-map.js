(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    canvas: $("researchMapCanvas"), wrap: $("researchMapCanvasWrap"), layout: $("researchMapLayout"),
    error: $("researchMapError"), errorText: $("researchMapErrorText"), coverage: $("researchMapCoverage"),
    tooltip: $("researchMapTooltip"), results: $("researchMapResults"), top: $("researchMapTopPlaces"),
    selection: $("researchMapSelection"), status: $("researchMapStatus"), organizations: $("researchMapOrganizations"),
    type: $("researchMapType"), contributor: $("researchMapContributor"), organization: $("researchMapOrganization"),
    australia: $("researchMapAustralia"), browse: $("researchMapBrowse"), section: $("researchMapSection"), squeeze: $("researchMapSqueeze"), print: $("researchMapPrint"),
  };
  if (!el.canvas || !el.wrap) return;

  el.sidebar = document.querySelector(".research-map-sidebar");
  const ctx = el.canvas.getContext("2d", { alpha: false });
  const map = { width: 0, height: 0, dpr: 1, mask: null, landDots: [], pins: [], pointer: null, hover: null, raf: 0, lens: 150, zoom: 4, mapTop: 0, mapHeight: 0, base: null, client: null };
  // Research markers have a larger core; the land grid keeps its original radius.
  const DOT_RADIUS = 1.65;
  const MARKER_RADIUS = 2.4;
  const HIT_RADIUS = { base: 14, lens: 28, touch: 20 };
  const GLOW_RADIUS = { base: 8.5, lens: 9.8 };
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
  let selectedOrganization = "";
  let unmappedMode = false;
  let lastTouchAt = 0;
  let resizeObserver;
  const lensSnapCache = new Map();
  const latMin = -58;
  const latMax = 84;
  const MAP_RATIO = (latMax - latMin) / 360;
  const MAP_MARGIN_X = 18, MAP_MARGIN_Y = 12;

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
    el.print.disabled = true;
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
    el.print.disabled = false;
    return true;
  }

  function buildFilters() {
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
    const sorted = [...orgIndex].sort((a, b) => b[1].keys.size - a[1].keys.size || a[1].label.localeCompare(b[1].label, undefined, { sensitivity: "base", numeric: true }) || (a[0] < b[0] ? -1 : 1));
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
    el.browse.hidden = !shortcuts.cities.length && !shortcuts.countries.length;
  }

  function renderShortcuts() {
    if (!shortcuts) return;
    const button = (place) => {
      const active = selectedPlace && String(selectedPlace.id) === String(place.id) && !unmappedMode;
      return `<button type="button" data-place="${escapeHtml(place.id)}"${active ? ' class="active" aria-pressed="true"' : ' aria-pressed="false"'}>${escapeHtml(place.name)}<b>${recordsAtPlace(place).length}</b></button>`;
    };
    const group = (label, list) => list.length ? `<div class="research-map-quick-group"><span class="research-map-quick-label">${label}</span><div class="research-map-quick-items">${list.map(button).join("")}</div></div>` : "";
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

  // Height follows width only, so observing the wrap cannot trigger a resize loop.
  function needsResize() {
    const width = el.canvas.getBoundingClientRect().width;
    return width > 0 && (!map.mask || Math.abs(width - map.width) >= 0.5 || Math.min(window.devicePixelRatio || 1, 2) !== map.dpr);
  }

  function setSize() {
    const rect = el.canvas.getBoundingClientRect();
    if (!rect.width) return;
    map.width = rect.width;
    map.height = Math.round((map.width - MAP_MARGIN_X * 2) * MAP_RATIO + MAP_MARGIN_Y * 2);
    map.mapHeight = (map.width - MAP_MARGIN_X * 2) * MAP_RATIO;
    map.mapTop = (map.height - map.mapHeight) / 2;
    map.dpr = Math.min(window.devicePixelRatio || 1, 2);
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
      if (needsResize()) setSize();
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
    else showOverview();
    renderShortcuts();
    map.base = null;
    draw();
  }

  // Print from the filtered, unsnapped places, independently of the screen canvas.
  function printMap() {
    if (!data || el.print.disabled) return;
    const sheet = document.createElement("div");
    sheet.id = "researchMapPrintSheet";
    const date = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const pins = [...map.pins].sort((a, b) => b.count - a.count || a.place.name.localeCompare(b.place.name));
    const filters = [el.type, el.contributor, el.organization].map((select) => select.options[select.selectedIndex]?.textContent || "").join(" · ");
    const australia = pins.filter((pin) => placeCountry(pin.place) === "Australia" && Number(pin.place.lon) >= 110 && Number(pin.place.lon) <= 157 && Number(pin.place.lat) >= -45 && Number(pin.place.lat) <= -9);
    const chunkSize = Math.max(1, Math.ceil(pins.length / 3));
    const columns = [];
    for (let i = 0; i < pins.length; i += chunkSize) {
      const rows = pins.slice(i, i + chunkSize).map((pin) => `<div class="research-map-print-row"><div class="research-map-print-place"><span class="research-map-print-name">${escapeHtml(pin.place.name)}</span>${placeCountry(pin.place) && placeCountry(pin.place) !== pin.place.name ? ` <span class="research-map-print-country">${escapeHtml(placeCountry(pin.place))}</span>` : ""}</div><div>${pin.typeCounts.academic || 0}</div><div>${pin.typeCounts.grey || 0}</div><div>${pin.count}</div></div>`).join("");
      columns.push(`<div class="research-map-print-column"><div class="research-map-print-row research-map-print-column-head"><div>Place / country</div><div>Papers</div><div>Reports</div><div>Total</div></div>${rows}</div>`);
    }
    const sizeKey = [1, 5, 20].map((count) => `<span><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><circle cx="12" cy="12" r="${printRadius(count)}" fill="#64748b" stroke="#fff" stroke-width="0.8"/></svg>${count} ${count === 1 ? "record" : "records"}</span>`).join("");
    sheet.innerHTML = `<div class="research-map-print-header"><div class="research-map-print-title" role="heading" aria-level="1">Research locations</div><div class="research-map-print-note">${escapeHtml(filters)}</div><div class="research-map-print-note">${escapeHtml(el.coverage.textContent)}</div><div class="research-map-print-date">Printed ${escapeHtml(date)}</div></div>
      <div class="research-map-print-map-block" role="region" aria-label="Maps and legend"><div class="research-map-print-world">${printWorld(pins)}${australia.length ? printAustralia(australia) : ""}</div>
      <div class="research-map-print-legend"><span><i class="academic"></i>${escapeHtml(typeLabel("academic"))}</span><span><i class="grey"></i>${escapeHtml(typeLabel("grey"))}</span><span><i class="both"></i>Both types</span>${sizeKey}</div></div>
      <div class="research-map-print-footer">${escapeHtml(document.title)} · Land outlines: Natural Earth 1:110m (public domain) · Printed ${escapeHtml(date)}</div>
      <div class="research-map-print-places"><div class="research-map-print-subtitle" role="heading" aria-level="2">Mapped places</div><div class="research-map-print-note">Sorted by total records, highest first. A record may appear in more than one place.</div><div class="research-map-print-columns">${columns.join("") || "<div>No places match the current filters.</div>"}</div></div>`;
    // Replace previous content on another click; afterprint owns cleanup of the active sheet.
    const previous = $("researchMapPrintSheet");
    if (previous) previous.replaceWith(sheet);
    else document.body.append(sheet);
    document.body.classList.add("research-map-printing");
    window.print();
  }

  const printNumber = (number) => Number(number).toFixed(1);
  const printRadius = (count) => Math.min(8.5, 2.4 + 1.1 * Math.sqrt(count));
  function printMarker(pin, project) {
    const [x, y] = project([Number(pin.place.lon), Number(pin.place.lat)]);
    const r = printNumber(printRadius(pin.count));
    const academic = pin.typeCounts.academic || 0, grey = pin.typeCounts.grey || 0;
    const discs = academic && grey
      ? `<path d="M0,-${r}A${r},${r} 0 0 0 0,${r}Z" fill="#0369a1"/><path d="M0,-${r}A${r},${r} 0 0 1 0,${r}Z" fill="#d97706"/>`
      : `<circle r="${r}" fill="${academic ? "#0369a1" : "#d97706"}"/>`;
    return `<g data-place-id="${escapeHtml(pin.place.id)}" transform="translate(${printNumber(x)} ${printNumber(y)})" stroke="#fff" stroke-width="0.8"><title>${escapeHtml(pin.place.name)}: ${academic} papers, ${grey} reports; ${pin.count} total records</title>${discs}</g>`;
  }

  // Clip geographic rings before projection, retaining holes with evenodd filling.
  function printLand(project, bounds) {
    const clip = (ring, axis, edge, above) => {
      const output = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[(i + ring.length - 1) % ring.length], b = ring[i];
        const insideA = above ? a[axis] >= edge : a[axis] <= edge;
        const insideB = above ? b[axis] >= edge : b[axis] <= edge;
        if (insideA !== insideB) {
          const t = (edge - a[axis]) / (b[axis] - a[axis]);
          output.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
        }
        if (insideB) output.push(b);
      }
      return output;
    };
    const paths = [];
    for (const feature of window.RESEARCH_WORLD_LAND.features) {
      const geometry = feature.geometry;
      const polygons = geometry?.type === "Polygon" ? [geometry.coordinates] : geometry?.type === "MultiPolygon" ? geometry.coordinates : [];
      for (const polygon of polygons) for (let ring of polygon) {
        for (const [axis, edge, above] of [[0, bounds.west, true], [0, bounds.east, false], [1, bounds.south, true], [1, bounds.north, false]]) ring = clip(ring, axis, edge, above);
        if (ring.length >= 3) paths.push(printLine(ring, project) + "Z");
      }
    }
    return `<path class="research-map-print-land" fill="#e6eaef" stroke="#a9b4c2" stroke-width="0.4pt" fill-rule="evenodd" d="${paths.join("")}"/>`;
  }

  function printLine(coords, project) {
    return coords.map((coord, index) => { const [x, y] = project(coord); return `${index ? "L" : "M"}${printNumber(x)},${printNumber(y)}`; }).join("");
  }
  function printRange(start, end, step) {
    const values = [];
    for (let value = start; step > 0 ? value < end : value > end; value += step) values.push(value);
    values.push(end);
    return values;
  }
  function equalEarth([lon, lat]) {
    const lambda = lon * Math.PI / 180, phi = lat * Math.PI / 180;
    const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
    const theta = Math.asin(Math.sqrt(3) / 2 * Math.sin(phi));
    return [2 * Math.sqrt(3) * lambda * Math.cos(theta) / (3 * (9 * A4 * theta ** 8 + 7 * A3 * theta ** 6 + 3 * A2 * theta ** 2 + A1)), -(A4 * theta ** 9 + A3 * theta ** 7 + A2 * theta ** 3 + A1 * theta)];
  }
  function printWorld(pins) {
    const west = -180, east = 180, south = latMin, north = latMax;
    const scale = 992 / (equalEarth([180, 0])[0] * 2);
    const top = equalEarth([0, north])[1], bottom = equalEarth([0, south])[1];
    const height = (bottom - top) * scale + 8;
    const project = (coord) => { const [x, y] = equalEarth(coord); return [500 + x * scale, 4 + (y - top) * scale]; };
    const boundary = [...printRange(west, east, 2).map((lon) => [lon, north]), ...printRange(north, south, -2).map((lat) => [east, lat]), ...printRange(east, west, -2).map((lon) => [lon, south]), ...printRange(south, north, 2).map((lat) => [west, lat])];
    const frame = printLine(boundary, project) + "Z";
    const grid = [];
    for (let lon = -150; lon <= 150; lon += 30) grid.push(printLine(printRange(south, north, 2).map((lat) => [lon, lat]), project));
    for (let lat = -30; lat <= 60; lat += 30) grid.push(printLine(printRange(west, east, 2).map((lon) => [lon, lat]), project));
    return `<svg id="researchMapPrintWorld" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 ${printNumber(height)}" role="img" aria-label="World research locations"><defs><clipPath id="researchMapPrintWorldClip"><path d="${frame}"/></clipPath></defs><path d="${frame}" fill="#f3f7fb" stroke="#a9b4c2" stroke-width="0.4pt"/><g clip-path="url(#researchMapPrintWorldClip)"><path d="${grid.join("")}" fill="none" stroke="#dfe6ee" stroke-width="0.4pt"/>${printLand(project, { west, east, south, north })}${pins.map((pin) => printMarker(pin, project)).join("")}</g></svg>`;
  }

  function printAustralia(pins) {
    const west = 110, east = 157, south = -45, north = -9;
    const scale = 280 / ((east - west) * Math.cos(27 * Math.PI / 180));
    const project = ([lon, lat]) => [10 + (lon - west) * Math.cos(27 * Math.PI / 180) * scale, 30 + (north - lat) * scale];
    const height = (north - south) * scale;
    const measure = document.createElement("canvas").getContext("2d");
    measure.font = "9.5px Inter, sans-serif";
    // Reserve the caption and label boxes; crowded cities keep their marker without a label.
    const boxes = [{ x: 8, y: 4, width: 68, height: 19 }];
    const labels = [];
    for (const pin of pins.filter((pin) => pin.place.kind === "city")) {
      const [x, y] = project([Number(pin.place.lon), Number(pin.place.lat)]);
      const width = measure.measureText(pin.place.name).width + 4, labelHeight = 15;
      const gap = printRadius(pin.count) + 3;
      const candidates = [[x + gap, y - labelHeight / 2], [x - gap - width, y - labelHeight / 2], [x - width / 2, y - gap - labelHeight], [x - width / 2, y + gap]];
      const candidate = candidates.find(([left, top]) => left >= 4 && left + width <= 296 && top >= 4 && top + labelHeight <= 276 && !boxes.some((box) => left < box.x + box.width && left + width > box.x && top < box.y + box.height && top + labelHeight > box.y));
      if (!candidate) continue;
      const [left, top] = candidate;
      boxes.push({ x: left, y: top, width, height: labelHeight });
      labels.push(`<text class="research-map-print-city" x="${printNumber(left + 2)}" y="${printNumber(top + 10.5)}">${escapeHtml(pin.place.name)}</text>`);
    }
    const grid = [];
    for (const lon of [120, 150]) grid.push(printLine([[lon, south], [lon, north]], project));
    grid.push(printLine([[west, -30], [east, -30]], project));
    return `<svg id="researchMapPrintAustralia" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 280" role="img" aria-label="Australian research locations"><defs><clipPath id="researchMapPrintAustraliaClip"><rect x="10" y="30" width="280" height="${printNumber(height)}"/></clipPath></defs><g clip-path="url(#researchMapPrintAustraliaClip)">${printLand(project, { west, east, south, north })}<path d="${grid.join("")}" fill="none" stroke="#dfe6ee" stroke-width="0.4pt"/>${pins.map((pin) => printMarker(pin, project)).join("")}</g><text class="research-map-print-inset-title" x="10" y="18">Australia</text>${labels.join("")}</svg>`;
  }

  el.print.addEventListener("click", printMap);
  window.addEventListener("afterprint", () => {
    $("researchMapPrintSheet")?.remove();
    document.body.classList.remove("research-map-printing");
  });

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
      return `<li><button type="button" class="research-map-title-row ${escapeHtml(record.type)}" data-record="${escapeHtml(key)}" tabindex="0" aria-controls="researchMapDetail" title="${escapeHtml(record.title || `Record ${record.id}`)}"><span class="research-map-title-text">${escapeHtml(record.title || `Record ${record.id}`)}</span><span class="research-map-title-meta">${titleMeta(record)}</span></button></li>`;
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
    return `<article class="research-map-record"><div class="research-map-record-top"><span class="research-map-type ${escapeHtml(record.type)}">${escapeHtml(typeLabel(record.type))}</span>${assignedTo ? `<span class="research-map-assignee" title="${escapeHtml(assignedTo)}">${escapeHtml(assignedTo)}</span>` : ""}</div><h4>${escapeHtml(record.title || `Record ${record.id}`)}</h4>${authors}${organization}${relation}${unmapped}<div class="research-map-record-links">${links.join("")}</div></article>`;
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
        const halo = g.createRadialGradient(x, y, MARKER_RADIUS * 0.5, x, y, glow);
        halo.addColorStop(0, `rgba(${r}, ${gr}, ${b}, .7)`);
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
        wedge(x, y, index, types.length, MARKER_RADIUS);
        g.fillStyle = `rgb(${r}, ${gr}, ${b})`; g.fill();
      });
      if (lens) for (const pin of group.pins) if (/^(Adelaide|Melbourne|Sydney)$/.test(pin.place.name)) {
        g.font = `600 ${getComputedStyle(el.coverage).fontSize} Inter, sans-serif`; g.textBaseline = "middle";
        const labelWidth = g.measureText(pin.place.name).width;
        const labelX = Math.max(bounds.left + 5, Math.min(bounds.right - labelWidth - 5, x + GLOW_RADIUS.lens + 3));
        const labelY = Math.max(bounds.top + 10, Math.min(bounds.bottom - 10, y - GLOW_RADIUS.lens - 2));
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
    selectedPlace = null; unmappedMode = false;
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
    unmappedMode = false; selectedPlace = place;
    render();
  }

  el.type.addEventListener("change", render);
  el.contributor.addEventListener("change", render);
  el.organization.addEventListener("change", () => { hideDetail(); setOrganization(el.organization.value); render(); });
  $("researchMapAll").addEventListener("click", () => { setOrganization(""); selectedPlace = null; unmappedMode = false; render(); });
  $("researchMapUnmapped").addEventListener("click", () => { selectedPlace = null; unmappedMode = true; render(); });
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

  detail.panel = document.createElement("div");
  detail.panel.id = "researchMapDetail";
  detail.panel.className = "research-map-detail";
  detail.panel.setAttribute("role", "region");
  detail.panel.setAttribute("aria-label", "Paper details");
  detail.panel.tabIndex = -1;
  detail.panel.hidden = true;
  document.body.append(detail.panel);

  // In em so the panel grows with the fluid type scale and the header row keeps fitting.
  const DETAIL_WIDTH_EM = 26;
  const DETAIL_EDGE = 8;
  const DETAIL_GAP = 4;
  // Fixed overlay, so it takes no layout space. It sits to the right of the sidebar when there
  // is room, otherwise it opens to the left over the map, leaving the list clear.
  function positionDetail() {
    if (!detail.row || detail.panel.hidden) return;
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    const rowBox = detail.row.getBoundingClientRect();
    const anchor = (el.sidebar || el.results).getBoundingClientRect();
    const width = Math.min(Math.round(DETAIL_WIDTH_EM * parseFloat(getComputedStyle(detail.panel).fontSize)), vw - DETAIL_EDGE * 2);
    const maxHeight = vh - DETAIL_EDGE * 2;
    detail.panel.style.width = `${width}px`;
    detail.panel.style.maxHeight = `${maxHeight}px`;
    const height = Math.min(detail.panel.offsetHeight, maxHeight);
    const opensRight = anchor.right + DETAIL_GAP + width <= vw - DETAIL_EDGE;
    const preferredLeft = opensRight ? anchor.right + DETAIL_GAP : anchor.left - DETAIL_GAP - width;
    const left = Math.max(DETAIL_EDGE, Math.min(preferredLeft, vw - width - DETAIL_EDGE));
    detail.panel.classList.toggle("opens-left", !opensRight);
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
    detail.panel.innerHTML = '<div class="research-map-detail-body">' + renderRecord(entry.record, entry.locations, entry.selected) + '</div>';
    detail.panel.querySelector(".research-map-record-top").insertAdjacentHTML("beforeend", '<button type="button" class="research-map-detail-close" aria-label="Close" title="Close">×</button>');
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
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { if (data && isDesktop() && needsResize()) setSize(); });
  });
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
        markerRadius: MARKER_RADIUS, lensMarkerRadius: MARKER_RADIUS,
      };
    },
    getMarkers() {
      return map.pins.map((pin, index) => {
        const lensPin = map.pointer && !map.pointer.touch ? map.lensPins?.find((entry) => entry.place.id === pin.place.id) : null;
        return { id: pin.place.id, name: pin.place.name, kind: pin.place.kind || "place", original: { lat: Number(pin.place.lat), lon: Number(pin.place.lon) }, base: { x: pin.point.x, y: pin.point.y, radius: MARKER_RADIUS, onLandDot: map.landDots.some((dot) => dot.x === pin.point.x && dot.y === pin.point.y) }, lens: lensPin ? { x: lensPin.point.x, y: lensPin.point.y, radius: MARKER_RADIUS, onLandDot: (map.lensDots || []).some((dot) => dot.x === lensPin.point.x && dot.y === lensPin.point.y) } : null, typeCounts: { ...pin.typeCounts }, recordCount: pin.count };
      });
    },
  };
})();
