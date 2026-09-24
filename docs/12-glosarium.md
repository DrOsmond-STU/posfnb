# 12 · Glosarium & Keputusan Terbuka

## 12.1 Glosarium

| Istilah | Arti di Racik POS |
|---|---|
| **Bill / order** | Pesanan yang belum dibayar. Bisa disimpan, ditambah, dan dikirim ke dapur. Belum memotong stok |
| **Invoice / sale** | Pesanan yang sudah dibayar. Memotong stok dan membuat jurnal |
| **Dine-in / Take away / Online** | Makan di tempat (pakai meja, kena service) / dibungkus / pesanan lewat aplikasi mitra ojol |
| **Service charge** | Biaya layanan (default 5%) atas penjualan bersih dine-in; pendapatan outlet (akun 4-102) |
| **PBJT (dulu PB1)** | Pajak Barang dan Jasa Tertentu atas makanan dan/atau minuman (pajak restoran daerah), default 10% atas bersih + service. Titipan yang disetor ke Bapenda, **bukan** pendapatan |
| **KDS** | *Kitchen Display System*: layar dapur yang menampilkan tiket pesanan |
| **Tiket dapur** | Kumpulan item yang dikirim kasir ke dapur dalam satu kali kirim |
| **All-day count** | Total porsi per menu yang sedang antri/dimasak, untuk persiapan dapur |
| **Resep standar** | Takaran bahan per 1 porsi yang menjadi dasar HPP dan pemotongan stok |
| **HPP** | Harga Pokok Penjualan: biaya bahan untuk membuat menu yang terjual |
| **Food cost %** | HPP ÷ harga jual × 100. Target umum restoran 28–35% |
| **Margin kontribusi (CM)** | Harga jual − HPP per porsi |
| **Menu engineering** | Klasifikasi menu berdasarkan popularitas dan CM: Star, Plowhorse, Puzzle, Dog |
| **Satuan pakai / satuan beli** | Satuan di resep (gr, ml, pcs) / satuan saat membeli (kg, jeriken, tray); dihubungkan oleh "isi per satuan beli" |
| **Harga rata-rata tertimbang** | Metode valuasi persediaan: harga per satuan diperbarui setiap penerimaan barang |
| **Stok minimum / target** | Batas bawah pemicu saran pembelian / jumlah ideal setelah membeli |
| **PO** | *Purchase Order*: pesanan pembelian ke pemasok |
| **GRN** | *Goods Receipt Note*: penerimaan barang yang menambah stok dan membuat hutang |
| **Termin** | Jumlah hari sejak barang diterima sampai hutang jatuh tempo |
| **Umur hutang** | Pengelompokan hutang menurut lama lewat jatuh tempo |
| **Stok opname** | Penghitungan fisik stok untuk menyesuaikan stok sistem |
| **Waste** | Bahan rusak, kedaluwarsa, tumpah, atau salah masak yang dikeluarkan dari stok |
| **Hari persediaan** | Berapa hari persediaan saat ini cukup untuk pemakaian rata-rata |
| **BKK** | Bukti Kas Keluar: dokumen pembayaran biaya atau hutang |
| **Tanggal bisnis** | Tanggal operasional outlet; berganti pada jam *cut-off* (default 04.00), bukan tengah malam |
| **Tutup hari / tutup bulan** | Mengunci transaksi pada tanggal/periode yang sudah direkonsiliasi |
| **Void** | Pembatalan transaksi yang sudah dibayar lewat dokumen pembalik (stok & jurnal dibalik) |
| **Mode luring** | Kasir bertransaksi tanpa koneksi server; transaksi diantrikan lalu disinkronkan |
| **RBAC** | *Role-Based Access Control*: hak akses ditentukan oleh peran pengguna |
| **PIN kasir** | Kode 6 digit untuk masuk cepat, membuka layar terkunci, dan menyetujui diskon |

## 12.2 Keputusan terbuka

Keputusan berikut perlu diambil pemilik produk **sebelum atau selama Fase 0**. Setiap butir sudah berisi rekomendasi.

