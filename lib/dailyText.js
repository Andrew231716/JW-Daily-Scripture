const SOURCE_URL = "https://wol.jw.org/it/wol/h/r6/lp-i";
const CACHE_TTL_MS = 30 * 60 * 1000;

let cache = { at: 0, payload: null };

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h2>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function extractDailyText(html, preferredDate) {
  let block = null;
  const key = `${preferredDate}T00:00:00.000Z`;
  const re = new RegExp(
    `<div class="tabContent" data-date="${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>([\\s\\S]*?)(?=<div class="tabContent"|</div>\\s*</div>\\s*</div>)`,
    "i"
  );
  const match = html.match(re);
  if (match) block = match[1];

  if (!block) {
    const loose = html.match(
      /<div class="tabContent" data-date="([^"]+)"[^>]*>([\s\S]*?)(?=<div class="tabContent"|$)/gi
    );
    if (loose && loose.length) {
      const found = loose.find((chunk) => chunk.includes(key));
      block = found
        ? found.replace(/^[\s\S]*?>/, "")
        : loose[Math.min(1, loose.length - 1)].replace(/^[\s\S]*?>/, "");
    }
  }

  if (!block) {
    throw new Error("Non riesco a trovare il testo del giorno nella pagina.");
  }

  const titleMatch = block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
  const themeMatch = block.match(/class="themeScrp"[^>]*>([\s\S]*?)<\/p>/i);
  const bodyMatch = block.match(/class="bodyTxt"[^>]*>([\s\S]*?)(?:<\/div>|<a href="\/it\/wol\/d)/i);

  const title = titleMatch ? stripTags(titleMatch[1]) : preferredDate;
  const scripture = themeMatch ? stripTags(themeMatch[1]) : "";
  const body = bodyMatch ? stripTags(bodyMatch[1]) : stripTags(block);
  const speakText = [title, scripture, body].filter(Boolean).join(". ");

  return {
    date: preferredDate,
    title,
    scripture,
    body,
    speakText,
    sourceUrl: SOURCE_URL,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchDailyText() {
  const now = Date.now();
  const date = todayKey();
  if (cache.payload && cache.payload.date === date && now - cache.at < CACHE_TTL_MS) {
    return cache.payload;
  }

  const response = await fetch(SOURCE_URL, {
    headers: {
      "User-Agent":
        "JWDailyScripture/1.1 (+personal reader; respectful caching)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "it,en;q=0.8",
    },
  });

  if (!response.ok) {
    throw new Error(`Errore scaricando wol.jw.org (${response.status})`);
  }

  const html = await response.text();
  const payload = extractDailyText(html, date);
  cache = { at: now, payload };
  return payload;
}

module.exports = { fetchDailyText, SOURCE_URL };
