const { DEFAULT_VOICE, resolveVoice } = require("../lib/voices");

module.exports = async function handler(req, res) {
  const url = new URL(req.url, "https://localhost");
  const voice = resolveVoice(url.searchParams.get("voice") || DEFAULT_VOICE);
  res.redirect(302, `/api/daily-audio?voice=${encodeURIComponent(voice)}`);
};
