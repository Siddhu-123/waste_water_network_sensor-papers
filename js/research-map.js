(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = {
    canvas: $("researchMapCanvas"), wrap: $("researchMapCanvasWrap"), layout: $("researchMapLayout"),
    error: $("researchMapError"), errorText: $("researchMapErrorText"), coverage: $("researchMapCoverage"),
    tooltip: $("researchMapTooltip"), results: $("researchMapResults"), top: $("researchMapTopPlaces"),
    selection: $("researchMapSelection"), status: $("researchMapStatus"), organizations: $("researchMapOrganizations"), country: $("researchMapCountry"),
    location: $("researchMapLocation"), type: $("researchMapType"), contributor: $("researchMapContributor"),
    australia: $("researchMapAustralia"),
  };
  if (!el.canvas || !el.wrap) return;

  const ctx = el.canvas.getContext("2d", { alpha: false });
  const map = { width: 0, height: 0, dpr: 1, mask: null, landDots: [], pins: [], pointer: null, raf: 0, lens: 150, zoom: 4, mapTop: 0, mapHeight: 0 };
  let data = null;
  let places = [];
  let records = [];
  let selectedPlace = null;
  let selectedCountry = "";
  let selectedOrganization = "";
  let unmappedMode = false;
  let lastTouchAt = 0;
  let resizeObserver;
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
  const typeLabel = (type) => ({ academic: "Academic / peer-reviewed", grey: "Grey literature", compiled: "Compiled reviews" }[type] || type);
  const contributorsFor = (record) => {
    const assigned = Array.isArray(record.assignedTo) ? record.assignedTo : [record.assignedTo];
    return [...new Set(assigned.flatMap((name) => String(name || "").split(",")).map((name) => name.trim()).filter(Boolean))];
  };
  const organizationName = (record) => String(record.organization || "").trim();
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
    records = incoming.records.filter((record) => record && record.id != null).map((record) => ({
      ...record,
      type: ["academic", "grey", "compiled"].includes(record.type) ? record.type : "academic",
      locations: Array.isArray(record.locations) ? record.locations : [],
    }));
    if (!places.length || !records.length) {
      showError("Research map data loaded without usable places or records. Check the geography data file and retry.");
      return false;
    }
    el.error.hidden = true;
    el.layout.hidden = false;
    buildFilters();
    buildAustraliaShortcuts();
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
  }

  function buildAustraliaShortcuts() {
    const cities = ["Adelaide", "Melbourne", "Sydney"].map((name) => places.find((p) => p.name.toLowerCase() === name.toLowerCase() && (p.country || "").toLowerCase().includes("australia"))).filter(Boolean);
    el.australia.innerHTML = cities.map((place) => `<button type="button" data-place="${escapeHtml(place.id)}">${escapeHtml(place.name)}</button>`).join("");
    el.australia.hidden = !cities.length;
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
    draw();
  }

  function filteredRecords(ignoreOrganization = false) {
    const type = el.type.value;
    const contributor = el.contributor.value;
    return records.filter((record) => (type === "all" || record.type === type) &&
      (contributor === "all" || contributorsFor(record).includes(contributor)) &&
      (ignoreOrganization || !selectedOrganization || organizationName(record) === selectedOrganization));
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
    const counts = pinCounts();
    const pins = places.filter((place) => (counts.get(String(place.id)) || new Set()).size > 0).map((place) => {
      const keys = counts.get(String(place.id));
      const typeCounts = Object.fromEntries(["academic", "grey", "compiled"].map((type) => [type, new Set(filteredRecords().filter((record) => record.type === type && locationsFor(record).some((loc) => String(loc.placeId) === String(place.id))).map(recordKey)).size]));
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
    draw();
  }

  function groupPins(pins) {
    const groups = new Map();
    const recordTypes = new Map(records.map((record) => [recordKey(record), record.type]));
    for (const pin of pins) {
      const key = `${pin.point.x.toFixed(3)},${pin.point.y.toFixed(3)}`;
      if (!groups.has(key)) groups.set(key, { point: pin.point, pins: [], typeRecords: { academic: new Set(), grey: new Set(), compiled: new Set() }, records: new Set(), typeCounts: { academic: 0, grey: 0, compiled: 0 }, count: 0 });
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

  function showOverview() {
    selectedPlace = null;
    $("researchMapResultsHeading").textContent = "Places in the library";
    el.selection.textContent = "Choose a place to explore its related records.";
    el.organizations.innerHTML = "";
    const ranking = places.map((place) => ({ place, count: recordsAtPlace(place).length })).filter((x) => x.count).sort((a, b) => b.count - a.count || a.place.name.localeCompare(b.place.name)).slice(0, 6);
    el.top.innerHTML = ranking.length ? `<div class="research-map-subhead">Top locations</div>${ranking.map(({ place, count }) => `<button type="button" class="research-map-place-row" data-place="${escapeHtml(place.id)}"><span>${escapeHtml(place.name)}<small>${escapeHtml(place.country || (place.kind === "country" ? "Country" : ""))}</small></span><b>${count}</b></button>`).join("")}` : `<p class="research-map-empty">No mapped records match these filters.</p>`;
    el.results.innerHTML = `<div class="research-map-welcome"><span class="research-map-globe">◎</span><h4>Follow the evidence</h4><p>Select a pin or use the location search to see papers connected with a place. Choose <b>Unmapped</b> to review records without a location.</p></div>`;
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
    el.results.innerHTML = linked.length ? linked.map(({ record, locations }) => renderRecord(record, locations, place)).join("") : `<p class="research-map-empty">No records match ${escapeHtml(place.name)} and the current filters.</p>`;
    el.status.textContent = `${place.name}: ${linked.length} related records`;
    el.canvas.setAttribute("aria-label", `Interactive world map. ${place.name} selected, ${linked.length} related records. Select another location marker.`);
  }

  function renderOrganizations(place) {
    const counts = new Map();
    for (const { record } of recordsAtPlace(place, true)) {
      const name = organizationName(record);
      if (name) counts.set(name, (counts.get(name) || 0) + 1);
    }
    const entries = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    el.organizations.innerHTML = entries.length ? `<div class="research-map-subhead">Organizations</div>${entries.map(([name, count]) => `<button type="button" class="research-map-place-row research-map-org-row${selectedOrganization === name ? " active" : ""}" data-org="${escapeHtml(name)}"><span>${escapeHtml(name)}</span><b>${count}</b></button>`).join("")}${selectedOrganization ? `<button type="button" class="research-map-clear-org" data-clear-org>Clear organization filter</button>` : ""}` : "";
  }

  function showUnmappedResults() {
    $("researchMapResultsHeading").textContent = "Unmapped & global";
    const unmapped = filteredRecords().filter((record) => locationsFor(record).length === 0);
    selectedPlace = null;
    el.selection.textContent = `${unmapped.length} records without a mapped location`;
    el.top.innerHTML = "";
    el.organizations.innerHTML = "";
    el.results.innerHTML = unmapped.length ? unmapped.map((record) => renderRecord(record, [], null)).join("") : `<p class="research-map-empty">Every record matching these filters has a mapped location.</p>`;
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
    const compiled = record.type === "compiled" && typeof compiledPapersData !== "undefined" && Array.isArray(compiledPapersData)
      ? compiledPapersData.find((paper) => String(paper.id) === String(record.id)) : null;
    const viewerUrl = (paper, fallback) => {
      if (paper && typeof getPdfViewerUrl === "function") return safeUrl(getPdfViewerUrl(paper));
      const viewer = new URL("./pdf-viewer.html", window.location.href);
      viewer.searchParams.set("paper", String(fallback.id));
      viewer.searchParams.set("pdf", fallback.pdfUrl || fallback.url || "");
      if (fallback.title) viewer.searchParams.set("title", fallback.title);
      const assigned = contributorsFor(fallback).join(", ");
      if (assigned) viewer.searchParams.set("user", assigned);
      return safeUrl(viewer.href);
    };
    if (record.type === "academic") {
      const href = viewerUrl(academic, { ...record, pdfUrl: record.pdfUrl || record.url });
      const sourcePdf = safeUrl(academic?.pdfUrl || record.pdfUrl || record.url);
      if (href && sourcePdf) links.push(`<a class="research-map-link primary" href="${escapeHtml(href)}" target="_blank" rel="noopener">PDF + Notes</a>`);
    } else if (record.type === "compiled") {
      const localPdf = linkedPdf;
      const href = compiled ? viewerUrl(compiled, record) : localPdf;
      if (href && localPdf) links.push(`<a class="research-map-link primary" href="${escapeHtml(href)}" target="_blank" rel="noopener">Open PDF</a>`);
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

  function draw() {
    if (!ctx || !map.width || !map.mask) return;
    ctx.setTransform(map.dpr, 0, 0, map.dpr, 0, 0);
    ctx.fillStyle = "#080d17";
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.fillStyle = "rgba(210, 220, 233, 0.68)";
    for (const dot of map.landDots) { ctx.beginPath(); ctx.arc(dot.x, dot.y, 1.05, 0, Math.PI * 2); ctx.fill(); }
    ctx.strokeStyle = "rgba(110, 134, 163, 0.14)";
    ctx.lineWidth = 1;
    for (let lat = -30; lat <= 60; lat += 30) {
      const y = point(lat, 0).y;
      ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(map.width - 18, y); ctx.stroke();
    }
    drawPins(false);
    if (map.pointer && !map.pointer.touch) drawLens();
  }

  function drawPins(lens) {
    const bounds = lens ? lensBounds() : null;
    const groups = lens ? map.lensGroups || [] : map.pinGroups || [];
    for (const group of groups) {
      const { x, y } = group.point;
      if (lens && (x < bounds.left - 4 || x > bounds.right + 4 || y < bounds.top - 4 || y > bounds.bottom + 4)) continue;
      const types = ["academic", "grey", "compiled"].filter((type) => group.typeCounts[type] > 0);
      const colors = { academic: "#38bdf8", grey: "#f59e0b", compiled: "#a78bfa" };
      const radius = lens ? 1.08 : 1.05;
      types.forEach((type, index) => {
        const start = -Math.PI / 2 + index * Math.PI * 2 / types.length;
        const end = -Math.PI / 2 + (index + 1) * Math.PI * 2 / types.length;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, radius, start, end); ctx.closePath();
        ctx.fillStyle = colors[type]; ctx.fill();
      });
      if (lens) for (const pin of group.pins) if (/^(Adelaide|Melbourne|Sydney)$/.test(pin.place.name)) {
        ctx.font = "600 11px Inter, sans-serif"; ctx.textBaseline = "middle";
        const labelWidth = ctx.measureText(pin.place.name).width;
        const labelX = Math.max(bounds.left + 5, Math.min(bounds.right - labelWidth - 5, x + 8));
        const labelY = Math.max(bounds.top + 10, Math.min(bounds.bottom - 10, y - 7));
        ctx.lineWidth = 3; ctx.strokeStyle = "#07101a"; ctx.strokeText(pin.place.name, labelX, labelY);
        ctx.fillStyle = "#f2fcff"; ctx.fillText(pin.place.name, labelX, labelY);
      }
    }
  }

  function drawLens() {
    const { x, y } = map.pointer;
    const half = map.lens / 2;
    const left = Math.max(1, Math.min(map.width - map.lens - 1, x - half));
    const top = Math.max(1, Math.min(map.height - map.lens - 1, y - half));
    const cx = left + half, cy = top + half;
    ctx.save();
    ctx.beginPath(); ctx.rect(left, top, map.lens, map.lens); ctx.clip();
    ctx.fillStyle = "#080d17"; ctx.fillRect(left, top, map.lens, map.lens);
    ctx.fillStyle = "rgba(189, 208, 226, 0.58)";
    const step = 5.2;
    const sourceFromLens = (p) => ({ x: x + (p.x - x) / map.zoom, y: y + (p.y - y) / map.zoom });
    const lensDots = buildLandDots(step, 0, { left, top, right: left + map.lens, bottom: top + map.lens }, sourceFromLens)
      .filter((dot) => dot.x >= left && dot.x <= left + map.lens && dot.y >= top && dot.y <= top + map.lens);
    map.lensDots = lensDots;
    for (const dot of lensDots) { ctx.beginPath(); ctx.arc(dot.x, dot.y, 1.08, 0, Math.PI * 2); ctx.fill(); }
    const visiblePins = map.pins.map((pin) => ({ ...pin, sourcePoint: { x: x + (pin.sourcePoint.x - x) * map.zoom, y: y + (pin.sourcePoint.y - y) * map.zoom } }))
      .filter((pin) => pin.sourcePoint.x >= left && pin.sourcePoint.x <= left + map.lens && pin.sourcePoint.y >= top && pin.sourcePoint.y <= top + map.lens);
    map.lensPins = lensDots.length ? snapPins(visiblePins, lensDots) : [];
    map.lensGroups = groupPins(map.lensPins);
    drawPins(true);
    ctx.restore();
    ctx.save(); ctx.strokeStyle = "rgba(79, 232, 238, .92)"; ctx.lineWidth = 1.5; ctx.shadowColor = "rgba(45, 212, 222, .24)"; ctx.shadowBlur = 12; ctx.strokeRect(left + 0.75, top + 0.75, map.lens - 1.5, map.lens - 1.5); ctx.restore();
  }

  function localPoint(event) {
    const rect = el.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function setPointer(point, touch = false) {
    map.pointer = { ...point, touch };
    if (!map.raf) map.raf = requestAnimationFrame(() => { map.raf = 0; draw(); });
  }
  function nearestPin(x, y, lens = false, radius = 9) {
    let winner = null, best = radius;
    const groups = lens ? map.lensGroups || [] : map.pinGroups || [];
    for (const group of groups) {
      const distance = Math.hypot(group.point.x - x, group.point.y - y);
      if (distance < best) { best = distance; winner = group; }
    }
    return winner;
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
    selectedPlace = null; selectedOrganization = ""; selectedCountry = ""; unmappedMode = false;
    el.organizations.innerHTML = ""; el.results.innerHTML = "";
    $("researchMapResultsHeading").textContent = "Choose a location";
    const options = group.pins.map(({ place }) => `<button type="button" class="research-map-place-row" data-place="${escapeHtml(place.id)}"><span>${escapeHtml(place.name)}<small>${escapeHtml(place.country || place.kind || "")}</small></span><b>${recordsAtPlace(place).length}</b></button>`).join("");
    el.top.innerHTML = `<div class="research-map-subhead">Several places share this map dot</div>${options}`;
    el.top.querySelector("button")?.focus();
    el.selection.textContent = "Choose a place to view its records.";
    el.status.textContent = `${group.pins.length} places share this map dot. Choose one in the sidebar.`;
    el.top.focus?.();
  }

  el.canvas.addEventListener("pointermove", (event) => {
    const pos = localPoint(event);
    const touch = event.pointerType === "touch";
    setPointer(pos, touch);
    draw();
    const pin = touch ? null : nearestPin(pos.x, pos.y, pointerInsideLens(pos.x, pos.y), 9);
    if (pin && event.pointerType !== "touch") {
      el.tooltip.textContent = describePin(pin); el.tooltip.hidden = false;
      const x = Math.max(6, Math.min(map.width - el.tooltip.offsetWidth - 6, pos.x + 13));
      const y = Math.max(5, Math.min(map.height - el.tooltip.offsetHeight - 6, pos.y + 12));
      el.tooltip.style.transform = `translate(${x}px, ${y}px)`;
      el.canvas.style.cursor = "pointer";
    } else { el.tooltip.hidden = true; el.canvas.style.cursor = "crosshair"; }
  });
  el.canvas.addEventListener("pointerleave", () => { map.pointer = null; el.tooltip.hidden = true; el.canvas.style.cursor = "crosshair"; draw(); });
  el.canvas.addEventListener("pointerdown", (event) => { if (event.pointerType === "touch") { lastTouchAt = Date.now(); setPointer(localPoint(event), true); } });
  el.canvas.addEventListener("click", (event) => {
    const pos = localPoint(event);
    const touch = event.pointerType === "touch" || map.pointer?.touch === true || Date.now() - lastTouchAt < 900;
    const lens = !touch && pointerInsideLens(pos.x, pos.y);
    if (lens) draw();
    const pin = nearestPin(pos.x, pos.y, lens, touch ? 17 : 9);
    if (pin) { choosePinGroup(pin); return; }
    const source = lens ? { x: map.pointer.x + (pos.x - map.pointer.x) / map.zoom, y: map.pointer.y + (pos.y - map.pointer.y) / map.zoom } : pos;
    const coords = inverse(source.x, source.y);
    el.status.textContent = `Map position ${coords.lat.toFixed(1)} degrees latitude, ${coords.lon.toFixed(1)} degrees longitude`;
  });

  function choosePlace(place) {
    if (!place) return;
    selectedCountry = ""; selectedOrganization = ""; unmappedMode = false; selectedPlace = place;
    el.country.value = place.kind === "country" ? (place.country || place.name) : "";
    el.location.value = place.kind === "city" ? `${place.name}, ${place.country}` : place.name;
    render();
  }

  el.country.addEventListener("input", () => {
    const value = el.country.value.trim();
    selectedCountry = value;
    selectedOrganization = "";
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
    else if (selectedCountry) { el.selection.textContent = `Search for a listed country to view its records.`; el.top.innerHTML = ""; el.organizations.innerHTML = ""; el.results.innerHTML = `<p class="research-map-empty">No matching country. Choose a country from the suggestions.</p>`; }
    draw();
  }
  el.location.addEventListener("input", () => {
    const rawValue = el.location.value.trim();
    const value = rawValue.toLowerCase();
    selectedOrganization = "";
    if (!value) { selectedPlace = null; selectedCountry = ""; unmappedMode = false; el.country.value = ""; render(); return; }
    const place = places.find((p) => p.name.toLowerCase() === value || `${p.name}, ${p.country || ""}`.toLowerCase() === value || (p.kind === "country" && (p.country || p.name).toLowerCase() === value));
    if (place) choosePlace(place);
    else { selectedPlace = null; selectedCountry = ""; unmappedMode = false; el.country.value = ""; el.selection.textContent = "Choose a listed location"; el.results.innerHTML = `<p class="research-map-empty">Select a place from the suggestions to see related records.</p>`; el.top.innerHTML = ""; el.organizations.innerHTML = ""; draw(); }
  });
  el.type.addEventListener("change", () => { selectedOrganization = ""; render(); });
  el.contributor.addEventListener("change", () => { selectedOrganization = ""; render(); });
  $("researchMapAll").addEventListener("click", () => { selectedCountry = ""; selectedOrganization = ""; selectedPlace = null; unmappedMode = false; el.country.value = ""; el.location.value = ""; render(); });
  $("researchMapUnmapped").addEventListener("click", () => { selectedPlace = null; selectedCountry = ""; selectedOrganization = ""; unmappedMode = true; el.country.value = ""; el.location.value = ""; render(); });
  el.australia.addEventListener("click", (event) => { const button = event.target.closest("[data-place]"); if (button) choosePlace(places.find((p) => String(p.id) === button.dataset.place)); });
  el.top.addEventListener("click", (event) => { const button = event.target.closest("[data-place]"); if (button) choosePlace(places.find((p) => String(p.id) === button.dataset.place)); });
  el.organizations.addEventListener("click", (event) => {
    if (event.target.closest("[data-clear-org]")) selectedOrganization = "";
    else { const button = event.target.closest("[data-org]"); if (button) selectedOrganization = button.dataset.org; }
    if (selectedPlace) showPlaceResults(selectedPlace);
    render();
  });
  el.results.addEventListener("click", (event) => {
    const button = event.target.closest("[data-summary]");
    if (!button || typeof papersData === "undefined" || !Array.isArray(papersData)) return;
    const paper = papersData.find((entry) => String(entry.id) === String(button.dataset.summary));
    if (paper && typeof window.openSummary === "function") window.openSummary(Number(paper.id));
  });
  $("researchMapRetry").addEventListener("click", () => { if (init()) el.status.textContent = "Research map loaded."; });

  if ("ResizeObserver" in window) {
    resizeObserver = new ResizeObserver(() => { if (data) setSize(); });
    resizeObserver.observe(el.wrap);
  } else window.addEventListener("resize", () => { if (data) setSize(); });
  init();

  window.ResearchMap = {
    selectPlace(id) { const place = places.find((p) => String(p.id) === String(id)); if (place) choosePlace(place); },
    showAll() { $("researchMapAll").click(); },
    showUnmapped() { $("researchMapUnmapped").click(); },
    getState() {
      const bounds = map.pointer && !map.pointer.touch ? lensBounds() : null;
      return {
        places: places.length, records: records.length, selectedPlace: selectedPlace?.id || null, unmapped: unmappedMode,
        markerCount: map.pins.length, baseLandDotCount: map.landDots.length, lensLandDotCount: map.lensDots?.length || 0,
        baseGrid: { startX: 4, startY: 4, step: 6.1 },
        lensGrid: bounds ? { startX: Math.floor(bounds.left / 5.2) * 5.2, startY: Math.floor(bounds.top / 5.2) * 5.2, step: 5.2, bounds, sourcePointer: { x: map.pointer.x, y: map.pointer.y }, zoom: map.zoom } : null,
        markerRadius: 1.05, lensMarkerRadius: 1.08,
      };
    },
    getMarkers() {
      return map.pins.map((pin, index) => {
        const lensPin = map.pointer && !map.pointer.touch ? map.lensPins?.find((entry) => entry.place.id === pin.place.id) : null;
        return { id: pin.place.id, name: pin.place.name, kind: pin.place.kind || "place", original: { lat: Number(pin.place.lat), lon: Number(pin.place.lon) }, base: { x: pin.point.x, y: pin.point.y, radius: 1.05, onLandDot: map.landDots.some((dot) => dot.x === pin.point.x && dot.y === pin.point.y) }, lens: lensPin ? { x: lensPin.point.x, y: lensPin.point.y, radius: 1.08, onLandDot: (map.lensDots || []).some((dot) => dot.x === lensPin.point.x && dot.y === lensPin.point.y) } : null, typeCounts: { ...pin.typeCounts }, recordCount: pin.count };
      });
    },
  };
})();
