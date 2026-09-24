# 05 · Aturan Perhitungan & Akuntansi

Dokumen ini adalah **sumber kebenaran** untuk setiap angka di Racik POS. Semua implementasi (server, kasir luring, laporan) wajib menghasilkan angka yang sama dengan contoh di sini. Contoh-contoh ini juga menjadi kasus uji otomatis.

## 5.1 Perhitungan tagihan

Semua nilai uang adalah **bilangan bulat Rupiah**. Pembulatan memakai *round half up* (0,5 dibulatkan ke atas) pada setiap langkah yang ditandai `round`.

```
subtotal  = Σ (harga_jual_menu × qty)
diskon    = round(subtotal × diskon_% ÷ 100)
bersih    = subtotal − diskon
service   = round(bersih × service_% ÷ 100)      jika dine-in, atau take away dan "service untuk take away" aktif; selain itu 0
pbjt      = round((bersih + service) × pbjt_% ÷ 100)   jika PBJT aktif; selain itu 0
total     = bersih + service + pbjt
```

**Urutan penting:**

- Diskon dihitung sebelum service.
- PBJT dikenakan atas bersih + service. Service charge termasuk dasar pengenaan PBJT.
- Harga menu disimpan **sebelum pajak**.

### Contoh A: take away tanpa diskon

| Item | Qty | Harga | Jumlah |
|---|--:|--:|--:|
| Nasi Goreng Spesial | 2 | 35.000 | 70.000 |
| Es Kopi Susu Gula Aren | 1 | 25.000 | 25.000 |
| **Subtotal** | | | **95.000** |
| Diskon | | | 0 |
| Service (take away) | | | 0 |
| PBJT 10% × 95.000 | | | 9.500 |
| **Total** | | | **104.500** |

### Contoh B: dine-in, diskon member 10%

| Baris | Perhitungan | Nilai |
|---|---|--:|
| Subtotal | | 95.000 |
| Diskon 10% | round(95.000 × 10%) | 9.500 |
| Bersih | 95.000 − 9.500 | 85.500 |
| Service 5% | round(85.500 × 5%) | 4.275 |
| PBJT 10% | round((85.500 + 4.275) × 10%) = round(8.977,5) | 8.978 |
| **Total** | 85.500 + 4.275 + 8.978 | **98.753** |

### Pembayaran tunai

`kembalian = uang_diterima − total`; konfirmasi ditolak bila `uang_diterima < total`. Tombol nominal cepat: uang pas, lalu pembulatan ke atas ke 10.000, 50.000, 100.000, 100.000 + 50.000, dan 100.000 + 100.000 (nilai ganda dihapus).

## 5.2 Satuan bahan

| Satuan pakai | Contoh satuan beli | Isi per satuan beli |
|---|---|---|
| gr | kg, pack 2,5 kg, blok 2 kg, karung 10 kg | 1.000 / 2.500 / 2.000 / 10.000 |
| ml | liter, jeriken 5 L, karton 12 L, botol 750 ml | 1.000 / 5.000 / 12.000 / 750 |
| pcs | tray 30 butir, pack 10 pcs, sisir 12 buah | 30 / 10 / 12 |

- Stok disimpan dalam **satuan pakai** dengan presisi 2 desimal (`DECIMAL(14,2)`).
- Harga rata-rata disimpan per satuan pakai dengan presisi 4 desimal (`DECIMAL(16,4)`).
- Tampilan: gr ≥ 1.000 → kg, ml ≥ 1.000 → L, 2 desimal.

## 5.3 HPP resep & food cost

```
HPP_porsi      = Σ (takaran_bahan × harga_rata_rata_bahan)        // harga saat ini
food_cost_%    = HPP_porsi ÷ harga_jual × 100
margin_kotor   = harga_jual − HPP_porsi
harga_saran    = ceil( HPP_porsi ÷ (target_% ÷ 100) ÷ 500 ) × 500
status         = hijau jika food_cost ≤ target; kuning jika ≤ target + 5; merah jika > target + 5
```

### Contoh C: Es Kopi Susu Gula Aren (harga awal data demo)

| Bahan | Takaran | Harga rata-rata | Biaya |
|---|--:|--:|--:|
| Biji kopi arabika | 15 gr | Rp 260/gr | 3.900 |
| Susu segar UHT | 120 ml | Rp 18/ml | 2.160 |
| Gula aren cair | 20 ml | Rp 55/ml | 1.100 |
| Es batu | 150 gr | Rp 2,5/gr | 375 |
| Cup 16 oz + tutup | 1 pcs | Rp 900/pcs | 900 |
| **HPP per porsi** | | | **8.435** |

Pada harga jual Rp 25.000:

- food cost = 33,74% (hijau, target 35%);
- margin kotor = Rp 16.565;
- harga saran pada target 35% = ceil(8.435 ÷ 0,35 ÷ 500) × 500 = **Rp 24.500**.

