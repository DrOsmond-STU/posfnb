# 10 · Panduan UI/UX

Acuan visual: purwarupa di <https://posfnb.semestateknologiutama.com/> yang mengikuti design system **Khong Guan QHSE** (KG SafeGuard, `khongguan.semestateknologiutama.com`). Implementasi Vue wajib memakai token yang sama. Token disalin apa adanya dari `assets/style.css` bagian 1.

## 10.1 Token desain

### Warna

| Token | Terang | Gelap | Pemakaian |
|---|---|---|---|
| `--brand-900` | #04234f | #0a2f63 | Toast, tooltip |
| `--brand-700` | #0b4da2 | #1565b8 | Teks tautan, tombol sekunder, menu aktif |
| `--brand-600` | #1268c4 | #2b82d6 | Aksen, sakelar aktif |
| `--brand-500` | #1a7bd4 | #4a9be4 | Grafik utama, fokus |
| `--brand-100` | #dcebfa | #14324d | Latar ikon, chip terpilih |
| `--brand-050` | #f0f7fe | #0f2537 | Hover baris tabel |
| `--grad-hero-from → to` | #062b63 → #1a7bd4 | #041b3f → #0b4da2 | Bilah sisi, header halaman, panel login |
| `--grad-action-from → to` | #1268c4 → #34a8e0 | #1565b8 → #2f97ce | Tombol utama |
| `--surface-000/100/200/300` | #fff / #f1f5fb / #e3ebf6 / #d2deee | #0b1724 / #071220 / #12212f / #1b2d3e | Kartu / latar / kepala tabel / trek |
| `--ink-900/700/500/400` | #0b1b2e / #27405c / #526883 / #6f8399 | #eaf2fb / #c3d6e8 / #93a9c0 / #7a90a8 | Judul / teks / sekunder / samar |
| `--signal-low` | #1c7f5a | #52c99a | Aman, lunas, food cost di bawah target |
| `--signal-medium` | #8a6400 | #f2c14e | Menipis, peringatan |
| `--signal-high` | #c2540c | #ffa057 | Reservasi, catatan dapur, tiket ≥ 10 menit |
| `--signal-critical` | #b00d21 | #ff7a85 | Habis, gagal, tiket ≥ 20 menit, badge notifikasi |
| `--kg-red-600` | #c8102e | | Hanya untuk lambang/kop dokumen |

Warna sinyal hanya dipakai untuk status, bukan untuk membedakan seri grafik.

### Tipografi

| Peran | Huruf | Ukuran |
|---|---|---|
| Judul halaman, merek, judul modal | Plus Jakarta Sans 700 | 30 / 20 / 17 px |
| Teks antarmuka | IBM Plex Sans 400–600 | 14 px / 22 px |
| Angka (KPI, harga, tabel angka, nomor meja, struk) | IBM Plex Mono 500–600, `tabular-nums` | 13–32 px |
| Label kapital (kepala tabel, eyebrow) | IBM Plex Sans 700, huruf kapital, spasi .09em | 11 px |

### Bentuk & ruang

- Jarak: kelipatan 4 (`--space-1` 4 px s.d. `--space-9` 64 px).
- Sudut: 6 (chip), 10 (tombol, input), 14 (kartu), 20 (modal, header halaman).
- Bayangan: `--shadow-card` untuk kartu; `--shadow-float-sm/md/lg` untuk kontrol yang bisa ditekan; `--shadow-press` saat ditekan.

## 10.2 Kerangka halaman

```
┌───────────────┬──────────────────────────────────────────────┐
│ Bilah sisi    │  HEADER GRADASI (rounded bawah 20 px)        │
│ (gradasi)     │  EYEBROW · GRUP MODUL · OUTLET               │
│ • merek       │  Judul halaman               ANGKA UTAMA     │
│ • grup modul  │  Deskripsi singkat           label           │
│ • menu aktif  ├──────────────────────────────────────────────┤
│   = putih     │  Konten: strip ringkasan → filter → kartu/   │
│ • tema        │  tabel/grafik                                │
│ • pengguna,   │                                              │
│   kunci, keluar│                                             │
└───────────────┴──────────────────────────────────────────────┘
```

- **Header ringkas** untuk Kasir dan Layar Dapur agar ruang kerja maksimal.
- **≤ 1024 px:** bilah sisi menjadi laci (tombol ☰ di header) dengan latar gelap semi-transparan.
- **≤ 560 px:** grid satu kolom; grid menu kasir dua kolom.

