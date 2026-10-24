# Cloudflare vs Vercel backend: review and migration plan

Status: plan only. No code, deploy, or config was changed. Source was read-only. No secrets were read. Live endpoint timings and Cloudflare/Vercel docs research are done separately by the main session. Statements here are about the repo source, not the live deployments, unless marked **unverified**.

## 1. Short answer

- The frontend **already points at Cloudflare by default**. Moving "the backend" is mostly finishing a half-done move, not starting one.
- Cloudflare is **not yet at parity** with the Vercel API, and the deployed Worker may not even be persistent. Fix those before calling it migrated.
- "Vercel is slow" is **not yet demonstrated**. The Vercel code has structural latency causes that are independent of cold starts (see section 6). Measure before attributing.
- Do not use the `cloudflare-backend/README.md` claims ("0ms cold starts", "300+ cities", "no complex setup") as evidence. They are marketing and say nothing about this app's latency.

## 2. What is in use today

| Item | Finding (file) |
| --- | --- |
| Default API base | `annotation-config.js` sets `CLOUDFLARE_WORKER_URL = https://pdf-annotations.sidcode3535.workers.dev`. Priority is `?api=` > localStorage `custom_annotation_api_base` > Cloudflare Worker > Vercel (only on `siddhu-123.github.io`) > same origin. Because the Worker URL is non-empty, the Vercel fallback is **unreachable** unless the config is removed or overridden. |
| Frontend consumers | `pdf-viewer.html` (~L1675-1810, load ~L2712, save ~L2815) and `js/annotations.js` (summary badges). Both read `window.ANNOTATION_API_BASE`, then keep their own hard-coded Vercel fallback for `siddhu-123.github.io`. |
| Worker name mismatch | Live URL is `pdf-annotations`. `wrangler.toml` says `wastewater-annotations-api`; the README says `wastewater-annotations`. The deployed Worker was therefore **not** produced from this `wrangler.toml` (likely pasted via dashboard). What is actually deployed is **unverified**. |
| KV binding | `wrangler.toml` has the `[[kv_namespaces]]` block **commented out**. Persistence depends on a dashboard binding named `ANNOTATIONS_KV`. Main should check `GET /api/health` (`hasKV`). |
| Docs drift | Root `README.md` still describes Vercel Blob as the shared store and Vercel as the API host. It does not mention the Worker. |
| Vercel backend | Still present: `api/annotations/*`, `api/auth/*`, `server/blob.js`, `server/github.js`, `package.json` (`@vercel/blob: latest`, unpinned). No `vercel.json` (so default function region and runtime), no `.vercelignore`. |
| Data split risk | Vercel Blob and Cloudflare KV are separate stores with no sync. Annotations saved under Vercel are invisible once the client points at the Worker, and vice versa. Any user with an old tab, or anyone using `?api=` / the localStorage override, writes to a different store. |

## 3. Route parity

| Route | Vercel | Cloudflare Worker | Gap |
| --- | --- | --- | --- |
| `GET /api/annotations` (summary) | Reads `annotations/summary.json`; if missing, lists blobs and rebuilds | Reads KV `summary`; if missing, rebuilds via `list` + N `get` | OK shape. Rebuild cost differs (section 5). |
| `GET /api/annotations/:id` | Returns doc, revision = Blob ETag | Returns doc, revision = `rev-<ts>-<uuid8>` | OK for the frontend. Revision formats differ, so a stored revision is not portable. |
| `POST /api/annotations/:id` | ETag `ifMatch` (atomic), 201 on first create | Read-then-write, non-atomic, always 200 | Concurrency gap (section 5). |
| `DELETE /api/annotations/:id` | Not implemented (405) | **Implemented, no auth** | Cloudflare is more dangerous. Any origin can wipe a paper's annotations. |
| `GET /api/health` | None | Yes (`hasKV`) | Cloudflare only. Useful. |
| `/api/auth/github`, `/callback`, `/me`, `/logout` | Implemented (GitHub OAuth, encrypted session cookie, collaborator-permission check) | **Absent** (404) | Not ported. |
| Missing storage | 503 `annotation_storage_not_configured` (GET summary returns empty 200) | **Silent in-memory `Map` fallback**, still returns 200 | Dangerous. See section 7. |

Payload validation differs (`server/github.js` `normalizeAnnotation` vs Worker copy):
- Vercel caps a document at 500 annotations and rejects sticky text over 2000 characters. The Worker has no document cap and truncates text at 3000 characters.
- Vercel keeps `deletedDevice` on sticky notes. The Worker **drops it**.
- Title limit: 100 (Vercel) vs 120 (Worker).
- Author limit: 50 (Vercel) vs 80 (Worker).
- Both preserve multi-line `boxes` (up to 100) and highlight `text`, so the README's "multi-line preservation" is not a Cloudflare-only advantage in the current source.
- The Worker has no request body size limit of its own, and the same duplicated normalizer in two places will drift.

