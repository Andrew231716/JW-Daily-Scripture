function sendMp3(req, res, buffer, { voice, date } = {}) {
  const total = buffer.length;
  const headers = {
    "Content-Type": "audio/mpeg",
    "Accept-Ranges": "bytes",
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges, Content-Length, X-JWDS-Voice",
  };
  if (voice) headers["X-JWDS-Voice"] = voice;
  if (date) {
    headers["X-JWDS-Date"] = date;
    headers["Content-Disposition"] = `inline; filename="jw-daily-scripture-${date}.mp3"`;
  }

  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }

  const range = req.headers.range || req.headers.Range;
  if (range) {
    const match = /bytes=(\d+)-(\d+)?/.exec(String(range));
    if (match) {
      const start = Number(match[1]);
      const end = match[2] ? Number(match[2]) : total - 1;
      if (start >= total || end >= total || start > end) {
        res.statusCode = 416;
        res.setHeader("Content-Range", `bytes */${total}`);
        res.end();
        return;
      }
      const chunk = buffer.subarray(start, end + 1);
      res.statusCode = 206;
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", String(chunk.length));
      res.end(chunk);
      return;
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Length", String(total));
  res.end(buffer);
}

module.exports = { sendMp3 };
