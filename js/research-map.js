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
  const map = { width: 0, height: 0, dpr: 1, mask: null, pins: [], pointer: null, raf: 0, lens: 150, zoom: 4, mapTop: 0, mapHeight: 0 };
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
    map.pins.forEach((pin) => { pin.point = point(pin.place.lat, pin.place.lon); });
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
    map.pins = places.filter((place) => (counts.get(String(place.id)) || new Set()).size > 0).map((place) => ({
      place, count: counts.get(String(place.id)).size, point: point(place.lat, place.lon),
    }));
    const unique = new Set(filteredRecords().map(recordKey)).size;
    const mapped = new Set(filteredRecords().filter((r) => locationsFor(r).length).map(recordKey)).size;
    el.coverage.textContent = `${mapped} of ${unique} records mapped · ${map.pins.length} places`;
    if (selectedPlace && !unmappedMode) showPlaceResults(selectedPlace);
    else if (unmappedMode) showUnmappedResults();
    else showOverview();
    draw();
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
    return `<article class="research-map-record"><div class="research-map-record-top"><span class="research-map-type ${escapeHtml(record.type)}">${escapeHtml(record.type)}</span>${assignedTo ? `<span class="research-map-assignee">${escapeHtml(assignedTo)}</span>` : ""}</div><h4>${escapeHtml(record.title || `Record ${record.id}`)}</h4>${authors}${organization}${relation}${unmapped}<div class="research-map-record-links">${links.join("")}</div></article>`;
  }

  function draw() {
    if (!ctx || !map.width || !map.mask) return;
    ctx.setTransform(map.dpr, 0, 0, map.dpr, 0, 0);
    ctx.fillStyle = "#080d17";
    ctx.fillRect(0, 0, map.width, map.height);
    ctx.fillStyle = "rgba(210, 220, 233, 0.68)";
    const spacing = 6.1;
    for (let y = 4; y < map.height - 3; y += spacing) {
      for (let x = 4; x < map.width - 3; x += spacing) {
        if (isLand(x, y)) { ctx.beginPath(); ctx.arc(x, y, 1.05, 0, Math.PI * 2); ctx.fill(); }
      }
    }
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
    for (const pin of map.pins) {
      const isSelected = selectedPlace && String(selectedPlace.id) === String(pin.place.id);
      let x = pin.point.x, y = pin.point.y;
      if (lens) {
        x = map.pointer.x + (pin.point.x - map.pointer.x) * map.zoom;
        y = map.pointer.y + (pin.point.y - map.pointer.y) * map.zoom;
      }
      if (lens && (x < bounds.left - 18 || x > bounds.right + 18 || y < bounds.top - 18 || y > bounds.bottom + 18)) continue;
      const radius = lens ? 4.1 : isSelected ? 5.5 : 4;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#e7fbff" : "#42e8ed"; ctx.shadowColor = "rgba(54, 231, 238, .8)"; ctx.shadowBlur = lens ? 12 : 8; ctx.fill(); ctx.shadowBlur = 0;
      ctx.lineWidth = 1.4; ctx.strokeStyle = "#063c52"; ctx.stroke();
      if (lens && pin.place.kind === "city" && /^(Adelaide|Melbourne|Sydney)$/i.test(pin.place.name)) {
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
    const startX = Math.floor(left / step) * step;
    const startY = Math.floor(top / step) * step;
    for (let yDest = startY; yDest < top + map.lens; yDest += step) {
      for (let xDest = startX; xDest < left + map.lens; xDest += step) {
        const sourceX = x + (xDest - x) / map.zoom;
        const sourceY = y + (yDest - y) / map.zoom;
        if (isLand(sourceX, sourceY)) { ctx.beginPath(); ctx.arc(xDest, yDest, 1.08, 0, Math.PI * 2); ctx.fill(); }
      }
    }
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
    for (const pin of map.pins) {
      const px = lens ? map.pointer.x + (pin.point.x - map.pointer.x) * map.zoom : pin.point.x;
      const py = lens ? map.pointer.y + (pin.point.y - map.pointer.y) * map.zoom : pin.point.y;
      const distance = Math.hypot(px - x, py - y);
      if (distance < best) { best = distance; winner = pin; }
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
  function describePin(pin) { return `${pin.place.name}${pin.place.country ? `, ${pin.place.country}` : ""} · ${pin.count} ${pin.count === 1 ? "record" : "records"}`; }

  el.canvas.addEventListener("pointermove", (event) => {
    const pos = localPoint(event);
    const touch = event.pointerType === "touch";
    setPointer(pos, touch);
    const pin = touch ? null : nearestPin(pos.x, pos.y, pointerInsideLens(pos.x, pos.y), 9);
    if (pin && event.pointerType !== "touch") {
      el.tooltip.textContent = describePin(pin); el.tooltip.hidden = false;
      const x = Math.min(map.width - 185, Math.max(6, pos.x + 13));
      const y = Math.min(map.height - 42, Math.max(5, pos.y + 12));
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
    const pin = nearestPin(pos.x, pos.y, lens, touch ? 17 : 9);
    if (pin) { choosePlace(pin.place); return; }
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
    getState() { return { places: places.length, records: records.length, selectedPlace: selectedPlace?.id || null, unmapped: unmappedMode }; },
  };
})();
