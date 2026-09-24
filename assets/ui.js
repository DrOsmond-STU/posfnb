/* =========================================================================
   Racik POS — utilitas UI, router, modal, toast, dan grafik SVG
   ========================================================================= */

/* ---------- Format ---------- */
const nf = new Intl.NumberFormat('id-ID');
const nf1 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });
const rp = n => (n < 0 ? '−Rp ' : 'Rp ') + nf.format(Math.abs(Math.round(n || 0)));
const rpShort = n => {
  const a = Math.abs(n);
  if (a >= 1e9) return 'Rp ' + nf1.format(n / 1e9) + ' M';
  if (a >= 1e6) return 'Rp ' + nf1.format(n / 1e6) + ' jt';
  if (a >= 1e3) return 'Rp ' + nf.format(Math.round(n / 1e3)) + ' rb';
  return 'Rp ' + nf.format(Math.round(n));
};
const pct = (n, d = 1) => (isFinite(n) ? n.toFixed(d).replace('.', ',') : '0') + '%';
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = t => new Date(t).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtDay = t => new Date(t).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = t => new Date(t).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtDT = t => fmtDate(t) + ' ' + fmtTime(t);
const TYPE_LABEL = { dinein: 'Dine-in', takeaway: 'Take away', online: 'Online' };

/* qty dalam satuan dasar → teks yang mudah dibaca */
function fmtQty(ing, q) {
  const a = Math.abs(q);
  if (ing.unit === 'gr' && a >= 1000) return nf2.format(q / 1000) + ' kg';
  if (ing.unit === 'ml' && a >= 1000) return nf2.format(q / 1000) + ' L';
  return nf2.format(q) + ' ' + ing.unit;
}
const fmtBuy = (ing, q) => nf2.format(q) + ' ' + ing.buy;

/* ---------- Periode ---------- */
const PERIODS = { today: 'Hari ini', yesterday: 'Kemarin', '7d': '7 hari', '30d': '30 hari', month: 'Bulan ini' };
function range(key) {
  const now = Date.now(), t0 = startOfDay(now);
  switch (key) {
    case 'yesterday': return { from: t0 - DAY, to: t0 - 1 };
    case '7d': return { from: t0 - 6 * DAY, to: now + DAY };
    case '30d': return { from: t0 - 29 * DAY, to: now + DAY };
    case 'month': { const d = new Date(now); return { from: new Date(d.getFullYear(), d.getMonth(), 1).getTime(), to: now + DAY }; }
    default: return { from: t0, to: now + DAY };
  }
}
const inRange = (t, r) => t >= r.from && t <= r.to;
function periodSeg(cur, act, keys) {
  return `<div class="seg" role="group" aria-label="Periode">${(keys || Object.keys(PERIODS)).map(k =>
    `<button type="button" class="${k === cur ? 'on' : ''}" data-act="${act}" data-v="${k}">${PERIODS[k]}</button>`).join('')}</div>`;
}

/* ---------- State UI per halaman ---------- */
const UI = {
  dash: { period: '30d' },
  pos: { cat: 'Semua', q: '' },
  cart: null,
  meja: { area: 'Semua' },
  sales: { period: 'today', method: 'all', type: 'all', q: '', page: 0 },
  menu: { cat: 'Semua', q: '', detail: null },
  buy: { tab: 'po', status: 'all' },
  stock: { tab: 'stok', cat: 'Semua', status: 'all', q: '', card: 'BB01', cardPeriod: '30d' },
  kas: { period: 'month' },
  rsales: { period: '7d' },
  rfin: { tab: 'lr', period: 'month', acc: '1-101', jpage: 0 },
  rinv: { period: '30d' },
};
function newCart() {
  return { billId: null, type: 'dinein', table: null, customer: '', items: [], discPct: 0 };
}

