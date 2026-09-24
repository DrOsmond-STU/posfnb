/* =========================================================================
   Racik POS — data master, mesin transaksi, dan simulasi data demo
   Semua transaksi (penjualan, pembelian, stok, jurnal) saling terhubung:
   - Penjualan  → stok bahan berkurang sesuai resep + jurnal pendapatan & HPP
   - Penerimaan → stok bertambah, harga rata-rata diperbarui + jurnal hutang
   - Opname / waste / biaya / pembayaran → jurnal masing-masing
   ========================================================================= */

const DB_KEY = 'racikpos-demo-v1';
const DAY = 86400000;

/* ---------- Bagan akun (Chart of Accounts) ---------- */
const ACCOUNTS = [
  { code: '1-101', name: 'Kas Outlet', type: 'aset' },
  { code: '1-102', name: 'Bank BCA', type: 'aset' },
  { code: '1-104', name: 'Persediaan Bahan Baku', type: 'aset' },
  { code: '1-201', name: 'Peralatan Dapur & Resto', type: 'aset' },
  { code: '2-101', name: 'Hutang Usaha (Pemasok)', type: 'liabilitas' },
  { code: '2-102', name: 'Hutang PB1 (Pajak Restoran)', type: 'liabilitas' },
  { code: '3-101', name: 'Modal Pemilik', type: 'ekuitas' },
  { code: '4-101', name: 'Penjualan Makanan & Minuman', type: 'pendapatan' },
  { code: '4-102', name: 'Pendapatan Service Charge', type: 'pendapatan' },
  { code: '4-103', name: 'Diskon Penjualan', type: 'pendapatan' },
  { code: '5-101', name: 'HPP Bahan Baku', type: 'hpp' },
  { code: '5-102', name: 'Selisih Persediaan & Bahan Rusak', type: 'hpp' },
  { code: '6-101', name: 'Beban Gaji & Tunjangan', type: 'beban' },
  { code: '6-102', name: 'Beban Sewa Tempat', type: 'beban' },
  { code: '6-103', name: 'Beban Listrik & Air', type: 'beban' },
  { code: '6-104', name: 'Beban Gas LPG', type: 'beban' },
  { code: '6-105', name: 'Beban Pemasaran', type: 'beban' },
  { code: '6-106', name: 'Beban Kebersihan & Lain-lain', type: 'beban' },
];
const accName = code => (ACCOUNTS.find(a => a.code === code) || {}).name || code;
const EXPENSE_ACCOUNTS = ACCOUNTS.filter(a => a.type === 'beban');

/* ---------- Master pemasok ---------- */
const SEED_SUPPLIERS = [
  { id: 'SP01', name: 'CV Sumber Pangan Segar', cat: 'Daging & Unggas', pic: 'Pak Hendra', phone: '0812-8841-2231', terms: 14, city: 'Jakarta Selatan' },
  { id: 'SP02', name: 'UD Tani Makmur', cat: 'Sayur & Bumbu', pic: 'Bu Siti', phone: '0813-1977-5402', terms: 7, city: 'Pasar Minggu' },
  { id: 'SP03', name: 'PT Sembako Jaya Abadi', cat: 'Sembako & Kemasan', pic: 'Pak Yohanes', phone: '021-7884-1190', terms: 30, city: 'Tangerang Selatan' },
  { id: 'SP04', name: 'Kopi Kita Roastery', cat: 'Kopi, Susu & Sirup', pic: 'Mas Bayu', phone: '0857-1022-8870', terms: 14, city: 'Jakarta Barat' },
  { id: 'SP05', name: 'Toko Buah Segar Mulia', cat: 'Buah', pic: 'Ci Lina', phone: '0811-9030-4412', terms: 7, city: 'Jakarta Selatan' },
];

/* ---------- Master bahan baku ----------
   unit  = satuan pemakaian resep (gr / ml / pcs)
   buy   = satuan pembelian, conv = isi per satuan pembelian, price = harga per satuan pembelian */
const SEED_INGREDIENTS = [
  ['BB01', 'Beras Premium', 'Bahan Pokok', 'gr', 'kg', 1000, 14500, 'SP03'],
  ['BB02', 'Ayam Fillet Dada', 'Protein', 'gr', 'kg', 1000, 52000, 'SP01'],
  ['BB03', 'Ayam Potong Paha', 'Protein', 'pcs', 'pack', 10, 95000, 'SP01'],
  ['BB04', 'Daging Sapi Has Dalam', 'Protein', 'gr', 'kg', 1000, 138000, 'SP01'],
  ['BB05', 'Telur Ayam', 'Protein', 'pcs', 'tray', 30, 58000, 'SP03'],
  ['BB06', 'Mie Telur Basah', 'Bahan Pokok', 'gr', 'kg', 1000, 24000, 'SP03'],
  ['BB07', 'Minyak Goreng', 'Bahan Pokok', 'ml', 'jeriken', 5000, 92000, 'SP03'],
  ['BB08', 'Bawang Merah', 'Bumbu', 'gr', 'kg', 1000, 42000, 'SP02'],
  ['BB09', 'Bawang Putih', 'Bumbu', 'gr', 'kg', 1000, 38000, 'SP02'],
  ['BB10', 'Cabai Merah Keriting', 'Bumbu', 'gr', 'kg', 1000, 55000, 'SP02'],
  ['BB11', 'Cabai Rawit Merah', 'Bumbu', 'gr', 'kg', 1000, 60000, 'SP02'],
  ['BB12', 'Kecap Manis', 'Bumbu', 'ml', 'liter', 1000, 32000, 'SP03'],
  ['BB13', 'Garam Dapur', 'Bumbu', 'gr', 'kg', 1000, 9000, 'SP03'],
  ['BB14', 'Gula Pasir', 'Bahan Pokok', 'gr', 'kg', 1000, 17500, 'SP03'],
  ['BB15', 'Santan Kental', 'Bahan Pokok', 'ml', 'liter', 1000, 34000, 'SP03'],
  ['BB16', 'Bumbu Rendang (pasta)', 'Bumbu', 'gr', 'kg', 1000, 85000, 'SP02'],
  ['BB17', 'Sawi Hijau', 'Sayur', 'gr', 'kg', 1000, 16000, 'SP02'],
  ['BB18', 'Timun', 'Sayur', 'gr', 'kg', 1000, 12000, 'SP02'],
  ['BB19', 'Tomat', 'Sayur', 'gr', 'kg', 1000, 18000, 'SP02'],
  ['BB20', 'Kentang Beku (fries)', 'Bahan Pokok', 'gr', 'pack', 2500, 95000, 'SP03'],
  ['BB21', 'Madu Hutan', 'Bumbu', 'ml', 'liter', 1000, 120000, 'SP03'],
  ['BB22', 'Tepung Terigu', 'Bahan Pokok', 'gr', 'kg', 1000, 13000, 'SP03'],
  ['BB23', 'Pisang Kepok', 'Buah', 'pcs', 'sisir', 12, 30000, 'SP05'],
  ['BB24', 'Keju Cheddar', 'Susu & Olahan', 'gr', 'blok', 2000, 190000, 'SP04'],
  ['BB25', 'Roti Tawar Tebal', 'Bahan Pokok', 'pcs', 'pack', 12, 22000, 'SP03'],
  ['BB26', 'Cokelat Meses', 'Bahan Pokok', 'gr', 'kg', 1000, 60000, 'SP03'],
  ['BB27', 'Biji Kopi Arabika Gayo', 'Kopi & Teh', 'gr', 'kg', 1000, 260000, 'SP04'],
  ['BB28', 'Susu Segar UHT', 'Susu & Olahan', 'ml', 'karton', 12000, 216000, 'SP04'],
  ['BB29', 'Gula Aren Cair', 'Kopi & Teh', 'ml', 'liter', 1000, 55000, 'SP04'],
  ['BB30', 'Teh Hitam Tubruk', 'Kopi & Teh', 'gr', 'kg', 1000, 90000, 'SP04'],
  ['BB31', 'Susu Kental Manis', 'Susu & Olahan', 'gr', 'kaleng', 370, 12500, 'SP03'],
  ['BB32', 'Jeruk Peras', 'Buah', 'gr', 'kg', 1000, 22000, 'SP05'],
  ['BB33', 'Alpukat Mentega', 'Buah', 'gr', 'kg', 1000, 35000, 'SP05'],
  ['BB34', 'Es Batu Kristal', 'Pelengkap', 'gr', 'karung', 10000, 25000, 'SP03'],
  ['BB35', 'Cup Plastik 16oz + Tutup', 'Kemasan', 'pcs', 'pack', 50, 45000, 'SP03'],
  ['BB36', 'Kotak Makan Kraft', 'Kemasan', 'pcs', 'pack', 50, 75000, 'SP03'],
  ['BB37', 'Bumbu Soto (pasta)', 'Bumbu', 'gr', 'kg', 1000, 70000, 'SP02'],
  ['BB38', 'Tauge', 'Sayur', 'gr', 'kg', 1000, 12000, 'SP02'],
  ['BB39', 'Kerupuk Udang', 'Pelengkap', 'gr', 'kg', 1000, 65000, 'SP03'],
  ['BB40', 'Kelapa Muda Kerok', 'Buah', 'gr', 'kg', 1000, 30000, 'SP05'],
  ['BB41', 'Sirup Cocopandan', 'Kopi & Teh', 'ml', 'botol', 750, 25000, 'SP04'],
];

