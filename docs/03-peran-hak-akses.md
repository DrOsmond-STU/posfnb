# 03 · Peran & Hak Akses

Racik POS memakai kontrol akses berbasis peran (RBAC):

- Setiap pengguna punya **satu peran**.
- Setiap peran punya sekumpulan **izin**.
- Izin terbagi dua: **akses modul** (`m:<modul>`, boleh membuka halaman) dan **aksi** (boleh melakukan perubahan tertentu).

Server adalah satu-satunya penentu izin. Antarmuka hanya menyembunyikan atau mengunci tombol sebagai kemudahan (lihat [09 · Keamanan](09-kebutuhan-nonfungsional.md#91-keamanan)).

## 3.1 Peran bawaan

| ID | Peran | Tanggung jawab | Dapat diubah |
|---|---|---|---|
| `owner` | Pemilik | Akses penuh ke semua modul dan pengaturan | Tidak (selalu semua izin) |
| `manajer` | Manajer Outlet | Menjalankan operasional harian, menyetujui diskon, membaca semua laporan | Ya |
| `kasir` | Kasir | Mencatat pesanan dan menerima pembayaran; diskon perlu PIN penyetuju | Ya |
| `dapur` | Kepala Dapur | Layar dapur, standar resep, stok opname, bahan rusak | Ya |
| `gudang` | Staf Gudang | PO, penerimaan barang, data persediaan | Ya |
| `akuntan` | Akuntan | Kas & biaya, pembayaran pemasok, laporan | Ya |

## 3.2 Katalog izin

### Akses modul

| Izin | Modul |
|---|---|
| `m:dashboard` | Dasbor |
| `m:kasir` | Kasir (POS) |
| `m:meja` | Meja & Pesanan |
| `m:dapur` | Layar Dapur |
| `m:penjualan` | Riwayat Penjualan |
| `m:menu` | Standar Menu & Resep |
| `m:pembelian` | Pembelian |
| `m:pemasok` | Pemasok |
| `m:persediaan` | Persediaan |
| `m:kas` | Kas & Biaya |
| `m:lap-penjualan` | Laporan Penjualan |
| `m:lap-keuangan` | Laporan Keuangan |
| `m:lap-persediaan` | Laporan Persediaan |
| `m:pengguna` | Pengguna & Akses |
| `m:pengaturan` | Pengaturan |

### Aksi

| Izin | Arti | Endpoint yang dijaga (lihat [08](08-spesifikasi-api.md)) |
|---|---|---|
| `kasir.bayar` | Terima pembayaran | `POST /orders/{id}/pay` |
| `kasir.diskon` | Beri diskon tanpa persetujuan | `PATCH /orders/{id}` dengan `discount_pct > 0` |
| `penjualan.semua` | Lihat transaksi semua kasir | `GET /sales` tanpa filter kasir |
| `penjualan.void` *(baru)* | Membatalkan transaksi yang sudah dibayar | `POST /sales/{id}/void` |
| `menu.edit` | Ubah resep & harga jual | `POST/PUT/DELETE /menu-items…` |
| `po.buat` | Buat, kirim, batalkan PO; kelola pemasok | `POST/PUT /purchase-orders…`, `/suppliers…` |
| `po.terima` | Posting penerimaan barang | `POST /purchase-orders/{id}/receipts` |
| `po.bayar` | Bayar hutang pemasok | `POST /purchase-orders/{id}/payments` |
| `stok.bahan` | Tambah & ubah data bahan | `POST/PUT /ingredients…` |
| `stok.opname` | Posting stok opname | `POST /stock-counts/{id}/post` |
| `stok.waste` | Catat bahan rusak | `POST /wastes` |
| `kas.catat` | Catat biaya, setor kas & PBJT | `POST /expenses`, `/cash-transfers`, `/tax-payments` |
| `pengaturan.ubah` | Ubah pengaturan outlet | `PUT /settings` |
| `pengguna.kelola` | Kelola pengguna & hak akses | `/users…`, `/roles…` |
| `data.reset` | Atur ulang data demo | Hanya lingkungan demo; **tidak ada di produksi** |

## 3.3 Matriks izin bawaan

✓ = diizinkan; kosong = tidak.

| Izin | Pemilik | Manajer | Kasir | K. Dapur | Gudang | Akuntan |
|---|:-:|:-:|:-:|:-:|:-:|:-:|
| m:dashboard | ✓ | ✓ | | | | ✓ |
| m:kasir | ✓ | ✓ | ✓ | | | |
| m:meja | ✓ | ✓ | ✓ | | | |
| m:dapur | ✓ | ✓ | ✓ | ✓ | | |
| m:penjualan | ✓ | ✓ | ✓ | | | ✓ |
| m:menu | ✓ | ✓ | | ✓ | | |
| m:pembelian | ✓ | ✓ | | | ✓ | ✓ |
| m:pemasok | ✓ | ✓ | | | ✓ | ✓ |
| m:persediaan | ✓ | ✓ | | ✓ | ✓ | |
| m:kas | ✓ | ✓ | | | | ✓ |
| m:lap-penjualan | ✓ | ✓ | | | | ✓ |
| m:lap-keuangan | ✓ | ✓ | | | | ✓ |
| m:lap-persediaan | ✓ | ✓ | | ✓ | | ✓ |
| m:pengguna | ✓ | | | | | |
| m:pengaturan | ✓ | ✓ | | | | |
| kasir.bayar | ✓ | ✓ | ✓ | | | |
| kasir.diskon | ✓ | ✓ | | | | |
| penjualan.semua | ✓ | ✓ | | | | ✓ |
| penjualan.void | ✓ | ✓ | | | | |
| menu.edit | ✓ | ✓ | | ✓ | | |
| po.buat | ✓ | ✓ | | | ✓ | |
| po.terima | ✓ | ✓ | | | ✓ | |
| po.bayar | ✓ | ✓ | | | | ✓ |
| stok.bahan | ✓ | ✓ | | | ✓ | |
| stok.opname | ✓ | ✓ | | ✓ | ✓ | |
| stok.waste | ✓ | ✓ | | ✓ | ✓ | |
| kas.catat | ✓ | ✓ | | | | ✓ |
| pengaturan.ubah | ✓ | ✓ | | | | |
| pengguna.kelola | ✓ | | | | | |

## 3.4 Aturan akses

1. **Menu mengikuti izin.** Bilah sisi hanya menampilkan modul `m:*` yang dimiliki. Halaman awal setelah masuk adalah modul pertama yang diizinkan, dengan urutan seperti bilah sisi.
2. **Akses langsung lewat URL** ke modul yang tidak diizinkan menampilkan halaman "Anda tidak punya akses" dan tercatat sebagai `Akses ditolak`.
3. **Tombol aksi yang tidak diizinkan** tetap terlihat dalam keadaan terkunci, dengan tooltip "Perlu izin: …", agar pengguna tahu fitur itu ada.
4. **Persetujuan diskon:** bila kasir tanpa `kasir.diskon` memilih diskon, muncul dialog PIN. Penyetuju harus pengguna aktif yang punya `kasir.diskon` dan PIN. PIN yang salah menambah hitungan gagal milik penyetuju.
5. **Data milik sendiri:** tanpa `penjualan.semua`, daftar dan ringkasan transaksi disaring ke `cashier_id = pengguna saat ini`, termasuk angka di header halaman.
6. **Perlindungan Pemilik:**
   - peran Pemilik selalu `*`;
   - hanya Pemilik yang dapat membuat, mengubah, atau menunjuk Pemilik;
   - minimal satu Pemilik aktif harus tetap ada;
   - tidak ada yang bisa menonaktifkan akunnya sendiri.
7. **Perubahan izin berlaku segera**, dan sesi pengguna yang sedang masuk ikut terpengaruh pada permintaan berikutnya. Server tidak menyimpan izin di token berumur panjang (lihat [06](06-arsitektur.md#63-autentikasi)).

## 3.5 Kredensial

| Item | Aturan |
|---|---|
| Kata sandi | Minimal 8 karakter; disimpan dengan **bcrypt/Argon2id** di server (purwarupa memakai SHA-256 bergaram hanya untuk demo) |
| PIN | 6 digit angka; unik per pengguna tidak diwajibkan; disimpan dengan hash seperti kata sandi |
| Batas percobaan | 5 gagal → kunci 60 detik per email / per PIN pengguna; kunci ke-3 dalam 1 jam → kunci 15 menit dan notifikasi ke Pemilik |
| Sesi | Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; 7 hari bila "Ingat saya", selain itu 12 jam |
| Tidak aktif | 30 menit → layar terkunci (sesi tetap, butuh PIN/kata sandi untuk lanjut) |
| Atur ulang | Oleh Pemilik (langsung) atau tautan email sekali pakai 30 menit |

## 3.6 Log aktivitas (audit)

Setiap kejadian berikut wajib dicatat dengan `waktu, pengguna, aktivitas, detail, IP, user-agent`:

| Aktivitas | Contoh detail |
|---|---|
| Masuk / Masuk dengan PIN | Peramban desktop |
| Gagal masuk | `rina@…` / PIN salah |
| Akun terkunci sementara | `pw:rina@…` |
| Keluar / Layar dikunci | Tidak aktif 30 menit |
| Akses ditolak | Modul Laporan Keuangan |
| Persetujuan diskon / ditolak | Diskon 10% disetujui oleh Sari Wulandari |
| Pengguna ditambah / diubah | Dimas Saputra: peran → Manajer Outlet |
| Hak akses diubah | Kepala Dapur: − Ubah resep & harga jual |
| Kredensial diubah | kata sandi & PIN |
| Pengaturan diubah | Tarif PBJT 10% → 11% |
| Void transaksi | INV/20260924/0031, alasan: salah input |

Log bersifat **tambah saja**: tidak bisa diubah atau dihapus lewat aplikasi, dan disimpan minimal 1 tahun.
