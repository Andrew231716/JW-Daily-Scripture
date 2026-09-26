const {
  isPushConfigured,
  savePushSubscription,
  removePushSubscription,
} = require("../lib/pushNotifications");

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  return {};
}

module.exports = async function handler(req, res) {
  if (!isPushConfigured()) {
    res.status(503).json({ error: "Notifiche push non configurate sul server" });
    return;
  }

  try {
    const body = readBody(req);
    if (req.method === "POST") {
      const result = await savePushSubscription(body);
      res.status(200).json(result);
      return;
    }
    if (req.method === "DELETE") {
      await removePushSubscription(body.subscription);
      res.status(200).json({ removed: true });
      return;
    }
    res.setHeader("Allow", "POST, DELETE");
    res.status(405).json({ error: "Metodo non supportato" });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: String(error.message || error) });
  }
};