/* ---------- Standar menu & resep (per 1 porsi) ---------- */
const MENU_CATS = ['Makanan', 'Minuman', 'Camilan', 'Penutup', 'Paket'];
const SEED_MENU = [
  { id: 'MN01', name: 'Nasi Goreng Spesial', cat: 'Makanan', price: 35000, pop: 14, prep: 8, icon: 'flame',
    recipe: [['BB01', 180], ['BB05', 1], ['BB02', 50], ['BB07', 20], ['BB08', 15], ['BB09', 8], ['BB10', 10], ['BB12', 15], ['BB13', 2], ['BB17', 30], ['BB18', 25], ['BB19', 20], ['BB39', 10]],
    steps: ['Tumis bawang merah, bawang putih, dan cabai hingga harum.', 'Masukkan ayam potong dadu, masak hingga berubah warna.', 'Buat orak-arik telur di sisi wajan.', 'Masukkan nasi, kecap manis, dan garam; aduk rata dengan api besar 2 menit.', 'Tambahkan sawi, aduk sebentar.', 'Sajikan di piring oval dengan timun, tomat, dan kerupuk.'],
    serve: 'Piring oval 10", garnish timun & tomat, kerupuk di sisi kanan' },
  { id: 'MN02', name: 'Mie Goreng Jawa', cat: 'Makanan', price: 32000, pop: 8, prep: 8, icon: 'soup',
    recipe: [['BB06', 150], ['BB05', 1], ['BB02', 40], ['BB07', 15], ['BB08', 12], ['BB09', 8], ['BB12', 20], ['BB17', 40], ['BB13', 2], ['BB19', 15], ['BB39', 10]],
    steps: ['Rebus mie 30 detik, tiriskan.', 'Tumis bawang dan ayam, masukkan telur lalu orak-arik.', 'Masukkan mie, sawi, kecap, dan garam; aduk dengan api besar.', 'Sajikan dengan tomat dan kerupuk.'],
    serve: 'Piring cekung 9", taburan bawang goreng' },
  { id: 'MN03', name: 'Ayam Bakar Madu', cat: 'Makanan', price: 42000, pop: 9, prep: 12, icon: 'drumstick',
    recipe: [['BB03', 1], ['BB01', 180], ['BB21', 15], ['BB12', 20], ['BB09', 5], ['BB08', 10], ['BB07', 10], ['BB18', 30], ['BB19', 20], ['BB11', 10]],
    steps: ['Ayam ungkep dimarinasi minimal 4 jam (prep pagi).', 'Olesi campuran madu dan kecap, bakar 4 menit tiap sisi.', 'Ulek sambal: cabai rawit, bawang, tomat.', 'Sajikan dengan nasi, lalapan, dan sambal.'],
    serve: 'Piring kayu + daun pisang, sambal di cobek kecil' },
  { id: 'MN04', name: 'Nasi Rendang Sapi', cat: 'Makanan', price: 55000, pop: 6, prep: 5, icon: 'beef',
    recipe: [['BB04', 100], ['BB16', 30], ['BB15', 60], ['BB01', 180], ['BB17', 30], ['BB11', 5]],
    steps: ['Rendang dimasak batch pagi (3 jam) dan disimpan di bain-marie.', 'Porsi daging 100 gr matang per piring.', 'Sajikan dengan nasi, sayur sawi, dan sambal hijau.'],
    serve: 'Piring rotan + kertas nasi, porsi daging 100 gr' },
  { id: 'MN05', name: 'Soto Ayam Lamongan', cat: 'Makanan', price: 30000, pop: 7, prep: 6, icon: 'soup',
    recipe: [['BB02', 70], ['BB37', 25], ['BB38', 30], ['BB05', 1], ['BB01', 150], ['BB39', 10], ['BB09', 5]],
    steps: ['Kuah soto disiapkan batch pagi dari kaldu ayam dan bumbu soto.', 'Tata tauge, ayam suwir, dan telur rebus di mangkuk.', 'Siram kuah panas 300 ml, taburi koya.', 'Nasi disajikan terpisah.'],
    serve: 'Mangkuk keramik 7", nasi di piring kecil' },
  { id: 'MN06', name: 'Ayam Geprek Sambal Bawang', cat: 'Makanan', price: 30000, pop: 10, prep: 10, icon: 'flame',
    recipe: [['BB02', 100], ['BB22', 40], ['BB07', 60], ['BB11', 15], ['BB09', 10], ['BB01', 180], ['BB18', 25], ['BB13', 2]],
    steps: ['Balur ayam dengan tepung bumbu, goreng 170°C selama 6 menit.', 'Ulek cabai rawit, bawang putih, garam; siram minyak panas.', 'Geprek ayam di atas sambal.', 'Sajikan dengan nasi dan timun.'],
    serve: 'Piring rotan + kertas nasi, level pedas sesuai permintaan' },
  { id: 'MN07', name: 'Kentang Goreng', cat: 'Camilan', price: 22000, pop: 7, prep: 5, icon: 'utensils',
    recipe: [['BB20', 150], ['BB07', 30], ['BB13', 2]],
    steps: ['Goreng kentang beku 175°C selama 3,5 menit.', 'Tiriskan, taburi garam selagi panas.', 'Sajikan dengan saus sambal dan mayones.'],
    serve: 'Keranjang saji + kertas minyak' },
  { id: 'MN08', name: 'Pisang Goreng Keju', cat: 'Camilan', price: 24000, pop: 5, prep: 7, icon: 'cookie',
    recipe: [['BB23', 2], ['BB22', 40], ['BB07', 40], ['BB24', 20], ['BB31', 20], ['BB14', 5]],
    steps: ['Belah pisang menjadi 4, celup adonan tepung.', 'Goreng hingga keemasan.', 'Siram susu kental manis, parut keju di atasnya.'],
    serve: 'Piring persegi, keju parut penuh' },
  { id: 'MN09', name: 'Roti Bakar Cokelat Keju', cat: 'Camilan', price: 25000, pop: 5, prep: 6, icon: 'sandwich',
    recipe: [['BB25', 2], ['BB26', 25], ['BB24', 20], ['BB31', 20]],
    steps: ['Olesi roti dengan margarin, panggang di griddle.', 'Isi meses dan keju parut.', 'Potong 4 diagonal, siram susu kental manis.'],
    serve: 'Talenan kayu kecil' },
  { id: 'MN10', name: 'Es Kopi Susu Gula Aren', cat: 'Minuman', price: 25000, pop: 16, prep: 3, icon: 'coffee',
    recipe: [['BB27', 15], ['BB28', 120], ['BB29', 20], ['BB34', 150], ['BB35', 1]],
    steps: ['Ekstrak 1 shot espresso (15 gr, 30 ml, 28 detik).', 'Masukkan gula aren ke cup, tambahkan es batu.', 'Tuang susu, lalu espresso di atasnya.'],
    serve: 'Cup 16oz, label rasa, sedotan kertas' },
  { id: 'MN11', name: 'Kopi Tubruk Gayo', cat: 'Minuman', price: 15000, pop: 5, prep: 3, icon: 'coffee',
    recipe: [['BB27', 12], ['BB14', 15]],
    steps: ['Seduh 12 gr kopi giling kasar dengan 180 ml air 92°C.', 'Diamkan 3 menit, sajikan dengan gula terpisah.'],
    serve: 'Gelas belimbing + tatakan' },
  { id: 'MN12', name: 'Es Teh Manis', cat: 'Minuman', price: 10000, pop: 14, prep: 1, icon: 'cup-soda',
    recipe: [['BB30', 5], ['BB14', 20], ['BB34', 150]],
    steps: ['Teh diseduh batch 2 liter tiap 3 jam.', 'Takar 250 ml teh, 20 gr gula, isi es batu penuh.'],
    serve: 'Gelas tinggi 350 ml' },
  { id: 'MN13', name: 'Es Jeruk Peras', cat: 'Minuman', price: 15000, pop: 7, prep: 3, icon: 'cup-soda',
    recipe: [['BB32', 200], ['BB14', 15], ['BB34', 150]],
    steps: ['Peras 200 gr jeruk (±3 buah).', 'Tambahkan gula cair dan es batu.'],
    serve: 'Gelas tinggi 350 ml + irisan jeruk' },
  { id: 'MN14', name: 'Jus Alpukat', cat: 'Minuman', price: 25000, pop: 6, prep: 4, icon: 'cup-soda',
    recipe: [['BB33', 180], ['BB31', 30], ['BB14', 10], ['BB34', 120], ['BB26', 5]],
    steps: ['Blender alpukat, gula, es batu, dan 100 ml air.', 'Lapisi dinding gelas dengan susu kental manis cokelat.', 'Tuang jus, taburi meses.'],
    serve: 'Gelas tinggi 400 ml' },
  { id: 'MN15', name: 'Teh Tarik', cat: 'Minuman', price: 18000, pop: 5, prep: 3, icon: 'coffee',
    recipe: [['BB30', 6], ['BB31', 40], ['BB28', 80], ['BB34', 100]],
    steps: ['Seduh teh pekat 150 ml.', 'Campur susu kental manis dan susu segar.', 'Tarik 5 kali hingga berbusa, sajikan dengan es.'],
    serve: 'Gelas mug kaca' },
  { id: 'MN16', name: 'Es Teler', cat: 'Penutup', price: 25000, pop: 4, prep: 4, icon: 'ice-cream-cone',
    recipe: [['BB33', 80], ['BB40', 60], ['BB31', 35], ['BB41', 25], ['BB34', 150], ['BB28', 50]],
    steps: ['Tata alpukat dan kelapa muda di mangkuk.', 'Tambahkan es serut, siram sirup, susu kental manis, dan susu segar.'],
    serve: 'Mangkuk kaca 500 ml' },
  { id: 'MN17', name: 'Paket Hemat Geprek + Es Teh', cat: 'Paket', price: 35000, pop: 6, prep: 10, icon: 'layers',
    recipe: [['BB02', 100], ['BB22', 40], ['BB07', 60], ['BB11', 15], ['BB09', 10], ['BB01', 180], ['BB18', 25], ['BB13', 2], ['BB30', 5], ['BB14', 20], ['BB34', 150]],
    steps: ['Ikuti standar Ayam Geprek Sambal Bawang.', 'Ikuti standar Es Teh Manis.'],
    serve: 'Nampan paket, porsi sama dengan menu satuan' },
];