**HPP transaksi** dihitung saat pembayaran dan disimpan per baris (`unit_cost`), sehingga perubahan resep atau harga bahan tidak mengubah laporan masa lalu. Pada contoh A: HPP = 2 × 11.283,33 + 8.435 = 31.001,67 → dibulatkan **Rp 31.002**.

## 5.4 Valuasi persediaan: rata-rata tertimbang bergerak

Setiap penerimaan barang memperbarui harga rata-rata:

```
nilai_lama   = max(0, stok) × harga_rata
stok_baru    = max(0, stok) + qty_terima × isi_satuan_beli
harga_rata'  = (nilai_lama + qty_terima × harga_aktual) ÷ stok_baru
stok'        = stok + qty_terima × isi_satuan_beli
```

Semua pengeluaran stok (penjualan, waste, opname minus) dinilai dengan **harga rata-rata saat itu**.

### Contoh D

Stok beras 20.000 gr dengan harga rata-rata Rp 14/gr (nilai Rp 280.000). Diterima 25 kg @ Rp 15.000:

- stok baru = 45.000 gr;
- nilai = 280.000 + 375.000 = Rp 655.000;
- harga rata-rata baru = 655.000 ÷ 45.000 = **Rp 14,5556/gr** (Rp 14.556/kg).

## 5.5 Metrik persediaan

```
saldo_awal_periode  = stok_sekarang − Σ mutasi sejak awal periode
hari_persediaan     = rata2(nilai_awal, nilai_akhir) ÷ (nilai_pemakaian_resep ÷ jumlah_hari)
selisih_%           = (nilai_waste + |nilai_opname_minus − nilai_opname_plus|) ÷ nilai_pemakaian_resep × 100
```

Laporan persediaan wajib merekonsiliasi: `awal + beli − pakai − waste ± opname = akhir = saldo akun 1-104`.

## 5.6 Tanggal bisnis dan tutup harian

- **Tanggal bisnis** berganti pukul **04.00 waktu outlet** (dapat diatur). Transaksi pukul 00.30 masuk ke tanggal bisnis hari sebelumnya. *(Aturan baru; purwarupa masih memakai tanggal kalender.)*
- Penomoran harian (`INV`, `ORD`) memakai tanggal bisnis.
- Setelah hari ditutup, transaksi di tanggal itu terkunci.

## 5.7 Bagan akun (Chart of Accounts)

| Kode | Nama | Tipe | Saldo normal |
|---|---|---|---|
| 1-101 | Kas Outlet | Aset | Debit |
| 1-102 | Bank (BCA) | Aset | Debit |
| 1-103 | Piutang Settlement (QRIS/EDC/Ojol) *(disarankan, K-05)* | Aset | Debit |
| 1-104 | Persediaan Bahan Baku | Aset | Debit |
| 1-201 | Peralatan Dapur & Resto | Aset | Debit |
| 2-101 | Hutang Usaha (Pemasok) | Liabilitas | Kredit |
| 2-102 | Hutang PBJT (Pajak Restoran) | Liabilitas | Kredit |
| 3-101 | Modal Pemilik | Ekuitas | Kredit |
| 4-101 | Penjualan Makanan & Minuman | Pendapatan | Kredit |
| 4-102 | Pendapatan Service Charge | Pendapatan | Kredit |
| 4-103 | Diskon Penjualan | Kontra pendapatan | **Debit** |
| 5-101 | HPP Bahan Baku | HPP | Debit |
| 5-102 | Selisih Persediaan & Bahan Rusak | HPP | Debit |
| 6-101 | Beban Gaji & Tunjangan | Beban | Debit |
| 6-102 | Beban Sewa Tempat | Beban | Debit |
| 6-103 | Beban Listrik & Air | Beban | Debit |
| 6-104 | Beban Gas LPG | Beban | Debit |
| 6-105 | Beban Pemasaran | Beban | Debit |
| 6-106 | Beban Kebersihan & Lain-lain | Beban | Debit |

Pemetaan metode bayar ke akun:

| Metode | Akun |
|---|---|
| Tunai | 1-101 |
| QRIS, Kartu, GoFood/GrabFood | 1-102 (versi 1.0) |

## 5.8 Jurnal otomatis

Setiap jurnal wajib **seimbang** (Σ debit = Σ kredit). Selisih pembulatan dibebankan ke baris terakhir pada sisi yang kurang. Baris bernilai 0 tidak disimpan.

