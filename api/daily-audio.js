const { fetchDailyText } = require("../lib/dailyText");
const { synthesizeSpeech } = require("../lib/tts");
const { resolveVoice, DEFAULT_VOICE } = require("../lib/voices");
const { sendMp3 } = require("../lib/sendMp3");

const audioCache = new Map();

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range");
    res.status(204).end();
    return;
  }

  try {
    const url = new URL(req.url, "http://localhost");
    const voice = resolveVoice(url.searchParams.get("voice") || DEFAULT_VOICE);
    const daily = await fetchDailyText();
    const cacheKey = `${daily.date}:${voice}`;

    let payload = audioCache.get(cacheKey);
    if (!payload) {
      const spoken = await synthesizeSpeech(daily.speakText, voice);
      payload = {
        buffer: spoken.buffer,
        voice: spoken.voice,
        date: daily.date,
      };
      audioCache.set(cacheKey, payload);
      if (audioCache.size > 24) {
        const first = audioCache.keys().next().value;
        audioCache.delete(first);
      }
    }

    sendMp3(req, res, payload.buffer, { voice: payload.voice, date: payload.date });
  } catch (error) {
    console.error(error);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end(
      JSON.stringify({
        error: "Impossibile generare l’audio del giorno",
        detail: String(error.message || error),
      })
    );
  }
};
