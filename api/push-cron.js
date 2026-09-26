const crypto = require("node:crypto");
const { isPushConfigured, processDuePushes } = require("../lib/pushNotifications");

const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
const GITHUB_AUDIENCE = "jw-daily-scripture-push";
const GITHUB_JWKS_URL = `${GITHUB_ISSUER}/.well-known/jwks`;
const EXPECTED_REPOSITORY = "Andrew231716/JW-Daily-Scripture";
const EXPECTED_WORKFLOW = `${EXPECTED_REPOSITORY}/.github/workflows/push-cron.yml@refs/heads/main`;
let cachedKeys = null;
let keysExpireAt = 0;

async function githubSigningKey(keyId) {
  if (!cachedKeys || Date.now() >= keysExpireAt) {
    const response = await fetch(GITHUB_JWKS_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("Impossibile verificare il token GitHub");
    const data = await response.json();
    cachedKeys = data.keys || [];
    keysExpireAt = Date.now() + 60 * 60 * 1000;
  }
  const jwk = cachedKeys.find((key) => key.kid === keyId);
  return jwk ? crypto.createPublicKey({ key: jwk, format: "jwk" }) : null;
}

async function isAuthorized(req) {
  const authorization = req.headers.authorization || "";
  if (process.env.CRON_SECRET && authorization === `Bearer ${process.env.CRON_SECRET}`) {
    return true;
  }

  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (header.alg !== "RS256" || !header.kid) return false;
    const key = await githubSigningKey(header.kid);
    if (!key) return false;
    const validSignature = crypto.verify(
      "RSA-SHA256",
      Buffer.from(`${parts[0]}.${parts[1]}`),
      key,
      Buffer.from(parts[2], "base64url")
    );
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    return Boolean(
      validSignature &&
        claims.iss === GITHUB_ISSUER &&
        audience.includes(GITHUB_AUDIENCE) &&
        claims.exp > Date.now() / 1000 &&
        claims.repository === EXPECTED_REPOSITORY &&
        claims.ref === "refs/heads/main" &&
        claims.workflow_ref === EXPECTED_WORKFLOW &&
        ["schedule", "workflow_dispatch"].includes(claims.event_name)
    );
  } catch {
    return false;
  }
}

module.exports = async function handler(req, res) {
  if (!isPushConfigured()) {
    res.status(503).json({ error: "Notifiche push non configurate sul server" });
    return;
  }
  if (!(await isAuthorized(req))) {
    res.status(401).json({ error: "Non autorizzato" });
    return;
  }

  try {
    res.status(200).json(await processDuePushes());
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Elaborazione notifiche non riuscita" });
  }
};

module.exports.isAuthorized = isAuthorized;
