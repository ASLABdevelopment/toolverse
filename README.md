# TOOLVERSE – All In One Tools

```
toolverse/
├─ frontend/   statis: index.html, manifest, sw.js, icon  (Vercel / Netlify / VPS)
└─ backend/    Node.js + Express (/api/expand, /api/dns, /api/ip, /api/download)
```

## Jalankan lokal
```bash
cd backend && npm install && cp .env.example .env && npm start     # :3000
cd ../frontend && npx serve .                                       # buka URL yang tampil
```
Di `frontend/index.html` isi `API_BASE` dengan `http://localhost:3000` (atau URL backend produksi).

## Deploy
- **Frontend**: Vercel/Netlify → root `frontend`, tanpa build command.
- **Backend**: VPS (`pm2 start server.js`, Nginx reverse proxy + HTTPS) atau Render/Railway. Set `ALLOWED_ORIGINS` ke domain frontend.
- Install PWA: buka lewat HTTPS, lalu "Tambahkan ke layar utama".

## Konfigurasi API
| Fitur | Konfigurasi |
|---|---|
| Downloader | `DOWNLOADER_API_URL` + `DOWNLOADER_API_KEY` (layanan legal pilihanmu; kontrak JSON ada di `.env.example`). Tanpa ini, tombol Download menampilkan error 501. |
| IP lookup | memakai ipwho.is (gratis). Ganti di `server.js` jika perlu. |
| Currency / Weather / Speed | langsung dari browser: frankfurter.app, Open-Meteo, Cloudflare. Tanpa key. |

Tidak ada layanan berbayar yang dipakai. Tidak ada URL/file pengguna yang disimpan di server.
