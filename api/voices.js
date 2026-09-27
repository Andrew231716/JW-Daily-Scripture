const { ITALIAN_NEURAL_VOICES, DEFAULT_VOICE } = require("../lib/voices");

module.exports = async function handler(_req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.status(200).json({
    engine: "edge-neural",
    free: true,
    defaultVoice: DEFAULT_VOICE,
    voices: ITALIAN_NEURAL_VOICES,
    siriHint:
      "Per Siri usa URL → Ottieni contenuto di URL → Pronuncia testo con /api/daily-speak.",
  });
};
