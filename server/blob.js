let blobModulePromise;

function getBlobModule() {
  if (!blobModulePromise) {
    blobModulePromise = import("@vercel/blob");
  }
  return blobModulePromise;
}

function blobEtag(result) {
  const value = result && (result.etag || (result.blob && result.blob.etag));
  return value ? String(value) : null;
}

async function streamToText(stream) {
  if (!stream) return "";
  if (typeof Response !== "undefined") {
    return new Response(stream).text();
  }

  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function getJsonBlob(pathname) {
  const { get } = await getBlobModule();
  const result = await get(pathname, {
    access: "private",
    useCache: false,
  });
  if (!result || result.statusCode === 404) return null;
  if (result.statusCode && result.statusCode !== 200 && result.statusCode !== 206) {
    const error = new Error("Vercel Blob returned HTTP " + result.statusCode);
    error.status = result.statusCode;
    throw error;
  }

  const text = await streamToText(result.stream);
  let document;
  try {
    document = JSON.parse(text);
  } catch (_error) {
    const error = new Error("Invalid JSON in Vercel Blob " + pathname);
    error.status = 502;
    throw error;
  }

  return {
    document,
    revision: blobEtag(result),
  };
}

async function putJsonBlob(pathname, document, options = {}) {
  const { put } = await getBlobModule();
  return put(pathname, JSON.stringify(document, null, 2) + "\n", {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...options,
  });
}

function hasBlobToken() {
  return Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || "").trim());
}

function isBlobConflict(error) {
  const status = Number(error && (error.status || error.statusCode));
  const code = String(error && (error.code || error.name || error.message) || "");
  return status === 409 || status === 412 || /conflict|precondition|if.?match/i.test(code);
}

module.exports = {
  blobEtag,
  getJsonBlob,
  hasBlobToken,
  isBlobConflict,
  putJsonBlob,
};