## 4. Auth and CORS

**Auth.**
- The frontend never calls `/api/auth/*` (no references in `pdf-viewer.html`, `js/*.js`, `index.html`). Annotation writes on Vercel are effectively anonymous too: `readSession` is used only to default the author name. The README says OAuth is optional.
- So today there is no real auth to port, only a dormant OAuth flow. The decision is whether it should become real.
- If it is kept, it must move to the Worker (Web Crypto replaces `node:crypto` AES-GCM, `fetch` replaces the GitHub calls, cookies are set manually). Note that `SameSite=None; Secure` third-party cookies from a `workers.dev` origin to a `github.io` page are increasingly blocked by browsers, so a Worker-hosted cookie session is fragile for a Pages frontend. A custom domain sharing a registrable domain with the frontend, or a token flow, avoids that.
- The OAuth scope requested is `public_repo` (broader than needed for a membership check). Worth reducing if auth is revived.

**CORS.**
- Vercel: allowlist (`github.io`, localhost, Vercel URLs, env-configured), credentials allowed, methods `GET,POST,OPTIONS`, header `Content-Type`.
- Worker: `Access-Control-Allow-Origin: *`, methods include `DELETE`, headers include `Authorization`. This is fine for public reads, but combined with unauthenticated `POST`/`DELETE` it means any website can write to or delete the library's annotations from a visitor's browser, or directly with curl.
- Minimum fix before migration: origin allowlist, drop `DELETE` (or require a secret), and keep `*` only for GET if wanted.

## 5. Revision, conflicts, and concurrency

Frontend behaviour (`pdf-viewer.html` save): sends the whole annotation array plus `revision`. On 409 it adopts the server revision and tells the user to click Save again to overwrite. So conflict resolution is **whole-document, last-writer-wins by user choice**, and an unsynced edit from user A can be overwritten by user B's second click. Neither backend merges.

Vercel: `put(..., { ifMatch: currentRevision })` gives a real server-side atomic compare-and-set. Gaps: the first write for a paper has no `ifMatch` and uses `allowOverwrite: true`, so two simultaneous first saves race. The summary blob is updated by read-modify-write with **no** `ifMatch`, so concurrent saves to different papers can lose summary updates (swallowed in a `catch`). The summary is not rebuilt unless the blob is missing.

Cloudflare Worker: the check is `get` then `put` on KV. That is not atomic.
- Two saves landing together both see the same revision and both succeed, last one wins silently.
- KV is eventually consistent. Per Cloudflare KV docs, a write can take up to ~60 seconds to be visible in other locations, and reads are cached at the edge. A second user in another city can fetch a stale revision and a stale document. The conflict check then compares against stale data. **Verify these figures against current docs** (main is researching).
- KV also limits writes to the same key (about 1 per second). Rapid saves of the same paper can be rejected. Verify.
- Conflict only fires when both `expectedRev` and `currentRev` are truthy, so a client with a null revision can overwrite an existing doc without any 409.
- `rebuildGlobalSummary` runs on **every** POST and DELETE via `waitUntil`. It lists `paper:` keys (no cursor handling, so truncated at one page of 1000) and does one `get` per key. With 115 PDFs in the repo (not all necessarily annotated), a rebuild can approach the per-request subrequest cap, which is lower on the free plan. A failure inside `waitUntil` is silent. Concurrent rebuilds also race on the single `summary` key. Verify limits against docs.

Options to fix, in order of cost:
1. **D1 (SQLite)**: strongly consistent, one row per paper with a `revision` integer. `UPDATE ... WHERE paper_id=? AND revision=?` gives atomic compare-and-set; the summary becomes a query (or a `GROUP BY`), so no rebuild job. Best fit for this data (small relational JSON per paper, low write rate, need for history). Read replication and latency characteristics need checking.
2. **Durable Object per paper**: serialises writes per paper, gives atomic revisions and optional WebSocket live sync later. More code, and per-DO location affinity (a DO lives in one place), so far-away users pay a round trip. Overkill unless live collaboration is wanted.
3. **KV only**: acceptable for a read-mostly summary cache, not for the source of truth with conflict detection.

Recommendation: D1 for documents plus revision history, KV (or Cache API) optional for the summary read path.

## 6. Why it may be slow (hypotheses, not findings)

