# MS Inspection Entry

Web app mandiri untuk screening karyawan melalui QR. Master karyawan dan akun admin dibaca dari database PostgreSQL `IoT-QR-Consumer`; level inspection dan log disimpan pada tabel terpisah.

Dapat di-deploy bersama CRS (`IoT-QR-Consumer`) di satu domain, misalnya `https://crs.moof-set.web.id/inspection/`, dengan Nginx mem-proxy ke proses Node terpisah.

## Fitur

- Scanner kamera live dengan input manual sebagai fallback.
- Pemindaian QR memakai **Barcode Detection API** bila browser mendukung (umumnya Chrome/Android); fallback **jsQR** dari frame kamera untuk Safari/iOS dan browser tanpa API native.
- HTTPS wajib di production agar kamera berfungsi (termasuk iPhone/iPad); semua browser di iOS memakai WebKit.
- Respons green selama 1 detik dan red selama 2 detik.
- Parsing employee ID biasa, JSON, dan URL.
- Pencatatan semua percobaan dengan hari operasional berganti pukul 06:00 WIB.
- Login admin memakai akun `users` yang sudah ada.
- Pengaturan level green/red, laporan terfilter, pagination, dan ekspor Excel.
- Health check database pada `GET /api/inspection/health`.

## Persyaratan

- Node.js 18 atau lebih baru.
- PostgreSQL milik `IoT-QR-Consumer` sudah aktif dan memiliki tabel `employee_data` serta `users`.
- HTTPS diperlukan agar kamera browser dapat digunakan selain pada `localhost`.

## Menjalankan

```powershell
Copy-Item .env.example .env
npm install
npm run migrate
npm test
npm start
```

Dengan `BASE_PATH=/inspection` (default di `.env.example`):

- Scanner: `http://localhost:3100/inspection/`
- Admin: `http://localhost:3100/inspection/admin`

Untuk development tanpa prefix, kosongkan `BASE_PATH` di `.env` lalu buka `http://localhost:3100/` dan `/admin`.

Sesuaikan kredensial database (`DB_PORT` default **5433**, selaras dengan CRS) dan `APP_ORIGIN`. Pada production di domain CRS, set:

- `APP_ORIGIN=https://crs.moof-set.web.id`
- `BASE_PATH=/inspection`
- `NODE_ENV=production`

## Tabel Baru

- `inspection_employee_levels`: level efektif karyawan dan audit perubahan terakhir.
- `inspection_scan_logs`: snapshot hasil setiap scan, level saat scan, sumber, timestamp, dan business date.
- `inspection_admin_sessions`: hash token session admin dengan masa kedaluwarsa.

Migrasi bersifat idempotent dan tidak mengubah tabel existing.

### Bulk level per departemen

Set semua karyawan satu departemen ke level red/green (upsert `inspection_employee_levels`):

```powershell
npm run set-department-level -- --dry-run
npm run set-department-level -- --department Production --level red
```

Opsi env: `DEPARTMENT`, `LEVEL`, `UPDATED_BY`. Cocokkan departemen case-insensitive (`Production` = `production`).

## API

- `POST /api/scans` dengan body `{ "value": "EMP001", "source": "camera" }`.
- `POST /api/inspection/auth/login`, `POST /api/inspection/auth/logout`, `GET /api/inspection/auth/session`.
- `GET /api/admin/employees` dan `PATCH /api/admin/employees/:employeeId/level`.
- `GET /api/admin/reports/summary`, `/logs`, `/departments`, dan `/export`.
- `GET /api/inspection/health` — health Inspection (CRS memakai `GET /api/health` sendiri).

Endpoint `/api/admin/*` membutuhkan cookie session admin (`Path` mengikuti `BASE_PATH`, default `/inspection`). Auth Inspection sengaja di prefix `/api/inspection/auth` agar tidak bentrok dengan `POST /api/auth/login` CRS.

## Deployment

1. Jalankan `npm install --omit=dev` dan `npm run migrate` pada server (PostgreSQL CRS harus sudah jalan).
2. Isi `.env` production (origin HTTPS, `BASE_PATH`, DB).
3. Jalankan `pm2 start ecosystem.config.js --env production` (port **3100**).
4. CRS tetap di PM2 terpisah (port production CRS, mis. **5567**).
5. Pasang Nginx gabungan: lihat [`nginx.crs-combined.conf.example`](nginx.crs-combined.conf.example). Standalone Inspection: [`nginx.conf.example`](nginx.conf.example).
6. Verifikasi:
   - `GET /api/health` → CRS
   - `GET /api/inspection/health` → Inspection + DB
   - UI `/inspection/`, admin, scan green/red, ekspor Excel

Session cookie menggunakan `HttpOnly`, `SameSite=Strict`, dan `Secure` pada production. Operasi mutasi admin juga memeriksa header origin.
