# 11 · Rencana Pengembangan

## 11.1 Tim yang disarankan

| Peran | Alokasi | Tanggung jawab |
|---|---|---|
| Pemilik produk | 20% | Prioritas, keputusan terbuka ([12](12-glosarium.md#122-keputusan-terbuka)), penerimaan sprint |
| Tech lead / backend senior | 100% | Arsitektur, service domain (checkout, stok, jurnal), review kode |
| Backend | 100% | Modul pembelian, persediaan, laporan, integrasi QRIS |
| Frontend | 100% | SPA Vue, PWA luring, cetak struk, porting komponen purwarupa |
| QA | 50% | Kasus uji dari KP & contoh 05, E2E Playwright, UAT |
| Desainer UI | 20% | Layar baru (shift, tutup hari), review konsistensi token KG |
| Akuntan (penasihat) | Sesuai kebutuhan | Validasi jurnal & laporan di Sprint 6 |

## 11.2 Fase & sprint (2 minggu per sprint)

| Fase | Sprint | Minggu | Hasil utama | Kebutuhan |
|---|---|---|---|---|
| 0 · Persiapan | — | 1 | Dokumen disetujui, keputusan K-01…K-12 diambil, repo Laravel + Vue, CI, staging, skema awal | — |
| 1 · Fondasi | S1 | 2–3 | Masuk email/PIN, sesi, kunci layar, rate limit, peran & matriks izin, log aktivitas, profil outlet & pengaturan pajak | FR-AUTH, FR-USER, FR-SET-01..03 |
| | S2 | 4–5 | Master data: kategori & menu, bahan & satuan, resep + HPP/food cost/harga saran, pemasok, meja; seeder demo | FR-MENU, FR-INV-01..03, FR-SUP, FR-TABLE-01 |
| 2 · Penjualan | S3 | 6–7 | Kasir: keranjang, bill tersimpan, kirim ke dapur, layar dapur (polling), meja & reservasi, persetujuan diskon | FR-POS-01..09, FR-KDS, FR-TABLE |
| | S4 | 8–9 | Checkout: tunai/kartu/online, potong stok per resep, jurnal penjualan+HPP, struk & cetak ESC/POS, riwayat penjualan, dasbor | FR-POS-10,12,13,15,16, FR-SALES, FR-DASH |
| 3 · Pembelian & stok | S5 | 10–11 | PO, GRN sebagian, harga rata-rata, hutang & umur hutang, pembayaran, saran pembelian, kartu stok, opname, waste | FR-PO, FR-INV-04..08 |
| 4 · Keuangan | S6 | 12–13 | Kas & biaya, setoran, laba rugi, neraca, arus kas, jurnal & buku besar, laporan penjualan & persediaan, ekspor | FR-CASH, FR-RPT |
| 5 · Operasional lanjut | S7 | 14–15 | QRIS dinamis + webhook, mode luring + sinkron, buka/tutup shift, tutup hari, void transaksi | FR-POS-11,17,18,19 |
| 6 · Peluncuran | S8 | 16–17 | Hardening keamanan & kinerja, UAT di outlet percontohan, migrasi data awal, pelatihan, go-live, pendampingan | NFR, 11.5–11.7 |

**Perkiraan total: ± 17 minggu (± 4 bulan).** Jadwal bergeser bila keputusan terbuka terlambat atau akses penyedia QRIS memerlukan proses KYB yang lama. Proses KYB dimulai di Fase 0.

## 11.3 Definisi selesai (Definition of Done)

Sebuah tiket selesai bila:

1. Semua kriteria penerimaan di [02](02-kebutuhan-fungsional.md) untuk kode FR terkait terpenuhi.
2. Izin ditegakkan di server, dan ada uji yang membuktikan pengguna tanpa izin mendapat `403`.
3. Angka uang/stok memakai service domain dan diuji dengan contoh di [05](05-aturan-akuntansi.md).
4. Uji unit & fitur lulus di CI; tidak ada penurunan cakupan pada service domain.
5. Tampilan mengikuti [10](10-panduan-ui.md): tema terang & gelap, lebar 390 px, fokus keyboard terlihat.
6. Aksi sensitif tercatat di log aktivitas.
7. Dokumentasi `docs/` diperbarui bila perilaku berubah.
8. Didemokan di staging dan diterima pemilik produk.

## 11.4 Strategi pengujian

| Lapisan | Alat | Fokus |
|---|---|---|
| Unit | Pest / Vitest | `BillCalculator` (contoh A & B), valuasi rata-rata (D), HPP (C), jurnal (E), menu engineering, saran pembelian |
| Fitur/API | Pest + DB uji | Setiap endpoint: 200/403/409/422; transaksi atomik (gagal di tengah = tidak ada perubahan) |
| Invarian | Pest (terjadwal) | Σ debit = Σ kredit per outlet; `stock_qty` = Σ `stock_movements.qty`; saldo 1-104 ≈ Σ nilai stok (toleransi Rp 10/bahan) |
| E2E | Playwright | Alur dari [9.8](09-kebutuhan-nonfungsional.md#98-pemeliharaan--kualitas-kode) per peran, desktop & 390 px, terang & gelap |
| Luring | Playwright (network offline) | 20 transaksi luring → daring → semua tersinkron, nomor resmi, tanpa duplikat |
| Beban | k6 | 10 kasir bersamaan × 1 transaksi / 20 detik selama 30 menit; p95 bayar < 800 ms |
| Keamanan | Checklist OWASP ASVS L1 + `composer/npm audit` | Autentikasi, sesi, akses, input |

Purwarupa sudah punya skrip Playwright (`smoke`, `auth-test`, `login-check`). Skrip itu bisa dipakai ulang sebagai titik awal E2E.

## 11.5 Uji penerimaan pengguna (UAT)

Dilakukan 5 hari operasional di outlet percontohan, berdampingan dengan sistem lama:

| Hari | Skenario | Lulus bila |
|---|---|---|
| 1 | Input master nyata: menu, resep, bahan, pemasok, meja, pengguna | Food cost per menu disetujui kepala dapur |
| 2 | Operasional kasir penuh (dine-in, take away, online, diskon, QRIS) | Total harian sama dengan sistem lama; tidak ada transaksi gagal |
| 3 | Putus internet 30 menit saat jam sibuk | Semua transaksi tersinkron tanpa duplikat |
| 4 | PO → GRN → bayar; waste; opname sebagian | Kartu stok cocok dengan hitung fisik ± toleransi |
| 5 | Tutup hari & laporan | Laba rugi, neraca, dan arus kas disetujui akuntan |

## 11.6 Migrasi data awal

1. Master: menu, bahan (dengan satuan & isi satuan beli), pemasok, meja. Diimpor dari templat Excel yang disediakan.
2. Saldo awal: stok fisik per bahan dan harga beli terakhir (opname hari H−1); saldo kas, bank, hutang pemasok per PO terbuka; nilai peralatan.
3. Sistem membuat jurnal `JU/SALDO-AWAL` dan mutasi stok `opening`. Neraca awal ditinjau akuntan sebelum go-live.
4. Riwayat penjualan lama **tidak** dimigrasi. Laporan pembanding disimpan terpisah.

## 11.7 Daftar periksa go-live

- [ ] `.env` produksi: `APP_ENV=production`, `APP_DEBUG=false`, kunci aplikasi baru, kredensial DB & SMTP & QRIS produksi
- [ ] Document root subdomain → `…/public`; `.git`, `.env` tidak bisa diakses
- [ ] Cron `schedule:run` aktif; backup harian terverifikasi dan uji pulihkan berhasil
- [ ] Akun Pemilik asli dibuat; akun demo & data demo **dihapus**
- [ ] Printer kasir & dapur tercetak dari perangkat produksi
- [ ] QRIS produksi: transaksi Rp 1.000 nyata masuk dan webhook tercatat
- [ ] Pelatihan: kasir (1 jam), dapur (30 menit), gudang (1 jam), manajer & akuntan (2 jam)
- [ ] Rencana kembali ke sistem lama bila terjadi masalah kritis di minggu pertama
- [ ] Pendampingan di outlet pada 3 hari pertama

## 11.8 Risiko

| Risiko | Dampak | Kemungkinan | Mitigasi |
|---|---|---|---|
| Shared hosting lambat saat jam sibuk | Kasir menunggu | Sedang | Mode luring, indeks, tabel ringkasan; jalur pindah ke VPS disiapkan |
| KYB penyedia QRIS lama | QRIS dinamis tertunda | Sedang | Mulai di Fase 0; fallback QRIS statis + konfirmasi manajer |
| Data resep tidak akurat | Food cost & stok menyesatkan | Tinggi | Workshop resep dengan kepala dapur di S2; opname mingguan bulan pertama |
| Konflik stok karena transaksi luring | Stok minus | Sedang | Terima transaksi, tandai minus, laporan pengecualian harian |
| Pengguna menolak perubahan | Adopsi rendah | Sedang | Purwarupa dipakai untuk pelatihan; UAT berdampingan |
| Kebocoran akun kasir (PIN dibagi) | Transaksi tanpa jejak asli | Sedang | PIN per orang, kunci otomatis, log aktivitas, void butuh persetujuan |
| Printer tidak didukung | Struk tidak tercetak | Rendah | Daftar printer teruji; fallback cetak peramban |

## 11.9 Peta jalan setelah 1.0

| Versi | Isi |
|---|---|
| 1.1 | Banyak outlet & transfer stok; laporan konsolidasi; 2FA Pemilik; Bahasa Inggris; notifikasi harian |
| 1.2 | Sub-resep & produksi (bahan setengah jadi); modifier berbayar; batch & kedaluwarsa |
| 1.3 | Integrasi GoFood/GrabFood; program member & poin; reservasi online |
| 1.4 | Absensi & penggajian sederhana; penyusutan aset; e-SPTPD PBJT |
