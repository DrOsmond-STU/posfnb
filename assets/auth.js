/* =========================================================================
   Racik POS — autentikasi & hak akses berbasis peran (RBAC)
   Purwarupa sisi peramban: akun, peran, dan log disimpan di localStorage.
   Kata sandi & PIN disimpan sebagai hash SHA-256 bergaram, bukan teks asli.
   Untuk produksi, verifikasi harus dipindah ke server.
   ========================================================================= */

const AUTH_KEY = 'racikpos-auth-v1';
const SESS_KEY = 'racikpos-session';
const IDLE_MS = 30 * 60000;
const MAX_TRY = 5, LOCK_MS = 60000;

/* ---------- SHA-256 (sinkron, tanpa pustaka) ---------- */
const sha256 = (() => {
  const K = [], H0 = [];
  const isPrime = x => { for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return true; };
  for (let n = 2, c = 0; c < 64; n++) {
    if (!isPrime(n)) continue;
    if (c < 8) H0[c] = (Math.pow(n, 1 / 2) * 4294967296) | 0;
    K[c++] = (Math.pow(n, 1 / 3) * 4294967296) | 0;
  }
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  return str => {
    const bytes = new TextEncoder().encode(str);
    const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6;
    const buf = new Uint8Array(total); buf.set(bytes); buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(total - 4, (len * 8) >>> 0);
    dv.setUint32(total - 8, Math.floor(len / 536870912));
    const H = H0.slice(), W = new Int32Array(64);
    for (let i = 0; i < total; i += 64) {
      for (let t = 0; t < 16; t++) W[t] = dv.getInt32(i + t * 4);
      for (let t = 16; t < 64; t++) {
        const s0 = rotr(W[t - 15], 7) ^ rotr(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rotr(W[t - 2], 17) ^ rotr(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
        const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, k) => { H[k] = (H[k] + v) | 0; });
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  };
})();
const hashSecret = (uid, kind, secret) => sha256(`racikpos:${uid}:${kind}:${secret}`);

/* ---------- Katalog izin ---------- */
const ACTION_PERMS = [
  ['kasir.bayar', 'Terima pembayaran', 'Kasir'],
  ['kasir.diskon', 'Beri diskon tanpa persetujuan', 'Kasir'],
  ['penjualan.semua', 'Lihat transaksi semua kasir', 'Penjualan'],
  ['menu.edit', 'Ubah resep & harga jual', 'Menu'],
  ['po.buat', 'Buat, kirim & batalkan PO; kelola pemasok', 'Pembelian'],
  ['po.terima', 'Posting penerimaan barang', 'Pembelian'],
  ['po.bayar', 'Bayar hutang pemasok', 'Pembelian'],
  ['stok.bahan', 'Tambah & ubah data bahan', 'Persediaan'],
  ['stok.opname', 'Posting stok opname', 'Persediaan'],
  ['stok.waste', 'Catat bahan rusak', 'Persediaan'],
  ['kas.catat', 'Catat biaya, setor kas & PB1', 'Keuangan'],
  ['pengaturan.ubah', 'Ubah pengaturan outlet', 'Sistem'],
  ['pengguna.kelola', 'Kelola pengguna & hak akses', 'Sistem'],
  ['data.reset', 'Atur ulang data demo', 'Sistem'],
];
const permLabel = p => {
  if (p.startsWith('m:')) return 'Buka modul ' + navInfo(p.slice(2)).title;
  const a = ACTION_PERMS.find(x => x[0] === p); return a ? a[1] : p;
};
const ALL_MODULES = () => NAV.flatMap(g => g.items.map(i => i[0]));

const ROLE_SEED = [
  { id: 'owner', name: 'Pemilik', tone: 'bad', locked: true, desc: 'Akses penuh ke semua modul dan pengaturan.', perms: ['*'] },
  { id: 'manajer', name: 'Manajer Outlet', tone: 'gold', desc: 'Menjalankan operasional harian, menyetujui diskon, dan membaca semua laporan.',
    perms: ['m:dashboard', 'm:kasir', 'm:meja', 'm:dapur', 'm:penjualan', 'm:menu', 'm:pembelian', 'm:pemasok', 'm:persediaan', 'm:kas', 'm:lap-penjualan', 'm:lap-keuangan', 'm:lap-persediaan', 'm:pengaturan',
      'kasir.bayar', 'kasir.diskon', 'penjualan.semua', 'menu.edit', 'po.buat', 'po.terima', 'po.bayar', 'stok.bahan', 'stok.opname', 'stok.waste', 'kas.catat', 'pengaturan.ubah'] },
  { id: 'kasir', name: 'Kasir', tone: 'info', desc: 'Mencatat pesanan dan menerima pembayaran. Diskon perlu PIN manajer.',
    perms: ['m:kasir', 'm:meja', 'm:dapur', 'm:penjualan', 'kasir.bayar'] },
  { id: 'dapur', name: 'Kepala Dapur', tone: 'ok', desc: 'Mengelola layar dapur, standar resep, stok opname, dan bahan rusak.',
    perms: ['m:dapur', 'm:menu', 'm:persediaan', 'm:lap-persediaan', 'menu.edit', 'stok.opname', 'stok.waste'] },
  { id: 'gudang', name: 'Staf Gudang', tone: '', desc: 'Membuat PO, menerima barang, dan menjaga data persediaan.',
    perms: ['m:pembelian', 'm:pemasok', 'm:persediaan', 'po.buat', 'po.terima', 'stok.bahan', 'stok.opname', 'stok.waste'] },
  { id: 'akuntan', name: 'Akuntan', tone: 'warn', desc: 'Mencatat kas & biaya, membayar pemasok, dan menyusun laporan.',
    perms: ['m:dashboard', 'm:penjualan', 'm:pembelian', 'm:pemasok', 'm:kas', 'm:lap-penjualan', 'm:lap-keuangan', 'm:lap-persediaan', 'penjualan.semua', 'po.bayar', 'kas.catat'] },
];
const USER_SEED = [
  ['U01', 'Andi Pratama', 'andi@dapurnusantara.id', 'owner', '111111', true],
  ['U02', 'Sari Wulandari', 'sari@dapurnusantara.id', 'manajer', '222222', true],
  ['U03', 'Rina Kartika', 'rina@dapurnusantara.id', 'kasir', '123456', true],
  ['U04', 'Dimas Saputra', 'dimas@dapurnusantara.id', 'kasir', '654321', true],
  ['U05', 'Wayan Sudarma', 'wayan@dapurnusantara.id', 'dapur', '333333', true],
  ['U06', 'Joko Susilo', 'joko@dapurnusantara.id', 'gudang', '444444', true],
  ['U07', 'Maya Lestari', 'maya@dapurnusantara.id', 'akuntan', '', true],
  ['U08', 'Budi Santoso', 'budi@dapurnusantara.id', 'kasir', '777777', false],
];
const DEMO_PASSWORD = 'demo1234';

/* ---------- Penyimpanan ---------- */
let AUTH = null;
let SESSION = null;
function seedAuth() {
  return {
    ver: 1,
    roles: ROLE_SEED.map(r => ({ ...r, perms: r.perms.slice() })),
    users: USER_SEED.map(([id, name, email, role, pin, active]) => ({
      id, name, email, role, active, lastLogin: null,
      pw: hashSecret(id, 'pw', DEMO_PASSWORD), pin: pin ? hashSecret(id, 'pin', pin) : null,
    })),
    audit: [], attempts: {},
  };
}
function loadAuth() {
  try { const raw = localStorage.getItem(AUTH_KEY); if (raw) { const a = JSON.parse(raw); if (a && a.ver === 1) AUTH = a; } } catch (e) { /* abaikan */ }
  if (!AUTH) { AUTH = seedAuth(); saveAuth(); }
  SESSION = readSession();
}
function saveAuth() { try { localStorage.setItem(AUTH_KEY, JSON.stringify(AUTH)); } catch (e) { /* abaikan */ } }
function readSession() {
  for (const store of ['localStorage', 'sessionStorage']) {
    try {
      const s = JSON.parse(window[store].getItem(SESS_KEY) || 'null');
      if (s && s.exp > Date.now() && AUTH.users.some(u => u.id === s.uid && u.active)) return s;
    } catch (e) { /* abaikan */ }
  }
  return null;
}
function writeSession(uid, remember) {
  SESSION = { uid, exp: Date.now() + (remember ? 7 * DAY : 12 * 3600000), at: Date.now() };
  clearSession(true);
  try { (remember ? localStorage : sessionStorage).setItem(SESS_KEY, JSON.stringify(SESSION)); } catch (e) { /* sesi hanya di memori */ }
}
function clearSession(keepMemory) {
  try { localStorage.removeItem(SESS_KEY); } catch (e) { /* abaikan */ }
  try { sessionStorage.removeItem(SESS_KEY); } catch (e) { /* abaikan */ }
  if (!keepMemory) SESSION = null;
}

const userById = id => AUTH.users.find(u => u.id === id);
const roleById = id => AUTH.roles.find(r => r.id === id);
const currentUser = () => (SESSION ? userById(SESSION.uid) : null);
const activeUsers = () => AUTH.users.filter(u => u.active);
const initials = n => n.split(' ').map(x => x[0]).join('').slice(0, 2).toUpperCase();
function can(perm, user) {
  const u = user || currentUser(); if (!u) return false;
  const r = roleById(u.role); if (!r) return false;
  return r.perms.includes('*') || r.perms.includes(perm);
}
const canView = key => can('m:' + key);
const firstAllowed = () => ALL_MODULES().find(canView) || 'dashboard';
const rolePill = id => { const r = roleById(id); return r ? `<span class="pill ${r.tone}">${esc(r.name)}</span>` : ''; };

function audit(event, detail, uid) {
  const u = uid ? userById(uid) : currentUser();
  AUTH.audit.unshift({ t: Date.now(), uid: u ? u.id : null, who: u ? u.name : '—', event, detail: detail || '' });
  AUTH.audit = AUTH.audit.slice(0, 300);
  saveAuth();
}

/* ---------- Penjaga aksi ---------- */
const ACT_PERM = {
  'cart-pay': 'kasir.bayar', 'pay-confirm': 'kasir.bayar',
  'menu-new': 'menu.edit', 'menu-save': 'menu.edit', 'me-apply': 'menu.edit', 'me-add': 'menu.edit', 'me-del': 'menu.edit',
  'me-f': 'menu.edit', 'me-ing': 'menu.edit', 'me-qty': 'menu.edit', 'me-steps': 'menu.edit', 'me-active': 'menu.edit',
  'po-new': 'po.buat', 'po-from-sug': 'po.buat', 'po-save': 'po.buat', 'po-send': 'po.buat', 'po-cancel': 'po.buat', 'sup-save': 'po.buat',
  'po-recv': 'po.terima', 'grn-post': 'po.terima', 'po-pay': 'po.bayar', 'pp-save': 'po.bayar',
  'ing-save': 'stok.bahan', 'opn-new': 'stok.opname', 'opn-post': 'stok.opname', 'waste-new': 'stok.waste', 'ws-save': 'stok.waste',
  'exp-new': 'kas.catat', 'exp-save': 'kas.catat', 'cash-deposit': 'kas.catat', 'cd-save': 'kas.catat', 'tax-pay': 'kas.catat', 'tax-save': 'kas.catat',
  'st-save': 'pengaturan.ubah', 'reset-ask': 'data.reset', 'reset-do': 'data.reset',
  'user-edit': 'pengguna.kelola', 'user-save': 'pengguna.kelola', 'role-toggle': 'pengguna.kelola',
};
function permOk(actName) {
  const p = ACT_PERM[actName];
  if (!p || can(p)) return true;
  toast('Akses ditolak: perlu izin "' + permLabel(p) + '".', 'ban');
  audit('Akses ditolak', permLabel(p));
  return false;
}
/* tandai kontrol yang tidak diizinkan agar terlihat terkunci */
function applyPermUI(root) {
  root.querySelectorAll('[data-act],[data-ch],[data-in]').forEach(el => {
    const name = el.getAttribute('data-act') || el.getAttribute('data-ch') || el.getAttribute('data-in');
    const p = ACT_PERM[name];
    if (!p || can(p)) return;
    if ('disabled' in el && el.tagName !== 'TR') el.disabled = true;
    el.classList.add('locked');
    el.title = 'Perlu izin: ' + permLabel(p);
  });
}
function deniedHTML(key) {
  return `<div class="card card-b" style="max-width:640px">
    <div class="stack"><span class="li-ic" style="width:48px;height:48px">${icon('shield', 26)}</span>
    <h2 style="margin:0;font-family:var(--font-display);font-size:22px">Anda tidak punya akses ke ${esc(navInfo(key).title)}</h2>
    <p class="muted" style="margin:0">Peran <b>${esc(roleById(currentUser().role).name)}</b> tidak mencakup modul ini. Minta pemilik outlet menambahkan izin di menu Pengguna &amp; Akses bila Anda memerlukannya.</p>
    <div class="row"><button class="btn btn-primary" data-act="go" data-to="${firstAllowed()}">${icon('arrow-right', 16)} Ke ${esc(navInfo(firstAllowed()).title)}</button></div></div></div>`;
}

/* =========================== LAYAR MASUK =========================== */
const LOGIN = { mode: 'email', email: '', err: '', pinUser: null, pin: '', lockedFor: null };
function themeSwitchHTML() {
  const cur = document.documentElement.dataset.theme || 'system';
  return [['light', 'sun', 'Terang'], ['dark', 'moon', 'Gelap'], ['system', 'monitor', 'Ikuti sistem']]
    .map(([v, ic, t]) => `<button type="button" class="${cur === v ? 'on' : ''}" data-act="theme-set" data-v="${v}" title="${t}" aria-label="Tema ${t}" aria-pressed="${cur === v}">${icon(ic, 15)}</button>`).join('');
}
function attemptsLeft(key) {
  const a = AUTH.attempts[key];
  if (a && a.until > Date.now()) return { locked: Math.ceil((a.until - Date.now()) / 1000) };
  return { locked: 0 };
}
function failAttempt(key, uid) {
  const a = AUTH.attempts[key] && AUTH.attempts[key].until > Date.now() ? AUTH.attempts[key] : (AUTH.attempts[key] || { n: 0, until: 0 });
  if (a.until && a.until <= Date.now()) { a.n = 0; a.until = 0; }
  a.n++;
  if (a.n >= MAX_TRY) { a.until = Date.now() + LOCK_MS; a.n = 0; audit('Akun terkunci sementara', key, uid); }
  AUTH.attempts[key] = a; saveAuth();
  return MAX_TRY - a.n;
}
function loginFormHTML() {
  const L = LOGIN;
  const err = L.err ? `<div class="login-error">${icon('triangle-alert', 16)}<span>${L.err}</span></div>` : '';
  if (L.mode === 'pin') {
    const users = activeUsers().filter(u => u.pin);
    const sel = L.pinUser ? userById(L.pinUser) : null;
    return `<div class="pin-users">${users.map(u => `<button type="button" class="pin-user ${L.pinUser === u.id ? 'on' : ''}" data-act="pin-user" data-id="${u.id}"><span class="av">${initials(u.name)}</span><span><span class="nm">${esc(u.name)}</span><span class="rl">${esc(roleById(u.role).name)}</span></span></button>`).join('')}</div>
      ${sel ? `<div class="pin-box"><div class="lbl" style="text-align:center">PIN ${esc(sel.name.split(' ')[0])}</div>
        <div class="pin-dots" aria-label="${L.pin.length} dari 6 digit">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < L.pin.length ? 'on' : ''}"></i>`).join('')}</div>${err}
        <div class="pinpad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map(k => k === 'del'
          ? `<button type="button" data-act="pin-key" data-k="del" aria-label="Hapus digit">${icon('chevron-left', 20)}</button>`
          : k === 'ok' ? `<button type="button" class="ok" data-act="pin-key" data-k="ok" aria-label="Masuk">${icon('arrow-right', 20)}</button>`
          : `<button type="button" data-act="pin-key" data-k="${k}">${k}</button>`).join('')}</div></div>`
        : `<p class="muted" style="text-align:center;margin:8px 0 0">Pilih nama Anda, lalu masukkan PIN 6 digit.</p>`}`;
  }
  return `<form id="login-form" novalidate>
    <div class="field"><label for="login-email">Email</label><input class="input" id="login-email" type="email" autocomplete="username" placeholder="nama@dapurnusantara.id" value="${esc(L.email)}"></div>
    <div class="field"><label for="login-pass">Kata sandi</label><div class="pass-wrap"><input class="input" id="login-pass" type="password" autocomplete="current-password" placeholder="••••••••">
      <button type="button" class="pass-eye" data-act="pass-eye" aria-label="Tampilkan kata sandi">${icon('eye', 17)}</button></div></div>
    <div class="login-row"><label class="check"><input type="checkbox" id="login-remember" checked> Ingat saya di perangkat ini</label>
      <button type="button" class="linkish" data-act="forgot">Lupa kata sandi?</button></div>
    ${err}
    <button type="submit" class="btn btn-primary btn-lg btn-block">${icon('log-out', 17)} Masuk</button>
  </form>
  <div class="login-demo"><div class="lbl">Akun demo</div>
    <p>Purwarupa ini belum terhubung ke server. Semua akun demo memakai kata sandi <code>${DEMO_PASSWORD}</code>. Klik salah satu untuk mengisi formulir.</p>
    <div class="demo-list">${AUTH.users.map(u => `<button type="button" class="demo-acct" data-act="login-demo" data-id="${u.id}"><span class="av">${initials(u.name)}</span><span style="flex:1;min-width:0"><span class="nm">${esc(u.name)}</span><span class="rl">${esc(u.email)}</span></span>${u.active ? rolePill(u.role) : '<span class="pill">Nonaktif</span>'}</button>`).join('')}</div></div>`;
}
function renderLogin() {
  const el = document.getElementById('login');
  el.innerHTML = `
  <div class="login-brandside">
    <div class="login-brandtop"><span class="brand-mark">${icon('chef-hat', 24)}</span><span><span class="brand-name">Racik POS</span><br><span class="brand-sub">POS · Resto &amp; F&amp;B</span></span></div>
    <div class="login-claim">
      <div class="login-metric">${AUTH.roles.length} peran</div>
      <h2>Dari pembelian bahan sampai laporan laba rugi</h2>
      <p>Kasir, dapur, gudang, dan pemilik bekerja di data yang sama, dengan akses sesuai peran masing-masing.</p>
      <blockquote>Setiap porsi yang terjual langsung memotong stok sesuai resep standar.</blockquote>
    </div>
    <svg class="login-pattern" viewBox="0 0 320 140" aria-hidden="true" preserveAspectRatio="none"><g fill="currentColor">
      <rect x="0" y="0" width="52" height="24" rx="6" opacity=".14"/><rect x="58" y="0" width="24" height="24" rx="6" opacity=".22"/><rect x="88" y="0" width="24" height="24" rx="6" opacity=".30"/>
      <rect x="0" y="30" width="24" height="24" rx="6" opacity=".10"/><rect x="30" y="30" width="24" height="24" rx="6" opacity=".18"/><rect x="60" y="30" width="52" height="24" rx="6" opacity=".26"/>
      <rect x="0" y="60" width="24" height="24" rx="6" opacity=".08"/><rect x="30" y="60" width="24" height="24" rx="6" opacity=".14"/><rect x="60" y="60" width="24" height="24" rx="6" opacity=".20"/><rect x="90" y="60" width="24" height="24" rx="6" opacity=".30"/></g></svg>
  </div>
  <div class="login-formside">
    <div class="login-prefs"><div class="theme-switch on-light" role="group" aria-label="Tema">${themeSwitchHTML()}</div></div>
    <div class="login-card">
      <h1>Masuk ke Racik POS</h1>
      <p class="login-sub">${esc(S.settings.outlet)} · ${esc(S.settings.branch)}</p>
      <div class="seg" style="width:100%;margin-bottom:20px">
        <button type="button" style="flex:1;justify-content:center" class="${LOGIN.mode === 'email' ? 'on' : ''}" data-act="login-mode" data-v="email">${icon('user', 14)} Email &amp; kata sandi</button>
        <button type="button" style="flex:1;justify-content:center" class="${LOGIN.mode === 'pin' ? 'on' : ''}" data-act="login-mode" data-v="pin">${icon('shield', 14)} PIN kasir</button>
      </div>
      <div id="login-body">${loginFormHTML()}</div>
    </div>
  </div>`;
  const f = document.getElementById('login-form');
  if (f) {
    f.addEventListener('submit', e => { e.preventDefault(); doLogin(); });
    const target = LOGIN.email ? document.getElementById('login-pass') : document.getElementById('login-email');
    if (target) target.focus();
  }
}
function paintLoginBody() { document.getElementById('login-body').innerHTML = loginFormHTML(); const f = document.getElementById('login-form'); if (f) f.addEventListener('submit', e => { e.preventDefault(); doLogin(); }); }

