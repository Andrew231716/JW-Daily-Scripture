const crypto = require("node:crypto");
const webPush = require("web-push");
const { del, get, list, put } = require("@vercel/blob");

const RECORD_PREFIX = "jw-daily-push/subscriptions/";

function isPushConfigured() {
  const hasBlobAccess =
    process.env.BLOB_STORE_ID &&
    (process.env.VERCEL_OIDC_TOKEN || process.env.BLOB_READ_WRITE_TOKEN);
  return Boolean(
    hasBlobAccess &&
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
  );
}

function recordPath(id) {
  return `${RECORD_PREFIX}${id}.json`;
}

function blobOptions() {
  return { token: process.env.BLOB_READ_WRITE_TOKEN };
}

async function readRecord(pathname) {
  const result = await get(pathname, {
    access: "private",
    ...blobOptions(),
    useCache: false,
  });
  if (!result || result.statusCode !== 200 || !result.stream) return null;
  return JSON.parse(await new Response(result.stream).text());
}

async function writeRecord(pathname, record) {
  await put(pathname, JSON.stringify(record), {
    access: "private",
    ...blobOptions(),
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
}

async function listSubscriptionBlobs() {
  const blobs = [];
  let cursor;
  let hasMore = true;
  while (hasMore) {
    const page = await list({
      prefix: RECORD_PREFIX,
      limit: 1000,
      cursor,
      ...blobOptions(),
    });
    blobs.push(...page.blobs);
    hasMore = page.hasMore;
    cursor = page.cursor;
  }
  return blobs;
}

function endpointId(endpoint) {
  return crypto.createHash("sha256").update(endpoint).digest("hex");
}

function localParts(date, timeZone) {
  const values = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(values.map(({ type, value }) => [type, Number(value)]));
}

function zonedTimeToUtc(parts, timeZone) {
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let guess = target;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = localParts(new Date(guess), timeZone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    guess += target - represented;
  }
  return guess;
}

function nextNotificationAt(notifyTime, timeZone, from = new Date()) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(notifyTime)) {
    throw new Error("Orario notifica non valido");
  }
  const now = localParts(from, timeZone);
  const [hour, minute] = notifyTime.split(":").map(Number);
  const date = new Date(Date.UTC(now.year, now.month - 1, now.day));
  let target = zonedTimeToUtc(
    { year: now.year, month: now.month, day: now.day, hour, minute },
    timeZone
  );
  if (target <= from.getTime()) {
    date.setUTCDate(date.getUTCDate() + 1);
    target = zonedTimeToUtc(
      {
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour,
        minute,
      },
      timeZone
    );
  }
  return target;
}

async function savePushSubscription({ subscription, notifyTime, timeZone }) {
  const endpoint = subscription?.endpoint;
  if (
    typeof endpoint !== "string" ||
    !endpoint.startsWith("https://") ||
    !subscription?.keys?.p256dh ||
    !subscription?.keys?.auth
  ) {
    throw new Error("Sottoscrizione push non valida");
  }
  if (typeof timeZone !== "string" || timeZone.length > 100) {
    throw new Error("Fuso orario non valido");
  }
  new Intl.DateTimeFormat("en-US", { timeZone });

  const id = endpointId(endpoint);
  const nextAt = nextNotificationAt(notifyTime, timeZone);
  const record = { subscription, notifyTime, timeZone, nextAt };
  await writeRecord(recordPath(id), record);
  return { nextAt };
}

async function removePushSubscription(subscription) {
  const endpoint = subscription?.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) return;
  const id = endpointId(endpoint);
  await del(recordPath(id), blobOptions());
}

async function processDuePushes(now = Date.now()) {
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  const blobs = await listSubscriptionBlobs();
  const records = [];
  for (const blob of blobs) {
    const record = await readRecord(blob.pathname);
    if (record?.nextAt <= now) records.push({ pathname: blob.pathname, record });
  }

  const totals = { due: records.length, sent: 0, failed: 0, removed: 0 };
  let cursor = 0;
  const workers = Array.from({ length: Math.min(8, records.length) }, async () => {
    while (cursor < records.length) {
      const { pathname, record } = records[cursor++];
      try {
        await webPush.sendNotification(
          record.subscription,
          JSON.stringify({
            title: "JW Daily Scripture",
            body: "Tocca per ascoltare la scrittura di oggi",
            url: "/?play=1&source=notification",
          })
        );
        totals.sent += 1;
        record.nextAt = nextNotificationAt(record.notifyTime, record.timeZone, new Date(now));
        await writeRecord(pathname, record);
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await del(pathname, blobOptions());
          totals.removed += 1;
        } else {
          totals.failed += 1;
          record.nextAt = now + 60_000;
          await writeRecord(pathname, record);
        }
      }
    }
  });
  await Promise.all(workers);
  return totals;
}

module.exports = {
  isPushConfigured,
  savePushSubscription,
  removePushSubscription,
  processDuePushes,
};
