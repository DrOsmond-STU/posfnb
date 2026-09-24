# 09 · Kebutuhan Non-fungsional

## 9.1 Keamanan

| Kode | Kebutuhan |
|---|---|
| NFR-SEC-01 | Semua lalu lintas lewat HTTPS (AutoSSL Let's Encrypt sudah aktif); header `Strict-Transport-Security` |
| NFR-SEC-02 | Kata sandi & PIN di-hash dengan **Argon2id** (atau bcrypt cost ≥ 12). Hash SHA-256 bergaram di purwarupa **tidak boleh** dipakai di produksi |
| NFR-SEC-03 | Setiap endpoint memeriksa izin di server (Policy/Gate Laravel). Menyembunyikan tombol di klien bukan kontrol keamanan |
| NFR-SEC-04 | Rate limit: login 5×/menit per email + 20×/menit per IP; PIN 5×/menit per pengguna; API umum 120×/menit per sesi |
| NFR-SEC-05 | Cookie sesi `HttpOnly`, `Secure`, `SameSite=Lax`; CSRF token untuk semua permintaan yang mengubah data |
| NFR-SEC-06 | Validasi & *escaping* semua input; kueri memakai parameter (Eloquent/Query Builder), tanpa SQL mentah dari input |
| NFR-SEC-07 | Header CSP ketat: skrip hanya dari domain sendiri; font dari Google Fonts |
| NFR-SEC-08 | Webhook pembayaran diverifikasi tanda tangan dan jumlahnya dicocokkan dengan transaksi |
| NFR-SEC-09 | Folder `.git`, `.env`, `storage/`, dan `vendor/` tidak bisa diakses lewat web (document root = `public/`) |
| NFR-SEC-10 | Log aktivitas tambah saja, disimpan ≥ 1 tahun, bisa diekspor Pemilik |
| NFR-SEC-11 | Lampiran nota dicek tipe MIME (gambar/PDF), maksimal 5 MB, disimpan di luar document root |
| NFR-SEC-12 | Pemindaian dependensi (`composer audit`, `npm audit`) di CI; rilis diblokir bila ada temuan kritis |

## 9.2 Privasi data

- Data pribadi yang disimpan: nama & email pengguna, nama pelanggan opsional di pesanan, dan nomor order mitra ojol. Tidak ada data kartu pembayaran yang disimpan, hanya nomor approval.
- Mengikuti prinsip UU No. 27/2022 tentang Pelindungan Data Pribadi: data seperlunya, akses berbasis peran, dan permintaan penghapusan nama pelanggan dapat dipenuhi tanpa menghapus dokumen keuangan (nama diganti "Pelanggan").
- Data staging memakai salinan yang dianonimkan.

## 9.3 Kinerja

| Kode | Target |
|---|---|
| NFR-PERF-01 | Kasir: tambah item ke keranjang < 100 ms (lokal, tanpa panggilan server) |
| NFR-PERF-02 | `POST /orders/{id}/pay` p95 < 800 ms di hosting produksi |
| NFR-PERF-03 | Tiket muncul di layar dapur ≤ 3 detik setelah dikirim (polling 3 detik) |
| NFR-PERF-04 | Laporan periode 30 hari < 2 detik; 12 bulan < 6 detik (pakai tabel ringkasan harian bila perlu) |
| NFR-PERF-05 | Muat awal SPA < 3 detik di 4G; aset di-cache service worker |
| NFR-PERF-06 | Ukuran bundel JS awal kasir < 300 KB gzip |

## 9.4 Ketersediaan & ketahanan

| Kode | Kebutuhan |
|---|---|
| NFR-AV-01 | Kasir tetap bisa bertransaksi saat server/internet tidak tersedia (mode luring, [6.4](06-arsitektur.md#64-mode-luring-kasir)) |
| NFR-AV-02 | Target ketersediaan server 99,5% per bulan pada jam operasional 09.00–23.00 |
| NFR-AV-03 | Tidak ada transaksi hilang: outbox luring bertahan setelah peramban ditutup; sinkronisasi idempoten |
| NFR-AV-04 | Pemeliharaan terjadwal di luar jam operasional (setelah 23.00) |

## 9.5 Cadangan & pemulihan

| Item | Kebijakan |
|---|---|
| Basis data | Dump otomatis harian (cron + `mysqldump`), disimpan 30 hari; mingguan disimpan 12 minggu; salinan di luar server (Google Drive/S3) |
| Lampiran | Disalin harian bersama dump |
| RPO | ≤ 24 jam (server); ≈ 0 untuk transaksi kasir karena ada outbox lokal |
| RTO | ≤ 4 jam |
| Uji pemulihan | Setiap bulan ke staging, dan hasilnya dicatat |

## 9.6 Kompatibilitas

| Perangkat | Dukungan |
|---|---|
| Peramban | Chrome/Edge 2 versi terakhir (utama), Safari iPadOS 17+, Firefox terbaru |
| Kasir | Tablet 10" landscape (1280×800) dan PC 1366×768 ke atas |
| Layar dapur | Tablet/TV 1080p, mode layar penuh, tampil terus-menerus (wake lock) |
| HP | Semua modul dapat dipakai di lebar 390 px; kasir tetap optimal di tablet |
| Printer | ESC/POS 58 & 80 mm (Epson TM-T82X, Xprinter XP-Q200, dsb.) |

## 9.7 Aksesibilitas & bahasa

- Mengikuti WCAG 2.1 AA: kontras teks ≥ 4,5:1, fokus keyboard terlihat, label untuk semua kontrol form, target sentuh ≥ 44 px.
- Tema terang, gelap, dan ikut sistem.
- Bahasa Indonesia sebagai bahasa utama. Semua teks antarmuka berada di berkas terjemahan agar Bahasa Inggris bisa ditambahkan (v1.1).
- Format angka `id-ID` (Rp 1.234.567; 33,7%); tanggal "24 Sep 2026".

## 9.8 Pemeliharaan & kualitas kode

| Kode | Kebutuhan |
|---|---|
| NFR-MNT-01 | Cakupan uji unit service domain (5.x) ≥ 90%; seluruh contoh di [05](05-aturan-akuntansi.md) menjadi uji otomatis |
| NFR-MNT-02 | Uji E2E Playwright untuk alur: masuk, bayar tunai, bayar QRIS (mock), PO → GRN → bayar, opname, hak akses per peran |
| NFR-MNT-03 | Lint & format: Laravel Pint, ESLint, Prettier |
| NFR-MNT-04 | Migrasi DB bisa di-*rollback*; tidak ada perubahan skema manual di produksi |
| NFR-MNT-05 | Log aplikasi (Laravel log harian, 14 hari) dan pemantauan galat (mis. Sentry) |
| NFR-MNT-06 | Dokumentasi di folder `docs/` diperbarui dalam PR yang sama dengan perubahan perilaku |

## 9.9 Observabilitas

- Health check `GET /api/v1/health` (DB, antrean, disk) untuk pemantau uptime.
- Metrik bisnis harian terkirim ke Pemilik lewat email (opsional v1.1): penjualan, food cost, bahan menipis.
- Peringatan otomatis:
  - jurnal tidak seimbang (seharusnya tidak pernah terjadi);
  - antrean sinkronisasi luring gagal;
  - stok minus;
  - backup gagal.
