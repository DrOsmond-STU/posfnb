# 02 · Kebutuhan Fungsional

Setiap kebutuhan diberi kode `FR-<MODUL>-<nomor>` supaya bisa dirujuk dari tiket dan kasus uji. Prioritas memakai MoSCoW:

- **M** (Must): wajib untuk rilis 1.0.
- **S** (Should): sangat diharapkan.
- **C** (Could): bila waktu cukup.

Kriteria penerimaan (KP) ditulis sebagai kondisi yang bisa diuji. Semua angka dan rumus merujuk ke [05 · Aturan akuntansi](05-aturan-akuntansi.md).

---

## 2.1 Autentikasi & sesi (AUTH)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-AUTH-01 | Pengguna masuk dengan email + kata sandi | M |
| FR-AUTH-02 | Pengguna ber-PIN masuk dengan memilih nama lalu mengetik PIN 6 digit (papan angka layar dan keyboard fisik) | M |
| FR-AUTH-03 | "Ingat saya" mempertahankan sesi 7 hari; tanpa centang, sesi berakhir saat peramban ditutup (maks. 12 jam) | M |
| FR-AUTH-04 | 5 kali gagal berturut-turut untuk satu email atau satu PIN mengunci percobaan selama 60 detik | M |
| FR-AUTH-05 | Akun nonaktif tidak bisa masuk dan mendapat pesan yang jelas | M |
| FR-AUTH-06 | Sesi terkunci otomatis setelah 30 menit tanpa aktivitas; pengguna masuk lagi dengan PIN atau kata sandi | M |
| FR-AUTH-07 | Tombol **Kunci layar** mengunci sesi dan membuka layar PIN (untuk ganti kasir) | M |
| FR-AUTH-08 | Pengguna mengubah kata sandi dan PIN sendiri setelah memasukkan kata sandi lama | M |
| FR-AUTH-09 | Lupa kata sandi: tautan atur ulang via email berlaku 30 menit, sekali pakai | S |
| FR-AUTH-10 | Autentikasi dua langkah (TOTP) wajib untuk peran Pemilik | C |

**Kriteria penerimaan**

- KP-AUTH-a: Saat belum masuk, tidak ada data aplikasi (menu, angka penjualan, nama pengguna) yang dikirim ke peramban. Server menolak setiap permintaan API dengan `401`.
- KP-AUTH-b: Pesan gagal masuk tidak membedakan "email tidak terdaftar" dan "kata sandi salah".
- KP-AUTH-c: Percobaan ke-6 dalam masa kunci ditolak tanpa memeriksa kata sandi, dan menampilkan sisa detik.
- KP-AUTH-d: Setelah keluar, tombol *Back* peramban tidak menampilkan halaman aplikasi.
- KP-AUTH-e: Setiap masuk, gagal masuk, keluar, dan kunci layar tercatat di log aktivitas.

## 2.2 Pengguna & hak akses (USER)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-USER-01 | Pemilik menambah, mengubah, dan menonaktifkan pengguna (nama, email, peran, status) | M |
| FR-USER-02 | Pemilik mengatur ulang kata sandi dan PIN pengguna lain | M |
| FR-USER-03 | Matriks hak akses: centang izin per peran, langsung berlaku | M |
| FR-USER-04 | Peran Pemilik selalu punya semua izin dan tidak bisa diubah | M |
| FR-USER-05 | Minimal satu Pemilik aktif harus selalu ada | M |
| FR-USER-06 | Hanya Pemilik yang bisa membuat, mengubah, atau menunjuk akun Pemilik | M |
| FR-USER-07 | Pengguna tidak bisa menonaktifkan akunnya sendiri | M |
| FR-USER-08 | Log aktivitas: waktu, pengguna, aktivitas, detail; bisa difilter tanggal, pengguna, dan jenis | M |
| FR-USER-09 | Peran kustom (buat peran baru selain enam bawaan) | S |

Detail peran dan izin ada di [03 · Peran & hak akses](03-peran-hak-akses.md).

