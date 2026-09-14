const { applyCors, json } = require("../../server/github");
const { getJsonBlob, hasBlobToken, listBlobs, putJsonBlob } = require("../../server/blob");

const SUMMARY_PATH = "annotations/summary.json";

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET,OPTIONS");
    return json(res, 405, { error: "Method not allowed" });
  }

  if (!hasBlobToken()) {
    return json(res, 200, {
      papers: {},
      notes: [],
      message: "Vercel blob storage not configured",
    });
  }

  try {
    const summaryStored = await getJsonBlob(SUMMARY_PATH);
    if (summaryStored && summaryStored.document && typeof summaryStored.document === "object") {
      return json(res, 200, summaryStored.document);
    }

    const { blobs } = await listBlobs("annotations/paper-");
    const papers = {};
    const notes = [];

    if (Array.isArray(blobs)) {
      for (const blob of blobs) {
        const match = blob.pathname.match(/annotations\/paper-(.+)\.json$/);
        if (!match) continue;
        const paperId = match[1];

        try {
          const docStored = await getJsonBlob(blob.pathname);
          if (docStored && docStored.document) {
            const doc = docStored.document;
            const docAnns = Array.isArray(doc.annotations) ? doc.annotations : [];
            const activeNotes = docAnns.filter((a) => a.type === "sticky-note" && a.status !== "deleted");
            const authors = [...new Set(docAnns.map((a) => a.createdBy).filter(Boolean))];

            papers[paperId] = {
              count: activeNotes.length,
              totalAnnotations: docAnns.length,
              authors,
              updatedAt: doc.updatedAt || blob.uploadedAt,
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
        } catch (_err) {}
      }
    }

    const payload = { papers, notes, generatedAt: new Date().toISOString() };
    try {
      await putJsonBlob(SUMMARY_PATH, payload);
    } catch (_e) {}

    return json(res, 200, payload);
  } catch (error) {
    console.error("Annotations summary API error:", error);
    return json(res, 500, {
      papers: {},
      notes: [],
      error: error.message || "Failed to fetch annotations summary",
    });
  }
};