function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-pass').value;
  const remember = document.getElementById('login-remember').checked;
  LOGIN.email = email;
  if (!email || !pass) { LOGIN.err = 'Isi email dan kata sandi.'; paintLoginBody(); return; }
  const key = 'pw:' + email;
  const lk = attemptsLeft(key);
  if (lk.locked) { LOGIN.err = `Terlalu banyak percobaan gagal. Coba lagi dalam ${lk.locked} detik.`; paintLoginBody(); return; }
  const u = AUTH.users.find(x => x.email.toLowerCase() === email);
  if (!u || u.pw !== hashSecret(u.id, 'pw', pass)) {
    const left = failAttempt(key, u && u.id);
    audit('Gagal masuk', email, u && u.id);
    LOGIN.err = left > 0 && left < MAX_TRY ? `Email atau kata sandi salah. Sisa ${left} percobaan.` : `Terlalu banyak percobaan gagal. Coba lagi dalam ${LOCK_MS / 1000} detik.`;
    paintLoginBody(); document.getElementById('login-pass').focus(); return;
  }
  if (!u.active) { LOGIN.err = 'Akun ini dinonaktifkan. Hubungi pemilik outlet.'; audit('Gagal masuk', 'Akun nonaktif', u.id); paintLoginBody(); return; }
  delete AUTH.attempts[key];
  completeLogin(u, remember, 'Masuk');
}
function doPinLogin() {
  const u = userById(LOGIN.pinUser);
  const key = 'pin:' + u.id;
  const lk = attemptsLeft(key);
  if (lk.locked) { LOGIN.err = `PIN terkunci. Coba lagi dalam ${lk.locked} detik.`; LOGIN.pin = ''; paintLoginBody(); return; }
  if (u.pin !== hashSecret(u.id, 'pin', LOGIN.pin)) {
    const left = failAttempt(key, u.id);
    audit('Gagal masuk', 'PIN salah', u.id);
    LOGIN.err = left > 0 && left < MAX_TRY ? `PIN salah. Sisa ${left} percobaan.` : `PIN terkunci selama ${LOCK_MS / 1000} detik.`;
    LOGIN.pin = ''; paintLoginBody();
    const box = document.querySelector('.pin-dots'); if (box) box.classList.add('shake');
    return;
  }
  delete AUTH.attempts[key];
  completeLogin(u, false, 'Masuk dengan PIN');
}
function completeLogin(u, remember, how) {
  u.lastLogin = Date.now();
  writeSession(u.id, remember);
  audit(how, navigator.userAgent.includes('Mobile') ? 'Perangkat seluler' : 'Peramban desktop', u.id);
  Object.assign(LOGIN, { err: '', pin: '', pinUser: null, email: '' });
  UI.cart = newCart();
  enterApp();
  toast(`Selamat datang, ${u.name.split(' ')[0]}. Anda masuk sebagai ${roleById(u.role).name}.`, 'circle-check');
}
function showLogin() {
  document.getElementById('app').hidden = true;
  document.getElementById('login').hidden = false;
  closeModal(true);
  renderLogin();
}
function logout(reason, lock) {
  const u = currentUser();
  if (u) audit(lock ? 'Layar dikunci' : 'Keluar', reason || '', u.id);
  clearSession();
  UI.cart = newCart();
  if (lock && u) {
    if (u.pin) Object.assign(LOGIN, { mode: 'pin', pinUser: u.id, pin: '' }); else Object.assign(LOGIN, { mode: 'email', email: u.email });
  }
  LOGIN.err = reason || '';
  showLogin();
}