/* ---------- Navigasi ---------- */
const NAV = [
  { group: 'Ringkasan', items: [['dashboard', 'Dasbor', 'layout-dashboard', '']] },
  { group: 'Operasional', items: [
    ['kasir', 'Kasir (POS)', 'shopping-cart', 'Catat pesanan dine-in, take away, dan online, lalu terima pembayaran.'],
    ['meja', 'Meja & Pesanan', 'armchair', 'Denah meja per area, bill yang masih terbuka, dan reservasi hari ini.'],
    ['dapur', 'Layar Dapur', 'chef-hat', 'Tiket pesanan dari kasir, diurutkan dari yang paling lama menunggu.'],
    ['penjualan', 'Riwayat Penjualan', 'receipt', 'Semua struk yang sudah dibayar, lengkap dengan HPP per transaksi.']] },
  { group: 'Menu & Produksi', items: [['menu', 'Standar Menu & Resep', 'book-open', 'Takaran bahan per porsi yang menjadi dasar HPP, food cost, dan pemotongan stok otomatis.']] },
  { group: 'Pembelian & Stok', items: [
    ['pembelian', 'Pembelian', 'truck', 'Purchase order, penerimaan barang, hutang pemasok, dan saran pembelian.'],
    ['pemasok', 'Pemasok', 'store', 'Data pemasok, termin pembayaran, dan nilai pembelian berjalan.'],
    ['persediaan', 'Persediaan', 'boxes', 'Stok bahan baku, kartu stok, stok opname, dan bahan rusak.']] },
  { group: 'Keuangan & Laporan', items: [
    ['kas', 'Kas & Biaya', 'wallet', 'Saldo kas dan bank, biaya operasional, setoran kas, dan setoran PB1.'],
    ['lap-penjualan', 'Laporan Penjualan', 'chart-column', 'Tren penjualan, jam sibuk, metode bayar, dan menu engineering.'],
    ['lap-keuangan', 'Laporan Keuangan', 'landmark', 'Laba rugi, neraca, arus kas, jurnal umum, dan buku besar dari transaksi otomatis.'],
    ['lap-persediaan', 'Laporan Persediaan', 'clipboard-list', 'Mutasi setiap bahan dari saldo awal sampai saldo akhir, direkonsiliasi ke akun persediaan.']] },
  { group: 'Sistem', items: [
    ['pengguna', 'Pengguna & Akses', 'shield', 'Akun pengguna, peran, matriks hak akses, dan log aktivitas masuk.'],
    ['pengaturan', 'Pengaturan', 'settings', 'Profil outlet, pajak dan service charge, dan perangkat.']] },
];
const VIEWS = {};
const ACT = {};
let current = 'dashboard';

function navBadge(key) {
  if (key === 'dapur') { const n = S.kds.filter(k => k.status !== 'selesai').length; return n ? n : ''; }
  if (key === 'meja') { const n = S.bills.length; return n ? n : ''; }
  if (key === 'persediaan') { const n = S.ingredients.filter(i => i.stock < i.min).length; return n ? n : ''; }
  if (key === 'pembelian') { const n = S.pos.filter(p => p.status === 'dikirim' || p.status === 'draft').length; return n ? n : ''; }
  return '';
}
function renderNav() {
  document.getElementById('nav').innerHTML = NAV.map(g => {
    const items = g.items.filter(it => canView(it[0]));
    return items.length ? `<div class="nav-group">${g.group}</div>` + items.map(([k, label, ic]) => {
      const b = navBadge(k);
      return `<a href="#${k}" class="${k === current ? 'active' : ''}" title="${label}">${icon(ic, 18)}<span>${label}</span>${b ? `<em class="badge">${b}</em>` : ''}</a>`;
    }).join('') : '';
  }).join('');
}
function navInfo(key) {
  for (const g of NAV) for (const it of g.items) if (it[0] === key) return { group: g.group, title: it[1], desc: it[3] };
  return { group: '', title: '', desc: '' };
}

