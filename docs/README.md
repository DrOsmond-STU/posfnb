# Dokumentasi Pengembangan Racik POS

Dokumen ini adalah acuan tim sebelum membangun Racik POS versi produksi, yaitu aplikasi Point of Sale untuk restoran dan usaha F&B. Isinya mencakup seluruh alur usaha: pembelian bahan, standar menu dan resep, penjualan, persediaan, sampai laporan keuangan.

Purwarupa interaktif sudah tersedia di <https://posfnb.semestateknologiutama.com/>. Kode purwarupa ada di folder `assets/` pada repositori ini. Setiap perhitungan dan aturan di dokumen ini sudah dicocokkan dengan purwarupa tersebut. Bila keduanya berbeda, **dokumen ini yang berlaku**.

| Atribut | Nilai |
|---|---|
| Versi dokumen | 1.0 |
| Tanggal | 24 September 2026 |
| Status | Draf untuk ditinjau pemilik produk |
| Pemilik produk | Semesta Teknologi Utama |
| Tema visual | Design system Khong Guan QHSE (KG SafeGuard) |

## Daftar dokumen

| No | Dokumen | Isi | Dibaca oleh |
|---|---|---|---|
| 01 | [Ringkasan produk](01-ringkasan-produk.md) | Latar belakang, tujuan, persona, ruang lingkup, metrik keberhasilan | Semua |
| 02 | [Kebutuhan fungsional](02-kebutuhan-fungsional.md) | Kebutuhan per modul, cerita pengguna, kriteria penerimaan | Produk, pengembang, QA |
| 03 | [Peran & hak akses](03-peran-hak-akses.md) | Enam peran, katalog izin, matriks, aturan autentikasi | Produk, backend, QA |
| 04 | [Alur bisnis](04-alur-bisnis.md) | Alur pesanan-ke-kas, pembelian-ke-bayar, persediaan, tutup harian | Produk, pengembang |
| 05 | [Aturan perhitungan & akuntansi](05-aturan-akuntansi.md) | Rumus tagihan, pajak, HPP, valuasi stok, bagan akun, jurnal otomatis | Backend, akuntan, QA |
| 06 | [Arsitektur sistem](06-arsitektur.md) | Teknologi, komponen, mode luring kasir, integrasi, lingkungan | Tech lead, DevOps |
| 07 | [Skema basis data](07-skema-database.md) | ERD, definisi tabel, indeks, aturan integritas | Backend |
| 08 | [Spesifikasi API](08-spesifikasi-api.md) | Konvensi REST, autentikasi, daftar endpoint, contoh | Backend, frontend |
| 09 | [Kebutuhan non-fungsional](09-kebutuhan-nonfungsional.md) | Keamanan, kinerja, ketersediaan, cadangan, privasi | Tech lead, QA |
| 10 | [Panduan UI/UX](10-panduan-ui.md) | Token desain, komponen, pola layar, aksesibilitas | Desainer, frontend |
| 11 | [Rencana pengembangan](11-rencana-pengembangan.md) | Fase, sprint, tim, pengujian, UAT, peluncuran, risiko | Semua |
| 12 | [Glosarium & keputusan terbuka](12-glosarium.md) | Istilah F&B dan akuntansi, daftar hal yang perlu diputuskan | Semua |

## Cara memakai dokumen ini

1. **Pemilik produk** membaca 01, 02, 04, dan bagian keputusan terbuka di 12, lalu memberi persetujuan.
2. **Tech lead** memvalidasi 06, 07, 08, dan 09, lalu memecah 11 menjadi tiket.
3. **Pengembang** memakai 02 sebagai definisi "selesai" dan 05 sebagai sumber kebenaran untuk setiap angka.
4. **QA** menurunkan kasus uji dari kriteria penerimaan di 02, matriks izin di 03, dan contoh perhitungan di 05.

Perubahan dokumen dilakukan lewat *pull request*. Setiap perubahan aturan bisnis wajib memperbarui nomor versi di tabel atas dan menambah baris di [riwayat perubahan](#riwayat-perubahan).

## Riwayat perubahan

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 24 Sep 2026 | Versi pertama, disusun dari purwarupa Racik POS (commit `ad85215`) |
