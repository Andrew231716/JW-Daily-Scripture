module.exports = async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const voice = "it-IT-IsabellaNeural";
  res.writeHead(302, {
    Location: `${proto}://${host}/api/daily-audio?voice=${encodeURIComponent(voice)}`,
  });
  res.end();
};
