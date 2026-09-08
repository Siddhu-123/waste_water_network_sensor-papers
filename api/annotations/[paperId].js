const {
  annotationPath,
  applyCors,
  getCollaboratorPermission,
  getRepositoryFile,
  json,
  normalizeAnnotations,
  parseBody,
  putRepositoryFile,
  readSession,
} = require("../../server/github");

const WRITE_PERMISSIONS = new Set(["admin", "maintain", "push"]);

function emptyDocument(paperId) {
  return {
    paperId,
    version: 1,
    revision: null,
    annotations: [],
  };
}

function publicDocument(paperId, file) {
  const document = file && file.document && typeof file.document === "object"
    ? file.document
    : {};
  return {
    paperId,
    version: Number(document.version || 1),
    revision: file && file.sha ? file.sha : null,
    updatedAt: document.updatedAt || null,
    updatedBy: document.updatedBy || null,
    annotations: Array.isArray(document.annotations)
      ? document.annotations
      : [],
  };
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

  try {
    if (req.method === "GET") {
      const file = await getRepositoryFile(identity.path);
      return json(
        res,
        200,
        file ? publicDocument(identity.paperId, file) : emptyDocument(identity.paperId),
      );
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET,POST,OPTIONS");
      return json(res, 405, { error: "Method not allowed" });
    }

    const session = readSession(req);
    if (!session) {
      return json(res, 401, {
        error: "authentication_required",
        message: "Sign in with GitHub before saving shared annotations.",
      });
    }

    const permission = await getCollaboratorPermission(session.login, session.token);
    if (!WRITE_PERMISSIONS.has(permission)) {
      return json(res, 403, {
        error: "write_access_required",
        message: "Your GitHub account needs push access to this repository.",
      });
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

    const currentFile = await getRepositoryFile(identity.path);
    const currentRevision = currentFile && currentFile.sha ? currentFile.sha : null;
    const hasExpectedRevision = Object.prototype.hasOwnProperty.call(body, "revision");
    const expectedRevision = body.revision || null;
    if (
      (hasExpectedRevision || currentRevision) &&
      currentRevision !== expectedRevision
    ) {
      const current = currentFile
        ? publicDocument(identity.paperId, currentFile)
        : emptyDocument(identity.paperId);
      return json(res, 409, {
        error: "annotation_conflict",
        message: "This paper's shared annotations changed. Reload them before saving.",
        ...current,
      });
    }

    const nextDocument = {
      paperId: identity.paperId,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: session.login,
      annotations,
    };
    const result = await putRepositoryFile(
      identity.path,
      JSON.stringify(nextDocument, null, 2) + "\n",
      currentRevision,
      session.token,
      "Update shared PDF annotations for paper " + identity.paperId,
    );

    return json(res, currentRevision ? 200 : 201, {
      ...nextDocument,
      revision:
        result && result.content && result.content.sha
          ? result.content.sha
          : null,
    });
  } catch (error) {
    console.error("Annotation API error:", error);
    if (error.status === 401 || error.status === 403) {
      return json(res, 403, {
        error: "github_write_failed",
        message: "GitHub rejected the write. Check repository permissions.",
      });
    }
    if (error.status === 409 || error.status === 422) {
      return json(res, 409, {
        error: "annotation_conflict",
        message: "GitHub changed the file while it was being saved. Reload and try again.",
      });
    }
    return json(res, 500, {
      error: "annotation_service_error",
      message: "The shared annotation service is temporarily unavailable.",
    });
  }
};