## 2.3 Dasbor (DASH)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-DASH-01 | Ubin KPI hari ini: penjualan bersih (vs kemarin), jumlah struk & rata-rata per struk, food cost % (vs target), nilai persediaan & jumlah bahan di bawah minimum | M |
| FR-DASH-02 | Grafik penjualan bersih 30 hari; hari berjalan ditandai | M |
| FR-DASH-03 | Penjualan per kategori 7 hari, menu terlaris 7 hari | M |
| FR-DASH-04 | Daftar bahan perlu dibeli dengan tautan ke saran PO | M |
| FR-DASH-05 | Ringkasan operasional: meja terisi, bill terbuka, tiket dapur, hutang terdekat, PO menunggu | M |
| FR-DASH-06 | Angka di dasbor mengikuti izin: tautan ke modul yang tidak diizinkan tidak ditampilkan | M |

KP-DASH-a: Nilai "penjualan bersih hari ini" sama persis dengan total `net` di Laporan Penjualan periode "Hari ini".

## 2.4 Kasir / POS (POS)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-POS-01 | Grid menu per kategori dengan pencarian nama | M |
| FR-POS-02 | Setiap kartu menu menampilkan harga dan **perkiraan porsi yang masih bisa dibuat** dari stok bahan; kartu dinonaktifkan bila 0 | M |
| FR-POS-03 | Tipe pesanan: dine-in (wajib pilih meja), take away, online (no. order mitra) | M |
| FR-POS-04 | Tambah/kurangi qty, hapus item, catatan per item dengan pilihan cepat (mis. "Tidak pedas", "Es sedikit") | M |
| FR-POS-05 | Diskon persentase dari daftar yang diatur. Tanpa izin `kasir.diskon`, diskon butuh PIN penyetuju, dan nama penyetuju disimpan di transaksi | M |
| FR-POS-06 | Ringkasan tagihan: subtotal, diskon, service charge, PBJT, total, sesuai [5.1](05-aturan-akuntansi.md#51-perhitungan-tagihan) | M |
| FR-POS-07 | **Simpan & kirim ke dapur**: menyimpan bill terbuka dan mengirim item yang belum dikirim sebagai tiket KDS | M |
| FR-POS-08 | Item yang sudah dikirim ke dapur tidak bisa dikurangi atau dihapus dari kasir (hanya lewat void dengan persetujuan) | M |
| FR-POS-09 | Daftar bill tersimpan; membuka bill memuat ulang isinya ke kasir | M |
| FR-POS-10 | Pembayaran tunai: input uang diterima, tombol nominal cepat (uang pas & pembulatan), kembalian otomatis; tidak bisa konfirmasi bila kurang | M |
| FR-POS-11 | Pembayaran QRIS dinamis: QR dibuat dari penyedia pembayaran, status lunas dari webhook; fallback konfirmasi manual oleh manajer | M |
| FR-POS-12 | Pembayaran kartu (EDC terpisah): input no. approval | M |
| FR-POS-13 | Pembayaran mitra online: input no. order aplikasi | M |
| FR-POS-14 | Pembayaran terpisah (split bill) per item atau per nominal, dengan metode campuran | S |
| FR-POS-15 | Struk: identitas outlet, NPWP, no. invoice, waktu, kasir, item, catatan, subtotal, diskon, service, PBJT, total, metode, kembalian, pesan kaki | M |
| FR-POS-16 | Cetak struk ke printer thermal 58/80 mm; cetak ulang dari riwayat | M |
| FR-POS-17 | Void transaksi yang sudah dibayar hanya dengan izin `penjualan.void` atau PIN penyetuju, alasan wajib, stok dan jurnal dibalik | S |
| FR-POS-18 | Buka & tutup shift kasir: modal awal, setoran akhir, selisih kas | S |
| FR-POS-19 | Kasir tetap bisa bertransaksi saat luring; data tersinkron otomatis saat daring | M |

**Kriteria penerimaan**

- KP-POS-a: Pembayaran ditolak bila stok bahan tidak cukup untuk seluruh qty di keranjang. Pesan menyebut nama menunya.
- KP-POS-b: Setelah bayar, (1) transaksi tersimpan dengan nomor `INV/YYYYMMDD/NNNN`, (2) stok bahan berkurang sesuai resep × qty, (3) jurnal penjualan dan HPP terbentuk seimbang, (4) meja dilepas, (5) item yang belum dikirim masuk ke dapur.
- KP-POS-c: Tipe take away dan online tidak dikenai service charge, kecuali pengaturan "service untuk take away" aktif.
- KP-POS-d: Nomor invoice unik per outlet dan berurutan per tanggal bisnis, termasuk untuk transaksi yang dibuat luring (lihat [06](06-arsitektur.md#64-mode-luring-kasir)).

## 2.5 Meja & pesanan (TABLE)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-TABLE-01 | Master meja: nomor, area (Indoor/Teras/VIP/Bar), jumlah kursi | M |
| FR-TABLE-02 | Denah per area dengan status Kosong / Terisi / Reservasi; meja terisi menampilkan total bill dan lama duduk | M |
| FR-TABLE-03 | Klik meja kosong membuka kasir dengan meja terpilih; klik meja terisi membuka bill-nya | M |
| FR-TABLE-04 | Reservasi: nama, jam, jumlah tamu; aksi "Tamu datang" dan "Batalkan" | M |
| FR-TABLE-05 | Pindah meja dan gabung meja | S |
| FR-TABLE-06 | Daftar pesanan take away & online yang masih terbuka | M |

## 2.6 Layar dapur / KDS (KDS)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-KDS-01 | Tiga kolom: Antrian → Sedang dimasak → Siap diantar; tombol memindahkan tiket ke tahap berikutnya | M |
| FR-KDS-02 | Tiket: lokasi (meja/tipe), no. order, item + qty + catatan, timer sejak dibuat | M |
| FR-KDS-03 | Warna timer: ≥ 10 menit peringatan, ≥ 20 menit kritis | M |
| FR-KDS-04 | Panel "Total per menu" untuk tiket yang belum selesai (*all-day count*) | M |
| FR-KDS-05 | Tiket baru muncul < 3 detik setelah dikirim kasir, tanpa memuat ulang halaman | M |
| FR-KDS-06 | Bunyi notifikasi saat tiket baru masuk (bisa dimatikan) | S |
| FR-KDS-07 | Cetak tiket ke printer dapur sebagai cadangan | S |
| FR-KDS-08 | Rute per stasiun (mis. minuman ke bar, makanan ke dapur) berdasarkan kategori menu | C |

## 2.7 Riwayat penjualan (SALES)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-SALES-01 | Daftar transaksi dengan filter periode, metode bayar, tipe, dan pencarian no. invoice/pelanggan; paginasi 25 per halaman | M |
| FR-SALES-02 | Ringkasan periode: jumlah transaksi, penjualan kotor, diskon, service + PBJT, total diterima | M |
| FR-SALES-03 | Detail transaksi menampilkan struk dan HPP/food cost transaksi | M |
| FR-SALES-04 | Tanpa izin `penjualan.semua`, pengguna hanya melihat transaksi yang ia proses sendiri | M |
| FR-SALES-05 | Ekspor ke Excel/CSV | S |

## 2.8 Standar menu & resep (MENU)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-MENU-01 | Master menu: kode, nama, kategori, harga jual (sebelum pajak), waktu saji, ikon/foto, status tampil di kasir | M |
| FR-MENU-02 | Komposisi bahan per 1 porsi: bahan, takaran dalam satuan pakai (gr/ml/pcs) | M |
| FR-MENU-03 | HPP per porsi dihitung otomatis = Σ (takaran × harga rata-rata bahan terkini) | M |
| FR-MENU-04 | Food cost % = HPP ÷ harga jual; ditandai hijau (≤ target), kuning (≤ target + 5), merah (> target + 5) | M |
| FR-MENU-05 | Harga jual saran = HPP ÷ target food cost, dibulatkan ke atas ke Rp 500 | M |
| FR-MENU-06 | Kontribusi biaya per bahan (%) untuk menunjukkan bahan termahal | M |
| FR-MENU-07 | Langkah pembuatan dan standar penyajian (alat saji, garnish, porsi) | M |
| FR-MENU-08 | Riwayat perubahan harga dan resep (siapa, kapan, nilai lama → baru) | S |
| FR-MENU-09 | Tanpa izin `menu.edit`, halaman resep tampil dalam mode lihat saja | M |
| FR-MENU-10 | Kategori menu dapat dikelola (tambah, urutkan) | S |
| FR-MENU-11 | Modifier/varian dengan penyesuaian resep dan harga | C |

KP-MENU-a: Mengubah resep tidak mengubah HPP transaksi yang sudah terjadi. HPP transaksi disimpan saat penjualan.

## 2.9 Pembelian (PO)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-PO-01 | Membuat PO: pemasok, baris bahan (qty dalam satuan beli, harga per satuan beli), catatan | M |
| FR-PO-02 | Status PO: Draft → Dikirim → Diterima sebagian / Diterima (belum lunas) → Lunas; atau Dibatalkan (hanya dari Draft/Dikirim) | M |
| FR-PO-03 | Kirim PO ke pemasok (PDF lewat email atau tautan WhatsApp) | S |
| FR-PO-04 | Penerimaan barang (GRN): qty diterima per baris (boleh sebagian), harga aktual, penerima, no. surat jalan | M |
| FR-PO-05 | GRN menambah stok, memperbarui harga rata-rata tertimbang, mencatat hutang, dan membuat jurnal | M |
| FR-PO-06 | Jatuh tempo = tanggal penerimaan + termin pemasok | M |
| FR-PO-07 | Pembayaran pemasok sebagian atau penuh dari kas atau bank; status Lunas saat sisa = 0 | M |
| FR-PO-08 | Umur hutang per pemasok: belum jatuh tempo, 1–30, 31–60, > 60 hari | M |
| FR-PO-09 | Saran pembelian: bahan dengan stok < minimum; qty saran = target − stok − qty dalam PO berjalan, dibulatkan ke atas ke satuan beli; satu klik menjadi PO per pemasok | M |
| FR-PO-10 | Retur ke pemasok (mengurangi stok & hutang) | S |
| FR-PO-11 | Persetujuan PO di atas batas nilai tertentu oleh manajer | C |

KP-PO-a: GRN tidak bisa melebihi qty sisa kecuali diberi tanda "lebih kirim" oleh pengguna berizin. Di versi purwarupa belum ada batas ini, jadi wajib ditambahkan.

## 2.10 Pemasok (SUP)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-SUP-01 | Master pemasok: kode, nama, kategori, kota, kontak, telepon, termin (hari) | M |
| FR-SUP-02 | Daftar menampilkan jumlah bahan dipasok, pembelian 30 hari, dan hutang berjalan | M |
| FR-SUP-03 | Pemasok nonaktif tidak muncul di form PO baru | S |

## 2.11 Persediaan (INV)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-INV-01 | Master bahan: kode, nama, kategori, satuan pakai (gr/ml/pcs), satuan beli, isi per satuan beli, stok minimum, stok target, pemasok utama | M |
| FR-INV-02 | Status stok: Aman / Menipis (< minimum) / Habis (≤ 0) | M |
| FR-INV-03 | Stok ditampilkan dalam satuan yang mudah dibaca (gr ≥ 1.000 → kg; ml ≥ 1.000 → L) | M |
| FR-INV-04 | Kartu stok per bahan dan periode: saldo awal, mutasi (tanggal, referensi, keterangan, masuk, keluar, saldo berjalan, nilai), saldo akhir | M |
| FR-INV-05 | Stok opname: daftar semua bahan dengan stok sistem, input stok fisik, selisih & nilai selisih langsung terhitung; posting membuat penyesuaian dan jurnal | M |
| FR-INV-06 | Opname bisa disimpan sebagai draf sebelum diposting, dan dibatasi per kategori/lokasi | S |
| FR-INV-07 | Bahan rusak (waste): bahan, qty, alasan (Layu/busuk, Kedaluwarsa, Rusak saat penyimpanan, Tumpah/jatuh, Salah masak/komplain), pencatat | M |
| FR-INV-08 | Waste tidak boleh melebihi stok sistem | M |
| FR-INV-09 | Peringatan bahan mendekati kedaluwarsa (butuh pencatatan batch & tanggal) | C |

## 2.12 Kas & biaya (CASH)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-CASH-01 | KPI: saldo kas outlet, saldo bank, beban operasional periode, PBJT belum disetor | M |
| FR-CASH-02 | Bukti kas keluar (BKK): akun beban, keterangan, jumlah, sumber (kas/bank), lampiran nota (gambar/PDF) | M |
| FR-CASH-03 | Setor kas ke bank (transfer internal), dengan saran menyisakan modal kembalian | M |
| FR-CASH-04 | Setor PBJT: membayar seluruh saldo hutang PBJT dari bank | M |
| FR-CASH-05 | Komposisi biaya per akun untuk periode terpilih | M |
| FR-CASH-06 | Pemasukan lain-lain (mis. sewa tempat acara) | S |

## 2.13 Laporan (RPT)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-RPT-01 | **Laporan penjualan**: periode (hari ini/7 hari/30 hari/bulan ini/rentang kustom); ringkasan kotor, diskon, bersih, service, PBJT, transaksi, rata-rata, food cost teoretis | M |
| FR-RPT-02 | Grafik penjualan per hari dan per jam (jam tersibuk ditandai) | M |
| FR-RPT-03 | Komposisi metode bayar dan tipe pesanan | M |
| FR-RPT-04 | Penjualan per menu: porsi, penjualan, kontribusi %, HPP, laba kotor, food cost %, klasifikasi menu engineering | M |
| FR-RPT-05 | **Laba rugi** dengan % terhadap pendapatan bersih | M |
| FR-RPT-06 | **Neraca** per tanggal dengan indikator seimbang | M |
| FR-RPT-07 | **Arus kas** metode langsung (operasi & pendanaan); transfer internal dikecualikan | M |
| FR-RPT-08 | **Jurnal umum** (paginasi) dan **buku besar** per akun dengan saldo berjalan | M |
| FR-RPT-09 | **Laporan persediaan**: mutasi per bahan (awal, beli, pakai, waste, opname, akhir), hari persediaan, rekonsiliasi nilai ke akun 1-104 | M |
| FR-RPT-10 | Ekspor PDF dan Excel untuk semua laporan | S |
| FR-RPT-11 | Laporan PBJT bulanan siap lapor | S |
| FR-RPT-12 | Laporan per kasir/shift | S |

KP-RPT-a: Total aset di neraca = total kewajiban + ekuitas + laba berjalan, dengan selisih maksimal Rp 1 akibat pembulatan.
KP-RPT-b: Saldo akhir laporan persediaan = saldo akun 1-104 Persediaan Bahan Baku, dengan selisih maksimal Rp 10 akibat pembulatan per baris.

## 2.14 Pengaturan (SET)

| Kode | Kebutuhan | Prioritas |
|---|---|---|
| FR-SET-01 | Profil outlet: nama, cabang, alamat, telepon, NPWP, pesan kaki struk | M |
| FR-SET-02 | Tarif PBJT (%), aktif/nonaktif; tarif service charge (%); service untuk take away (ya/tidak) | M |
| FR-SET-03 | Target food cost (%) | M |
| FR-SET-04 | Metode pembayaran aktif dan akun tujuannya | M |
| FR-SET-05 | Perangkat: printer kasir, printer dapur, EDC; tombol tes cetak | S |
| FR-SET-06 | Daftar diskon yang boleh dipakai kasir (nama, %) | S |
| FR-SET-07 | Pembulatan total ke Rp 100/500 (bila diaktifkan, selisih masuk akun pembulatan) | C |

Perubahan tarif pajak dan service hanya berlaku untuk transaksi baru dan tercatat di log aktivitas.
