module.exports = async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  res.writeHead(302, {
    Location: `${proto}://${host}/api/daily-speak`,
  });
  res.end();
};
