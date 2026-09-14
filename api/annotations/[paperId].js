const {
  annotationPath,
  applyCors,
  json,
  normalizeAnnotations,
  parseBody,
  readSession,
} = require("../../server/github");
const {
  blobEtag,
  cleanEtag,
  getJsonBlob,
  hasBlobToken,
  isBlobConflict,
  putJsonBlob,
} = require("../../server/blob");

function emptyDocument(paperId) {
  return {
    paperId,
    version: 1,
    revision: null,
    updatedAt: null,
    updatedBy: null,
    annotations: [],
  };
}

function publicDocument(paperId, stored, revision) {
  const document = stored && stored.document && typeof stored.document === "object"
    ? stored.document
    : {};
  let annotations = [];
  try {
    annotations = normalizeAnnotations(
      Array.isArray(document.annotations) ? document.annotations : [],
    );
  } catch (error) {
    error.status = 502;
    throw error;
  }
  return {
    paperId,
    version: Number(document.version || 1),
    revision: revision || null,
    updatedAt: document.updatedAt || null,
    updatedBy: document.updatedBy || null,
    annotations,
  };
}

async function readCurrentDocument(pathname, paperId) {
  const stored = await getJsonBlob(pathname);
  return stored
    ? publicDocument(paperId, stored, stored.revision)
    : emptyDocument(paperId);
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  let identity;
  try {
    identity = annotationPath(req.query && req.query.paperId);
  } catch (error) {
    return json(res, 400, { error: error.message });
  }

  if (!hasBlobToken()) {
    return json(res, 503, {
      error: "annotation_storage_not_configured",
      message: "Connect the Vercel Blob store before using shared annotations.",
    });
  }

  try {
    if (req.method === "GET") {
      return json(res, 200, await readCurrentDocument(identity.path, identity.paperId));
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET,POST,OPTIONS");
      return json(res, 405, { error: "Method not allowed" });
    }

    const body = parseBody(req);
    if (!body || (body.paperId && String(body.paperId) !== identity.paperId)) {
      return json(res, 400, { error: "paperId does not match the request path" });
    }

    let annotations;
    try {
      annotations = normalizeAnnotations(body.annotations);
    } catch (error) {
      return json(res, 400, { error: error.message });
    }

    const currentStored = await getJsonBlob(identity.path);
    const currentRevision = currentStored ? cleanEtag(currentStored.revision) : null;
    const hasExpectedRevision = Object.prototype.hasOwnProperty.call(body, "revision");
    const expectedRevision = cleanEtag(body.revision);
    if (
      hasExpectedRevision &&
      expectedRevision &&
      currentRevision &&
      currentRevision !== expectedRevision
    ) {
      const current = currentStored
        ? publicDocument(identity.paperId, currentStored, currentRevision)
        : emptyDocument(identity.paperId);
      return json(res, 409, {
        error: "annotation_conflict",
        message: "This paper's shared annotations changed. Reload them before saving.",
        ...current,
      });
    }

    const session = readSession(req);
    const author = (body && typeof body.author === "string" && body.author.trim())
      ? body.author.trim().slice(0, 50)
      : (session && session.login) || "team";

    const nextDocument = {
      paperId: identity.paperId,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: author,
      annotations,
    };
    let result;
    try {
      result = await putJsonBlob(identity.path, nextDocument, currentRevision
        ? { ifMatch: currentRevision }
        : {});
    } catch (error) {
      if (isBlobConflict(error)) {
        let latestDoc = null;
        try {
          latestDoc = await readCurrentDocument(identity.path, identity.paperId);
        } catch (_e) {}
        return json(res, 409, {
          error: "annotation_conflict",
          message: "Another person saved changes while this was being saved. Reload to get the latest version.",
          ...(latestDoc || {}),
        });
      }
      throw error;
    }

    try {
      const summaryStored = await getJsonBlob("annotations/summary.json");
      const summary = summaryStored && summaryStored.document && typeof summaryStored.document === "object"
        ? summaryStored.document
        : { papers: {}, notes: [] };
      const activeNotes = annotations.filter((a) => a.type === "sticky-note" && a.status !== "deleted");
      const authors = [...new Set(annotations.map((a) => a.createdBy).filter(Boolean))];
      summary.papers = summary.papers || {};
      summary.papers[identity.paperId] = {
        count: activeNotes.length,
        totalAnnotations: annotations.length,
        authors,
        updatedAt: nextDocument.updatedAt,
      };
      summary.notes = (summary.notes || []).filter((n) => String(n.paperId) !== String(identity.paperId));
      for (const n of annotations) {
        if (n.type === "sticky-note") {
          summary.notes.push({
            id: n.id,
            paperId: identity.paperId,
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
      summary.generatedAt = new Date().toISOString();
      await putJsonBlob("annotations/summary.json", summary);
    } catch (_summaryErr) {}

    return json(res, currentRevision ? 200 : 201, {
      ...nextDocument,
      revision: blobEtag(result),
    });
  } catch (error) {
    console.error("Annotation API error:", error);
    if (error.status === 401 || error.status === 403) {
      return json(res, 403, {
        error: "github_write_failed",
        message: "GitHub rejected the access check. Check repository permissions.",
      });
    }
    if (error.status === 409 || error.status === 412 || isBlobConflict(error)) {
      return json(res, 409, {
        error: "annotation_conflict",
        message: "Another person saved changes while this was being saved. Reload and try again.",
      });
    }
    if (error.status === 429) {
      return json(res, 429, {
        error: "rate_limited",
        message: "Too many save requests in a short time. Please wait a moment and try again.",
      });
    }
    if (error.status === 502) {
      return json(res, 502, {
        error: "annotation_data_invalid",
        message: "The shared annotation data is invalid and could not be loaded.",
      });
    }
    return json(res, 503, {
      error: "annotation_service_error",
      message: error.message || "The Vercel annotation storage is temporarily busy or unavailable. Please retry in a moment.",
    });
  }
};