function render() {
  if (!currentUser()) { showLogin(); return; }
  const key = VIEWS[current] ? current : firstAllowed();
  const info = navInfo(key);
  const allowed = canView(key);
  const h = allowed && VIEWS[key].hero ? VIEWS[key].hero() : {};
  document.getElementById('page-title').textContent = h.title || info.title;
  document.getElementById('crumb').textContent = info.group + ' · ' + S.settings.outlet + ' ' + S.settings.branch.replace('Cabang ', '');
  document.getElementById('page-desc').textContent = h.desc || info.desc;
  document.getElementById('hero').classList.toggle('compact', !!VIEWS[key].compact);
  document.getElementById('hero-right').innerHTML =
    (h.metric != null ? `<div class="hero-metric"><span class="num">${h.metric}</span><span class="lbl">${h.label}</span></div>` : '') +
    (h.actions ? `<div class="hero-actions">${h.actions}</div>` : '');
  document.title = info.title + ' · Racik POS Resto';
  renderNav();
  const el = document.getElementById('view');
  if (!allowed) { el.innerHTML = deniedHTML(key); audit('Akses ditolak', 'Modul ' + info.title); return; }
  el.innerHTML = VIEWS[key]();
  if (VIEWS[key].after) VIEWS[key].after(el);
  applyPermUI(document.querySelector('.main'));
}
function go(key) {
  if (location.hash.slice(1) === key) { current = key; render(); window.scrollTo(0, 0); }
  else location.hash = key;
}
function refresh() { saveState(); render(); }

/* ---------- Modal ---------- */
let modalOnClose = null;
function openModal({ title, body, foot, size, onClose }) {
  closeModal(true);
  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'overlay';
  ov.innerHTML = `<div class="modal ${size || ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-h"><h3>${title}</h3><button type="button" class="icon-btn x" data-act="modal-close" aria-label="Tutup">${icon('x')}</button></div>
    <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div>`;
  ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(); });
  document.body.appendChild(ov);
  modalOnClose = onClose || null;
  applyPermUI(ov);
  const f = ov.querySelector('[autofocus]'); if (f) f.focus();
  return ov;
}
function closeModal(silent) {
  const ov = document.getElementById('overlay');
  if (ov) ov.remove();
  if (!silent && modalOnClose) { const fn = modalOnClose; modalOnClose = null; fn(); }
}
const modalEl = () => document.getElementById('overlay');

/* ---------- Toast ---------- */
function toast(msg, ic) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = icon(ic || 'circle-check') + `<span>${msg}</span>`;
  document.getElementById('toasts').appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/* ---------- Tooltip grafik ---------- */
function bindTips(root) {
  const tip = document.getElementById('tip');
  root.querySelectorAll('[data-tip]').forEach(n => {
    n.addEventListener('mousemove', e => {
      tip.innerHTML = n.getAttribute('data-tip');
      tip.hidden = false;
      const w = tip.offsetWidth;
      let x = e.clientX + 14; if (x + w > window.innerWidth - 8) x = e.clientX - w - 14;
      tip.style.left = x + 'px'; tip.style.top = (e.clientY + 14) + 'px';
    });
    n.addEventListener('mouseleave', () => { tip.hidden = true; });
  });
}

/* ---------- Grafik batang SVG ----------
   data: [{label, value, tip, hi}]  — satu seri, satu sumbu */
