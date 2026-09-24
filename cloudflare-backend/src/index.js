/**
 * Cloudflare Worker Backend for Wastewater Research Library
 * High-performance, edge-distributed storage for PDF highlights, sticky notes, and research badges.
 */

// In-memory fallback if KV is not bound (e.g. initial local dev)
const memoryStorage = new Map();

function applyCorsHeaders(headers = new Headers()) {
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS, DELETE");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  return headers;
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  const headers = applyCorsHeaders(new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  }));
  return new Response(JSON.stringify(data), { status, headers });
}

function numberInRange(val, min, max) {
  const n = Number(val);
  return Number.isFinite(n) && n >= min && n <= max;
}

/**
 * Validates and normalizes annotations, preserving multi-line highlight boxes & text.
 */
function normalizeAnnotation(value, index) {
  if (!value || typeof value !== "object") {
    throw new Error(`Annotation ${index + 1} must be an object`);
  }
  const type = value.type === "sticky-note" ? "sticky-note" : value.type;
  if (type !== "highlight" && type !== "sticky-note") {
    throw new Error(`Annotation ${index + 1} has an unsupported type: ${type}`);
  }

  const id = String(value.id || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(id)) {
    throw new Error(`Annotation ${index + 1} has an invalid ID`);
  }

  const page = Number(value.page ?? value.pageNumber);
  const x = Number(value.x ?? value.relativeX ?? 0);
  const y = Number(value.y ?? value.relativeY ?? 0);

  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    throw new Error(`Annotation ${index + 1} has an invalid page number: ${page}`);
  }

  const normalized = {
    id,
    type,
    page,
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
    createdBy: String(value.createdBy || "Unknown contributor").slice(0, 120),
    createdAt: String(value.createdAt || new Date().toISOString()).slice(0, 40),
  };

  if (type === "highlight") {
    const width = Number(value.width ?? 0.05);
    const height = Number(value.height ?? 0.02);
    const color = String(value.color || "#ffdf5d");
    const opacity = Number(value.opacity ?? 0.42);

    normalized.width = Math.max(0.0001, Math.min(1, width));
    normalized.height = Math.max(0.0001, Math.min(1, height));
    normalized.color = /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffdf5d";
    normalized.opacity = numberInRange(opacity, 0.05, 1) ? opacity : 0.42;

    // Preserve exact selected text
    if (typeof value.text === "string" && value.text.trim()) {
      normalized.text = value.text.trim().slice(0, 2000);
    }

    // Preserve ALL line boxes for multi-line highlighting!
    if (Array.isArray(value.boxes) && value.boxes.length > 0) {
      normalized.boxes = value.boxes.slice(0, 100).map((b) => ({
        x: Math.max(0, Math.min(1, Number(b.x))),
        y: Math.max(0, Math.min(1, Number(b.y))),
        width: Math.max(0.0001, Math.min(1, Number(b.width))),
        height: Math.max(0.0001, Math.min(1, Number(b.height))),
      })).filter((b) => Number.isFinite(b.x) && Number.isFinite(b.y) && Number.isFinite(b.width) && Number.isFinite(b.height));
    }
  } else {
    // Sticky note
    const text = String(value.text || "").trim();
    if (!text) {
      throw new Error(`Annotation ${index + 1} has empty note text`);
    }
    normalized.text = text.slice(0, 3000);

    if (value.title && typeof value.title === "string") {
      normalized.title = value.title.trim().slice(0, 120);
    }
    if (value.status === "deleted" || value.status === "active") {
      normalized.status = value.status;
    }
    if (value.deletedBy && typeof value.deletedBy === "string") {
      normalized.deletedBy = value.deletedBy.trim().slice(0, 120);
    }
    if (value.deletedAt && typeof value.deletedAt === "string") {
      normalized.deletedAt = value.deletedAt.trim().slice(0, 40);
    }

    normalized.width = numberInRange(value.width, 0.01, 0.3) ? Number(value.width) : 0.06;
    normalized.height = numberInRange(value.height, 0.01, 0.3) ? Number(value.height) : 0.06;
    normalized.color = /^#[0-9a-f]{6}$/i.test(String(value.color || "")) ? String(value.color) : "#ffd166";
  }

  return normalized;
}

/**
 * Storage Abstraction: KV with in-memory fallback
 */
async function getStoredJson(env, key) {
  if (env.ANNOTATIONS_KV) {
    return await env.ANNOTATIONS_KV.get(key, "json");
  }
  return memoryStorage.get(key) || null;
}

async function putStoredJson(env, key, value) {
  if (env.ANNOTATIONS_KV) {
    await env.ANNOTATIONS_KV.put(key, JSON.stringify(value));
  } else {
    memoryStorage.set(key, value);
  }
}

async function deleteStored(env, key) {
  if (env.ANNOTATIONS_KV) {
    await env.ANNOTATIONS_KV.delete(key);
  } else {
    memoryStorage.delete(key);
  }
}

/**
 * Recomputes global summary across all papers for table badges & instructor view
 */
