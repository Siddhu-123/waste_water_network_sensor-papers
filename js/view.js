// Read-only PDF reader for the public library. It only opens PDFs that this site
// hosts under contributors/, talks to no backend, and has no editing features.
(function () {
  "use strict";

  const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
  const params = new URLSearchParams(location.search);
  const el = {
    title: document.getElementById("docTitle"),
    pages: document.getElementById("pages"),
    status: document.getElementById("status"),
    indicator: document.getElementById("pageIndicator"),
    zoom: document.getElementById("zoomIndicator"),
  };
  let pdf = null;
  let zoom = 1; // multiplier on fit-to-width
  let current = 1;
  const rendered = new Map(); // page number -> scale it was drawn at
  let generation = 0; // bumped on every layout so stale renders are dropped
  let laidOutWidth = 0;

  function fail(message) {
    el.title.textContent = "Document unavailable";
    el.status.textContent = message;
    el.status.classList.add("visible", "error");
  }

  // Only this site's own PDFs: same origin, inside contributors/, ending in .pdf.
  function safePdfUrl(raw) {
    if (!raw) return null;
    let url;
    try { url = new URL(raw, location.href); } catch (e) { return null; }
    const base = new URL("./contributors/", location.href);
    if (url.origin !== location.origin) return null;
    if (!url.pathname.startsWith(base.pathname)) return null;
    if (!/\.pdf$/i.test(url.pathname)) return null;
    if (/(^|\/)\.\.?(\/|$)/.test(decodeURIComponent(url.pathname))) return null;
    url.search = "";
    url.hash = "";
    return url.href;
  }

  const pdfUrl = safePdfUrl(params.get("pdf"));
  const title = (params.get("title") || "").slice(0, 200).trim();
  document.title = (title ? title + " · " : "") + "Wastewater Research Library";
  el.title.textContent = title || "Document";
  el.title.title = title;

  if (!pdfUrl) { fail("This link does not point to a document in the library."); return; }
  if (!window.pdfjsLib) { fail("The PDF reader could not load. Check your connection and reload."); return; }
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js";

  function fitScale(page) {
    const viewport = page.getViewport({ scale: 1 });
    const width = el.pages.clientWidth - (window.innerWidth < 600 ? 16 : 48);
    return Math.max(0.2, Math.min(4, (width / viewport.width) * zoom));
  }

  async function renderPage(number) {
    const holder = el.pages.querySelector(`[data-page="${number}"]`);
    if (!holder) return;
    const gen = generation;
    const page = await pdf.getPage(number);
    const scale = fitScale(page);
    if (gen !== generation || rendered.get(number) === scale) return;
    rendered.set(number, scale);
    const viewport = page.getViewport({ scale });
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width * ratio);
    canvas.height = Math.floor(viewport.height * ratio);
    canvas.style.width = Math.floor(viewport.width) + "px";
    canvas.style.height = Math.floor(viewport.height) + "px";
    holder.style.width = canvas.style.width;
    holder.style.height = canvas.style.height;
    await page.render({
      canvasContext: canvas.getContext("2d"),
      viewport,
      transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : null,
    }).promise;
    if (gen !== generation) return;
    holder.replaceChildren(canvas);
  }

  const visible = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) renderPage(Number(entry.target.dataset.page)).catch((err) => console.warn("page render failed", err));
    }
  }, { root: el.pages, rootMargin: "800px 0px" });

  const tracker = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
        current = Number(entry.target.dataset.page);
        el.indicator.textContent = `${current} / ${pdf.numPages}`;
      }
    }
  }, { root: el.pages, threshold: [0.5] });

  async function layout() {
    const first = await pdf.getPage(1);
    const scale = fitScale(first);
    const vp = first.getViewport({ scale });
    generation += 1;
    laidOutWidth = el.pages.clientWidth;
    rendered.clear();
    el.pages.querySelectorAll(".page").forEach((holder) => {
      holder.style.width = Math.floor(vp.width) + "px";
      holder.style.height = Math.floor(vp.height) + "px";
      holder.replaceChildren();
      visible.unobserve(holder); visible.observe(holder);
    });
    el.zoom.textContent = zoom === 1 ? "Fit" : Math.round(zoom * 100) + "%";
  }

  function goTo(number) {
    const n = Math.max(1, Math.min(pdf.numPages, number));
    const holder = el.pages.querySelector(`[data-page="${n}"]`);
    if (holder) holder.scrollIntoView({ block: "start" });
  }

  async function setZoom(next) {
    const keep = current;
    zoom = Math.max(0.5, Math.min(3, Math.round(next * 100) / 100));
    await layout();
    goTo(keep);
  }

  document.getElementById("prevBtn").addEventListener("click", () => pdf && goTo(current - 1));
  document.getElementById("nextBtn").addEventListener("click", () => pdf && goTo(current + 1));
  document.getElementById("zoomInBtn").addEventListener("click", () => pdf && setZoom(zoom + 0.25));
  document.getElementById("zoomOutBtn").addEventListener("click", () => pdf && setZoom(zoom - 0.25));
  document.addEventListener("keydown", (event) => {
    if (!pdf || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === "ArrowRight" || event.key === "PageDown") { goTo(current + 1); event.preventDefault(); }
    if (event.key === "ArrowLeft" || event.key === "PageUp") { goTo(current - 1); event.preventDefault(); }
  });
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (pdf && el.pages.clientWidth !== laidOutWidth) setZoom(zoom); }, 200);
  });

  el.status.textContent = "Loading document…";
  el.status.classList.add("visible");
  window.pdfjsLib.getDocument({ url: pdfUrl, isEvalSupported: false, enableXfa: false }).promise
    .then(async (doc) => {
      pdf = doc;
      const fragment = document.createDocumentFragment();
      for (let n = 1; n <= pdf.numPages; n += 1) {
        const holder = document.createElement("div");
        holder.className = "page";
        holder.dataset.page = String(n);
        holder.setAttribute("aria-label", `Page ${n}`);
        fragment.appendChild(holder);
      }
      el.pages.appendChild(fragment);
      await layout(); // size every page before tracking which one is on screen
      el.pages.querySelectorAll(".page").forEach((holder) => tracker.observe(holder));
      el.indicator.textContent = `1 / ${pdf.numPages}`;
      const start = parseInt(params.get("page"), 10);
      if (start > 1) goTo(start);
      el.status.classList.remove("visible");
    })
    .catch(() => fail("The document could not be opened."));
})();