ACT['login-mode'] = el => { Object.assign(LOGIN, { mode: el.dataset.v, err: '', pin: '' }); renderLogin(); };
ACT['login-demo'] = el => {
  const u = userById(el.dataset.id);
  LOGIN.email = u.email; LOGIN.err = '';
  paintLoginBody();
  document.getElementById('login-pass').value = DEMO_PASSWORD;
  document.getElementById('login-pass').focus();
};
ACT['pass-eye'] = () => { const p = document.getElementById('login-pass'); p.type = p.type === 'password' ? 'text' : 'password'; };
ACT['forgot'] = () => { LOGIN.err = 'Minta pemilik outlet mengatur ulang kata sandi Anda di menu Pengguna &amp; Akses.'; paintLoginBody(); };
ACT['pin-user'] = el => { Object.assign(LOGIN, { pinUser: el.dataset.id, pin: '', err: '' }); paintLoginBody(); };
ACT['pin-key'] = el => {
  const k = el.dataset.k;
  if (k === 'del') LOGIN.pin = LOGIN.pin.slice(0, -1);
  else if (k === 'ok') { if (LOGIN.pin.length === 6) { doPinLogin(); return; } }
  else if (LOGIN.pin.length < 6) LOGIN.pin += k;
  LOGIN.err = '';
  if (LOGIN.pin.length === 6) { doPinLogin(); return; }
  paintLoginBody();
};
document.addEventListener('keydown', e => {
  if (document.getElementById('login').hidden || LOGIN.mode !== 'pin' || !LOGIN.pinUser) return;
  if (/^[0-9]$/.test(e.key)) { ACT['pin-key']({ dataset: { k: e.key } }); e.preventDefault(); }
  else if (e.key === 'Backspace') { ACT['pin-key']({ dataset: { k: 'del' } }); e.preventDefault(); }
});
ACT['logout'] = () => logout('');
ACT['lock'] = () => logout('Layar dikunci. Masuk lagi untuk melanjutkan.', true);

