# 01 · Ringkasan Produk

## 1.1 Latar belakang

Restoran kecil dan menengah di Indonesia umumnya memakai tiga alat yang terpisah:

- aplikasi kasir untuk penjualan;
- buku atau spreadsheet untuk stok dan pembelian;
- akuntan eksternal untuk laporan keuangan.

Akibatnya:

- **Food cost tidak diketahui sampai akhir bulan.** Pemilik baru tahu margin menipis setelah uangnya habis.
- **Stok selisih tanpa penjelasan.** Tidak ada pembanding antara pemakaian menurut resep (teoretis) dan hasil hitung fisik (aktual).
- **Pembelian reaktif.** Bahan habis di tengah jam sibuk karena tidak ada stok minimum dan saran pembelian.
- **Laporan pajak dan keuangan disusun manual.** PB1/PBJT, hutang pemasok, dan laba rugi dihitung ulang dari nota.

Racik POS menyatukan semuanya dalam satu data. Setiap porsi yang terjual memotong stok sesuai resep standar dan otomatis membuat jurnal akuntansi.

## 1.2 Tujuan produk

| Kode | Tujuan | Ukuran |
|---|---|---|
| T1 | Kasir melayani pesanan dengan cepat | Satu transaksi 3 item selesai < 45 detik, dari pilih menu sampai struk |
| T2 | Pemilik tahu food cost setiap hari | Food cost harian tersedia di dasbor tanpa input tambahan |
| T3 | Stok bahan selalu bisa dipertanggungjawabkan | Selisih opname dapat ditelusuri ke kartu stok per bahan |
| T4 | Pembelian terencana | Saran PO otomatis untuk bahan di bawah stok minimum |
| T5 | Laporan keuangan tanpa entri ganda | Laba rugi, neraca, dan arus kas dihasilkan dari jurnal otomatis dan selalu seimbang |
| T6 | Akses sesuai tanggung jawab | Setiap pengguna hanya melihat dan mengubah data sesuai perannya; semua aksi sensitif tercatat |

## 1.3 Persona

| Persona | Peran sistem | Kebutuhan utama | Perangkat |
|---|---|---|---|
| **Andi**, pemilik | Pemilik | Melihat kesehatan usaha dari mana saja, mengatur harga dan akses | Laptop, HP |
| **Sari**, manajer outlet | Manajer Outlet | Menjalankan shift, menyetujui diskon, mengawasi stok dan kas | Tablet, laptop |
| **Rina**, kasir | Kasir | Input pesanan cepat, bayar dengan banyak metode, cetak struk | Tablet/PC kasir + printer thermal |
| **Wayan**, kepala dapur | Kepala Dapur | Melihat antrian pesanan, menjaga standar resep, mencatat bahan rusak | Layar dapur (tablet/TV) |
| **Joko**, staf gudang | Staf Gudang | Membuat PO, menerima barang sesuai surat jalan, stok opname | HP/tablet |
| **Maya**, akuntan | Akuntan | Mencatat biaya, membayar pemasok, menutup buku dan menyusun laporan | Laptop |

## 1.4 Ruang lingkup versi 1.0 (MVP produksi)

Termasuk:

1. **Autentikasi & hak akses:** email + kata sandi, PIN kasir 6 digit, 6 peran bawaan, matriks izin yang bisa diubah, log aktivitas.
2. **Kasir (POS):** dine-in, take away, online (input manual); catatan dapur; diskon dengan persetujuan; service charge; PBJT; pembayaran tunai, QRIS, kartu, dan mitra ojol; bill tersimpan; struk.
3. **Meja & pesanan:** denah meja per area, status meja, reservasi sederhana, bill terbuka.
4. **Layar dapur (KDS):** tiket antrian, sedang dimasak, siap; timer; total porsi per menu.
5. **Standar menu & resep:** takaran bahan per porsi, HPP otomatis, food cost vs target, harga jual saran, langkah pembuatan, standar penyajian.
6. **Pembelian:** pemasok, PO, penerimaan barang (sebagian atau penuh), hutang dan umur hutang, pembayaran, saran pembelian.
7. **Persediaan:** master bahan, stok minimum, kartu stok, stok opname, bahan rusak (waste), valuasi harga rata-rata tertimbang.
8. **Kas & biaya:** bukti kas keluar, setor kas ke bank, setor PBJT.
9. **Laporan:** penjualan (harian, per jam, metode bayar, per menu, menu engineering); keuangan (laba rugi, neraca, arus kas, jurnal umum, buku besar); persediaan (mutasi, hari persediaan, rekonsiliasi).
10. **Pengaturan:** profil outlet, tarif pajak dan service, target food cost, perangkat.

Tidak termasuk dan dijadwalkan untuk versi berikutnya (lihat [11 · Rencana](11-rencana-pengembangan.md)):

- banyak outlet dengan transfer stok antar-outlet dan laporan konsolidasi;
- integrasi langsung GoFood/GrabFood/ShopeeFood (versi 1.0: input manual);
- program loyalitas dan member;
- resep bertingkat (sub-resep, bahan setengah jadi hasil produksi);
- modifier berbayar (ekstra keju, level pedas berbayar);
- penggajian, absensi, dan pajak penghasilan;
- penyusutan aset tetap otomatis;
- e-Faktur dan pelaporan pajak otomatis ke Bapenda.

## 1.5 Asumsi

- Satu akun usaha memiliki satu outlet pada versi 1.0. Skema data sudah menyiapkan `outlet_id` agar banyak outlet bisa ditambahkan tanpa migrasi besar.
- Mata uang tunggal Rupiah tanpa desimal; semua nilai uang disimpan sebagai bilangan bulat.
- Pajak restoran memakai PBJT atas makanan dan/atau minuman (dulu PB1) dengan tarif default 10%, yang bisa diubah per outlet.
- Jam operasional default 10.00–22.00 WIB. Transaksi lewat tengah malam tetap masuk ke **tanggal bisnis** hari buka (lihat [05](05-aturan-akuntansi.md#56-tanggal-bisnis-dan-tutup-harian)).
- Koneksi internet outlet bisa putus, jadi kasir harus tetap bisa bertransaksi saat luring (lihat [06](06-arsitektur.md#64-mode-luring-kasir)).

## 1.6 Metrik keberhasilan (3 bulan setelah peluncuran)

| Metrik | Target |
|---|---|
| Rata-rata waktu transaksi kasir | < 45 detik |
| Transaksi gagal tersinkron setelah luring | 0 |
| Selisih nilai opname bulanan | < 1,5% dari nilai pemakaian |
| Laporan laba rugi bulanan siap | H+1 setelah tutup bulan |
| Kepuasan pengguna (survei internal, skala 1–5) | ≥ 4,2 |
| Insiden keamanan (akses tanpa izin) | 0 |

## 1.7 Pemangku kepentingan

| Pihak | Peran dalam proyek |
|---|---|
| Semesta Teknologi Utama | Pemilik produk, pengembang, operator hosting |
| Outlet percontohan (Dapur Nusantara, Kemang) | Pengguna UAT dan sumber data resep nyata |
| Akuntan outlet | Validator aturan jurnal dan laporan keuangan |
| Penyedia pembayaran (mis. Midtrans/Xendit) | Integrasi QRIS dinamis |