const CAT_ICONS = { 'Makanan': 'utensils-crossed', 'Minuman': 'cup-soda', 'Camilan': 'cookie', 'Penutup': 'ice-cream-cone', 'Paket': 'layers' };

const PAY_METHODS = [
  { id: 'tunai', name: 'Tunai', icon: 'banknote', acc: '1-101' },
  { id: 'qris', name: 'QRIS', icon: 'qr-code', acc: '1-102' },
  { id: 'kartu', name: 'Kartu Debit/Kredit', icon: 'credit-card', acc: '1-102' },
  { id: 'online', name: 'GoFood / GrabFood', icon: 'smartphone', acc: '1-102' },
];
const payName = id => (PAY_METHODS.find(p => p.id === id) || {}).name || id;


/* ---------- Util angka acak deterministik ---------- */
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function pickWeighted(rand, arr, w) {
  const total = arr.reduce((s, x) => s + w(x), 0);
  let r = rand() * total;
  for (const x of arr) { r -= w(x); if (r <= 0) return x; }
  return arr[arr.length - 1];
}
const startOfDay = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const pad = (n, l = 2) => String(n).padStart(l, '0');
const ymd = t => { const d = new Date(t); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()); };
const ym = t => { const d = new Date(t); return String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1); };

/* =========================================================================
   STATE
   ========================================================================= */
