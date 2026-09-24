# 08 · Spesifikasi API

## 8.1 Konvensi

| Hal | Aturan |
|---|---|
| Basis URL | `https://posfnb.semestateknologiutama.com/api/v1` |
| Format | JSON UTF-8; nama field `snake_case`; uang dalam bilangan bulat Rupiah; qty desimal sebagai string (`"150.00"`) agar tidak kehilangan presisi |
| Waktu | ISO 8601 dengan zona (`2026-09-24T14:32:10+07:00`); `business_date` sebagai `YYYY-MM-DD` |
| Autentikasi | Cookie sesi Sanctum (SPA) + header `X-XSRF-TOKEN`; token perangkat `Authorization: Bearer …` untuk KDS/printer |
| Idempotensi | Semua `POST` yang membuat dokumen menerima header `Idempotency-Key` (UUID). Permintaan ulang dengan kunci sama mengembalikan hasil pertama |
| Paginasi | `?page=1&per_page=25`; respons `meta: {page, per_page, total}` |
| Filter periode | `?from=2026-09-01&to=2026-09-24` (tanggal bisnis, inklusif) |
| Versi | Awalan `/v1`; perubahan yang merusak kompatibilitas → `/v2` |

### Format galat

```json
{
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Stok bahan untuk Nasi Rendang Sapi tidak cukup.",
    "details": { "menu_item_id": 4, "ingredient": "Daging Sapi Has Dalam", "available": "80.00", "required": "100.00" }
  }
}
```

| HTTP | Kode galat | Kapan |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Belum masuk / sesi habis |
| 403 | `FORBIDDEN` | Izin tidak cukup (`details.permission`) |
| 404 | `NOT_FOUND` | |
| 409 | `CONFLICT` | Status dokumen tidak mengizinkan aksi (mis. terima PO yang dibatalkan) |
| 422 | `VALIDATION_FAILED` | `details.fields` per kolom |
| 422 | `INSUFFICIENT_STOCK` | Pembayaran dengan stok kurang (daring) |
| 423 | `SESSION_LOCKED` | Layar terkunci / tidak aktif |
| 429 | `TOO_MANY_ATTEMPTS` | Rate limit login/PIN (`details.retry_after`) |

## 8.2 Autentikasi

| Metode | Endpoint | Izin | Keterangan |
|---|---|---|---|
| GET | `/sanctum/csrf-cookie` | publik | di luar `/api/v1` |
| POST | `/auth/login` | publik | `{email, password, remember}` → profil + izin |
| GET | `/auth/pin-users` | publik (per outlet) | daftar `{id, name, role_name, initials}` pengguna aktif ber-PIN, tanpa email |
| POST | `/auth/pin` | publik | `{user_id, pin}` |
| POST | `/auth/lock` | masuk | kunci sesi |
| POST | `/auth/unlock` | masuk (terkunci) | `{pin}` atau `{password}` |
| POST | `/auth/logout` | masuk | |
| GET | `/auth/me` | masuk | profil, peran, daftar izin, outlet |
| PUT | `/auth/me/credentials` | masuk | `{current_password, new_password?, new_pin?}` |
| POST | `/auth/forgot` · `/auth/reset` | publik | tautan email |

Contoh respons `POST /auth/login`:

```json
{
  "user": { "id": 3, "name": "Rina Kartika", "email": "rina@dapurnusantara.id", "role": { "code": "kasir", "name": "Kasir" } },
  "permissions": ["m:kasir", "m:meja", "m:dapur", "m:penjualan", "kasir.bayar"],
  "outlet": { "id": 1, "name": "Dapur Nusantara", "branch": "Cabang Kemang", "tax_rate": "10.00", "service_rate": "5.00" }
}
```

## 8.3 Pengguna & akses (`pengguna.kelola`)

| Metode | Endpoint | Keterangan |
|---|---|---|
| GET | `/users` | daftar pengguna |
| POST | `/users` | `{name, email, role_id, password, pin?, is_active}` |
| PUT | `/users/{id}` | ubah; `password`/`pin` opsional untuk atur ulang |
| GET | `/roles` | peran + izin |
| PUT | `/roles/{id}/permissions` | `{grant: [...], revoke: [...]}`; 409 untuk peran terkunci |
| GET | `/audit-logs` | filter `from,to,user_id,event` |

## 8.4 Katalog

| Metode | Endpoint | Izin |
|---|---|---|
| GET | `/menu-categories` | `m:kasir` atau `m:menu` |
| GET | `/menu-items?include=recipe,availability` | `m:kasir` atau `m:menu` |
| POST | `/menu-items` | `menu.edit` |
| PUT | `/menu-items/{id}` | `menu.edit`; body menyertakan `recipe: [{ingredient_id, qty}]` (menggantikan seluruh resep) |
| GET | `/menu-items/{id}/costing?target=35` | `m:menu`; HPP, food cost, harga saran, kontribusi per bahan |

`availability` = porsi yang bisa dibuat = `min(floor(stok_bahan ÷ takaran))` untuk semua bahan di resep.

## 8.5 Penjualan