Vercel path, from the code:
- **Many sequential Blob round trips per save**: `getJsonBlob` (current doc) + `put` + `getJsonBlob` (summary) + `put` (summary) = 4 storage calls, before the response. Cloudflare does 1 read + 1 write and defers the summary.
- `getJsonBlob` retries 5xx up to 2 times with 300 ms and 600 ms backoff, which hides and adds latency under transient errors.
- `@vercel/blob` is loaded via dynamic `import()` on first use per instance. That adds to cold starts, and the dependency is `latest`.
- `get(..., { access: "private" })` streams the blob through the function rather than serving it from a CDN, with `useCache: false`.
- No `vercel.json`, so the default function region applies (commonly US East). The team and users appear to be in Adelaide. Region distance is a plausible dominant factor and is cheap to test. **Unverified:** actual project region and Blob store region (dashboard).
- Free/Hobby plan cold behaviour and function limits: check docs.

Frontend factors that look like "backend slowness" but are not:
- `loadAnnotations` awaits the API with **no timeout/AbortController** before falling back to local JSON and localStorage. A slow or hung API blocks annotation load.
- The index summary is cache-first (localStorage), so badge latency is mostly hidden.
- PDF loading is separate: `pdfUrl` comes from the `pdf` query parameter and is fetched by pdf.js (range requests, `disableAutoFetch`). The API is not in that path. If PDFs feel slow, the cause is the static host for the PDF files, not annotation endpoints.

Cloudflare path caveats: the Worker is fast to start, but KV cold-location reads go back to central storage, and a DO or D1 primary is in one region. "Edge" does not mean every read is local. Compare actual numbers.

## 7. Failure mode: missing bindings

`getStoredJson` / `putStoredJson` fall back to a module-level `Map` when `ANNOTATIONS_KV` is missing. In production this is worse than failing:
- Writes return 200 and appear to save, but live only in one isolate's memory. Isolates are recycled and multiple isolates run concurrently, so data vanishes or differs between requests.
- The client then caches the response in localStorage and shows "All saved". Users believe annotations are shared when they are not.
- `GET /api/health` reports `hasKV: false`, but nothing in the frontend checks it.

