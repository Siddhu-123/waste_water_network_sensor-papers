let blobModulePromise;

function getBlobModule() {
  if (!blobModulePromise) {
    blobModulePromise = import("@vercel/blob");
  }
  return blobModulePromise;
}

function cleanEtag(val) {
  if (!val) return null;
  const str = String(val).trim();
  const unquoted = str.replace(/^W\//i, "").trim().replace(/^"+|"+$/g, "").trim();
  return unquoted ? `"${unquoted}"` : null;
}

function blobEtag(result) {
  const value = result && (result.etag || (result.blob && result.blob.etag));
  return cleanEtag(value);
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

async function retryOperation(fn, retries = 2, delayMs = 300) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (isBlobConflict(err) || (err && (err.status === 400 || err.status === 401 || err.status === 403 || err.status === 404))) {
        throw err;
      }
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

async function getJsonBlob(pathname) {
  return retryOperation(async () => {
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
  });
}

async function putJsonBlob(pathname, document, options = {}) {
  const { put } = await getBlobModule();
  const payload = JSON.stringify(document, null, 2) + "\n";
  return retryOperation(() => put(pathname, payload, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60,
    ...options,
  }));
}

function hasBlobToken() {
  return Boolean(String(process.env.BLOB_READ_WRITE_TOKEN || "").trim());
}

function isBlobConflict(error) {
  if (!error) return false;
  const status = Number(error.status || error.statusCode);
  if (status === 409 || status === 412) return true;
  const fullText = `${error.code || ""} ${error.name || ""} ${error.message || ""}`;
  return /conflict|precondition|if.?match|etag mismatch|BlobPreconditionFailed/i.test(fullText);
}

async function listBlobs(prefix) {
  const { list } = await getBlobModule();
  return list({ prefix, access: "private" });
}

module.exports = {
  blobEtag,
  cleanEtag,
  getJsonBlob,
  hasBlobToken,
  isBlobConflict,
  listBlobs,
  putJsonBlob,
};