function niceScale(v) {
  if (v <= 0) return { max: 1, ticks: 4 };
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const steps = [[1, 4], [1.5, 3], [2, 4], [2.5, 5], [3, 3], [4, 4], [5, 5], [6, 3], [8, 4], [10, 5]];
  const [s, ticks] = steps.find(([x]) => n <= x);
  return { max: s * p, ticks };
}
function barChart(data, opt = {}) {
  const W = opt.width || 720, H = opt.height || 220;
  const padL = 56, padR = 8, padT = 12, padB = 26;
  const iw = W - padL - padR, ih = H - padT - padB;
  const { max, ticks } = niceScale(Math.max(...data.map(d => d.value), 0));
  const fmt = opt.fmt || rpShort;
  const bw = iw / data.length;
  const gap = Math.max(2, Math.min(10, bw * 0.28));
  let g = '';
  for (let i = 0; i <= ticks; i++) {
    const y = padT + ih - ih * i / ticks;
    g += `<line class="grid-l" x1="${padL}" x2="${W - padR}" y1="${y}" y2="${y}"/>`;
    g += `<text x="${padL - 8}" y="${y + 4}" text-anchor="end">${fmt(max * i / ticks).replace('Rp ', '')}</text>`;
  }
  const every = Math.ceil(data.length / (opt.maxLabels || 10));
  data.forEach((d, i) => {
    const h = max ? ih * d.value / max : 0;
    const x = padL + i * bw + gap / 2, w = Math.max(1, bw - gap);
    const y = padT + ih - h;
    const r = Math.min(4, w / 2, h);
    const path = h > 0 ? `M${x},${padT + ih}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${padT + ih}Z` : '';
    g += `<g class="col" data-tip="${esc(d.tip || (d.label + ': ' + fmt(d.value)))}"><rect class="hit" x="${padL + i * bw}" y="${padT}" width="${bw}" height="${ih}"/>${path ? `<path class="bar ${opt.cls || ''} ${d.dim ? 'dim' : ''}" d="${path}"/>` : ''}</g>`;
    if (i % every === 0 || i === data.length - 1) {
      g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(d.label)}</text>`;
    }
    if (d.hi && d.value > 0) g += `<text class="endlabel" x="${x + w / 2}" y="${y - 5}" text-anchor="middle">${fmt(d.value).replace('Rp ', '')}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label || 'Grafik')}">${g}</svg>`;
}
function hbars(rows, opt = {}) {
  const max = Math.max(...rows.map(r => r.value), 1);
  const fmt = opt.fmt || rp;
  return `<div class="hbars">${rows.map(r => `<div class="hbar"><span>${esc(r.label)}${r.sub ? ` <span class="faint">· ${r.sub}</span>` : ''}</span><span class="v">${fmt(r.value)}</span>
    <div class="track"><div class="fill ${opt.cls || ''}" style="width:${(r.value / max * 100).toFixed(1)}%"></div></div></div>`).join('')}</div>`;
}

/* ---------- Komponen kecil ---------- */
function kpi(ic, label, val, foot, gold) {
  return `<div class="card kpi"><div class="k-top"><span class="k-ic ${gold ? 'gold' : ''}">${icon(ic, 17)}</span>${label}</div>
    <div class="k-val">${val}</div><div class="k-foot">${foot || ''}</div></div>`;
}
function delta(cur, prev, invert) {
  if (!prev) return '<span class="faint">—</span>';
  const d = (cur - prev) / prev * 100;
  const good = invert ? d <= 0 : d >= 0;
  return `<span class="delta ${good ? 'up' : 'down'}">${icon(d >= 0 ? 'trending-up' : 'trending-down', 14)} ${pct(Math.abs(d))}</span>`;
}
function fcPill(fc) {
  const t = S.settings.targetFC;
  const cls = fc <= t ? 'ok' : fc <= t + 5 ? 'warn' : 'bad';
  return `<span class="pill ${cls}">${pct(fc)}</span>`;
}
function stockPill(i) {
  const s = stockStatus(i);
  return s === 'aman' ? '<span class="pill ok">Aman</span>' : s === 'menipis' ? '<span class="pill warn">Menipis</span>' : '<span class="pill bad">Habis</span>';
}
const PO_STATUS = {
  draft: ['Draft', ''], dikirim: ['Dikirim ke pemasok', 'info'], sebagian: ['Diterima sebagian', 'warn'],
  diterima: ['Diterima · belum lunas', 'gold'], lunas: ['Lunas', 'ok'], batal: ['Dibatalkan', 'bad'],
};
const poPill = s => `<span class="pill ${PO_STATUS[s][1]}">${PO_STATUS[s][0]}</span>`;
function emptyState(ic, msg) { return `<div class="empty">${icon(ic, 32)}<div>${msg}</div></div>`; }
function opts(list, cur) { return list.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join(''); }

