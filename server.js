const express = require("express");
const path = require("path");
const { fetchDailyText } = require("./lib/dailyText");
const { synthesizeSpeech } = require("./lib/tts");
const { ITALIAN_NEURAL_VOICES, DEFAULT_VOICE, resolveVoice } = require("./lib/voices");
const { sendMp3 } = require("./lib/sendMp3");
const pushConfigHandler = require("./api/push-config");
const pushSubscriptionsHandler = require("./api/push-subscriptions");
const pushCronHandler = require("./api/push-cron");

const PORT = process.env.PORT || 3847;
const app = express();
const publicDir = path.join(__dirname, "public");
const audioCache = new Map();

app.get("/api/push-config", pushConfigHandler);
app.all("/api/push-subscriptions", express.json(), pushSubscriptionsHandler);
app.all("/api/push-cron", pushCronHandler);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "jw-daily-scripture" });
});

app.get("/api/voices", (_req, res) => {
  res.json({
    engine: "edge-neural",
    free: true,
    defaultVoice: DEFAULT_VOICE,
    voices: ITALIAN_NEURAL_VOICES,
  });
});

app.get("/api/daily-text", async (_req, res) => {
  try {
    const payload = await fetchDailyText();
    res.set("Cache-Control", "public, max-age=300");
    res.json(payload);
  } catch (error) {
    console.error(error);
    res.status(502).json({
      error: "Impossibile ottenere il testo del giorno",
      detail: String(error.message || error),
    });
  }
});

app.get("/api/daily-audio", async (req, res) => {
  try {
    const voice = resolveVoice(req.query.voice || DEFAULT_VOICE);
    const daily = await fetchDailyText();
    const cacheKey = `${daily.date}:${voice}`;
    let payload = audioCache.get(cacheKey);
    if (!payload) {
      const spoken = await synthesizeSpeech(daily.speakText, voice);
      payload = { buffer: spoken.buffer, voice: spoken.voice, date: daily.date };
      audioCache.set(cacheKey, payload);
    }
    sendMp3(req, res, payload.buffer, { voice: payload.voice, date: payload.date });
  } catch (error) {
    console.error(error);
    res.status(502).json({
      error: "Impossibile generare l’audio del giorno",
      detail: String(error.message || error),
    });
  }
});

app.get("/api/daily-speak", async (_req, res) => {
  try {
    const daily = await fetchDailyText();
    const text = daily.speakText || `${daily.title}. ${daily.scripture}. ${daily.body}`;
    res.set("Content-Type", "text/plain; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300");
    res.send(text);
  } catch (error) {
    console.error(error);
    res.status(502).type("text/plain").send("Impossibile ottenere il testo del giorno");
  }
});

app.get("/api/siri-link", (req, res) => {
  const host = req.get("x-forwarded-host") || req.get("host") || `localhost:${PORT}`;
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const voice = resolveVoice(req.query.voice || DEFAULT_VOICE);
  res.json({
    url: `${proto}://${host}/api/daily-audio?voice=${encodeURIComponent(voice)}`,
    playerUrl: `${proto}://${host}/play.html?voice=${encodeURIComponent(voice)}`,
    audioUrl: `${proto}://${host}/api/daily-audio?voice=${encodeURIComponent(voice)}`,
    speakUrl: `${proto}://${host}/api/daily-speak`,
    phrase: "leggi scrittura del giorno",
    shortcutName: "leggi scrittura del giorno",
    voice,
  });
});

app.get("/siri", (req, res) => {
  res.redirect(302, "/api/daily-speak");
});

app.get("/google", (req, res) => {
  const voice = resolveVoice(req.query.voice || DEFAULT_VOICE);
  res.redirect(302, `/api/daily-audio?voice=${encodeURIComponent(voice)}`);
});

app.use(express.static(publicDir, { maxAge: "1h" }));

app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`JW Daily Scripture in ascolto su http://localhost:${PORT}`);
  });
}
