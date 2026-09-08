const crypto = require("node:crypto");
const {
  applyCors,
  callbackUrl,
  isAllowedReturnTo,
  json,
  redirect,
  saveOAuthState,
} = require("../../server/github");

module.exports = function handler(req, res) {
  applyCors(req, res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return json(res, 405, { error: "Method not allowed" });
  }

  let returnTo = req.query && req.query.returnTo;
  if (Array.isArray(returnTo)) returnTo = returnTo[0];
  returnTo = isAllowedReturnTo(returnTo, req);

  const clientId = String(process.env.GITHUB_CLIENT_ID || "").trim();
  if (!clientId) {
    if (returnTo && (!req.headers.accept || !req.headers.accept.includes("application/json"))) {
      return redirect(res, returnTo);
    }
    return json(res, 200, {
      status: "direct_mode",
      message: "GitHub OAuth is optional. Shared annotations are stored directly in Vercel Blob.",
    });
  }

  try {
    const state = crypto.randomBytes(24).toString("hex");
    saveOAuthState(res, state, returnTo);
    const authorizationUrl = new URL("https://github.com/login/oauth/authorize");
    authorizationUrl.searchParams.set("client_id", clientId);
    authorizationUrl.searchParams.set("redirect_uri", callbackUrl(req));
    authorizationUrl.searchParams.set(
      "scope",
      process.env.GITHUB_OAUTH_SCOPE || "public_repo",
    );
    authorizationUrl.searchParams.set("state", state);
    authorizationUrl.searchParams.set("allow_signup", "true");
    return redirect(res, authorizationUrl.toString());
  } catch (error) {
    console.error("GitHub OAuth start error:", error);
    return json(res, 500, {
      error: "oauth_not_configured",
      message: "Complete the Vercel OAuth environment variables before signing in.",
    });
  }
};