let S = null;

function saveState() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(S)); } catch (e) { /* penyimpanan tidak tersedia */ }
}
function loadState() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      // data disimpan permanen di peramban; hanya dibuat ulang lewat "Atur ulang data demo"
      if (s && s.ver === 1) { S = s; migrateState(); return; }
    }
  } catch (e) { /* abaikan */ }
  S = buildDemo(Date.now());
  saveState();
}
/* lengkapi field yang ditambahkan setelah data lama tersimpan */
function migrateState() {
  S.reservations = S.reservations || [];
  S.suppliers.forEach(x => { if (x.active === undefined) x.active = true; });
}
function resetState() {
  try { localStorage.removeItem(DB_KEY); } catch (e) { /* abaikan */ }
  S = buildDemo(Date.now());
  saveState();
}

/* ---------- Pencarian ---------- */
const ingById = id => S.ingredients.find(i => i.id === id);
const menuById = id => S.menu.find(m => m.id === id);
const supById = id => S.suppliers.find(s => s.id === id);
const nextId = (list, prefix) => prefix + pad(Math.max(0, ...list.map(x => +String(x.id).replace(/\D/g, '') || 0)) + 1);

function nextNo(prefix, t, daily) {
  const key = prefix + (daily ? ymd(t) : ym(t));
  S.seq[key] = (S.seq[key] || 0) + 1;
  return daily ? `${prefix}/${ymd(t)}/${pad(S.seq[key], 4)}` : `${prefix}/${ym(t)}/${pad(S.seq[key], 3)}`;
}

/* ---------- Biaya resep ---------- */
function recipeCost(menu) {
  return menu.recipe.reduce((s, [id, q]) => { const i = ingById(id); return s + (i ? i.avg * q : 0); }, 0);
}
function portionsAvailable(menu) {
  let min = Infinity;
  for (const [id, q] of menu.recipe) {
    const i = ingById(id); if (!i || q <= 0) continue;
    min = Math.min(min, Math.floor(i.stock / q));
  }
  return min === Infinity ? 0 : Math.max(0, min);
}
/* pemakaian bahan untuk sekumpulan item {mid, qty} */
function usageOf(items) {
  const u = {};
  for (const it of items) {
    const m = menuById(it.mid); if (!m) continue;
    for (const [id, q] of m.recipe) u[id] = (u[id] || 0) + q * it.qty;
  }
  return u;
}
/* bahan pertama yang kurang untuk seluruh item (bahan yang dipakai bersama ikut dihitung) */
function stockShortage(items) {
  const u = usageOf(items);
  for (const id in u) { const i = ingById(id); if (i && u[id] - i.stock > 1e-9) return { ing: i, need: u[id], have: i.stock }; }
  return null;
}
/* porsi menu yang masih bisa dibuat setelah dikurangi pemakaian item lain */
function portionsLeft(menu, items) {
  const u = usageOf(items || []);
  let min = Infinity;
  for (const [id, q] of menu.recipe) {
    const i = ingById(id); if (!i || q <= 0) continue;
    min = Math.min(min, Math.floor((i.stock - (u[id] || 0)) / q + 1e-9));
  }
  return min === Infinity ? 0 : Math.max(0, min);
}
/* saldo akun kas/bank untuk validasi pembayaran */
const cashAccount = method => (method === 'tunai' ? '1-101' : '1-102');
function stockStatus(i) {
  if (i.stock <= 0) return 'habis';
  if (i.stock < i.min) return 'menipis';
  return 'aman';
}

/* ---------- Jurnal & mutasi ---------- */
function postJournal(t, ref, desc, type, lines) {
  const clean = lines.filter(l => Math.round(l.d || 0) !== 0 || Math.round(l.c || 0) !== 0)
    .map(l => ({ acc: l.acc, d: Math.round(l.d || 0), c: Math.round(l.c || 0) }));
  const sd = clean.reduce((s, l) => s + l.d, 0), sc = clean.reduce((s, l) => s + l.c, 0);
  if (sd !== sc && clean.length) {
    // selisih pembulatan dibebankan ke baris terakhir yang sisi-nya sesuai
    const diff = sd - sc;
    const target = diff > 0 ? clean.slice().reverse().find(l => l.c > 0) : clean.slice().reverse().find(l => l.d > 0);
    if (target) { if (diff > 0) target.c += diff; else target.d -= diff; }
  }
  S.journals.push({ t, ref, desc, type, lines: clean });
}
function addMove(t, ingId, type, qty, value, ref, note) {
  S.moves.push({ t, ing: ingId, type, qty, value: Math.round(value), ref, note: note || '' });
}

/* ---------- Perhitungan tagihan ---------- */
function calcBill(items, type, discPct) {
  const sub = items.reduce((s, it) => { const m = menuById(it.mid); return s + (m ? m.price * it.qty : 0); }, 0);
  const disc = Math.round(sub * (discPct || 0) / 100);
  const net = sub - disc;
  const svcOn = type === 'dinein' || (type === 'takeaway' && S.settings.serviceTakeaway);
  const svc = svcOn ? Math.round(net * S.settings.serviceRate / 100) : 0;
  const tax = S.settings.taxOn ? Math.round((net + svc) * S.settings.taxRate / 100) : 0;
  const total = net + svc + tax;
  return { sub, disc, net, svc, tax, total };
}

/* ---------- Penjualan (checkout) ----------
   bill: {type, table, customer, items:[{mid,qty,note}], discPct}
   pay : {method, paid, ref} */