/* ---------- Batas waktu tidak aktif ---------- */
let lastActivity = Date.now();
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(() => {
  if (currentUser() && Date.now() - lastActivity > IDLE_MS) logout('Sesi dikunci karena tidak ada aktivitas selama 30 menit.', true);
}, 60000);

/* ---------- Persetujuan diskon oleh manajer ---------- */
function askDiscountApproval(pct, onOk) {
  const approvers = activeUsers().filter(u => u.pin && can('kasir.diskon', u));
  openModal({
    title: 'Persetujuan diskon ' + pct + '%', size: 'sm',
    body: `<div class="alert info">${icon('shield', 16)}<div>Peran Anda tidak bisa memberi diskon sendiri. Minta manajer atau pemilik memasukkan PIN-nya.</div></div>
      <div class="field"><label for="ap-user">Disetujui oleh</label><select class="input" id="ap-user">${opts(approvers.map(u => [u.id, u.name + ' · ' + roleById(u.role).name]), approvers[0] && approvers[0].id)}</select></div>
      <div class="field"><label for="ap-pin">PIN 6 digit</label><input class="input num" id="ap-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" autofocus></div>
      <div id="ap-err"></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="ap-ok">${icon('check', 16)} Setujui</button>`,
  });
  ACT['ap-ok'] = () => {
    const u = userById(document.getElementById('ap-user').value);
    const pin = document.getElementById('ap-pin').value.trim();
    const key = 'pin:' + u.id;
    if (attemptsLeft(key).locked) { document.getElementById('ap-err').innerHTML = `<div class="alert bad">${icon('ban', 16)}<div>PIN ${esc(u.name)} sedang terkunci.</div></div>`; return; }
    if (u.pin !== hashSecret(u.id, 'pin', pin)) {
      failAttempt(key, u.id);
      audit('Persetujuan diskon ditolak', 'PIN salah untuk ' + u.name);
      document.getElementById('ap-err').innerHTML = `<div class="alert bad">${icon('triangle-alert', 16)}<div>PIN salah.</div></div>`;
      document.getElementById('ap-pin').value = ''; document.getElementById('ap-pin').focus();
      return;
    }
    delete AUTH.attempts[key];
    audit('Persetujuan diskon', `Diskon ${pct}% disetujui oleh ${u.name}`);
    closeModal(true);
    onOk(u);
  };
}