| Kejadian | Debit | Kredit | Referensi |
|---|---|---|---|
| Saldo awal | Kas, Bank, Persediaan, Peralatan | Modal Pemilik | `JU/SALDO-AWAL` |
| Penjualan | Kas/Bank (total); Diskon Penjualan (diskon) | Penjualan (subtotal); Service (service); Hutang PBJT (pbjt) | `INV/…` |
| HPP penjualan | HPP Bahan Baku | Persediaan | `INV/…` (satu jurnal dengan penjualan) |
| Penerimaan barang | Persediaan | Hutang Usaha | `GRN/…` |
| Bayar pemasok | Hutang Usaha | Kas/Bank | `BKK/…` |
| Biaya operasional | Akun beban | Kas/Bank | `BKK/…` |
| Setor kas ke bank | Bank | Kas | `STR-…` |
| Setor PBJT | Hutang PBJT | Bank | `BKK/…` |
| Bahan rusak | Selisih Persediaan & Bahan Rusak | Persediaan | `WST/…` |
| Opname (selisih minus) | Selisih Persediaan | Persediaan | `SO/…` |
| Opname (selisih plus) | Persediaan | Selisih Persediaan | `SO/…` |
| Void penjualan *(baru)* | Kebalikan jurnal penjualan & HPP | | `VOID/…` |

### Contoh E: jurnal contoh B dibayar QRIS

Nilai HPP diambil dari contoh A (Rp 31.002).

| Akun | Debit | Kredit |
|---|--:|--:|
| 1-102 Bank | 98.753 | |
| 4-103 Diskon Penjualan | 9.500 | |
| 4-101 Penjualan Makanan & Minuman | | 95.000 |
| 4-102 Pendapatan Service Charge | | 4.275 |
| 2-102 Hutang PBJT | | 8.978 |
| 5-101 HPP Bahan Baku | 31.002 | |
| 1-104 Persediaan Bahan Baku | | 31.002 |
| **Jumlah** | **139.255** | **139.255** |

## 5.9 Laporan keuangan

**Laba rugi (periode):**

```
Pendapatan bersih = Penjualan + Service − Diskon
Total HPP         = HPP Bahan Baku + Selisih Persediaan & Bahan Rusak
Laba kotor        = Pendapatan bersih − Total HPP
Laba bersih       = Laba kotor − Σ Beban operasional        (sebelum pajak penghasilan)
```

PBJT **bukan** pendapatan. PBJT adalah titipan yang dicatat sebagai hutang.

**Neraca (per tanggal):** Aset = Kewajiban + Modal + Laba berjalan (akumulasi semua pendapatan − HPP − beban sampai tanggal itu, sampai ada jurnal tutup buku).

**Arus kas (metode langsung, akun 1-101 + 1-102):**

| Kategori | Sumber jurnal |
|---|---|
| Penerimaan dari pelanggan | `sale` |
| Pembayaran ke pemasok | `ap` |
| Pembayaran beban operasional | `expense` |
| Setoran PBJT | `tax` |
| Setoran modal pemilik (pendanaan) | `opening` |
| Dikecualikan | `transfer` (kas ↔ bank) |

## 5.10 Menu engineering

Periode analisis mengikuti filter laporan.

```
N                 = jumlah menu yang terjual di periode
porsi_total       = Σ porsi semua menu
batas_populer     = 0,7 × (1 ÷ N)                          // proporsi porsi
CM_per_porsi(m)   = (penjualan_m − HPP_m) ÷ porsi_m
CM_rata2          = Σ (penjualan − HPP) ÷ porsi_total
populer(m)        = porsi_m ÷ porsi_total ≥ batas_populer
untung(m)         = CM_per_porsi(m) ≥ CM_rata2
```

| Populer | Untung | Klasifikasi | Rekomendasi |
|---|---|---|---|
| Ya | Ya | Star | Pertahankan kualitas dan posisi |
| Ya | Tidak | Plowhorse | Tinjau takaran atau naikkan harga sedikit |
| Tidak | Ya | Puzzle | Promosikan, ubah nama atau posisi di menu |
| Tidak | Tidak | Dog | Ganti resep atau hapus |

## 5.11 Penomoran dokumen

| Dokumen | Format | Reset |
|---|---|---|
| Order/bill | `ORD/YYYYMMDD/NNNN` | Harian (tanggal bisnis) |
| Invoice penjualan | `INV/YYYYMMDD/NNNN` | Harian (tanggal bisnis) |
| Purchase order | `PO/YYMM/NNN` | Bulanan |
| Penerimaan barang | `GRN/YYMM/NNN` | Bulanan |
| Bukti kas keluar | `BKK/YYMM/NNN` | Bulanan |
| Stok opname | `SO/YYMM/NNN` | Bulanan |
| Bahan rusak | `WST/YYMM/NNN` | Bulanan |

Nomor dibuat oleh server secara atomik (tabel `sequences` dengan kunci baris). Kasir luring memakai nomor sementara `OFF-<device>-<n>` yang diganti nomor resmi saat sinkronisasi (lihat [06](06-arsitektur.md#64-mode-luring-kasir)).
