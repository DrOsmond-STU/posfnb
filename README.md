# Racik POS: purwarupa UI/UX POS Resto & F&B

Purwarupa interaktif aplikasi Point of Sale untuk restoran dan usaha F&B. Alurnya lengkap, mulai dari pembelian bahan, standar menu dan resep, penjualan di kasir, sampai laporan keuangan dan laporan persediaan.

Aplikasi ini murni HTML, CSS, dan JavaScript tanpa build step dan tanpa backend. Semua data demo dibuat otomatis di browser.

## Cara menjalankan

```bash
python3 -m http.server 8000
# buka http://localhost:8000
```

Bisa juga langsung membuka `index.html` di browser.

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

Aplikasi dibuka dengan layar masuk. Ada dua cara masuk: **email + kata sandi**, atau **PIN kasir 6 digit** dengan papan angka untuk berganti kasir dengan cepat. Semua akun demo memakai kata sandi `demo1234`.

| Peran | Akun demo | PIN | Modul |
|---|---|---|---|
| Pemilik | andi@dapurnusantara.id | 111111 | Semua, termasuk Pengguna & Akses |
| Manajer Outlet | sari@dapurnusantara.id | 222222 | Semua kecuali Pengguna & Akses; bisa menyetujui diskon |
| Kasir | rina@ / dimas@dapurnusantara.id | 123456 / 654321 | Kasir, Meja, Layar Dapur, riwayat transaksi sendiri |
| Kepala Dapur | wayan@dapurnusantara.id | 333333 | Layar Dapur, Resep, Persediaan (opname & waste) |
| Staf Gudang | joko@dapurnusantara.id | 444444 | Pembelian, Pemasok, Persediaan |
| Akuntan | maya@dapurnusantara.id | — | Dasbor, Kas & Biaya, semua laporan, bayar pemasok |
| (nonaktif) | budi@dapurnusantara.id | — | Tidak bisa masuk |

- **Menu mengikuti peran:** bilah sisi hanya menampilkan modul yang diizinkan. Membuka URL modul lain menampilkan halaman "tidak punya akses", dan tombol aksi yang tidak diizinkan tampil terkunci.
- **Diskon butuh persetujuan:** kasir yang memilih diskon harus meminta PIN Manajer atau Pemilik. Nama penyetujunya tercatat di transaksi.
- **Pengguna & Akses** (khusus Pemilik) berisi:
  - daftar pengguna: tambah, ubah peran, atur ulang kata sandi & PIN, aktif/nonaktif;
  - matriks hak akses per peran, yang bisa dicentang langsung;
  - log aktivitas: masuk, gagal masuk, akses ditolak, persetujuan diskon, perubahan hak akses.
- **Keamanan dasar:**
  - kata sandi & PIN disimpan sebagai hash SHA-256 bergaram;
  - 5 kali gagal akan mengunci akun selama 60 detik;
  - sesi terkunci otomatis setelah 30 menit tidak aktif;
  - "Ingat saya" menjaga sesi 7 hari (tanpa centang, sesi berakhir saat tab ditutup);
  - tombol **Kunci layar** untuk berganti kasir;
  - hanya Pemilik yang bisa menunjuk Pemilik lain, dan minimal satu Pemilik harus tetap aktif.

> Ini autentikasi purwarupa di sisi peramban. Siapa pun yang membuka DevTools bisa melewatinya. Untuk produksi, verifikasi kata sandi, sesi, dan pengecekan izin wajib dijalankan di server (mis. PHP/Laravel + MySQL di hosting yang sama).

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
assets/auth.js           layar masuk, sesi, peran & izin, Pengguna & Akses, log aktivitas
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