/* ---------- Profil sendiri ---------- */
ACT['profile'] = () => {
  const u = currentUser(), r = roleById(u.role);
  openModal({
    title: 'Profil saya', size: 'sm',
    body: `<div class="row" style="flex-wrap:nowrap"><span class="avatar" style="width:48px;height:48px;background:var(--brand-100);color:var(--brand-700)">${initials(u.name)}</span><div><div class="strong">${esc(u.name)}</div><div class="muted">${esc(u.email)}</div></div><span class="spacer"></span>${rolePill(u.role)}</div>
      <p class="muted" style="margin:0;font-size:13px">${esc(r.desc)}</p>
      <div class="field"><label for="pf-old">Kata sandi sekarang</label><input class="input" id="pf-old" type="password" autocomplete="current-password"></div>
      <div class="form-grid"><div class="field"><label for="pf-new">Kata sandi baru</label><input class="input" id="pf-new" type="password" autocomplete="new-password" placeholder="Minimal 8 karakter"></div>
      <div class="field"><label for="pf-pin">PIN kasir baru</label><input class="input num" id="pf-pin" type="password" inputmode="numeric" maxlength="6" placeholder="6 digit, opsional"></div></div>
      <div id="pf-err"></div>`,
    foot: `<button class="btn" data-act="modal-close">Tutup</button><button class="btn btn-primary" data-act="pf-save">${icon('save', 16)} Simpan</button>`,
  });
};
ACT['pf-save'] = () => {
  const u = currentUser();
  const old = document.getElementById('pf-old').value, nw = document.getElementById('pf-new').value, pin = document.getElementById('pf-pin').value.trim();
  const fail = m => { document.getElementById('pf-err').innerHTML = `<div class="alert bad">${icon('triangle-alert', 16)}<div>${m}</div></div>`; };
  if (!nw && !pin) return fail('Isi kata sandi baru atau PIN baru.');
  if (u.pw !== hashSecret(u.id, 'pw', old)) return fail('Kata sandi sekarang salah.');
  if (nw && nw.length < 8) return fail('Kata sandi baru minimal 8 karakter.');
  if (pin && !/^\d{6}$/.test(pin)) return fail('PIN harus 6 digit angka.');
  if (nw) u.pw = hashSecret(u.id, 'pw', nw);
  if (pin) u.pin = hashSecret(u.id, 'pin', pin);
  audit('Kredensial diubah', [nw && 'kata sandi', pin && 'PIN'].filter(Boolean).join(' & '));
  closeModal(true); toast('Kredensial Anda diperbarui.');
};

