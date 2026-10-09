# MS Inspection Entry

Web app mandiri untuk screening karyawan melalui QR. Master karyawan dan akun admin dibaca dari database PostgreSQL `IoT-QR-Consumer`; level inspection dan log disimpan pada tabel terpisah.

## Fitur

- Scanner kamera live dengan input manual sebagai fallback.
- Respons green selama 1 detik dan red selama 2 detik.
- Parsing employee ID biasa, JSON, dan URL.
- Pencatatan semua percobaan dengan hari operasional berganti pukul 06:00 WIB.
- Login admin memakai akun `users` yang sudah ada.
- Pengaturan level green/red, laporan terfilter, pagination, dan ekspor Excel.
- Health check database pada `GET /api/health`.

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

Buka scanner di `http://localhost:3100` dan admin di `http://localhost:3100/admin`.

Sesuaikan kredensial database dan `APP_ORIGIN` di `.env`. Pada production, `APP_ORIGIN` harus sama persis dengan origin publik, misalnya `https://inspection.example.com`.

## Tabel Baru

- `inspection_employee_levels`: level efektif karyawan dan audit perubahan terakhir.
- `inspection_scan_logs`: snapshot hasil setiap scan, level saat scan, sumber, timestamp, dan business date.
- `inspection_admin_sessions`: hash token session admin dengan masa kedaluwarsa.

Migrasi bersifat idempotent dan tidak mengubah tabel existing.

## API

- `POST /api/scans` dengan body `{ "value": "EMP001", "source": "camera" }`.
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`.
- `GET /api/admin/employees` dan `PATCH /api/admin/employees/:employeeId/level`.
- `GET /api/admin/reports/summary`, `/logs`, `/departments`, dan `/export`.

Endpoint `/api/admin/*` membutuhkan cookie session admin. Semua query laporan menerima `start_date`, `end_date`, `level`, `result_code`, `department`, dan `employee_id` sesuai kebutuhan.

## Deployment

1. Jalankan `npm install --omit=dev` dan `npm run migrate` pada server.
2. Isi `.env` dengan `NODE_ENV=production`, origin HTTPS, dan kredensial database.
3. Jalankan `pm2 start ecosystem.config.js`.
4. Gunakan `nginx.conf.example` sebagai dasar reverse proxy dan pasang sertifikat TLS.
5. Setelah deployment, verifikasi `/api/health`, login admin, kamera, satu scan green, satu scan red, dan ekspor Excel.

Session cookie menggunakan `HttpOnly`, `SameSite=Strict`, dan `Secure` pada production. Operasi mutasi admin juga memeriksa header origin.
