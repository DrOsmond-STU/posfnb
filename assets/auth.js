/* =========================================================================
   Racik POS — autentikasi & hak akses (klien)
   Semua keputusan keamanan dibuat server (api/): kata sandi & PIN diverifikasi
   dengan hash Argon2id, sesi disimpan di MySQL, izin dicek di setiap endpoint.
   Berkas ini hanya menampilkan layar masuk dan menyembunyikan menu sesuai izin.
   ========================================================================= */

const API_BASE = 'api/';
const IDLE_MS = 30 * 60000;

/* ---------- Katalog izin (label untuk antarmuka) ---------- */
const ACTION_PERMS = [
  ['kasir.bayar', 'Terima pembayaran', 'Kasir'],
  ['kasir.diskon', 'Beri diskon tanpa persetujuan', 'Kasir'],
  ['penjualan.semua', 'Lihat transaksi semua kasir', 'Penjualan'],
  ['penjualan.void', 'Void transaksi & batalkan bill', 'Penjualan'],
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

/* ---------- Status sesi ---------- */
let ME = null;       // { user, permissions, roles, csrf } dari server
let LOCKED = null;   // pengguna yang layarnya terkunci
let CSRF = '';
let STAFF = [];      // staf aktif: { id, name, role_name }

const currentUser = () => (ME ? ME.user : null);
const initials = n => String(n || '').split(/\s+/).filter(Boolean).map(x => x[0]).join('').slice(0, 2).toUpperCase();
const roleById = id => ((ME && ME.roles) || []).find(r => r.id === id) || { id, name: id, tone: '', desc: '' };
const allRoles = () => (ME && ME.roles) || [];
const activeUsers = () => STAFF;
function can(perm) {
  if (!ME) return false;
  return ME.permissions.includes('*') || ME.permissions.includes(perm);
}
const canView = key => can('m:' + key);
const firstAllowed = () => ALL_MODULES().find(canView) || 'dashboard';
const rolePill = id => { const r = roleById(id); return `<span class="pill ${r.tone || ''}">${esc(r.name)}</span>`; };

/* ---------- Klien API ---------- */
async function api(method, path, body) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (CSRF) headers['X-CSRF-Token'] = CSRF;
  let res;
  try {
    res = await fetch(API_BASE + path, { method, credentials: 'same-origin', headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch (e) {
    return { status: 0, ok: false, data: { error: { code: 'NETWORK', message: 'Tidak bisa terhubung ke server. Periksa koneksi internet.' } } };
  }
  let data;
  try { data = await res.json(); } catch (e) { data = { error: { code: 'BAD_RESPONSE', message: 'Respons server tidak valid (' + res.status + ').' } }; }
  // sesi berakhir / terkunci saat aplikasi sedang dipakai
  if (ME && res.status === 401 && !path.startsWith('auth/')) { ME = null; LOGIN.err = 'Sesi Anda berakhir. Silakan masuk lagi.'; showLogin(); }
  if (ME && res.status === 423) { goLocked(data.error.details); }
  return { status: res.status, ok: res.ok, data };
}
const apiErr = r => (r.data && r.data.error ? r.data.error.message : 'Terjadi kesalahan.');

async function loadStaff() {
  const r = await api('GET', 'staff');
  STAFF = r.ok ? r.data.users : [];
}
function setMe(data) {
  ME = { user: data.user, permissions: data.permissions, roles: data.roles };
  CSRF = data.csrf;
  LOCKED = null;
}
/* dipanggil saat aplikasi dibuka: 'app' | 'locked' | 'login' */
async function initAuth() {
  const r = await api('GET', 'auth/me');
  if (r.ok) { setMe(r.data); await loadStaff(); return 'app'; }
  if (r.status === 423) { LOCKED = r.data.error.details.user; CSRF = r.data.error.details.csrf; Object.assign(LOGIN, { mode: 'unlock' }); return 'locked'; }
  if (r.status === 0 || r.status >= 500) LOGIN.err = apiErr(r);
  return 'login';
}

/* log aktivitas dari modul lain (dikirim ke server, tidak menunggu) */
function audit(event, detail) {
  if (ME) api('POST', 'audit', { event, detail: detail || '' });
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
  'sup-del': 'po.buat', 'po-edit': 'po.buat', 'ing-del': 'stok.bahan', 'menu-del': 'menu.edit',
  'waste-void': 'stok.waste', 'exp-void': 'kas.catat', 'resv-new': 'm:meja', 'resv-save': 'm:meja',
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
    <p class="muted" style="margin:0">Peran <b>${esc(currentUser().role_name)}</b> tidak mencakup modul ini. Minta pemilik outlet menambahkan izin di menu Pengguna &amp; Akses bila Anda memerlukannya.</p>
    <div class="row"><button class="btn btn-primary" data-act="go" data-to="${firstAllowed()}">${icon('arrow-right', 16)} Ke ${esc(navInfo(firstAllowed()).title)}</button></div></div></div>`;
}

/* =========================== LAYAR MASUK =========================== */
const LOGIN = { mode: 'email', email: '', err: '', pinUsers: null, pinUser: null, pin: '', busy: false };
function themeSwitchHTML() {
  const cur = document.documentElement.dataset.theme || 'system';
  return [['light', 'sun', 'Terang'], ['dark', 'moon', 'Gelap'], ['system', 'monitor', 'Ikuti sistem']]
    .map(([v, ic, t]) => `<button type="button" class="${cur === v ? 'on' : ''}" data-act="theme-set" data-v="${v}" title="${t}" aria-label="Tema ${t}" aria-pressed="${cur === v}">${icon(ic, 15)}</button>`).join('');
}
const pinPadHTML = (label, n) => `<div class="pin-box"><div class="lbl" style="text-align:center">${label}</div>
  <div class="pin-dots" aria-label="${n} dari 6 digit">${[0, 1, 2, 3, 4, 5].map(i => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>
  ${LOGIN.err ? `<div class="login-error">${icon('triangle-alert', 16)}<span>${esc(LOGIN.err)}</span></div>` : ''}
  <div class="pinpad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'].map(k => k === 'del'
    ? `<button type="button" data-act="pin-key" data-k="del" aria-label="Hapus digit">${icon('chevron-left', 20)}</button>`
    : k === 'ok' ? `<button type="button" class="ok" data-act="pin-key" data-k="ok" aria-label="Masuk">${icon('arrow-right', 20)}</button>`
    : `<button type="button" data-act="pin-key" data-k="${k}">${k}</button>`).join('')}</div></div>`;
function loginFormHTML() {
  const L = LOGIN;
  const err = L.err ? `<div class="login-error">${icon('triangle-alert', 16)}<span>${esc(L.err)}</span></div>` : '';
  if (L.mode === 'unlock' && LOCKED) {
    return `<div class="row" style="flex-wrap:nowrap;margin-bottom:16px"><span class="avatar" style="width:44px;height:44px;background:var(--brand-100);color:var(--brand-700)">${esc(LOCKED.initials)}</span>
      <div><div class="strong">${esc(LOCKED.name)}</div><div class="muted" style="font-size:13px">${esc(LOCKED.role_name)} · layar terkunci</div></div></div>
      ${LOCKED.has_pin ? pinPadHTML('Masukkan PIN untuk melanjutkan', L.pin.length)
        : `<form id="unlock-form" novalidate><div class="field"><label for="unlock-pass">Kata sandi</label><input class="input" id="unlock-pass" type="password" autocomplete="current-password"></div>${err}
           <button type="submit" class="btn btn-primary btn-lg btn-block" style="margin-top:12px">${icon('arrow-right', 17)} Buka kunci</button></form>`}
      <div style="text-align:center;margin-top:16px"><button type="button" class="linkish" data-act="login-other">Masuk sebagai pengguna lain</button></div>`;
  }
  if (L.mode === 'pin') {
    if (L.pinUsers === null) return `<p class="muted" style="text-align:center">Memuat daftar pengguna…</p>${err}`;
    if (!L.pinUsers.length) return err || `<p class="muted" style="text-align:center">Belum ada pengguna yang punya PIN.</p>`;
    const sel = L.pinUsers.find(u => u.id === L.pinUser);
    return `<div class="pin-users">${L.pinUsers.map(u => `<button type="button" class="pin-user ${L.pinUser === u.id ? 'on' : ''}" data-act="pin-user" data-id="${u.id}"><span class="av">${esc(u.initials)}</span><span><span class="nm">${esc(u.name)}</span><span class="rl">${esc(u.role_name)}</span></span></button>`).join('')}</div>
      ${sel ? pinPadHTML('PIN ' + esc(sel.name.split(' ')[0]), L.pin.length) : `<p class="muted" style="text-align:center;margin:8px 0 0">Pilih nama Anda, lalu masukkan PIN 6 digit.</p>`}`;
  }
  return `<form id="login-form" novalidate>
    <div class="field"><label for="login-email">Email</label><input class="input" id="login-email" type="email" autocomplete="username" placeholder="nama@usaha.id" value="${esc(L.email)}"></div>
    <div class="field"><label for="login-pass">Kata sandi</label><div class="pass-wrap"><input class="input" id="login-pass" type="password" autocomplete="current-password" placeholder="••••••••">
      <button type="button" class="pass-eye" data-act="pass-eye" aria-label="Tampilkan kata sandi">${icon('eye', 17)}</button></div></div>
    <div class="login-row"><label class="check"><input type="checkbox" id="login-remember" checked> Ingat saya di perangkat ini</label>
      <button type="button" class="linkish" data-act="forgot">Lupa kata sandi?</button></div>
    ${err}
    <button type="submit" class="btn btn-primary btn-lg btn-block" ${L.busy ? 'disabled' : ''}>${icon('log-out', 17)} ${L.busy ? 'Memeriksa…' : 'Masuk'}</button>
  </form>`;
}
function bindLoginForms() {
  const f = document.getElementById('login-form');
  if (f) f.addEventListener('submit', e => { e.preventDefault(); doLogin(); });
  const u = document.getElementById('unlock-form');
  if (u) u.addEventListener('submit', e => { e.preventDefault(); doUnlock({ password: document.getElementById('unlock-pass').value }); });
}
function renderLogin() {
  const el = document.getElementById('login');
  const locked = LOGIN.mode === 'unlock' && LOCKED;
  el.innerHTML = `
  <div class="login-brandside">
    <div class="login-brandtop"><span class="brand-mark">${icon('chef-hat', 24)}</span><span><span class="brand-name">Racik POS</span><br><span class="brand-sub">POS · Resto &amp; F&amp;B</span></span></div>
    <div class="login-claim">
      <div class="login-metric">1 data</div>
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
      <h1>${locked ? 'Layar terkunci' : 'Masuk ke Racik POS'}</h1>
      <p class="login-sub">${esc(S.settings.outlet)} · ${esc(S.settings.branch)}</p>
      ${locked ? '' : `<div class="seg" style="width:100%;margin-bottom:20px">
        <button type="button" style="flex:1;justify-content:center" class="${LOGIN.mode === 'email' ? 'on' : ''}" data-act="login-mode" data-v="email">${icon('user', 14)} Email &amp; kata sandi</button>
        <button type="button" style="flex:1;justify-content:center" class="${LOGIN.mode === 'pin' ? 'on' : ''}" data-act="login-mode" data-v="pin">${icon('shield', 14)} PIN kasir</button>
      </div>`}
      <div id="login-body">${loginFormHTML()}</div>
    </div>
  </div>`;
  bindLoginForms();
  const target = document.getElementById(LOGIN.email ? 'login-pass' : 'login-email') || document.getElementById('unlock-pass');
  if (target) target.focus();
}
function paintLoginBody() { document.getElementById('login-body').innerHTML = loginFormHTML(); bindLoginForms(); }

async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-pass').value;
  const remember = document.getElementById('login-remember').checked;
  LOGIN.email = email;
  if (!email || !password) { LOGIN.err = 'Isi email dan kata sandi.'; paintLoginBody(); return; }
  LOGIN.busy = true; LOGIN.err = ''; paintLoginBody();
  const r = await api('POST', 'auth/login', { email, password, remember });
  LOGIN.busy = false;
  if (!r.ok) { LOGIN.err = apiErr(r); paintLoginBody(); const p = document.getElementById('login-pass'); if (p) p.focus(); return; }
  completeLogin(r.data);
}
async function doPinLogin() {
  const r = await api('POST', 'auth/pin', { user_id: LOGIN.pinUser, pin: LOGIN.pin });
  LOGIN.pin = '';
  if (!r.ok) {
    LOGIN.err = apiErr(r); paintLoginBody();
    const box = document.querySelector('.pin-dots'); if (box) box.classList.add('shake');
    return;
  }
  completeLogin(r.data);
}
async function doUnlock(cred) {
  const r = await api('POST', 'auth/unlock', cred);
  LOGIN.pin = '';
  if (r.status === 401 && r.data.error.code === 'UNAUTHENTICATED') { LOCKED = null; LOGIN.mode = 'email'; LOGIN.err = 'Sesi sudah berakhir. Silakan masuk lagi.'; renderLogin(); return; }
  if (!r.ok) { LOGIN.err = apiErr(r); paintLoginBody(); const box = document.querySelector('.pin-dots'); if (box) box.classList.add('shake'); return; }
  const cartKeep = UI.cart;
  setMe(r.data); await loadStaff();
  UI.cart = cartKeep;   // layar terkunci tidak menghapus pesanan yang sedang diinput
  Object.assign(LOGIN, { err: '', pin: '', mode: 'email' });
  enterApp();
}
async function completeLogin(data) {
  setMe(data);
  await loadStaff();
  Object.assign(LOGIN, { err: '', pin: '', pinUser: null, email: '', mode: 'email' });
  UI.cart = newCart();
  enterApp();
  toast(`Selamat datang, ${ME.user.name.split(' ')[0]}. Anda masuk sebagai ${ME.user.role_name}.`, 'circle-check');
  if (ME.user.must_change_password) forceChangePassword();
}
function showLogin() {
  const app = document.getElementById('app');
  app.hidden = true;
  app.classList.remove('nav-open');
  // kosongkan isi aplikasi supaya data sesi sebelumnya tidak tertinggal di halaman
  ['view', 'nav', 'hero-right', 'page-desc', 'page-title', 'crumb', 'u-name', 'u-role', 'avatar'].forEach(id => { document.getElementById(id).innerHTML = ''; });
  document.getElementById('toasts').innerHTML = '';
  document.getElementById('tip').hidden = true;
  closeModal(true);
  document.getElementById('login').hidden = false;
  document.title = (LOCKED ? 'Terkunci' : 'Masuk') + ' · Racik POS Resto';
  renderLogin();
  window.scrollTo(0, 0);
  if (LOGIN.mode === 'pin' && LOGIN.pinUsers === null) loadPinUsers();
}
function goLocked(details) {
  LOCKED = details.user; CSRF = details.csrf || CSRF; ME = null;
  Object.assign(LOGIN, { mode: 'unlock', pin: '', err: '' });
  showLogin();
}
async function loadPinUsers() {
  const r = await api('GET', 'auth/pin-users');
  LOGIN.pinUsers = r.ok ? r.data.users : [];
  if (!r.ok) LOGIN.err = apiErr(r);
  if (LOGIN.mode === 'pin') paintLoginBody();
}
async function logout(reason) {
  await api('POST', 'auth/logout', {});
  ME = null; LOCKED = null; CSRF = ''; STAFF = [];
  UI.cart = newCart();
  Object.assign(LOGIN, { mode: 'email', err: reason || '', pin: '', pinUsers: null });
  showLogin();
}

ACT['login-mode'] = el => {
  Object.assign(LOGIN, { mode: el.dataset.v, err: '', pin: '' });
  renderLogin();
  if (el.dataset.v === 'pin') { LOGIN.pinUsers = null; paintLoginBody(); loadPinUsers(); }
};
ACT['login-other'] = () => logout('');
ACT['pass-eye'] = () => { const p = document.getElementById('login-pass'); p.type = p.type === 'password' ? 'text' : 'password'; };
ACT['forgot'] = () => { LOGIN.err = 'Minta pemilik outlet mengatur ulang kata sandi Anda di menu Pengguna & Akses.'; paintLoginBody(); };
ACT['pin-user'] = el => { Object.assign(LOGIN, { pinUser: +el.dataset.id, pin: '', err: '' }); paintLoginBody(); };
ACT['pin-key'] = el => {
  if (LOGIN.busy) return;
  const k = el.dataset.k;
  if (k === 'del') LOGIN.pin = LOGIN.pin.slice(0, -1);
  else if (k !== 'ok' && LOGIN.pin.length < 6) LOGIN.pin += k;
  LOGIN.err = '';
  if (LOGIN.pin.length === 6 || (k === 'ok' && LOGIN.pin.length === 6)) {
    LOGIN.busy = true; paintLoginBody();
    const done = LOGIN.mode === 'unlock' ? doUnlock({ pin: LOGIN.pin }) : doPinLogin();
    done.finally(() => { LOGIN.busy = false; });
    return;
  }
  paintLoginBody();
};
document.addEventListener('keydown', e => {
  if (document.getElementById('login').hidden) return;
  const pinPad = (LOGIN.mode === 'pin' && LOGIN.pinUser) || (LOGIN.mode === 'unlock' && LOCKED && LOCKED.has_pin);
  if (!pinPad) return;
  if (/^[0-9]$/.test(e.key)) { ACT['pin-key']({ dataset: { k: e.key } }); e.preventDefault(); }
  else if (e.key === 'Backspace') { ACT['pin-key']({ dataset: { k: 'del' } }); e.preventDefault(); }
});
ACT['logout'] = () => logout('');
ACT['lock'] = async () => {
  const r = await api('POST', 'auth/lock', {});
  if (r.ok) goLocked({ user: r.data.user, csrf: CSRF });
};

/* ---------- Kunci otomatis setelah tidak aktif (server juga menegakkan ini) ---------- */
let lastActivity = Date.now();
['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { lastActivity = Date.now(); }, { passive: true }));
setInterval(() => { if (ME && Date.now() - lastActivity > IDLE_MS) ACT['lock'](); }, 60000);

/* ---------- Persetujuan dengan PIN (diskon, void, batal bill) ----------
   Bila pengguna sendiri punya izin, aksi langsung jalan tanpa PIN. PIN diverifikasi server. */
async function withApproval(perm, title, info, onOk) {
  if (can(perm)) { onOk(currentUser()); return; }
  const r = await api('GET', 'auth/approvers?perm=' + encodeURIComponent(perm));
  const approvers = r.ok ? r.data.users : [];
  if (!approvers.length) { toast('Tidak ada penyetuju aktif yang punya PIN.', 'ban'); return; }
  openModal({
    title, size: 'sm',
    body: `<div class="alert info">${icon('shield', 16)}<div>${info} Minta manajer atau pemilik memasukkan PIN-nya.</div></div>
      <div class="field"><label for="ap-user">Disetujui oleh</label><select class="input" id="ap-user">${opts(approvers.map(u => [u.id, u.name + ' · ' + u.role_name]), approvers[0].id)}</select></div>
      <div class="field"><label for="ap-pin">PIN 6 digit</label><input class="input num" id="ap-pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off" autofocus></div>
      <div id="ap-err"></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="ap-ok">${icon('check', 16)} Setujui</button>`,
  });
  ACT['ap-ok'] = async () => {
    const res = await api('POST', 'auth/approve', { user_id: +document.getElementById('ap-user').value, pin: document.getElementById('ap-pin').value.trim(), perm, context: title });
    if (!res.ok) {
      document.getElementById('ap-err').innerHTML = `<div class="alert bad">${icon('triangle-alert', 16)}<div>${esc(apiErr(res))}</div></div>`;
      document.getElementById('ap-pin').value = ''; document.getElementById('ap-pin').focus();
      return;
    }
    closeModal(true);
    onOk(res.data.approver);
  };
}
function askDiscountApproval(pct, onOk) {
  withApproval('kasir.diskon', 'Persetujuan diskon ' + pct + '%', 'Peran Anda tidak bisa memberi diskon sendiri.', onOk);
}

/* ---------- Profil sendiri & wajib ganti kata sandi ---------- */
function profileModal(forced) {
  const u = currentUser();
  openModal({
    title: forced ? 'Ganti kata sandi awal' : 'Profil saya', size: 'sm',
    onClose: forced ? () => { if (currentUser() && currentUser().must_change_password) setTimeout(() => profileModal(true), 0); } : null,
    body: `${forced ? `<div class="alert">${icon('shield', 16)}<div>Akun Anda masih memakai kata sandi awal dari pemilik/administrator. Buat kata sandi baru sebelum melanjutkan.</div></div>` : ''}
      <div class="row" style="flex-wrap:nowrap"><span class="avatar" style="width:48px;height:48px;background:var(--brand-100);color:var(--brand-700)">${esc(u.initials)}</span><div><div class="strong">${esc(u.name)}</div><div class="muted">${esc(u.email)}</div></div><span class="spacer"></span>${rolePill(u.role)}</div>
      <div class="field"><label for="pf-old">Kata sandi sekarang</label><input class="input" id="pf-old" type="password" autocomplete="current-password" autofocus></div>
      <div class="form-grid"><div class="field"><label for="pf-new">Kata sandi baru</label><input class="input" id="pf-new" type="password" autocomplete="new-password" placeholder="Minimal 8 karakter"></div>
      <div class="field"><label for="pf-pin">PIN kasir baru</label><input class="input num" id="pf-pin" type="password" inputmode="numeric" maxlength="6" placeholder="6 digit, opsional"></div></div>
      <div id="pf-err"></div>`,
    foot: `${forced ? '' : '<button class="btn" data-act="modal-close">Tutup</button>'}<button class="btn btn-primary" data-act="pf-save" data-forced="${forced ? '1' : ''}">${icon('save', 16)} Simpan</button>`,
  });
}
function forceChangePassword() { profileModal(true); }
ACT['profile'] = () => profileModal(false);
ACT['pf-save'] = async el => {
  const forced = !!el.dataset.forced;
  const old = document.getElementById('pf-old').value, nw = document.getElementById('pf-new').value, pin = document.getElementById('pf-pin').value.trim();
  const fail = m => { document.getElementById('pf-err').innerHTML = `<div class="alert bad">${icon('triangle-alert', 16)}<div>${esc(m)}</div></div>`; };
  if (forced && !nw) return fail('Isi kata sandi baru.');
  const r = await api('PUT', 'auth/me/credentials', { current_password: old, new_password: nw, new_pin: pin });
  if (!r.ok) return fail(apiErr(r));
  ME.user = { ...ME.user, ...r.data.user };
  closeModal(true); paintChrome(); toast('Kredensial Anda diperbarui.');
};

/* =========================== PENGGUNA & AKSES =========================== */
UI.users = { tab: 'users' };
const ADMIN = { users: null, roles: null, logs: null, loading: false, err: '' };
async function loadAdmin() {
  if (ADMIN.loading) return;
  ADMIN.loading = true;
  const [u, r, l] = await Promise.all([api('GET', 'users'), api('GET', 'roles'), api('GET', 'audit-logs?limit=200')]);
  ADMIN.loading = false;
  if (!u.ok || !r.ok || !l.ok) { ADMIN.err = apiErr([u, r, l].find(x => !x.ok)); ADMIN.users = []; ADMIN.roles = []; ADMIN.logs = []; }
  else { ADMIN.err = ''; ADMIN.users = u.data.users; ADMIN.roles = r.data.roles; ADMIN.logs = l.data.logs; }
  if (current === 'pengguna') render();
}
VIEWS.pengguna = () => {
  if (ADMIN.users === null) { loadAdmin(); return `<div class="card">${emptyState('refresh-cw', 'Memuat data pengguna dari server…')}</div>`; }
  if (ADMIN.err) return `<div class="alert bad">${icon('triangle-alert', 16)}<div>${esc(ADMIN.err)}</div></div>`;
  const T = UI.users.tab;
  const active = ADMIN.users.filter(u => u.active);
  const tabs = [['users', 'Pengguna', ADMIN.users.length], ['roles', 'Peran & hak akses', ADMIN.roles.length], ['log', 'Log aktivitas', ADMIN.logs.length]];
  let body = '';
  if (T === 'users') {
    body = `<div class="strip">${ADMIN.roles.map(r => `<div><div class="s-l">${esc(r.name)}</div><div class="s-v">${active.filter(u => u.role === r.id).length}</div></div>`).join('')}</div>
      <div class="row between"><div class="muted">${active.length} pengguna aktif dari ${ADMIN.users.length}. Pengguna baru dan kata sandi yang diatur ulang wajib diganti saat pertama masuk.</div>
      <button class="btn btn-primary" data-act="user-edit">${icon('plus', 16)} Tambah pengguna</button></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Pengguna</th><th>Peran</th><th>PIN kasir</th><th>Masuk terakhir</th><th>Status</th><th></th></tr></thead><tbody>
      ${ADMIN.users.map(u => `<tr><td><div class="row" style="flex-wrap:nowrap;gap:10px"><span class="avatar" style="background:var(--brand-100);color:var(--brand-700)">${esc(u.initials)}</span><div><div class="strong">${esc(u.name)}${u.id === currentUser().id ? ' <span class="faint">(Anda)</span>' : ''}</div><div class="sub">${esc(u.email)}</div></div></div></td>
        <td>${rolePill(u.role)}</td><td>${u.has_pin ? '<span class="pill ok">Aktif</span>' : '<span class="faint">Belum diatur</span>'}</td>
        <td>${u.last_login ? fmtDT(u.last_login) : '<span class="faint">Belum pernah</span>'}${u.must_change_password ? ' <span class="pill warn">Wajib ganti sandi</span>' : ''}</td><td>${u.active ? '<span class="pill ok">Aktif</span>' : '<span class="pill">Nonaktif</span>'}</td>
        <td><button class="btn btn-sm btn-ghost" data-act="user-edit" data-id="${u.id}">${icon('pencil', 14)} Ubah</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
  } else if (T === 'roles') {
    const mods = NAV.flatMap(g => g.items.map(i => ['m:' + i[0], i[1], g.group]));
    const cell = (r, p) => {
      const on = r.perms.includes('*') || r.perms.includes(p);
      return `<td style="text-align:center"><input type="checkbox" class="perm-cb" ${on ? 'checked' : ''} ${r.locked ? 'disabled' : ''} data-ch="role-toggle" data-role="${r.id}" data-perm="${p}" aria-label="${esc(r.name)}: ${esc(permLabel(p))}"></td>`;
    };
    const rows = (list, title) => `<tr class="group"><td colspan="${ADMIN.roles.length + 1}">${title}</td></tr>` + list.map(([p, l, g]) => `<tr><td><div class="strong" style="font-weight:500">${esc(l)}</div><div class="sub">${esc(g)}</div></td>${ADMIN.roles.map(r => cell(r, p)).join('')}</tr>`).join('');
    body = `<div class="alert info">${icon('shield', 16)}<div>Perubahan langsung disimpan di server dan berlaku pada permintaan berikutnya. Peran <b>Pemilik</b> selalu punya akses penuh dan tidak bisa diubah.</div></div>
      <div class="grid g-3">${ADMIN.roles.map(r => `<div class="card card-b stack" style="gap:6px"><div class="row between">${rolePill(r.id)}<span class="muted" style="font-size:12px">${ADMIN.users.filter(u => u.role === r.id).length} pengguna</span></div><div style="font-size:13px">${esc(r.desc)}</div><div class="faint" style="font-size:12px">${r.perms.includes('*') ? 'Semua izin' : r.perms.length + ' izin'}</div></div>`).join('')}</div>
      <div class="card"><div class="table-wrap"><table class="tbl perm-matrix"><thead><tr><th>Izin</th>${ADMIN.roles.map(r => `<th style="text-align:center">${esc(r.name)}</th>`).join('')}</tr></thead><tbody>
      ${rows(mods, 'AKSES MODUL')}${rows(ACTION_PERMS, 'AKSI')}</tbody></table></div></div>`;
  } else {
    body = `<div class="row between"><div class="muted">200 aktivitas terakhir dari server, termasuk alamat IP.</div><button class="btn btn-sm" data-act="admin-reload">${icon('refresh-cw', 14)} Muat ulang</button></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aktivitas</th><th>Detail</th><th>IP</th></tr></thead><tbody>
      ${ADMIN.logs.map(a => `<tr><td class="mono" style="color:var(--ink-500)">${fmtDT(a.t)}</td><td class="strong">${esc(a.who)}</td><td>${/Gagal|ditolak|terkunci/i.test(a.event) ? `<span class="pill bad">${esc(a.event)}</span>` : /Masuk/.test(a.event) ? `<span class="pill ok">${esc(a.event)}</span>` : `<span class="pill info">${esc(a.event)}</span>`}</td><td class="muted">${esc(a.detail)}</td><td class="mono" style="color:var(--ink-500)">${esc(a.ip)}</td></tr>`).join('') || `<tr><td colspan="5">${emptyState('history', 'Belum ada aktivitas.')}</td></tr>`}
      </tbody></table></div></div>`;
  }
  return `<div class="tabs">${tabs.map(([k, l, n]) => `<button type="button" class="${T === k ? 'on' : ''}" data-act="users-tab" data-v="${k}">${l}<span class="count">${n}</span></button>`).join('')}</div>${body}`;
};
VIEWS.pengguna.hero = () => ({ metric: ADMIN.users ? ADMIN.users.filter(u => u.active).length : '…', label: 'Pengguna aktif' });
ACT['users-tab'] = el => { UI.users.tab = el.dataset.v; if (el.dataset.v === 'log') { ADMIN.users = null; } render(); };
ACT['admin-reload'] = () => { ADMIN.users = null; render(); };
ACT['role-toggle'] = async el => {
  const role = ADMIN.roles.find(r => r.id === el.dataset.role), p = el.dataset.perm, granted = el.checked;
  el.disabled = true;
  const r = await api('PUT', `roles/${role.id}/permissions`, { permission: p, granted });
  el.disabled = false;
  if (!r.ok) { el.checked = !granted; toast(apiErr(r), 'ban'); return; }
  if (granted) { if (!role.perms.includes(p)) role.perms.push(p); } else role.perms = role.perms.filter(x => x !== p);
  // izin peran sendiri berubah → ambil ulang izin dari server
  if (role.id === currentUser().role) { const me = await api('GET', 'auth/me'); if (me.ok) { setMe(me.data); renderNav(); } }
  toast(`${role.name} ${granted ? 'sekarang bisa' : 'tidak lagi bisa'}: ${permLabel(p).toLowerCase()}.`, 'shield');
};
ACT['user-edit'] = el => {
  const u = el.dataset.id ? ADMIN.users.find(x => x.id === +el.dataset.id) : null;
  const d = u || { name: '', email: '', role: 'kasir', active: true };
  const roles = ADMIN.roles.filter(r => r.id !== 'owner' || currentUser().role === 'owner');
  openModal({
    title: u ? 'Ubah pengguna' : 'Tambah pengguna',
    body: `<div class="form-grid">
      <div class="field full"><label for="us-name">Nama lengkap</label><input class="input" id="us-name" value="${esc(d.name)}" autofocus></div>
      <div class="field"><label for="us-email">Email (untuk masuk)</label><input class="input" id="us-email" type="email" value="${esc(d.email)}" placeholder="nama@usaha.id"></div>
      <div class="field"><label for="us-role">Peran</label><select class="input" id="us-role">${opts(roles.map(r => [r.id, r.name]), d.role)}</select></div>
      <div class="field"><label for="us-pw">${u ? 'Atur ulang kata sandi' : 'Kata sandi awal'}</label><input class="input" id="us-pw" type="password" autocomplete="new-password" placeholder="${u ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'}"></div>
      <div class="field"><label for="us-pin">PIN kasir (6 digit)</label><input class="input num" id="us-pin" type="password" inputmode="numeric" maxlength="6" placeholder="${u && u.has_pin ? 'Kosongkan jika tidak diubah' : 'Opsional'}"></div>
      <label class="switch full"><input type="checkbox" id="us-active" ${d.active ? 'checked' : ''}> Akun aktif dan boleh masuk</label></div>
      <div class="faint" style="font-size:12px">Kata sandi awal atau yang diatur ulang wajib diganti pengguna saat pertama masuk. Menonaktifkan akun langsung mengakhiri semua sesinya.</div>
      <div id="us-err"></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="user-save" data-id="${u ? u.id : ''}">${icon('save', 16)} Simpan</button>`,
  });
};
ACT['user-save'] = async el => {
  const v = id => document.getElementById(id).value.trim();
  const body = { name: v('us-name'), email: v('us-email'), role: v('us-role'), password: document.getElementById('us-pw').value, pin: v('us-pin'), active: document.getElementById('us-active').checked };
  const id = el.dataset.id;
  el.disabled = true;
  const r = await api(id ? 'PUT' : 'POST', id ? 'users/' + id : 'users', body);
  el.disabled = false;
  if (!r.ok) { document.getElementById('us-err').innerHTML = `<div class="alert bad">${icon('triangle-alert', 16)}<div>${esc(apiErr(r))}</div></div>`; return; }
  closeModal(true); ADMIN.users = null; await loadStaff(); render(); toast(`Data ${body.name} disimpan.`);
};