function recordSale(t, bill, pay, opts = {}) {
  const c = calcBill(bill.items, bill.type, bill.discPct);
  let cogs = 0;
  const lines = bill.items.map(it => {
    const m = menuById(it.mid);
    const unitCost = recipeCost(m);
    cogs += unitCost * it.qty;
    return { mid: m.id, name: m.name, cat: m.cat, qty: it.qty, price: m.price, cost: Math.round(unitCost), note: it.note || '' };
  });
  const no = nextNo('INV', t, true);
  // kurangi stok bahan sesuai resep
  const usage = usageOf(bill.items);
  const used = {};
  for (const id in usage) {
    const ing = ingById(id);
    const val = usage[id] * ing.avg;
    ing.stock -= usage[id];
    if (opts.aggregate) {
      const a = opts.aggregate[id] || (opts.aggregate[id] = { qty: 0, value: 0 });
      a.qty += usage[id]; a.value += val;
    } else {
      addMove(t, id, 'jual', -usage[id], -val, no, 'Pemakaian penjualan');
      used[id] = [usage[id], Math.round(val)];
    }
  }
  const sale = {
    no, t, type: bill.type, table: bill.table || null, customer: bill.customer || '',
    items: lines, discPct: bill.discPct || 0, ...c, cogs: Math.round(cogs),
    method: pay.method, paid: pay.paid || c.total, change: Math.max(0, (pay.paid || c.total) - c.total),
    payRef: pay.ref || '', cashier: opts.cashier || S.session.cashier, discBy: bill.discBy || '',
    status: 'paid',
  };
  if (!opts.aggregate) sale.usage = used;
  S.sales.push(sale);
  if (!opts.skipJournal) journalSale(t, no, `Penjualan ${no}`, [sale]);
  return sale;
}
function journalSale(t, ref, desc, sales) {
  const byAcc = {};
  let sub = 0, disc = 0, svc = 0, tax = 0, cogs = 0;
  for (const s of sales) {
    const acc = (PAY_METHODS.find(p => p.id === s.method) || PAY_METHODS[0]).acc;
    byAcc[acc] = (byAcc[acc] || 0) + s.total;
    sub += s.sub; disc += s.disc; svc += s.svc; tax += s.tax; cogs += s.cogs;
  }
  const lines = Object.keys(byAcc).map(a => ({ acc: a, d: byAcc[a] }));
  lines.push({ acc: '4-103', d: disc }, { acc: '4-101', c: sub }, { acc: '4-102', c: svc }, { acc: '2-102', c: tax });
  lines.push({ acc: '5-101', d: cogs }, { acc: '1-104', c: cogs });
  postJournal(t, ref, desc, 'sale', lines);
}

/* ---------- Pembelian ---------- */
function createPO(t, supId, lines, status, note) {
  const po = {
    no: nextNo('PO', t), t, sup: supId, status: status || 'draft', note: note || '',
    lines: lines.map(l => ({ ing: l.ing, qty: l.qty, price: Math.round(l.price), recv: 0 })),
    grns: [], paid: 0, due: null, sentAt: status === 'dikirim' ? t : null,
  };
  po.total = po.lines.reduce((s, l) => s + l.qty * l.price, 0);
  S.pos.push(po);
  return po;
}
const poByNo = no => S.pos.find(p => p.no === no);

/* recv: [{idx, qty, price}] dalam satuan pembelian */
function receivePO(t, po, recv, receiver) {
  let value = 0;
  const grnLines = [];
  for (const r of recv) {
    if (!r.qty || r.qty <= 0) continue;
    const l = po.lines[r.idx];
    const ing = ingById(l.ing);
    const baseQty = r.qty * ing.conv;
    const price = r.price != null ? r.price : l.price;
    const v = r.qty * price;
    // harga rata-rata tertimbang (moving average)
    const curVal = Math.max(0, ing.stock) * ing.avg;
    const newStock = Math.max(0, ing.stock) + baseQty;
    ing.avg = newStock > 0 ? (curVal + v) / newStock : price / ing.conv;
    ing.stock += baseQty;
    ing.lastPrice = price;
    l.recv += r.qty;
    value += v;
    grnLines.push({ ing: l.ing, qty: r.qty, price });
  }
  if (!grnLines.length) return null;
  const no = nextNo('GRN', t);
  S.moves.push(...grnLines.map(g => {
    const ing = ingById(g.ing);
    return { t, ing: g.ing, type: 'beli', qty: g.qty * ing.conv, value: Math.round(g.qty * g.price), ref: no, note: `Penerimaan ${po.no}` };
  }));
  const grn = { no, t, po: po.no, sup: po.sup, lines: grnLines, value: Math.round(value), receiver: receiver || 'Joko Susilo' };
  S.grns.push(grn);
  po.grns.push(no);
  po.recvValue = (po.recvValue || 0) + Math.round(value);
  const full = po.lines.every(l => l.recv >= l.qty);
  po.status = full ? 'diterima' : 'sebagian';
  const sup = supById(po.sup);
  po.due = t + sup.terms * DAY;
  postJournal(t, no, `Penerimaan barang ${po.no} — ${sup.name}`, 'purchase', [
    { acc: '1-104', d: value }, { acc: '2-101', c: value },
  ]);
  return grn;
}
function payPO(t, po, amount, method) {
  const acc = method === 'tunai' ? '1-101' : '1-102';
  const amt = Math.min(amount, (po.recvValue || 0) - po.paid);
  if (amt <= 0) return 0;
  po.paid += amt;
  if (po.paid >= (po.recvValue || 0) && po.status === 'diterima') po.status = 'lunas';
  postJournal(t, nextNo('BKK', t), `Pembayaran ${po.no} — ${supById(po.sup).name}`, 'ap', [
    { acc: '2-101', d: amt }, { acc, c: amt },
  ]);
  return amt;
}
/* ubah PO yang masih draft */
function updatePO(po, supId, lines, note) {
  po.sup = supId; po.note = note || '';
  po.lines = lines.map(l => ({ ing: l.ing, qty: l.qty, price: Math.round(l.price), recv: 0 }));
  po.total = po.lines.reduce((s, l) => s + l.qty * l.price, 0);
}
function poOutstanding(po) { return Math.max(0, (po.recvValue || 0) - po.paid); }

/* ---------- Biaya operasional ---------- */
function recordExpense(t, acc, desc, amount, method) {
  const no = nextNo('BKK', t);
  S.expenses.push({ no, t, acc, desc, amount: Math.round(amount), method, status: 'aktif' });
  postJournal(t, no, desc, 'expense', [{ acc, d: amount }, { acc: method === 'tunai' ? '1-101' : '1-102', c: amount }]);
}