/* ---------- Event global ---------- */
document.addEventListener('click', e => {
  const a = e.target.closest('[data-act]');
  if (!a) return;
  const name = a.getAttribute('data-act');
  if (ACT[name]) { e.preventDefault(); if (permOk(name)) ACT[name](a, e); }
});
document.addEventListener('input', e => {
  const a = e.target.closest('[data-in]');
  if (a && ACT[a.getAttribute('data-in')] && permOk(a.getAttribute('data-in'))) ACT[a.getAttribute('data-in')](a, e);
});
document.addEventListener('change', e => {
  const a = e.target.closest('[data-ch]');
  if (a && ACT[a.getAttribute('data-ch')] && permOk(a.getAttribute('data-ch'))) ACT[a.getAttribute('data-ch')](a, e);
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modalEl()) closeModal(); });

ACT['modal-close'] = () => closeModal();
ACT['go'] = el => go(el.dataset.to);
ACT['nav-open'] = () => document.getElementById('app').classList.add('nav-open');
ACT['nav-close'] = () => document.getElementById('app').classList.remove('nav-open');
ACT['collapse'] = () => {
  const app = document.getElementById('app');
  app.classList.toggle('collapsed');
  try { localStorage.setItem('racikpos-collapsed', app.classList.contains('collapsed') ? '1' : ''); } catch (e) { /* abaikan */ }
};
ACT['theme-set'] = el => {
  const v = el.dataset.v, root = document.documentElement;
  if (v === 'system') delete root.dataset.theme; else root.dataset.theme = v;
  try { if (v === 'system') localStorage.removeItem('racikpos-theme'); else localStorage.setItem('racikpos-theme', v); } catch (e) { /* abaikan */ }
  paintChrome();
  if (!document.getElementById('login').hidden) renderLogin();
};

function paintChrome() {
  document.getElementById('theme-switch').innerHTML = themeSwitchHTML();
  document.getElementById('brand-mark').innerHTML = icon('chef-hat', 22);
  document.getElementById('menu-btn').innerHTML = icon('menu');
  document.getElementById('collapse-ic').innerHTML = icon('chevron-left', 17);
  document.getElementById('lock-btn').innerHTML = icon('shield', 16);
  document.getElementById('logout-btn').innerHTML = icon('log-out', 16);
  const u = currentUser(); if (!u) return;
  document.getElementById('avatar').textContent = initials(u.name);
  document.getElementById('u-name').textContent = u.name;
  document.getElementById('u-role').textContent = roleById(u.role).name + ' · ' + S.settings.branch.replace('Cabang ', '');
}

let kdsTimer = null;
/* setelah masuk: tampilkan aplikasi sesuai peran pengguna */
function enterApp() {
  const u = currentUser();
  S.session.cashier = u.name;
  S.session.manager = u.name;
  document.getElementById('login').hidden = true;
  document.getElementById('app').hidden = false;
  paintChrome();
  current = location.hash.slice(1) || firstAllowed();
  if (!canView(current)) current = firstAllowed();
  if (location.hash.slice(1) !== current) history.replaceState(null, '', '#' + current);
  render();
  window.scrollTo(0, 0);
}
function boot() {
  loadState();
  loadAuth();
  try {
    if (localStorage.getItem('racikpos-collapsed')) document.getElementById('app').classList.add('collapsed');
  } catch (e) { /* abaikan */ }
  UI.cart = newCart();
  window.addEventListener('hashchange', () => {
    if (!currentUser()) return;
    current = location.hash.slice(1) || firstAllowed();
    document.getElementById('app').classList.remove('nav-open');
    closeModal(true);
    render();
    window.scrollTo(0, 0);
  });
  if (currentUser()) enterApp(); else showLogin();
  // perbarui timer layar dapur tiap 30 detik
  kdsTimer = setInterval(() => { if (current === 'dapur' && currentUser() && !modalEl()) render(); }, 30000);
}
