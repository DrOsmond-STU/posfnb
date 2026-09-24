# Racik POS: POS Resto & F&B

Aplikasi Point of Sale untuk restoran dan usaha F&B. Alurnya lengkap, mulai dari pembelian bahan, standar menu dan resep, penjualan di kasir, sampai laporan keuangan dan laporan persediaan.

- **Autentikasi & hak akses berjalan di server** (PHP + MySQL, folder `api/`): akun, kata sandi, PIN, sesi, peran, izin, dan log aktivitas disimpan di basis data dan diperiksa di setiap permintaan.
- **Data operasional** (penjualan, stok, pembelian, jurnal) masih disimpan di browser (localStorage) sebagai data contoh. Pemindahan modul-modul ini ke API mengikuti rencana di [`docs/11-rencana-pengembangan.md`](docs/11-rencana-pengembangan.md).

## Dokumentasi pengembangan

Spesifikasi lengkap untuk membangun versi produksi ada di folder [`docs/`](docs/README.md): ringkasan produk, kebutuhan fungsional, peran & hak akses, alur bisnis, aturan perhitungan & akuntansi, arsitektur, skema basis data, spesifikasi API, kebutuhan non-fungsional, panduan UI, rencana pengembangan, dan daftar keputusan terbuka.

## Kebutuhan server

- PHP 7.4 atau lebih baru dengan ekstensi `pdo_mysql` (Argon2id dipakai bila tersedia, selain itu bcrypt).
- MySQL 5.7+ / MariaDB 10.3+.
- Apache dengan `mod_rewrite` (hosting cPanel biasa). Tidak perlu Composer atau build step.

## Instalasi

1. Buat basis data dan user MySQL.
2. Salin `api/config.example.php` ke **luar** document root, yaitu `<home>/posfnb-config/config.php` (satu tingkat di atas folder situs). Isi kredensial DB, `trusted_origin`, `app_secret` acak, dan akun Pemilik pertama. Lokasi lain bisa ditunjuk lewat variabel lingkungan `POSFNB_CONFIG`.
3. Jalankan migrasi dari terminal atau cron:
   ```bash
   php api/bin/migrate.php
   ```
   Perintah ini membuat tabel, peran bawaan, dan akun Pemilik pertama. Aman dijalankan berulang.
4. Masuk dengan akun Pemilik. Sistem langsung meminta kata sandi baru. Setelah itu tambahkan pengguna lain di menu **Pengguna & Akses**.

`.htaccess` mengarahkan semua `/api/*` ke `api/index.php`. Folder `docs/`, `tools/`, `api/src`, `api/bin`, `api/migrations`, serta berkas `.md`, `.sql`, dan berkas tersembunyi diblokir (403).

## Menjalankan di komputer lokal

```bash
POSFNB_CONFIG=/path/ke/config.php php api/bin/migrate.php
POSFNB_CONFIG=/path/ke/config.php php -S localhost:8766 tools/dev-router.php
# buka http://localhost:8766  (isi cookie_secure => false dan trusted_origin => 'http://localhost:8766')
```

## Modul