| Metode | Endpoint | Izin | Keterangan |
|---|---|---|---|
| GET | `/tables` | `m:meja` atau `m:kasir` | status + bill terbuka |
| POST | `/reservations` · PUT `/reservations/{id}` | `m:meja` | |
| GET | `/orders?status=open` | `m:kasir` | bill tersimpan |
| POST | `/orders` | `m:kasir` | `{type, table_id?, customer_name?, items:[{menu_item_id, qty, note}]}` |
| PUT | `/orders/{id}` | `m:kasir` | ganti isi; `discount_pct` > 0 butuh `kasir.diskon` **atau** `approval: {user_id, pin}` |
| POST | `/orders/{id}/send-to-kitchen` | `m:kasir` | kirim item dengan `qty > sent_qty` |
| POST | `/orders/{id}/quote` | `m:kasir` | hitung tagihan tanpa menyimpan (rumus 5.1) |
| POST | `/orders/{id}/pay` | `kasir.bayar` | `{method, tendered?, reference?}` → sale + struk |
| POST | `/payments/qris` | `kasir.bayar` | buat QRIS dinamis → `{qr_string, expires_at}` |
| POST | `/webhooks/qris/{provider}` | tanda tangan penyedia | tandai lunas |
| POST | `/sync/sales` | `kasir.bayar` | batch transaksi luring (lihat 8.9) |
| GET | `/sales` | `m:penjualan` | tanpa `penjualan.semua` → otomatis `cashier_id = saya` |
| GET | `/sales/{id}` · `/sales/{id}/receipt?format=escpos\|html` | `m:penjualan` | |
| POST | `/sales/{id}/void` | `penjualan.void` atau `approval` | `{reason}` |
| GET | `/kitchen/tickets?since=…` | `m:dapur` / token perangkat | `ETag`, `304` bila tidak berubah |
| POST | `/kitchen/tickets/{id}/advance` | `m:dapur` | queued → cooking → ready → served |

Contoh `POST /orders/{id}/pay` (daring):

```json
// permintaan
{ "method": "cash", "tendered": 100000 }
// respons 201
{
  "sale": {
    "number": "INV/20260924/0032", "business_date": "2026-09-24",
    "subtotal": 95000, "discount": 9500, "net": 85500, "service": 4275, "tax": 8978, "total": 98753,
    "cogs": 31002, "payment": { "method": "cash", "tendered": 100000, "change": 1247 },
    "discount_approved_by": { "id": 2, "name": "Sari Wulandari" }
  },
  "table_released": 7,
  "kitchen_ticket_id": 812
}
```

## 8.6 Pembelian & persediaan

| Metode | Endpoint | Izin |
|---|---|---|
| GET/POST/PUT | `/suppliers` | baca `m:pemasok`; tulis `po.buat` |
| GET | `/purchase-suggestions` | `m:pembelian` |
| GET/POST | `/purchase-orders` | baca `m:pembelian`; buat `po.buat` |
| POST | `/purchase-orders/{id}/send` · `/cancel` | `po.buat` |
| POST | `/purchase-orders/{id}/receipts` | `po.terima`; `{lines:[{po_line_id, qty, unit_price}], delivery_note_no, received_by}` |
| POST | `/purchase-orders/{id}/payments` | `po.bayar`; `{amount, source}` |
| GET | `/payables/aging` | `m:pembelian` |
| GET/POST/PUT | `/ingredients` | baca `m:persediaan`; tulis `stok.bahan` |
| GET | `/ingredients/{id}/movements?from&to` | `m:persediaan` (kartu stok) |
| POST | `/stock-counts` · PUT `/stock-counts/{id}` · POST `/stock-counts/{id}/post` | `stok.opname` |
| POST | `/wastes` | `stok.waste` |

## 8.7 Keuangan & laporan

| Metode | Endpoint | Izin |
|---|---|---|
| GET/POST | `/expenses` | baca `m:kas`; tulis `kas.catat` |
| POST | `/cash-transfers` · `/tax-payments` | `kas.catat` |
| GET | `/reports/sales-summary?from&to` | `m:lap-penjualan` |
| GET | `/reports/sales-by-day` · `/sales-by-hour` · `/sales-by-menu` · `/menu-engineering` | `m:lap-penjualan` |
| GET | `/reports/profit-loss?from&to` | `m:lap-keuangan` |
| GET | `/reports/balance-sheet?as_of` | `m:lap-keuangan` |
| GET | `/reports/cash-flow?from&to` | `m:lap-keuangan` |
| GET | `/journals?from&to` · `/ledger/{account}?from&to` | `m:lap-keuangan` |
| GET | `/reports/inventory-movement?from&to` | `m:lap-persediaan` |
| GET | `/reports/{name}/export?format=xlsx\|pdf` | sesuai laporan |
| GET | `/dashboard` | `m:dashboard` |

## 8.8 Pengaturan

| Metode | Endpoint | Izin |
|---|---|---|
| GET | `/settings` | masuk |
| PUT | `/settings` | `pengaturan.ubah` |
| GET/POST/DELETE | `/devices` | `pengaturan.ubah` |

## 8.9 Sinkronisasi luring

`POST /sync/sales`

```json
{
  "device_id": "K1",
  "sales": [
    {
      "client_uuid": "01926f3a-7c1e-7b1a-9d4e-3c2b1a0f9e8d",
      "offline_number": "OFF-K1-12",
      "created_at": "2026-09-24T13:05:44+07:00",
      "type": "takeaway", "table_id": null, "customer_name": "",
      "items": [{ "menu_item_id": 1, "qty": 2, "note": "" }],
      "discount_pct": 0, "discount_approval": null,
      "payment": { "method": "cash", "tendered": 100000, "reference": "" },
      "client_totals": { "total": 77000 }
    }
  ]
}
```

Respons berisi status per transaksi: `created` (dengan `number` resmi), `duplicate` (hasil lama), atau `rejected` (galat validasi, mis. menu dihapus). Bila `client_totals.total` berbeda dengan hitungan server, transaksi **tetap disimpan dengan angka server** dan ditandai `total_mismatch` untuk ditinjau manajer.
