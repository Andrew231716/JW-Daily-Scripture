const { fetchDailyText } = require("../lib/dailyText");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  try {
    const payload = await fetchDailyText();
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json(payload);
  } catch (error) {
    res.status(502).json({
      error: "Impossibile ottenere il testo del giorno",
      detail: String(error.message || error),
    });
  }
};