/* ---------- Waste & opname ---------- */
function recordWaste(t, ingId, qty, reason, by) {
  const ing = ingById(ingId);
  const val = qty * ing.avg;
  ing.stock -= qty;
  const no = nextNo('WST', t);
  addMove(t, ingId, 'waste', -qty, -val, no, reason);
  S.wastes.push({ no, t, ing: ingId, qty, value: Math.round(val), reason, by: by || 'Chef Wayan', status: 'aktif' });
  postJournal(t, no, `Bahan rusak: ${ing.name} (${reason})`, 'waste', [{ acc: '5-102', d: val }, { acc: '1-104', c: val }]);
}
function postOpname(t, counts, by, note) {
  const no = nextNo('SO', t);
  let plus = 0, minus = 0;
  const lines = [];
  for (const c of counts) {
    const ing = ingById(c.ing);
    const diff = c.actual - ing.stock;
    lines.push({ ing: c.ing, system: ing.stock, actual: c.actual, diff, value: Math.round(diff * ing.avg) });
    if (Math.abs(diff) < 1e-9) continue;
    const val = diff * ing.avg;
    ing.stock = c.actual;
    addMove(t, c.ing, 'opname', diff, val, no, 'Penyesuaian stok opname');
    if (val > 0) plus += val; else minus += -val;
  }
  S.opnames.push({ no, t, by: by || 'Joko Susilo', note: note || '', lines, net: Math.round(plus - minus) });
  if (Math.round(plus) || Math.round(minus)) postJournal(t, no, 'Penyesuaian stok opname', 'opname', [
    { acc: '5-102', d: minus }, { acc: '1-104', c: minus },
    { acc: '1-104', d: plus }, { acc: '5-102', c: plus },
  ]);
}

/* ---------- Pembatalan (void) ----------
   Dokumen tidak dihapus; dibuat mutasi & jurnal pembalik agar laporan tetap terjejak. */
function returnStock(t, ingId, qty, value, type, ref, note) {
  const ing = ingById(ingId);
  const curVal = Math.max(0, ing.stock) * ing.avg;
  const newStock = Math.max(0, ing.stock) + qty;
  if (newStock > 0) ing.avg = (curVal + value) / newStock;
  ing.stock += qty;
  addMove(t, ingId, type, qty, value, ref, note);
}
/* pemakaian bahan transaksi lama yang belum menyimpan rincian: pakai resep saat ini,
   nilai HPP transaksi dibagi proporsional agar jurnal & nilai stok tetap cocok */
function saleUsage(sale) {
  if (sale.usage) return sale.usage;
  const u = usageOf(sale.items);
  const ids = Object.keys(u);
  const w = ids.map(id => u[id] * ingById(id).avg);
  const tw = w.reduce((a, b) => a + b, 0) || 1;
  const out = {}; let left = sale.cogs;
  ids.forEach((id, k) => { const v = k === ids.length - 1 ? left : Math.round(sale.cogs * w[k] / tw); left -= v; out[id] = [u[id], v]; });
  return out;
}
function voidSale(t, sale, reason, by) {
  if (sale.status === 'void') return null;
  const no = nextNo('VOID', t);
  const used = JSON.parse(JSON.stringify(saleUsage(sale)));
  const ids = Object.keys(used);
  // selisih pembulatan per bahan disesuaikan ke bahan bernilai terbesar agar total = HPP transaksi
  const diff = sale.cogs - ids.reduce((a, id) => a + used[id][1], 0);
  if (ids.length && diff) { const big = ids.reduce((a, id) => (used[id][1] > used[a][1] ? id : a), ids[0]); used[big][1] += diff; }
  const back = sale.cogs;
  for (const id of ids) returnStock(t, id, used[id][0], used[id][1], 'void', no, 'Pembatalan ' + sale.no);
  const acc = (PAY_METHODS.find(p => p.id === sale.method) || PAY_METHODS[0]).acc;
  postJournal(t, no, `Void ${sale.no}: ${reason}`, 'void', [
    { acc: '4-101', d: sale.sub }, { acc: '4-102', d: sale.svc }, { acc: '2-102', d: sale.tax },
    { acc: '4-103', c: sale.disc }, { acc, c: sale.total },
    { acc: '1-104', d: back }, { acc: '5-101', c: back },
  ]);
  Object.assign(sale, { status: 'void', voidNo: no, voidReason: reason, voidBy: by, voidAt: t });
  return no;
}
function voidExpense(t, e, reason, by) {
  if (e.status === 'batal') return;
  postJournal(t, 'BTL-' + e.no, `Batal ${e.no}: ${reason}`, 'expense', [{ acc: cashAccount(e.method), d: e.amount }, { acc: e.acc, c: e.amount }]);
  Object.assign(e, { status: 'batal', voidReason: reason, voidBy: by, voidAt: t });
}
function voidWaste(t, w, reason, by) {
  if (w.status === 'batal') return;
  returnStock(t, w.ing, w.qty, w.value, 'waste', 'BTL-' + w.no, 'Batal ' + w.no + ': ' + reason);
  postJournal(t, 'BTL-' + w.no, `Batal ${w.no}: ${reason}`, 'waste', [{ acc: '1-104', d: w.value }, { acc: '5-102', c: w.value }]);
  Object.assign(w, { status: 'batal', voidReason: reason, voidBy: by, voidAt: t });
}
/* data master hanya boleh dihapus bila belum pernah dipakai transaksi */
function menuInUse(id) { return S.sales.some(s => s.items.some(l => l.mid === id)) || S.bills.some(b => b.items.some(i => i.mid === id)); }
function ingredientInUse(id) { return S.menu.some(m => m.recipe.some(r => r[0] === id)) || S.moves.some(m => m.ing === id) || S.pos.some(p => p.lines.some(l => l.ing === id)); }
function supplierInUse(id) { return S.pos.some(p => p.sup === id) || S.ingredients.some(i => i.sup === id); }

/* ---------- Saldo akun ---------- */
function accBalance(code, from, to) {
  const acc = ACCOUNTS.find(a => a.code === code);
  const debitNormal = acc && ['aset', 'hpp', 'beban'].includes(acc.type) || code === '4-103';
  let bal = 0;
  for (const j of S.journals) {
    if (from != null && j.t < from) continue;
    if (to != null && j.t > to) continue;
    for (const l of j.lines) if (l.acc === code) bal += debitNormal ? l.d - l.c : l.c - l.d;
  }
  return bal;
}

/* =========================================================================
   SIMULASI DATA DEMO (30 hari terakhir)
   ========================================================================= */
