const {
  applyCors,
  clearCookie,
  getGithubUser,
  json,
  readSession,
} = require("../../server/github");

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

  const session = readSession(req);
  if (!session) return json(res, 200, { authenticated: false });

  try {
    const user = await getGithubUser(session.token);
    return json(res, 200, {
      authenticated: true,
      user: {
        login: user.login || session.login,
        name: user.name || session.name || user.login || session.login,
        avatarUrl: user.avatar_url || session.avatarUrl || "",
        permission: session.permission || "push",
      },
    });
  } catch (error) {
    clearCookie(res, "leedpdf_session");
    return json(res, 200, { authenticated: false });
  }
};