## 10.3 Komponen

| Komponen | Spesifikasi | Dipakai di |
|---|---|---|
| Ubin KPI | Ikon 32 px + label kapital, angka mono 24 px, catatan di bawah garis | Dasbor, Kas |
| Strip ringkasan | Sel label kapital + angka mono 17 px, dipisah garis | Hampir semua halaman |
| Chip status | Sudut 6 px, garis kiri 3 px warna sinyal, teks 11 px tebal | Status stok, PO, food cost, peran |
| Chip filter (pil) | Putih, border, bayangan; terpilih = latar `brand-100` | Kategori menu, status PO |
| Segmented control | Latar `surface-200`, tombol aktif putih | Periode, tipe pesanan, cara masuk |
| Tabel | Kepala `surface-200` kapital 11 px; hover `brand-050`; angka rata kanan mono | Semua daftar |
| Kartu menu kasir | Area ikon 80 px berwarna per kategori, nama, harga mono, "Bisa dibuat ±N porsi" | Kasir |
| Tiket dapur | Lokasi, no. order, timer mono berwarna, daftar qty × item + catatan oranye | Layar dapur |
| Modal | Sudut 20 px, judul Plus Jakarta 20 px, footer tombol kanan | Semua form |
| Toast | Pil `brand-900` di tengah bawah, hilang 3,2 detik | Umpan balik aksi |
| Kontrol terkunci | Opasitas .45, kursor *not-allowed*, tooltip "Perlu izin: …" | RBAC |

## 10.4 Pola interaksi

1. **Umpan balik setiap aksi:** toast menyebut hasil konkret, mis. "GRN/2609/067 diposting · stok bertambah Rp 1.240.000".
2. **Konfirmasi di dalam halaman** untuk aksi berisiko (batalkan PO, atur ulang data, void), tanpa dialog `confirm()` peramban.
3. **Galat menjelaskan penyebab dan jalan keluar**, mis. "Stok bahan Nasi Rendang Sapi tidak cukup. Cek persediaan."
4. **Status selalu terbaca tanpa warna saja:** chip berisi teks, dan timer dapur menampilkan menit.
5. **Kasir bisa dioperasikan dengan sentuhan:** target ≥ 44 px, PIN pad 54 px, tombol Bayar besar di bawah panel pesanan.
6. **Angka keuangan** selalu rata kanan dengan `tabular-nums`; negatif ditampilkan "−Rp 9.500" berwarna kritis.

## 10.5 Daftar layar

| Layar | Purwarupa | Catatan untuk produksi |
|---|---|---|
| Masuk (email / PIN) | Ada | Tambah "lupa kata sandi" via email |
| Dasbor | Ada | Data dari `/dashboard` |
| Kasir + pembayaran + struk | Ada | Tambah split bill, indikator luring, antrean sinkron |
| Meja & pesanan | Ada | Tambah pindah/gabung meja |
| Layar dapur | Ada | Mode layar penuh, bunyi |
| Riwayat penjualan | Ada | Tambah void & ekspor |
| Standar menu & resep | Ada | Tambah unggah foto, riwayat harga |
| Pembelian (PO, GRN, hutang, saran) | Ada | Tambah PDF PO & kirim |
| Pemasok | Ada | |
| Persediaan (stok, kartu, opname, waste) | Ada | Tambah draf opname |
| Kas & biaya | Ada | Unggah lampiran ke server |
| Laporan penjualan / keuangan / persediaan | Ada | Tambah rentang kustom & ekspor nyata |
| Pengguna & akses | Ada | |
| Pengaturan | Ada | Tambah daftar diskon & tes printer |
| Buka/tutup shift | Belum | Baru (FR-POS-18) |
| Tutup hari & tutup bulan | Belum | Baru ([4.9](04-alur-bisnis.md#49-kas-harian--tutup-hari), [4.10](04-alur-bisnis.md#410-tutup-bulan)) |

## 10.6 Grafik

- Satu seri memakai `--brand-500` tanpa legenda; judul kartu menyebut seri.
- Batang bersudut 4 px dengan jarak antar-batang; garis kisi `surface-200`; label sumbu mono 11 px.
- Setiap batang punya tooltip berisi tanggal/jam, nilai Rupiah, dan jumlah transaksi.
- Tidak memakai dua sumbu Y. Dua ukuran berbeda ditampilkan di dua grafik terpisah.