function buildDemo(now) {
  const rand = mulberry32(20260924);
  const today = startOfDay(now);
  const start = today - 29 * DAY;

  S = {
    ver: 1, generatedAt: now,
    settings: {
      outlet: 'Dapur Nusantara', branch: 'Cabang Kemang', address: 'Jl. Kemang Raya No. 18, Jakarta Selatan 12730',
      phone: '021-7199-0418', npwp: '01.234.567.8-015.000', taxOn: true, taxRate: 10, serviceRate: 5,
      serviceTakeaway: false, targetFC: 35, rounding: false,
      footer: 'Terima kasih! Kritik & saran: @dapurnusantara',
    },
    session: { cashier: 'Rina Kartika', shift: 'Shift Pagi', manager: 'Andi Pratama' },
    suppliers: SEED_SUPPLIERS.map(s => ({ ...s })),
    ingredients: SEED_INGREDIENTS.map(([id, name, cat, unit, buy, conv, price, sup]) =>
      ({ id, name, cat, unit, buy, conv, sup, avg: price / conv, lastPrice: price, stock: 0, min: 0, target: 0 })),
    menu: SEED_MENU.map(m => ({ ...m, recipe: m.recipe.map(r => r.slice()), steps: m.steps.slice(), active: true })),
    sales: [], pos: [], grns: [], moves: [], journals: [], expenses: [], opnames: [], wastes: [],
    tables: [], bills: [], kds: [], reservations: [], seq: {},
  };
  S.suppliers.forEach(x => { x.active = true; });

  /* estimasi pemakaian harian → stok minimum & target */
  const itemsPerDay = 215;
  const popTotal = S.menu.reduce((s, m) => s + m.pop, 0);
  const usage = {};
  for (const m of S.menu) for (const [id, q] of m.recipe) usage[id] = (usage[id] || 0) + itemsPerDay * m.pop / popTotal * q;
  for (const i of S.ingredients) {
    const u = usage[i.id] || 1;
    i.min = Math.ceil(u * 2.5 / (i.unit === 'pcs' ? 1 : 50)) * (i.unit === 'pcs' ? 1 : 50);
    i.target = u * 9;
    i.stock = Math.round(u * (5 + rand() * 3));
    if (i.unit !== 'pcs') i.stock = Math.round(i.stock / 10) * 10;
  }

  /* saldo awal */
  const t0 = start - DAY + 8 * 3600000;
  const invValue = S.ingredients.reduce((s, i) => s + i.stock * i.avg, 0);
  for (const i of S.ingredients) addMove(t0, i.id, 'awal', i.stock, i.stock * i.avg, 'SALDO-AWAL', 'Saldo awal persediaan');
  postJournal(t0, 'JU/SALDO-AWAL', 'Saldo awal pembukuan', 'opening', [
    { acc: '1-101', d: 8000000 }, { acc: '1-102', d: 65000000 }, { acc: '1-104', d: invValue }, { acc: '1-201', d: 85000000 },
    { acc: '3-101', c: 8000000 + 65000000 + invValue + 85000000 },
  ]);

  const hourW = { 10: 2, 11: 5, 12: 9, 13: 8, 14: 4, 15: 3, 16: 3, 17: 4, 18: 7, 19: 9, 20: 7, 21: 3 };
  const hours = Object.keys(hourW).map(Number);
  const nowHour = new Date(now).getHours();

  for (let d = 0; d < 30; d++) {
    const day = start + d * DAY;
    const isToday = d === 29;
    const dt = new Date(day);
    const dom = dt.getDate();

    /* pagi: pembayaran PO jatuh tempo */
    for (const po of S.pos) {
      if (po.due && po.due <= day + 10 * 3600000 && poOutstanding(po) > 0) payPO(day + 10 * 3600000, po, poOutstanding(po), 'transfer');
    }

    /* pagi: pembelian otomatis bila stok < minimum */
    if (!isToday) {
      const bySup = {};
      for (const i of S.ingredients) {
        if (i.stock < i.min * 1.3) {
          const need = Math.max(1, Math.ceil((i.target - i.stock) / i.conv));
          (bySup[i.sup] = bySup[i.sup] || []).push({ ing: i.id, qty: need, price: i.lastPrice * (0.96 + rand() * 0.09) });
        }
      }
      for (const sup in bySup) {
        // pemasok kopi & sayur belum mengirim beberapa hari terakhir → muncul saran pembelian
        if ((sup === 'SP04' && d >= 25) || (sup === 'SP02' && d >= 27)) continue;
        const po = createPO(day + 7 * 3600000, sup, bySup[sup], 'dikirim');
        receivePO(day + 9 * 3600000 + Math.floor(rand() * 3600000), po, po.lines.map((l, idx) => ({ idx, qty: l.qty })));
      }
    }

    /* biaya operasional */
    if (dom === 1) recordExpense(day + 11 * 3600000, '6-102', 'Sewa ruko bulan ' + dt.toLocaleDateString('id-ID', { month: 'long' }), 12500000, 'transfer');
    if (dom === 25) recordExpense(day + 11 * 3600000, '6-101', 'Gaji karyawan (8 orang)', 27200000, 'transfer');
    if (dom === 5) recordExpense(day + 11 * 3600000, '6-103', 'Tagihan PLN & PDAM', 3450000, 'transfer');
    if (d % 4 === 1) recordExpense(day + 9 * 3600000, '6-104', 'Isi ulang LPG 12 kg × 3 tabung', 585000, 'tunai');
    if (d % 7 === 2) recordExpense(day + 15 * 3600000, '6-105', 'Iklan Instagram & promosi ojol', 750000, 'transfer');
    if (d % 7 === 6) recordExpense(day + 22 * 3600000 + 900000, '6-101', 'Upah pekerja harian & uang makan staf (mingguan)', 2450000, 'tunai');
    if (d % 7 === 5) recordExpense(day + 16 * 3600000, '6-106', 'Sabun, tisu, plastik sampah', 320000, 'tunai');
    if (dom === 10) {
      const pb1 = accBalance('2-102');
      if (pb1 > 0) postJournal(day + 10 * 3600000, nextNo('BKK', day), 'Setor PB1 ke Bapenda DKI', 'tax', [{ acc: '2-102', d: pb1 }, { acc: '1-102', c: pb1 }]);
    }

    /* waste sesekali */
    if (d % 5 === 3) {
      const pool = ['BB17', 'BB19', 'BB38', 'BB23', 'BB33', 'BB32'];
      const id = pool[Math.floor(rand() * pool.length)];
      const ing = ingById(id);
      const q = ing.unit === 'pcs' ? 2 : Math.round((150 + rand() * 350) / 10) * 10;
      if (ing.stock > q) recordWaste(day + 21 * 3600000, id, q, ['Layu / busuk', 'Kedaluwarsa', 'Rusak saat penyimpanan'][Math.floor(rand() * 3)]);
    }

    /* penjualan */
    const wd = dt.getDay();
    const weekend = wd === 0 || wd === 5 || wd === 6;
    let count = Math.round((weekend ? 92 : 70) * (0.88 + rand() * 0.26) * (0.95 + d * 0.004));
    const agg = {};
    const daySales = [];
    const maxHour = isToday ? Math.max(13, Math.min(21, nowHour)) : 21;
    const hoursAllowed = hours.filter(h => h <= maxHour);
    if (isToday) count = Math.round(count * hoursAllowed.reduce((s, h) => s + hourW[h], 0) / 64);
    const times = [];
    for (let k = 0; k < count; k++) {
      const h = pickWeighted(rand, hoursAllowed, x => hourW[x]);
      times.push(day + h * 3600000 + Math.floor(rand() * 3600000));
    }
    times.sort((a, b) => a - b);
    for (const t of times) {
      const r = rand();
      const type = r < 0.6 ? 'dinein' : r < 0.85 ? 'takeaway' : 'online';
      const nLines = 1 + Math.floor(rand() * rand() * 4);
      const items = [];
      for (let k = 0; k < nLines; k++) {
        const m = pickWeighted(rand, S.menu, x => x.pop);
        const ex = items.find(x => x.mid === m.id);
        if (ex) ex.qty++; else items.push({ mid: m.id, qty: rand() < 0.2 ? 2 : 1 });
      }
      // lewati bila bahan tidak cukup
      if (items.some(it => portionsAvailable(menuById(it.mid)) < it.qty)) continue;
      const method = type === 'online' ? 'online' : (() => { const p = rand(); return p < 0.34 ? 'tunai' : p < 0.8 ? 'qris' : 'kartu'; })();
      const bill = { type, table: type === 'dinein' ? 1 + Math.floor(rand() * 16) : null, items, discPct: rand() < 0.08 ? 10 : 0 };
      const c = calcBill(items, type, bill.discPct);
      const paid = method === 'tunai' ? Math.ceil(c.total / 50000) * 50000 : c.total;
      const sale = recordSale(t, bill, { method, paid }, { aggregate: agg, skipJournal: true, cashier: new Date(t).getHours() < 16 ? 'Rina Kartika' : 'Dimas Saputra' });
      daySales.push(sale);
    }
    const endT = isToday ? Math.min(now, day + (maxHour + 1) * 3600000) - 60000 : day + 22 * 3600000;
    for (const id in agg) addMove(endT, id, 'jual', -agg[id].qty, -agg[id].value, 'REKAP-' + ymd(day), 'Pemakaian penjualan harian');
    if (daySales.length) journalSale(endT, 'REKAP-' + ymd(day), `Rekap penjualan ${new Date(day).toLocaleDateString('id-ID')}`, daySales);

    /* setor kas ke bank (hari sebelumnya) */
    if (!isToday) {
      // setor kelebihan kas di atas modal laci (Rp 3 juta) agar kas tidak pernah minus
      const cash = accBalance('1-101') - 3000000;
      if (cash > 0) postJournal(day + 22 * 3600000 + 1800000, 'STR-' + ymd(day), 'Setor kas harian ke Bank BCA', 'transfer', [{ acc: '1-102', d: cash }, { acc: '1-101', c: cash }]);
    }

    /* stok opname mingguan terakhir */
    if (d === 26) {
      const counts = S.ingredients.map(i => {
        const f = i.unit === 'pcs' ? Math.round(i.stock - (rand() < 0.25 ? 1 : 0)) : Math.round(i.stock * (0.965 + rand() * 0.04) / 10) * 10;
        return { ing: i.id, actual: Math.max(0, f) };
      });
      postOpname(day + 22 * 3600000 + 2400000, counts, 'Joko Susilo', 'Opname mingguan seluruh gudang');
    }
  }

  /* PO yang masih berjalan untuk demo alur pembelian */
  const t1 = today - DAY + 15 * 3600000;
  createPO(t1, 'SP04', [
    { ing: 'BB27', qty: 3, price: 258000 }, { ing: 'BB28', qty: 2, price: 216000 }, { ing: 'BB29', qty: 4, price: 55000 },
  ], 'dikirim', 'Kirim sebelum jam 10 pagi');
  const lowSup = S.ingredients.filter(i => i.sup === 'SP02').slice(0, 4);
  createPO(today + 8 * 3600000, 'SP02', lowSup.map(i => ({ ing: i.id, qty: 2, price: i.lastPrice })), 'draft', 'Draft dari saran pembelian');

  /* meja & bill terbuka */
  const areas = ['Indoor', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Teras', 'Teras', 'Teras', 'Teras', 'Teras', 'VIP', 'VIP', 'Bar'];
  const seats = [2, 2, 4, 4, 4, 4, 6, 6, 2, 2, 4, 4, 4, 8, 10, 4];
  S.tables = areas.map((a, i) => ({ no: i + 1, area: a, seats: seats[i], status: 'kosong', bill: null, resv: null }));
  const nowT = Math.max(now, today + 12 * 3600000);
  const openBills = [
    { table: 3, customer: 'Bpk. Hartono', mins: 24, items: [['MN01', 2, 'Pedas sedang'], ['MN10', 2, ''], ['MN07', 1, '']] },
    { table: 7, customer: 'Arisan Bu Rt', mins: 41, items: [['MN04', 3, ''], ['MN03', 2, 'Sambal pisah'], ['MN12', 5, 'Es sedikit'], ['MN16', 2, '']] },
    { table: 10, customer: '', mins: 9, items: [['MN06', 1, 'Level 3'], ['MN13', 1, '']] },
    { table: 14, customer: 'PT Maju Bersama', mins: 17, items: [['MN17', 6, ''], ['MN08', 2, ''], ['MN09', 2, '']] },
  ];
  for (const b of openBills) {
    const created = nowT - b.mins * 60000;
    const bill = {
      id: 'B' + b.table + '-' + created, no: nextNo('ORD', created, true), type: 'dinein', table: b.table, customer: b.customer,
      items: b.items.map(([mid, qty, note]) => ({ mid, qty, note, sent: qty })), discPct: 0, created,
    };
    S.bills.push(bill);
    const tb = S.tables.find(x => x.no === b.table); tb.status = 'terisi'; tb.bill = bill.id;
    S.kds.push({ id: 'K' + bill.id, billNo: bill.no, where: 'Meja ' + b.table, created, status: b.mins > 30 ? 'siap' : b.mins > 15 ? 'dimasak' : 'antri',
      items: bill.items.map(it => ({ name: menuById(it.mid).name, qty: it.qty, note: it.note })) });
  }
  const tkCreated = nowT - 6 * 60000;
  const tk = { id: 'BTA-' + tkCreated, no: nextNo('ORD', tkCreated, true), type: 'online', table: null, customer: 'GrabFood #A-2291', items: [{ mid: 'MN10', qty: 3, note: 'Less sugar', sent: 3 }, { mid: 'MN02', qty: 1, note: '', sent: 1 }], discPct: 0, created: tkCreated };
  S.bills.push(tk);
  S.kds.push({ id: 'K' + tk.id, billNo: tk.no, where: 'Online · GrabFood', created: tkCreated, status: 'antri', items: tk.items.map(it => ({ name: menuById(it.mid).name, qty: it.qty, note: it.note })) });
  S.tables.find(x => x.no === 15).status = 'reservasi';
  S.tables.find(x => x.no === 15).resv = { name: 'Keluarga Wijaya', time: '19:00', pax: 9 };
  S.tables.find(x => x.no === 5).status = 'reservasi';
  S.tables.find(x => x.no === 5).resv = { name: 'Ibu Dewi', time: '18:30', pax: 3 };

  S.journals.sort((a, b) => a.t - b.t);
  S.moves.sort((a, b) => a.t - b.t);
  return S;
}
