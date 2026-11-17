import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dns from 'node:dns/promises';
import net from 'node:net';

const app = express();
const origins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({ origin: origins.length ? origins : true }));
app.use(express.json({ limit: '10kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 60 }));

const PRIVATE = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|f[cd]|fe80)/i;
async function assertPublic(raw) {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Hanya http/https');
  const ips = net.isIP(u.hostname) ? [u.hostname] : (await dns.lookup(u.hostname, { all: true })).map(a => a.address);
  if (ips.some(ip => PRIVATE.test(ip))) throw new Error('Alamat privat tidak diizinkan');
  return u;
}
const fail = (res, code, message) => res.status(code).json({ error: message, message });

app.get('/api/health', (_, res) => res.json({ ok: true }));

// Ikuti redirect satu per satu (maks 10 hop), tanpa membuka isi halaman.
app.get('/api/expand', async (req, res) => {
  try {
    let url = String(req.query.url || ''), hops = [];
    for (let i = 0; i < 10; i++) {
      const u = await assertPublic(url);
      const r = await fetch(u, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'ToolverseBot/1.0' } });
      hops.push({ url: u.href, status: r.status });
      const loc = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && loc) url = new URL(loc, u).href; else break;
    }
    res.json({ hops, final: hops.at(-1).url });
  } catch (e) { fail(res, 400, 'URL tidak bisa diperiksa: ' + e.message); }
});

app.get('/api/dns', async (req, res) => {
  const d = String(req.query.domain || '').trim();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(d)) return fail(res, 400, 'Domain tidak valid');
  const out = {};
  for (const t of ['A', 'AAAA', 'MX', 'TXT', 'NS']) out[t] = await dns.resolve(d, t).catch(() => []);
  res.json(out);
});

// IP info: pakai ipwho.is (gratis, tanpa key). Ganti sesuai layanan pilihanmu.
app.get('/api/ip', async (req, res) => {
  const ip = String(req.query.ip || '') || (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
  if (ip && !net.isIP(ip)) return fail(res, 400, 'IP tidak valid');
  try { res.json(await (await fetch(`https://ipwho.is/${ip}`, { signal: AbortSignal.timeout(6000) })).json()); }
  catch { fail(res, 502, 'Layanan IP tidak merespons'); }
});

// Downloader: diteruskan ke layanan yang kamu konfigurasi sendiri. Tanpa konfigurasi = 501 (tidak berpura-pura).
app.post('/api/download', async (req, res) => {
  const api = process.env.DOWNLOADER_API_URL;
  if (!api) return fail(res, 501, 'Backend downloader belum dikonfigurasi. Isi DOWNLOADER_API_URL di backend/.env.');
  const { url, platform } = req.body || {};
  try { await assertPublic(url); } catch (e) { return fail(res, 400, 'URL tidak valid'); }
  try {
    const r = await fetch(api, { method: 'POST', signal: AbortSignal.timeout(30000),
      headers: { 'Content-Type': 'application/json', ...(process.env.DOWNLOADER_API_KEY && { Authorization: `Bearer ${process.env.DOWNLOADER_API_KEY}` }) },
      body: JSON.stringify({ url, platform }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return fail(res, 502, j.message || 'Konten tidak tersedia atau tidak bisa diunduh');
    res.json(j);
  } catch { fail(res, 502, 'Layanan downloader tidak merespons'); }
});

app.listen(process.env.PORT || 3000, () => console.log('TOOLVERSE API on :' + (process.env.PORT || 3000)));
