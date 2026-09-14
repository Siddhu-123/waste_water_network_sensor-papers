const {
  applyCors,
  clearCookie,
  json,
} = require("../../server/github");

module.exports = function handler(req, res) {
  applyCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST,OPTIONS");
    return json(res, 405, { error: "Method not allowed" });
  }
  clearCookie(res, "leedpdf_session");
  return json(res, 200, { authenticated: false });
};