| Grup | Halaman | Isi |
|---|---|---|
| Ringkasan | **Dasbor** | KPI hari ini (penjualan, struk, food cost, nilai stok), grafik 30 hari, kategori, menu terlaris, stok perlu dibeli, hutang, status operasional |
| Operasional | **Kasir (POS)** | Grid menu dengan estimasi porsi tersedia dari stok, dine-in/take away/online, pilih meja, catatan dapur, diskon, service charge, PB1, simpan bill, pembayaran Tunai/QRIS/Kartu/Ojol, struk |
| | **Meja & Pesanan** | Denah meja per area (kosong/terisi/reservasi), buka bill dari meja, pesanan take away & online aktif |
| | **Layar Dapur (KDS)** | Tiket Antrian, Sedang dimasak, dan Siap diantar, timer per tiket, total porsi per menu |
| | **Riwayat Penjualan** | Filter periode, metode, dan tipe, lalu detail dan cetak ulang struk |
| Menu & Produksi | **Standar Menu & Resep** | Komposisi bahan per porsi, HPP otomatis, food cost vs target, harga jual saran, langkah pembuatan, standar penyajian |
| Pembelian & Stok | **Pembelian** | Purchase Order (draft, kirim, terima sebagian atau penuh, bayar), Penerimaan Barang (GRN), umur hutang pemasok, saran pembelian otomatis |
| | **Pemasok** | Data pemasok, termin, nilai pembelian, hutang berjalan |
| | **Persediaan** | Stok bahan & status minimum, kartu stok, stok opname, bahan rusak (waste) |
| Keuangan & Laporan | **Kas & Biaya** | Saldo kas/bank, bukti kas keluar, setor kas ke bank, setor PB1 |
| | **Laporan Penjualan** | Per hari, per jam, metode bayar, tipe pesanan, per menu, **menu engineering** (Star/Plowhorse/Puzzle/Dog) |
| | **Laporan Keuangan** | Laba rugi, neraca, arus kas, jurnal umum, buku besar |
| | **Laporan Persediaan** | Mutasi per bahan (awal, beli, pakai, waste, opname, akhir), hari persediaan, rekonsiliasi ke akun persediaan |
| Sistem | **Pengaturan** | Profil outlet & struk, PB1 & service charge, target food cost, pengguna & hak akses, perangkat, reset data demo |

## Masuk & hak akses

Ada dua cara masuk: **email + kata sandi**, atau **PIN kasir 6 digit** untuk berganti kasir dengan cepat. Tidak ada akun demo; semua akun dibuat Pemilik di menu **Pengguna & Akses**.

| Peran bawaan | Modul |
|---|---|
| Pemilik | Semua, termasuk Pengguna & Akses (izin tidak bisa dikurangi) |
| Manajer Outlet | Semua kecuali Pengguna & Akses; bisa menyetujui diskon & void |
| Kasir | Kasir, Meja, Layar Dapur, riwayat transaksi sendiri |
| Kepala Dapur | Layar Dapur, Resep, Persediaan (opname & waste) |
| Staf Gudang | Pembelian, Pemasok, Persediaan |
| Akuntan | Dasbor, Kas & Biaya, semua laporan, bayar pemasok |

**Keamanan (ditegakkan di server):**
- Kata sandi & PIN di-hash dengan Argon2id. Server tidak pernah menyimpan atau mengirim nilai aslinya.
- Sesi disimpan di tabel `sessions`. Browser hanya memegang token acak di cookie `HttpOnly`, `Secure`, `SameSite=Lax`, yang di basis data disimpan sebagai hash SHA-256.
- Setiap perubahan data memerlukan token CSRF dan asal (Origin) yang sesuai `trusted_origin`.
- Batas percobaan:
  - 5 kali gagal per akun → akun dikunci 60 detik;
  - 3 kali terkunci dalam 1 jam → dikunci 15 menit;
  - 20 kali gagal per alamat IP → IP ditahan 5 menit.
- **PIN hanya berlaku di perangkat tepercaya**, yaitu perangkat yang pernah dipakai masuk dengan email + kata sandi (cookie perangkat bertanda tangan HMAC, 180 hari).
- Sesi terkunci otomatis setelah 30 menit tidak aktif. Tombol **Kunci layar** tersedia, dan membuka kunci memerlukan PIN atau kata sandi pemilik sesi.
- "Ingat saya" menjaga sesi 7 hari; tanpa centang, sesi berakhir saat browser ditutup (maksimal 12 jam).
- Pengguna baru dan kata sandi yang diatur ulang **wajib diganti** saat pertama masuk.
- Mengganti kata sandi mengakhiri sesi lain milik pengguna itu. Menonaktifkan akun langsung mengakhiri semua sesinya.
- Hanya Pemilik yang bisa menunjuk Pemilik lain, dan minimal satu Pemilik harus tetap aktif.
- Persetujuan diskon, void, dan batal bill memakai PIN penyetuju yang diverifikasi server.
- Setiap aksi penting tercatat di `audit_logs` beserta alamat IP. Catatan yang dilaporkan aplikasi di browser (void, batal bill) dibatasi jenis tertentu dan ditandai sumber **Aplikasi**, sehingga tidak bisa dipakai memalsukan catatan **Server** (masuk, gagal masuk, perubahan akun).
- Galat PHP tidak pernah ditampilkan di respons (hanya dicatat ke error log); nama pengguna ditolak bila memuat tag HTML; pesan notifikasi di UI dirender sebagai teks, bukan HTML.

