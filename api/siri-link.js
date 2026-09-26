const { resolveVoice, DEFAULT_VOICE } = require("../lib/voices");

module.exports = async function handler(req, res) {
  const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const urlObj = new URL(req.url, `http://${host}`);
  const voice = resolveVoice(urlObj.searchParams.get("voice") || DEFAULT_VOICE);
  res.status(200).json({
    url: `${proto}://${host}/api/daily-audio?voice=${encodeURIComponent(voice)}`,
    playerUrl: `${proto}://${host}/play.html?voice=${encodeURIComponent(voice)}`,
    audioUrl: `${proto}://${host}/api/daily-audio?voice=${encodeURIComponent(voice)}`,
    speakUrl: `${proto}://${host}/api/daily-speak`,
    phrase: "leggi scrittura del giorno",
    shortcutName: "leggi scrittura del giorno",
    voice,
  });
};
