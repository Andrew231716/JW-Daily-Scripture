const { isPushConfigured } = require("../lib/pushNotifications");

module.exports = async function handler(_req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    configured: isPushConfigured(),
    publicKey: process.env.VAPID_PUBLIC_KEY || "",
  });
};