async function rebuildGlobalSummary(env) {
  const papers = {};
  const notes = [];

  let keys = [];
  if (env.ANNOTATIONS_KV) {
    const list = await env.ANNOTATIONS_KV.list({ prefix: "paper:" });
    keys = (list && list.keys ? list.keys.map((k) => k.name) : []);
  } else {
    keys = Array.from(memoryStorage.keys()).filter((k) => k.startsWith("paper:"));
  }

  for (const key of keys) {
    const paperId = key.replace(/^paper:/, "");
    try {
      const doc = await getStoredJson(env, key);
      if (doc && Array.isArray(doc.annotations)) {
        const docAnns = doc.annotations;
        const activeNotes = docAnns.filter((a) => a.type === "sticky-note" && a.status !== "deleted");
        const authors = [...new Set(docAnns.map((a) => a.createdBy).filter(Boolean))];

        papers[paperId] = {
          count: activeNotes.length,
          totalAnnotations: docAnns.length,
          authors,
          updatedAt: doc.updatedAt || new Date().toISOString(),
        };

        for (const n of docAnns) {
          if (n.type === "sticky-note") {
            notes.push({
              id: n.id,
              paperId,
              page: n.page,
              title: n.title,
              text: n.text,
              status: n.status || "active",
              createdBy: n.createdBy,
              createdAt: n.createdAt,
              deletedBy: n.deletedBy,
              deletedAt: n.deletedAt,
            });
          }
        }
      }
    } catch (_e) {}
  }

  const payload = {
    papers,
    notes,
    generatedAt: new Date().toISOString(),
    provider: "cloudflare-kv",
  };

  await putStoredJson(env, "summary", payload);
  return payload;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";
    const method = request.method;

    // Handle CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: applyCorsHeaders(),
      });
    }

    // Health check
    if (pathname === "/api/health" || pathname === "/health" || pathname === "/") {
      return jsonResponse({
        status: "ok",
        service: "Wastewater Annotations API",
        provider: "Cloudflare Workers",
        hasKV: Boolean(env.ANNOTATIONS_KV),
        time: new Date().toISOString(),
      });
    }

    // 1. GET /api/annotations -> Global Summary for Table Badges & Instructor Mode
    if (pathname === "/api/annotations" && method === "GET") {
      try {
        let summary = await getStoredJson(env, "summary");
        if (!summary || !summary.papers) {
          summary = await rebuildGlobalSummary(env);
        }
        return jsonResponse(summary);
      } catch (err) {
        return jsonResponse({ error: err.message || "Failed to load summary", papers: {}, notes: [] }, 500);
      }
    }

    // 2. /api/annotations/:paperId
    const paperMatch = pathname.match(/^\/api\/annotations\/([^/]+)$/);
    if (paperMatch) {
      const paperId = decodeURIComponent(paperMatch[1]);

      // GET /api/annotations/:paperId -> Retrieve annotations for this paper
      if (method === "GET") {
        try {
          const doc = await getStoredJson(env, `paper:${paperId}`);
          if (doc) {
            return jsonResponse({
              paperId,
              version: Number(doc.version || 1),
              revision: doc.revision || null,
              updatedAt: doc.updatedAt || null,
              updatedBy: doc.updatedBy || null,
              annotations: Array.isArray(doc.annotations) ? doc.annotations : [],
            });
          }
          // Empty document default
          return jsonResponse({
            paperId,
            version: 1,
            revision: null,
            updatedAt: null,
            updatedBy: null,
            annotations: [],
          });
        } catch (err) {
          return jsonResponse({ error: err.message }, 500);
        }
      }

      // POST /api/annotations/:paperId -> Save annotations (with full multi-line highlight boxes)
      if (method === "POST") {
        try {
          const body = await request.json().catch(() => null);
          if (!body || typeof body !== "object") {
            return jsonResponse({ error: "Invalid JSON request body" }, 400);
          }

          if (body.paperId && String(body.paperId) !== paperId) {
            return jsonResponse({ error: "paperId in payload does not match URL path" }, 400);
          }

          if (!Array.isArray(body.annotations)) {
            return jsonResponse({ error: "annotations must be an array" }, 400);
          }

          // Validate and normalize each annotation, keeping multi-line boxes and full text
          const ids = new Set();
          const normalizedAnnotations = body.annotations.map((ann, idx) => {
            const norm = normalizeAnnotation(ann, idx);
            if (ids.has(norm.id)) {
              throw new Error(`Duplicate annotation ID: ${norm.id}`);
            }
            ids.add(norm.id);
            return norm;
          });

          const currentDoc = await getStoredJson(env, `paper:${paperId}`);
          const currentRev = currentDoc ? currentDoc.revision : null;
          const expectedRev = body.revision || null;

          // Conflict detection (optional optimistic concurrency)
          if (expectedRev && currentRev && expectedRev !== currentRev) {
            return jsonResponse({
              error: "annotation_conflict",
              message: "Remote annotations changed. Reload to sync with latest version.",
              revision: currentRev,
              annotations: currentDoc.annotations || [],
            }, 409);
          }

          const author = (typeof body.author === "string" && body.author.trim())
            ? body.author.trim().slice(0, 80)
            : "Team Contributor";

          const newRevision = `rev-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
          const savedDocument = {
            paperId,
            version: 1,
            revision: newRevision,
            updatedAt: new Date().toISOString(),
            updatedBy: author,
            annotations: normalizedAnnotations,
          };

          // Save paper document into KV
          await putStoredJson(env, `paper:${paperId}`, savedDocument);

          // Update summary asynchronously or inline
          ctx.waitUntil(rebuildGlobalSummary(env));

          return jsonResponse(savedDocument, 200);
        } catch (err) {
          return jsonResponse({ error: err.message }, 400);
        }
      }

      // DELETE /api/annotations/:paperId
      if (method === "DELETE") {
        await deleteStored(env, `paper:${paperId}`);
        ctx.waitUntil(rebuildGlobalSummary(env));
        return jsonResponse({ success: true, message: `Annotations for paper ${paperId} deleted` });
      }

      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    return jsonResponse({ error: "Not found" }, 404);
  },
};
