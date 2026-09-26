const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const { resolveVoice } = require("./voices");

function splitForTts(text, maxLen = 280) {
  const clean = String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4500);
  if (clean.length <= maxLen) return [clean];

  const parts = [];
  let remaining = clean;
  while (remaining.length > maxLen) {
    const window = remaining.slice(0, maxLen);
    let cut = Math.max(
      window.lastIndexOf(". "),
      window.lastIndexOf("? "),
      window.lastIndexOf("! "),
      window.lastIndexOf("; "),
      window.lastIndexOf(", ")
    );
    if (cut < maxLen * 0.4) cut = window.lastIndexOf(" ");
    if (cut < 1) cut = maxLen;
    parts.push(remaining.slice(0, cut + 1).trim());
    remaining = remaining.slice(cut + 1).trim();
  }
  if (remaining) parts.push(remaining);
  return parts.filter(Boolean);
}

async function synthesizeViaStream(text, voice, attempt = 1) {
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = await tts.toStream(text);
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    if (!buffer.length) throw new Error("Audio vuoto");
    return buffer;
  } catch (error) {
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 350 * attempt));
      return synthesizeViaStream(text, voice, attempt + 1);
    }
    throw error;
  }
}

async function synthesizeSpeech(text, voiceId) {
  const voice = resolveVoice(voiceId);
  const pieces = splitForTts(text);
  const buffers = [];

  for (const piece of pieces) {
    buffers.push(await synthesizeViaStream(piece, voice));
  }

  const buffer = Buffer.concat(buffers);
  if (!buffer.length) {
    throw new Error("Audio vuoto dalla sintesi vocale");
  }
  return { buffer, voice, contentType: "audio/mpeg" };
}

module.exports = { synthesizeSpeech, splitForTts };