| Kode | Pertanyaan | Pilihan | Rekomendasi | Dampak bila terlambat |
|---|---|---|---|---|
| K-01 | Teknologi backend & frontend | Laravel + Vue (PWA) / Laravel + Blade + Alpine / Node.js | **Laravel 11 + Vue 3 PWA** ([06](06-arsitektur.md#62-teknologi-yang-direkomendasikan)) | Seluruh jadwal |
| K-02 | Penyedia QRIS dinamis | Midtrans / Xendit / bank langsung | Pilih yang biaya MDR & proses KYB-nya paling cepat untuk badan usaha outlet | QRIS tertunda ke 1.1 |
| K-03 | Apakah bill terbuka "memesan" stok? | Tidak (purwarupa) / Ya, sebagai *reserved* | **Ya**, agar estimasi porsi di kasir lain akurat saat jam sibuk | Kasir bisa menjual porsi yang sebenarnya sudah dipesan meja lain |
| K-04 | Jam pergantian tanggal bisnis | 00.00 / 04.00 / sesuai jam tutup | **04.00** | Transaksi lewat tengah malam masuk ke hari yang salah |
| K-05 | Pembayaran non-tunai langsung ke Bank atau lewat Piutang Settlement | Langsung Bank (purwarupa) / Piutang 1-103 lalu dicocokkan saat dana masuk | **Piutang settlement**, karena dana QRIS/EDC/ojol masuk H+1 dikurangi MDR/komisi | Saldo bank di sistem tidak cocok dengan rekening koran |
| K-06 | Jatuh tempo hutang untuk penerimaan bertahap | Dari penerimaan terakhir (purwarupa) / per GRN | **Per GRN** (tiap penerimaan punya jatuh tempo sendiri) | Umur hutang kurang akurat |
| K-07 | Penanganan penjualan selama opname berlangsung | Abaikan (purwarupa) / sesuaikan otomatis dengan pemakaian sejak snapshot | **Sesuaikan otomatis** | Selisih opname palsu |
| K-08 | Kapan multi-outlet | 1.0 / 1.1 | **1.1**; skema sudah siap `outlet_id` | — |
| K-09 | Pembulatan total tagihan | Tanpa (purwarupa) / ke Rp 100 / ke Rp 500 | **Tanpa** di 1.0; opsi pengaturan di 1.1 | — |
| K-10 | Versi PHP & ekstensi di hosting | Perlu dicek (PHP ≥ 8.2, `intl`, `bcmath`, `sodium`) | Cek di Fase 0; bila tidak tersedia, pilih paket hosting/VPS lain | Laravel 11 tidak bisa berjalan |
| K-11 | Subdomain staging | `staging-posfnb.…` / subfolder | **Subdomain terpisah** dengan DB terpisah | Uji di produksi |
| K-12 | Apakah service charge termasuk dasar PBJT | Ya (purwarupa, umum di DKI) / Tidak | **Ya**, dan dijadikan pengaturan per daerah | Salah hitung pajak di daerah lain |
| K-13 | Perangkat kasir & printer standar | Tablet Android + RawBT / PC Windows + QZ Tray | Tentukan 1 paket perangkat untuk UAT | Driver cetak dikembangkan dua kali |
| K-14 | Nama produk final | "Racik POS" (purwarupa) / lainnya | Konfirmasi sebelum desain materi pelatihan | — |

## 12.3 Perbedaan purwarupa vs versi produksi

Hal-hal di bawah ini sengaja disederhanakan di purwarupa dan **wajib** diganti di produksi:

| Area | Purwarupa | Produksi |
|---|---|---|
| Penyimpanan | `localStorage` peramban, data demo dibuat ulang setiap hari | MySQL di server, data permanen |
| Autentikasi | Diperiksa di peramban, hash SHA-256 bergaram | Diperiksa di server, Argon2id, sesi cookie |
| Izin | Disembunyikan/dikunci di UI | Ditegakkan di setiap endpoint |
| Jurnal penjualan historis | Satu jurnal rekap per hari (data simulasi) | Satu jurnal per transaksi |
| QRIS | QR simulasi + konfirmasi manual | QRIS dinamis + webhook |
| Cetak | Toast "dikirim ke printer" | ESC/POS nyata |
| Ekspor laporan | Toast simulasi | File XLSX/PDF nyata |
| Tanggal bisnis | Tanggal kalender | Cut-off 04.00 |
| Luring | Tidak ada (semua lokal) | Outbox IndexedDB + sinkron idempoten |
