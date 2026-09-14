const {
  applyCors,
  callbackUrl,
  clearCookie,
  getCollaboratorPermission,
  getGithubUser,
  githubRequest,
  isAllowedReturnTo,
  json,
  readOAuthState,
  redirect,
  saveSession,
} = require("../../../server/github");

function redirectWithStatus(returnTo, key, value) {
  let target;
  try {
    target = new URL(returnTo);
  } catch (_error) {
    return returnTo;
  }
  target.searchParams.set(key, value);
  return target.toString();
}

module.exports = async function handler(req, res) {
  applyCors(req, res);
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  const oauthState = readOAuthState(req);
  clearCookie(res, "leedpdf_oauth_state");
  const query = req.query || {};
  const returnTo = isAllowedReturnTo(oauthState && oauthState.returnTo, req);

  if (query.error) {
    return redirect(
      res,
      redirectWithStatus(returnTo, "auth", "cancelled"),
    );
  }
  if (
    !oauthState ||
    !query.state ||
    String(query.state) !== String(oauthState.state) ||
    !query.code
  ) {
    return json(res, 400, {
      error: "oauth_state_invalid",
      message: "GitHub sign-in could not be verified. Start again.",
    });
  }

  try {
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "wastewater-research-library",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: String(query.code),
          redirect_uri: callbackUrl(req),
        }),
      },
    );
    const tokenBody = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenBody.access_token) {
      throw new Error("GitHub did not return an access token");
    }

    const user = await getGithubUser(tokenBody.access_token);
    const login = String(user.login || "").trim();
    if (!login) throw new Error("GitHub user profile is missing a login");

    const permission = await getCollaboratorPermission(
      login,
      tokenBody.access_token,
    );
    if (!["admin", "maintain", "push"].includes(permission)) {
      return redirect(
        res,
        redirectWithStatus(returnTo, "auth", "no-access"),
      );
    }

    saveSession(res, {
      token: tokenBody.access_token,
      login,
      name: user.name || login,
      avatarUrl: user.avatar_url || "",
      permission,
    });
    return redirect(
      res,
      redirectWithStatus(returnTo, "auth", "success"),
    );
  } catch (error) {
    console.error("GitHub OAuth callback error:", error);
    return redirect(
      res,
      redirectWithStatus(returnTo, "auth", "error"),
    );
  }
};