Fix before migration: return 503 on every data route when the binding is absent (matching Vercel's `annotation_storage_not_configured`), and make the frontend surface it. Keep the in-memory path for `wrangler dev` only, behind an explicit env flag.

## 8. Large PDF storage: R2 vs Vercel deploy copies

- The repo tracks 115 PDFs, about 400 MB total, largest about 42 MB. They are served relative to the frontend (`pdf-viewer.html?pdf=...`).
- On GitHub Pages, repo files above published-site limits (Pages sites should stay within about 1 GB) are a concern at this size. Verify the current limits.
- On Vercel, there is no `.vercelignore`, so a Git deploy likely copies the whole repository including PDFs into every deployment. This inflates build/upload time and counts against deployment size limits. Verify the actual deployment size in the dashboard.
- Annotation JSON is tiny. It is the PDFs that are heavy, and moving the API does nothing for them.
- **R2** is a reasonable home for PDFs: no egress fees (per Cloudflare pricing, verify), range requests supported, and the Worker can serve them with `Range` and caching headers. It would also stop PDFs being copied into every deploy. Costs: need an upload/sync step in the existing parsing workflow, CORS on the bucket (pdf.js is cross-origin from `github.io`), copyright review for public hosting of papers (the repo is already public, so this is unchanged), and updating `pdfUrl` values in contributor data and `validate_repo.py`'s PDF link checks.
- This is a separate decision from the annotation API. Do not bundle it into the same cutover.

## 9. Constraints that stay the same

- **GitHub Pages remains the frontend** (`siddhu-123.github.io`). No frontend host change is proposed.
- **Parsing and batch work run in GitHub Actions** (`.github/workflows/validate.yml` and the scripts under `scripts/`), not in the browser and not in a Worker request. A Worker has CPU and memory limits and is the wrong place for PDF parsing. Cloudflare may at most store its outputs.

## 10. Phased, backup-first plan

Each phase is reversible. Do not start the next until the previous passes its check.

**Phase 0: measure and inventory (no changes)**
1. Run the measurements in section 11.
2. Confirm which Worker is live and whether `hasKV` is true; export the list of deployed bindings.
3. Take a **backup of Vercel Blob**: list `annotations/` and download every `paper-*.json` and `summary.json` to a dated local folder, outside any deploy path, with a manifest (path, size, ETag, count). Do the same for Worker KV if it holds data. Needs a read-only token handled by the user, never pasted into chat or committed.
4. Reconcile: for each paper, compare Vercel and Worker documents and record which is newer. The split from section 2 likely produced divergence.

**Phase 1: make Cloudflare safe (no traffic change)**
5. Commit the KV or D1 binding in `wrangler.toml` and name the Worker consistently.
6. Return 503 when bindings are missing; remove the silent `Map` fallback in production.
7. Restrict CORS to an allowlist; remove or protect `DELETE`.
8. Port validation to match Vercel (500 cap, `deletedDevice`, limits). Put the shared normaliser in one module with tests, rather than two diverging copies.
9. Replace read-then-write with an atomic conditional write (D1 `revision` column). Keep the 409 response shape identical (`error: "annotation_conflict"`, `revision`, `annotations`).
10. Compute the summary from a query or an incremental update, not a full rebuild per POST.
11. Add append-only revision history (table or R2 object per save) so any overwrite is recoverable.
12. Add a contract test that runs the same request set against both backends (GET empty, POST create, POST stale revision, POST null revision, invalid payload, OPTIONS from allowed and disallowed origin) and compares status codes and response shapes.

**Phase 2: import and shadow**
13. Import the Phase 0 backup into the new store (idempotent script, dry-run first). Verify counts and a checksum per paper.
14. Shadow-write: keep the Vercel API primary for a trial window and mirror successful writes to Cloudflare (or the reverse), logging mismatches. Alternative if too complex: freeze writes briefly during cutover and announce it to the five contributors.

**Phase 3: cutover**
15. Confirm `annotation-config.js` target and remove the two hard-coded Vercel fallbacks in `pdf-viewer.html` and `js/annotations.js` so there is one source of truth. Add a fetch timeout and a visible error if the backend is down.
16. Final export from Vercel, re-import, switch. Keep Vercel Blob and the API **read-only and deployed** for a rollback window (suggest at least 2 weeks) before retiring.

**Phase 4: auth, only if wanted**
17. Decide whether login should exist. If annotations stay anonymous, delete the dormant `api/auth/*` rather than port it. If it should exist, build it on the Worker with an origin and cookie strategy that survives third-party cookie blocking, and a narrower OAuth scope.

**Phase 5: PDFs (optional, separate)**
18. Evaluate R2 for the 115 PDFs once the annotation cutover is stable.

Rollback at any point before step 16: set `CLOUDFLARE_WORKER_URL = ""` (or use `?api=` for testing) so the existing Vercel path takes over, and restore from the Phase 0 backup.

## 11. Measurements needed before blaming Vercel

Take these from the places users actually are (Adelaide at least), over several days and times, with percentiles, not single runs.

1. **Cold vs warm**: first request after 10+ minutes idle vs repeated requests, for `GET /api/annotations`, `GET /api/annotations/:id` (existing and empty), and `POST`. Record p50/p95 for both backends.
2. **Time breakdown**: DNS, TCP, TLS, TTFB, download (`curl -w`), and server-side timing. Add a temporary `Server-Timing` header or log in a test copy to split function init, Blob read, Blob write.
3. **Region**: Vercel function region and Blob store region; the user's nearest Cloudflare colo (`cf-ray` header suffix) and, for D1/DO, where the primary is.
4. **Per-save storage calls**: confirm the 4-call sequence on Vercel and its measured share of save time.
5. **Error and retry rate**: how often the 5xx retries in `retryOperation` fire, from Vercel logs.
6. **Frontend perspective**: time from page load to annotations rendered, with the Network panel, to see how much is API vs PDF vs pdf.js worker vs CDN assets. Test with the fetch timeout absent and present.
7. **Cloudflare under the same conditions**: KV read of a key last written elsewhere (stale-read check), write-then-read from two locations, and summary rebuild duration with the real paper count.
8. **Stale/lost writes**: a scripted concurrent-save test against both backends (two clients, same paper, same revision) to count lost updates.
9. **PDF delivery separately**: TTFB and range-request time for a large PDF from the current static host.

Decision rule: if Vercel warm p95 is acceptable and most delay is region distance or the multi-call save, fix those (set region, drop the second summary round trip) before migrating. Migrate if the Worker, with the safety fixes above, is clearly better on cold and warm p95 *and* the atomic revision and backup requirements are met.

## 12. What moving would and would not buy

Likely benefits: fewer sequential storage calls per save; possibly lower latency for Australia depending on storage placement; no cold start in the usual sense; one platform if R2 is later added; free tier fits a five-person team (check current limits).

Not benefits by themselves: persistence (needs a real binding, currently unverified), concurrency safety (currently weaker than Vercel's), auth (not ported and unused), security (currently weaker), or PDF speed (separate path).