## API autentikasi

| Metode | Path | Keterangan |
|---|---|---|
| GET | `/api/health` | Cek aplikasi & koneksi DB |
| GET | `/api/auth/me` | Pengguna, izin, daftar peran, token CSRF (423 bila layar terkunci) |
| POST | `/api/auth/login` | `{email, password, remember}` |
| GET | `/api/auth/pin-users` | Daftar pengguna ber-PIN (hanya perangkat tepercaya) |
| POST | `/api/auth/pin` | `{user_id, pin}` |
| POST | `/api/auth/lock` · `/api/auth/unlock` · `/api/auth/logout` | Kunci layar, buka kunci (`{pin}` atau `{password}`), keluar |
| PUT | `/api/auth/me/credentials` | Ganti kata sandi/PIN sendiri |
| GET/POST | `/api/auth/approvers?perm=` · `/api/auth/approve` | Persetujuan dengan PIN |
| GET/POST/PUT | `/api/users`, `/api/users/{id}` | Kelola pengguna (izin `pengguna.kelola`) |
| GET/PUT | `/api/roles`, `/api/roles/{id}/permissions` | Matriks izin per peran |
| GET | `/api/audit-logs?limit=` | Log aktivitas |

Galat selalu berbentuk `{"error": {"code", "message", "details"}}`.

## Alur data yang saling terhubung

- **Penjualan**: stok bahan berkurang sesuai resep. Jurnal: Kas/Bank (D), Diskon (D), Penjualan (K), Service (K), Hutang PB1 (K), serta HPP (D) dan Persediaan (K).
- **Penerimaan barang**: stok bertambah dan harga rata-rata tertimbang diperbarui. Jurnal: Persediaan (D), Hutang Usaha (K).
- **Pembayaran pemasok, biaya, setor PB1, waste, dan opname** masing-masing otomatis membuat jurnal.
- Neraca selalu seimbang, dan nilai laporan persediaan cocok dengan saldo akun 1-104.

## Struktur berkas

```
index.html               kerangka aplikasi (sidebar, topbar)
assets/style.css         tema & komponen (token warna di :root)
assets/icons.js          ikon Lucide (ISC) yang dibundel lokal
assets/data.js           master data, mesin transaksi & akuntansi, simulasi 30 hari
assets/ui.js             router, modal, toast, format Rupiah, grafik SVG
assets/auth.js           klien API: layar masuk, PIN, kunci layar, izin di UI, Pengguna & Akses
api/index.php            front controller & daftar rute API
api/src/                 Auth, Users, Permissions, RateLimit, Audit, Db, Http
api/migrations/          skema MySQL
api/bin/migrate.php      migrasi + peran bawaan + Pemilik pertama (CLI)
api/config.example.php   contoh konfigurasi (salin ke luar document root)
tools/dev-router.php     router untuk server PHP bawaan (lokal)
assets/views-ops.js      Dasbor, Kasir, Meja, Layar Dapur, Riwayat Penjualan
assets/views-stock.js    Resep, Pemasok, Pembelian, Persediaan
assets/views-finance.js  Kas & Biaya, Laporan, Pengaturan
```

## Tema

Tema mengikuti design system **Khong Guan QHSE** yang dipakai KG SafeGuard (khongguan.semestateknologiutama.com):

- **Warna:** tangga biru merek (`--brand-050` sampai `--brand-900`) dan gradasi hero `#062b63` ke `#1a7bd4`.
- **Huruf:** Plus Jakarta Sans untuk judul, IBM Plex Sans untuk teks, IBM Plex Mono untuk angka.
- **Komponen:** bilah sisi bergradasi dengan menu aktif berwarna putih, hero bergradasi di setiap halaman, dan chip status bergaris kiri.

Token aslinya disalin apa adanya ke bagian atas `assets/style.css`, lalu dipetakan ke nama token Racik POS. Mode terang, gelap, dan ikut sistem bisa dipilih di bilah sisi.

Semua nama usaha, pemasok, dan transaksi adalah data contoh.
