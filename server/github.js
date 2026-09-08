const crypto = require("node:crypto");

const SESSION_COOKIE = "leedpdf_session";
const OAUTH_STATE_COOKIE = "leedpdf_oauth_state";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const OAUTH_STATE_TTL_SECONDS = 60 * 10;
const DEFAULT_REPOSITORY = "Siddhu-123/waste_water_network_sensor-papers";
const DEFAULT_BRANCH = "main";

function configuredOrigins() {
  const values = [
    process.env.ALLOWED_ORIGINS,
    process.env.FRONTEND_ORIGIN,
    process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "",
    process.env.VERCEL_BRANCH_URL
      ? "https://" + process.env.VERCEL_BRANCH_URL
      : "",
    "https://siddhu-123.github.io",
    "http://localhost:4173",
    "http://localhost:8000",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:8000",
  ];

  return [
    ...new Set(
      values
        .flatMap((value) => String(value || "").split(","))
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          try {
            return new URL(value).origin;
          } catch (_error) {
            return "";
          }
        })
        .filter(Boolean),
    ),
  ];
}

function requestOrigin(req) {
  const protocol = String(
    req.headers["x-forwarded-proto"] || "https",
  ).split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return protocol + "://" + host;
}

function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && configuredOrigins().includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "600");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function getRepository() {
  const value = String(
    process.env.GITHUB_REPOSITORY || DEFAULT_REPOSITORY,
  ).trim();
  const match = value.match(/^([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error("GITHUB_REPOSITORY must use the owner/repository format");
  }
  return { owner: match[1], repository: match[2] };
}

function getBranch() {
  const branch = String(process.env.GITHUB_BRANCH || DEFAULT_BRANCH).trim();
  if (!/^[A-Za-z0-9._/-]+$/.test(branch)) {
    throw new Error("GITHUB_BRANCH contains unsupported characters");
  }
  return branch;
}

function encodePath(path) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}

function annotationPath(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  let paperId = String(raw || "").trim();
  try {
    paperId = decodeURIComponent(paperId);
  } catch (_error) {
    throw new Error("Invalid paper ID");
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/.test(paperId)) {
    throw new Error("Invalid paper ID");
  }
  return {
    paperId,
    path: "annotations/paper-" + paperId + ".json",
  };
}

function githubContentsEndpoint(path) {
  const { owner, repository } = getRepository();
  const branch = encodeURIComponent(getBranch());
  return (
    "https://api.github.com/repos/" +
    encodeURIComponent(owner) +
    "/" +
    encodeURIComponent(repository) +
    "/contents/" +
    encodePath(path) +
    "?ref=" +
    branch
  );
}

async function githubRequest(endpoint, options = {}) {
  const { token, headers: extraHeaders, ...fetchOptions } = options;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "wastewater-research-library",
    ...(extraHeaders || {}),
  };
  if (token) headers.Authorization = "Bearer " + token;

  const response = await fetch(endpoint, {
    ...fetchOptions,
    headers,
  });
  const responseText = await response.text();
  let body = null;
  try {
    body = responseText ? JSON.parse(responseText) : null;
  } catch (_error) {
    body = responseText;
  }

  if (!response.ok) {
    const error = new Error(
      body && typeof body === "object" && body.message
        ? body.message
        : "GitHub API returned HTTP " + response.status,
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

async function getRepositoryFile(path, token = "") {
  try {
    const body = await githubRequest(githubContentsEndpoint(path), { token });
    if (!body || body.type !== "file") {
      throw new Error("GitHub path is not a file: " + path);
    }
    const encoded = String(body.content || "").replace(/\s+/g, "");
    const text = Buffer.from(encoded, "base64").toString("utf8");
    let document;
    try {
      document = JSON.parse(text);
    } catch (_error) {
      const error = new Error("Invalid JSON in " + path);
      error.status = 502;
      throw error;
    }
    return { sha: body.sha || null, document, text };
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function putRepositoryFile(path, content, sha, token, message) {
  const endpoint = githubContentsEndpoint(path).split("?")[0];
  const payload = {
    message,
    content: Buffer.from(content, "utf8").toString("base64"),
    branch: getBranch(),
  };
  if (sha) payload.sha = sha;

  return githubRequest(endpoint, {
    method: "PUT",
    token,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function getGithubUser(token) {
  return githubRequest("https://api.github.com/user", { token });
}

async function getCollaboratorPermission(login, token) {
  const { owner, repository } = getRepository();
  const endpoint =
    "https://api.github.com/repos/" +
    encodeURIComponent(owner) +
    "/" +
    encodeURIComponent(repository) +
    "/collaborators/" +
    encodeURIComponent(login) +
    "/permission";
  try {
    const body = await githubRequest(endpoint, { token });
    return String(body && body.permission ? body.permission : "none");
  } catch (error) {
    if (error.status === 404) return "none";
    throw error;
  }
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function encryptionKey() {
  const secret = String(process.env.SESSION_SECRET || "");
  if (secret.length < 32) {
    const error = new Error("SESSION_SECRET must be at least 32 characters");
    error.status = 500;
    throw error;
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function seal(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [
    base64UrlEncode(iv),
    base64UrlEncode(authTag),
    base64UrlEncode(ciphertext),
  ].join(".");
}

function unseal(value) {
  try {
    const [ivValue, tagValue, ciphertextValue] = String(value).split(".");
    if (!ivValue || !tagValue || !ciphertextValue) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      base64UrlDecode(ivValue),
    );
    decipher.setAuthTag(base64UrlDecode(tagValue));
    const plaintext = Buffer.concat([
      decipher.update(base64UrlDecode(ciphertextValue)),
      decipher.final(),
    ]).toString("utf8");
    return JSON.parse(plaintext);
  } catch (_error) {
    return null;
  }
}

function parseCookies(req) {
  const header = String(req.headers.cookie || "");
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separator = part.indexOf("=");
        if (separator < 0) return [part, ""];
        return [
          part.slice(0, separator),
          decodeURIComponent(part.slice(separator + 1)),
        ];
      }),
  );
}

function cookieAttributes(maxAge) {
  const isProduction =
    process.env.VERCEL === "1" || process.env.NODE_ENV === "production";
  const sameSite = isProduction ? "None" : "Lax";
  return (
    "Path=/; Max-Age=" +
    maxAge +
    "; HttpOnly; SameSite=" +
    sameSite +
    (isProduction ? "; Secure" : "")
  );
}

function appendCookie(res, value) {
  const current = res.getHeader("Set-Cookie");
  const cookies = Array.isArray(current)
    ? current
    : current
      ? [current]
      : [];
  res.setHeader("Set-Cookie", [...cookies, value]);
}

function setCookie(res, name, value, maxAge) {
  appendCookie(
    res,
    name + "=" + encodeURIComponent(value) + "; " + cookieAttributes(maxAge),
  );
}

function clearCookie(res, name) {
  appendCookie(
    res,
    name +
      "=; " +
      cookieAttributes(0) +
      "; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
  );
}

function saveSession(res, session) {
  setCookie(
    res,
    SESSION_COOKIE,
    seal({
      ...session,
      expiresAt: Date.now() + SESSION_TTL_SECONDS * 1000,
    }),
    SESSION_TTL_SECONDS,
  );
}

function readSession(req) {
  const value = parseCookies(req)[SESSION_COOKIE];
  const session = value ? unseal(value) : null;
  if (!session || !session.token || Number(session.expiresAt) < Date.now()) {
    return null;
  }
  return session;
}

function saveOAuthState(res, state, returnTo) {
  setCookie(
    res,
    OAUTH_STATE_COOKIE,
    seal({
      state,
      returnTo,
      expiresAt: Date.now() + OAUTH_STATE_TTL_SECONDS * 1000,
    }),
    OAUTH_STATE_TTL_SECONDS,
  );
}

function readOAuthState(req) {
  const value = parseCookies(req)[OAUTH_STATE_COOKIE];
  const state = value ? unseal(value) : null;
  if (!state || Number(state.expiresAt) < Date.now()) return null;
  return state;
}

function clearAuthCookies(res) {
  clearCookie(res, SESSION_COOKIE);
  clearCookie(res, OAUTH_STATE_COOKIE);
}

function isAllowedReturnTo(value, req) {
  const fallback =
    process.env.PUBLIC_APP_URL ||
    req.headers.origin ||
    "https://siddhu-123.github.io/waste_water_network_sensor_papers/";
  let candidate;
  try {
    candidate = new URL(value || fallback, fallback);
  } catch (_error) {
    return fallback;
  }
  return configuredOrigins().includes(candidate.origin)
    ? candidate.toString()
    : fallback;
}

function callbackUrl(req) {
  return (
    process.env.GITHUB_CALLBACK_URL ||
    requestOrigin(req) +
      "/api/auth/github/callback"
  );
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_error) {
      return null;
    }
  }
  return null;
}

function numberInRange(value, min, max) {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
}

function normalizeAnnotation(value, index) {
  if (!value || typeof value !== "object") {
    throw new Error("Annotation " + (index + 1) + " must be an object");
  }
  const type = value.type === "sticky-note" ? "sticky-note" : value.type;
  if (type !== "highlight" && type !== "sticky-note") {
    throw new Error("Annotation " + (index + 1) + " has an unsupported type");
  }
  const id = String(value.id || "").trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/.test(id)) {
    throw new Error("Annotation " + (index + 1) + " has an invalid ID");
  }
  const page = Number(value.page ?? value.pageNumber);
  const x = Number(value.x ?? value.relativeX);
  const y = Number(value.y ?? value.relativeY);
  if (!Number.isInteger(page) || page < 1 || page > 10000) {
    throw new Error("Annotation " + (index + 1) + " has an invalid page");
  }
  if (!numberInRange(x, 0, 1) || !numberInRange(y, 0, 1)) {
    throw new Error("Annotation " + (index + 1) + " has invalid coordinates");
  }

  const normalized = {
    id,
    type,
    page,
    x,
    y,
    createdBy: String(value.createdBy || "Unknown contributor").slice(0, 120),
    createdAt: String(
      value.createdAt || new Date().toISOString(),
    ).slice(0, 40),
  };

  if (type === "highlight") {
    const width = Number(value.width);
    const height = Number(value.height);
    const color = String(value.color || "#ffdf5d");
    const opacity = Number(value.opacity ?? 0.4);
    if (
      !numberInRange(width, 0.001, 1) ||
      !numberInRange(height, 0.001, 1) ||
      x + width > 1 ||
      y + height > 1 ||
      !/^#[0-9a-f]{6}$/i.test(color) ||
      !numberInRange(opacity, 0.05, 1)
    ) {
      throw new Error(
        "Annotation " + (index + 1) + " has invalid highlight data",
      );
    }
    normalized.width = width;
    normalized.height = height;
    normalized.color = color;
    normalized.opacity = opacity;
  } else {
    const text = String(value.text || "").trim();
    if (!text || text.length > 2000) {
      throw new Error("Annotation " + (index + 1) + " has invalid note text");
    }
    normalized.text = text;
    if (value.title && typeof value.title === "string") {
      normalized.title = value.title.trim().slice(0, 100);
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
    if (value.deletedDevice && typeof value.deletedDevice === "string") {
      normalized.deletedDevice = value.deletedDevice.trim().slice(0, 100);
    }
    normalized.width = numberInRange(value.width, 0.01, 0.2)
      ? Number(value.width)
      : 0.06;
    normalized.height = numberInRange(value.height, 0.01, 0.2)
      ? Number(value.height)
      : 0.06;
    normalized.color = /^#[0-9a-f]{6}$/i.test(String(value.color || ""))
      ? String(value.color)
      : "#ffd166";
  }
  return normalized;
}

function normalizeAnnotations(value) {
  if (!Array.isArray(value)) throw new Error("annotations must be an array");
  if (value.length > 500) {
    throw new Error("A paper can have at most 500 annotations");
  }
  const ids = new Set();
  return value.map((annotation, index) => {
    const normalized = normalizeAnnotation(annotation, index);
    if (ids.has(normalized.id)) {
      throw new Error("Duplicate annotation ID: " + normalized.id);
    }
    ids.add(normalized.id);
    return normalized;
  });
}

module.exports = {
  OAUTH_STATE_COOKIE,
  applyCors,
  annotationPath,
  callbackUrl,
  clearAuthCookies,
  clearCookie,
  getCollaboratorPermission,
  getGithubUser,
  getRepositoryFile,
  isAllowedReturnTo,
  json,
  githubRequest,
  normalizeAnnotations,
  parseBody,
  readOAuthState,
  readSession,
  redirect,
  requestOrigin,
  saveOAuthState,
  saveSession,
  putRepositoryFile,
};
