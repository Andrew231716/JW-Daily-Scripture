const { fetchDailyText } = require("../lib/dailyText");

module.exports = async function handler(_req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (_req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const daily = await fetchDailyText();
    const text = daily.speakText || `${daily.title}. ${daily.scripture}. ${daily.body}`;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
    res.status(200).send(text);
  } catch (error) {
    console.error(error);
    res.status(502).send("Impossibile ottenere il testo del giorno");
  }
};