/* =========================== PENGGUNA & AKSES =========================== */
UI.users = { tab: 'users' };
VIEWS.pengguna = () => {
  const T = UI.users.tab;
  const tabs = [['users', 'Pengguna', AUTH.users.length], ['roles', 'Peran & hak akses', AUTH.roles.length], ['log', 'Log aktivitas', AUTH.audit.length]];
  let body = '';
  if (T === 'users') {
    body = `<div class="strip">${AUTH.roles.map(r => `<div><div class="s-l">${esc(r.name)}</div><div class="s-v">${AUTH.users.filter(u => u.role === r.id && u.active).length}</div></div>`).join('')}</div>
      <div class="row between"><div class="muted">${activeUsers().length} pengguna aktif dari ${AUTH.users.length}. Semua akun demo memakai kata sandi <code class="mono">${DEMO_PASSWORD}</code> sampai diubah.</div>
      <button class="btn btn-primary" data-act="user-edit">${icon('plus', 16)} Tambah pengguna</button></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Pengguna</th><th>Peran</th><th>PIN kasir</th><th>Masuk terakhir</th><th>Status</th><th></th></tr></thead><tbody>
      ${AUTH.users.map(u => `<tr><td><div class="row" style="flex-wrap:nowrap;gap:10px"><span class="avatar" style="background:var(--brand-100);color:var(--brand-700)">${initials(u.name)}</span><div><div class="strong">${esc(u.name)}${u.id === currentUser().id ? ' <span class="faint">(Anda)</span>' : ''}</div><div class="sub">${esc(u.email)}</div></div></div></td>
        <td>${rolePill(u.role)}</td><td>${u.pin ? '<span class="pill ok">Aktif</span>' : '<span class="faint">Belum diatur</span>'}</td>
        <td>${u.lastLogin ? fmtDT(u.lastLogin) : '<span class="faint">Belum pernah</span>'}</td><td>${u.active ? '<span class="pill ok">Aktif</span>' : '<span class="pill">Nonaktif</span>'}</td>
        <td><button class="btn btn-sm btn-ghost" data-act="user-edit" data-id="${u.id}">${icon('pencil', 14)} Ubah</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
  } else if (T === 'roles') {
    const mods = NAV.flatMap(g => g.items.map(i => ['m:' + i[0], i[1], g.group]));
    const acts = ACTION_PERMS.map(([p, l, g]) => [p, l, g]);
    const cell = (r, p) => {
      const on = r.perms.includes('*') || r.perms.includes(p);
      return `<td style="text-align:center"><input type="checkbox" class="perm-cb" ${on ? 'checked' : ''} ${r.locked ? 'disabled' : ''} data-ch="role-toggle" data-role="${r.id}" data-perm="${p}" aria-label="${esc(r.name)}: ${esc(permLabel(p))}"></td>`;
    };
    const rows = (list, title) => `<tr class="group"><td colspan="${AUTH.roles.length + 1}">${title}</td></tr>` + list.map(([p, l, g]) => `<tr><td><div class="strong" style="font-weight:500">${esc(l)}</div><div class="sub">${esc(g)}</div></td>${AUTH.roles.map(r => cell(r, p)).join('')}</tr>`).join('');
    body = `<div class="alert info">${icon('shield', 16)}<div>Centang langsung tersimpan dan berlaku pada klik berikutnya. Peran <b>Pemilik</b> selalu punya akses penuh dan tidak bisa diubah, supaya outlet tidak pernah terkunci dari pengaturannya sendiri.</div></div>
      <div class="grid g-3">${AUTH.roles.map(r => `<div class="card card-b stack" style="gap:6px"><div class="row between">${rolePill(r.id)}<span class="muted" style="font-size:12px">${AUTH.users.filter(u => u.role === r.id).length} pengguna</span></div><div style="font-size:13px">${esc(r.desc)}</div><div class="faint" style="font-size:12px">${r.perms.includes('*') ? 'Semua izin' : r.perms.length + ' izin'}</div></div>`).join('')}</div>
      <div class="card"><div class="table-wrap"><table class="tbl perm-matrix"><thead><tr><th>Izin</th>${AUTH.roles.map(r => `<th style="text-align:center">${esc(r.name)}</th>`).join('')}</tr></thead><tbody>
      ${rows(mods, 'AKSES MODUL')}${rows(acts, 'AKSI')}</tbody></table></div></div>`;
  } else {
    body = `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th><th>Detail</th></tr></thead><tbody>
      ${AUTH.audit.slice(0, 200).map(a => `<tr><td class="mono" style="color:var(--ink-500)">${fmtDT(a.t)}</td><td class="strong">${esc(a.who)}</td><td>${/Gagal|ditolak|terkunci/i.test(a.event) ? `<span class="pill bad">${esc(a.event)}</span>` : /Masuk/.test(a.event) ? `<span class="pill ok">${esc(a.event)}</span>` : `<span class="pill info">${esc(a.event)}</span>`}</td><td class="muted">${esc(a.detail)}</td></tr>`).join('') || `<tr><td colspan="4">${emptyState('history', 'Belum ada aktivitas.')}</td></tr>`}
      </tbody></table></div></div>`;
  }
  return `<div class="tabs">${tabs.map(([k, l, n]) => `<button type="button" class="${T === k ? 'on' : ''}" data-act="users-tab" data-v="${k}">${l}<span class="count">${n}</span></button>`).join('')}</div>${body}`;
};
VIEWS.pengguna.hero = () => ({ metric: activeUsers().length, label: 'Pengguna aktif' });
ACT['users-tab'] = el => { UI.users.tab = el.dataset.v; render(); };
ACT['role-toggle'] = el => {
  const r = roleById(el.dataset.role), p = el.dataset.perm;
  if (r.locked) return;
  if (el.checked) { if (!r.perms.includes(p)) r.perms.push(p); } else r.perms = r.perms.filter(x => x !== p);
  audit('Hak akses diubah', `${r.name}: ${el.checked ? '+' : '−'} ${permLabel(p)}`);
  saveAuth(); renderNav();
  toast(`${r.name} ${el.checked ? 'sekarang bisa' : 'tidak lagi bisa'}: ${permLabel(p).toLowerCase()}.`, 'shield');
};
ACT['user-edit'] = el => {
  const u = el.dataset.id ? userById(el.dataset.id) : null;
  const isNew = !u;
  const d = u || { id: 'U' + pad(AUTH.users.length + 1), name: '', email: '', role: 'kasir', active: true };
  openModal({
    title: isNew ? 'Tambah pengguna' : 'Ubah pengguna',
    body: `<div class="form-grid">
      <div class="field full"><label for="us-name">Nama lengkap</label><input class="input" id="us-name" value="${esc(d.name)}" autofocus></div>
      <div class="field"><label for="us-email">Email</label><input class="input" id="us-email" type="email" value="${esc(d.email)}" placeholder="nama@dapurnusantara.id"></div>
      <div class="field"><label for="us-role">Peran</label><select class="input" id="us-role">${opts(AUTH.roles.map(r => [r.id, r.name]), d.role)}</select></div>
      <div class="field"><label for="us-pw">${isNew ? 'Kata sandi awal' : 'Atur ulang kata sandi'}</label><input class="input" id="us-pw" type="password" autocomplete="new-password" placeholder="${isNew ? 'Minimal 8 karakter' : 'Kosongkan jika tidak diubah'}"></div>
      <div class="field"><label for="us-pin">PIN kasir (6 digit)</label><input class="input num" id="us-pin" type="password" inputmode="numeric" maxlength="6" placeholder="${u && u.pin ? 'Kosongkan jika tidak diubah' : 'Opsional'}"></div>
      <label class="switch full"><input type="checkbox" id="us-active" ${d.active ? 'checked' : ''}> Akun aktif dan boleh masuk</label></div>
      <div id="us-err"></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="user-save" data-id="${d.id}" data-new="${isNew ? '1' : ''}">${icon('save', 16)} Simpan</button>`,
  });
};
ACT['user-save'] = el => {
  const v = id => document.getElementById(id).value.trim();
  const fail = m => { document.getElementById('us-err').innerHTML = `<div class="alert bad">${icon('triangle-alert', 16)}<div>${m}</div></div>`; };
  const isNew = !!el.dataset.new, id = el.dataset.id;
  const name = v('us-name'), email = v('us-email').toLowerCase(), role = v('us-role'), pw = document.getElementById('us-pw').value, pin = v('us-pin');
  const active = document.getElementById('us-active').checked;
  if (!name) return fail('Nama wajib diisi.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('Format email tidak valid.');
  if (AUTH.users.some(x => x.email.toLowerCase() === email && x.id !== id)) return fail('Email sudah dipakai pengguna lain.');
  if (isNew && pw.length < 8) return fail('Kata sandi awal minimal 8 karakter.');
  if (!isNew && pw && pw.length < 8) return fail('Kata sandi baru minimal 8 karakter.');
  if (pin && !/^\d{6}$/.test(pin)) return fail('PIN harus 6 digit angka.');
  const me = currentUser();
  const target = userById(id);
  if (me.role !== 'owner' && (role === 'owner' || (target && target.role === 'owner'))) return fail('Hanya Pemilik yang bisa membuat, mengubah, atau menunjuk akun Pemilik.');
  if (id === me.id && !active) return fail('Anda tidak bisa menonaktifkan akun sendiri.');
  const owners = AUTH.users.filter(x => x.role === 'owner' && x.active && x.id !== id);
  if (!owners.length && (role !== 'owner' || !active)) return fail('Harus ada minimal satu Pemilik yang aktif.');
  let u = userById(id);
  if (!u) { u = { id, lastLogin: null, pin: null }; AUTH.users.push(u); }
  const changes = [];
  if (!isNew && u.role !== role) changes.push('peran → ' + roleById(role).name);
  if (!isNew && u.active !== active) changes.push(active ? 'diaktifkan' : 'dinonaktifkan');
  if (!isNew && pw) changes.push('kata sandi diatur ulang');
  if (!isNew && pin) changes.push('PIN diatur ulang');
  Object.assign(u, { name, email, role, active });
  if (pw) u.pw = hashSecret(u.id, 'pw', pw);
  if (pin) u.pin = hashSecret(u.id, 'pin', pin);
  audit(isNew ? 'Pengguna ditambah' : 'Pengguna diubah', `${name}${isNew ? ' sebagai ' + roleById(role).name : changes.length ? ': ' + changes.join(', ') : ''}`);
  saveAuth(); closeModal(true); render(); toast(`Data ${name} disimpan.`);
};
