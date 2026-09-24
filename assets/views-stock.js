/* =========================================================================
   Racik POS — Standar Menu & Resep, Pemasok, Pembelian, Persediaan
   ========================================================================= */

/* =========================== STANDAR MENU & RESEP =========================== */
let MENU_EDIT = null;
function menuStats(m) {
  const cost = recipeCost(m);
  return { cost, fc: m.price ? cost / m.price * 100 : 0, margin: m.price - cost };
}
VIEWS.menu = () => (UI.menu.detail ? menuDetailHTML() : menuListHTML());
function menuListHTML() {
  const q = UI.menu.q.trim().toLowerCase();
  const list = S.menu.filter(m => (UI.menu.cat === 'Semua' || m.cat === UI.menu.cat) && (!q || m.name.toLowerCase().includes(q)));
  const act = S.menu.filter(m => m.active);
  const stats = act.map(menuStats);
  const over = stats.filter(s => s.fc > S.settings.targetFC).length;
  return `
  <div class="strip">
    <div><div class="s-l">Menu aktif</div><div class="s-v">${act.length}</div></div>
    <div><div class="s-l">Rata-rata food cost</div><div class="s-v">${pct(sumBy(stats, s => s.fc) / (stats.length || 1))}</div></div>
    <div><div class="s-l">Di atas target ${S.settings.targetFC}%</div><div class="s-v" style="color:var(--warn)">${over} menu</div></div>
    <div><div class="s-l">Rata-rata margin kotor / porsi</div><div class="s-v">${rp(sumBy(stats, s => s.margin) / (stats.length || 1))}</div></div>
  </div>
  <div class="row between">
    <div class="chips">${['Semua', ...MENU_CATS].map(c => `<button type="button" class="chip ${UI.menu.cat === c ? 'on' : ''}" data-act="menu-cat" data-v="${c}">${c}</button>`).join('')}</div>
    <div class="row"><div class="search"><span>${icon('search', 16)}</span><input class="input" style="width:220px" placeholder="Cari menu" value="${esc(UI.menu.q)}" data-ch="menu-q" aria-label="Cari menu"></div>
    <button class="btn btn-primary" data-act="menu-new">${icon('plus', 16)} Tambah menu</button></div>
  </div>
  <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Menu</th><th>Kategori</th><th class="num">Harga jual</th><th class="num">HPP / porsi</th><th class="num">Food cost</th><th class="num">Margin kotor</th><th class="num">Bahan</th><th class="num">Porsi tersedia</th><th>Status</th><th></th></tr></thead><tbody>
  ${list.map(m => { const s = menuStats(m); const p = portionsAvailable(m); return `<tr class="click" data-act="menu-open" data-id="${m.id}">
    <td><div class="row" style="flex-wrap:nowrap;gap:10px"><span class="mcard" style="border:0;cursor:inherit"><span class="m-img c-${m.cat}" style="width:38px;height:38px;border-radius:9px">${icon(m.icon || CAT_ICONS[m.cat], 18)}</span></span><div><div class="strong">${esc(m.name)}</div><div class="sub mono">${m.id} · saji ${m.prep} mnt</div></div></div></td>
    <td>${m.cat}</td><td class="num strong">${rp(m.price)}</td><td class="num">${rp(s.cost)}</td><td class="num">${fcPill(s.fc)}</td><td class="num">${rp(s.margin)}</td><td class="num">${m.recipe.length}</td>
    <td class="num">${p <= 10 ? `<span class="pill ${p ? 'warn' : 'bad'}">${p}</span>` : nf.format(p)}</td><td>${m.active ? '<span class="pill ok">Aktif</span>' : '<span class="pill">Nonaktif</span>'}</td><td>${icon('chevron-right', 16)}</td></tr>`; }).join('')}
  </tbody></table></div></div>
  <div class="alert info">${icon('book-marked', 16)}<div><b>Standar resep</b> adalah dasar perhitungan HPP, pengurangan stok otomatis setiap transaksi, dan kolom "porsi tersedia" di kasir. HPP dihitung dari harga rata-rata tertimbang bahan terbaru.</div></div>`;
}
function menuDetailHTML() {
  const m = MENU_EDIT;
  const cost = m.recipe.reduce((s, [id, q]) => s + (ingById(id) ? ingById(id).avg * q : 0), 0);
  const fc = m.price ? cost / m.price * 100 : 0;
  const t = UI.menu.target || S.settings.targetFC;
  const sugg = Math.ceil(cost / (t / 100) / 500) * 500;
  const custPays = Math.round(m.price * (1 + S.settings.serviceRate / 100) * (1 + S.settings.taxRate / 100));
  const fcColor = fc <= S.settings.targetFC ? 'var(--ok)' : fc <= S.settings.targetFC + 5 ? 'var(--warn)' : 'var(--bad)';
  const ingOpts = S.ingredients.map(i => [i.id, `${i.name} (${i.unit})`]);
  return `
  <div class="row between">
    <button class="btn btn-ghost" data-act="menu-back">${icon('chevron-left', 16)} Semua menu</button>
    <div class="row">${!m.isNew ? `<button class="btn btn-danger" data-act="menu-del" data-id="${m.id}" title="${menuInUse(m.id) ? 'Menu sudah pernah dijual; nonaktifkan saja' : 'Hapus menu'}">${icon('trash-2', 16)} Hapus</button>` : ''}<button class="btn" data-act="menu-back">Batal</button><button class="btn btn-primary" data-act="menu-save">${icon('save', 16)} Simpan standar menu</button></div>
  </div>
  ${can('menu.edit') ? '' : `<div class="alert info">${icon('eye', 16)}<div><b>Mode lihat saja.</b> Peran Anda bisa membaca standar resep tetapi tidak bisa mengubah takaran atau harga.</div></div>`}
  <div class="card card-b">
    <div class="recipe-head">
      <div class="recipe-img m-img c-${m.cat}" style="display:grid">${icon(m.icon || CAT_ICONS[m.cat], 48)}</div>
      <div class="form-grid" style="grid-template-columns:repeat(4,minmax(0,1fr))">
        <div class="field" style="grid-column:span 2"><label for="me-name">Nama menu</label><input class="input" id="me-name" value="${esc(m.name)}" data-ch="me-f" data-k="name"></div>
        <div class="field"><label for="me-cat">Kategori</label><select class="input" id="me-cat" data-ch="me-f" data-k="cat">${opts(MENU_CATS.map(c => [c, c]), m.cat)}</select></div>
        <div class="field"><label for="me-id">Kode</label><input class="input mono" id="me-id" value="${m.id}" disabled></div>
        <div class="field"><label for="me-price">Harga jual (Rp, sebelum pajak)</label><input class="input num" id="me-price" inputmode="numeric" value="${m.price}" data-ch="me-f" data-k="price" data-num="1"></div>
        <div class="field"><label for="me-prep">Waktu saji (menit)</label><input class="input num" id="me-prep" inputmode="numeric" value="${m.prep}" data-ch="me-f" data-k="prep" data-num="1"></div>
        <div class="field"><label for="me-yield">Hasil resep</label><input class="input" id="me-yield" value="1 porsi" disabled></div>
        <div class="field"><label class="lbl">Status</label><label class="switch"><input type="checkbox" ${m.active ? 'checked' : ''} data-ch="me-active"> Tampil di kasir</label></div>
      </div>
    </div>
  </div>
  <div class="grid g-main" style="align-items:start">
    <div class="card">
      <div class="card-h"><div><h3>Komposisi bahan per porsi</h3><div class="sub">Takaran standar yang dipotong dari stok setiap menu terjual</div></div><div class="right"><button class="btn btn-sm" data-act="me-add">${icon('plus', 14)} Tambah bahan</button></div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th style="min-width:220px">Bahan</th><th class="num" style="width:110px">Takaran</th><th>Satuan</th><th class="num">Harga rata-rata</th><th class="num">Biaya</th><th class="num">Porsi HPP</th><th></th></tr></thead><tbody>
      ${m.recipe.map(([id, q], i) => { const ing = ingById(id); const c = ing.avg * q; return `<tr>
        <td><select class="input sm" data-ch="me-ing" data-i="${i}" aria-label="Bahan">${opts(ingOpts, id)}</select></td>
        <td><input class="input sm num" inputmode="decimal" value="${String(q).replace('.', ',')}" data-ch="me-qty" data-i="${i}" aria-label="Takaran"></td>
        <td>${ing.unit}</td><td class="num muted">${rp(ing.avg * ing.conv)}/${ing.buy}</td><td class="num strong">${rp(c)}</td>
        <td class="num"><div style="display:flex;align-items:center;gap:6px;justify-content:flex-end"><div style="width:50px;height:6px;background:var(--surface-3);border-radius:9px;overflow:hidden"><div style="height:100%;width:${cost ? c / cost * 100 : 0}%;background:var(--chart-1)"></div></div>${pct(cost ? c / cost * 100 : 0, 0)}</div></td>
        <td><button class="btn btn-sm btn-ghost btn-danger" data-act="me-del" data-i="${i}" aria-label="Hapus bahan">${icon('trash-2', 14)}</button></td></tr>`; }).join('')}
      </tbody><tfoot><tr><td colspan="4">Total HPP per porsi</td><td class="num">${rp(cost)}</td><td class="num">100%</td><td></td></tr></tfoot></table></div>
    </div>
    <div class="stack">
      <div class="card">
        <div class="card-h"><h3>Analisis biaya</h3></div>
        <div class="card-b stack">
          <div class="sumline"><span>Harga jual</span><span class="strong">${rp(m.price)}</span></div>
          <div class="sumline"><span>HPP per porsi</span><span class="strong">${rp(cost)}</span></div>
          <div class="sumline"><span>Margin kotor</span><span class="strong">${rp(m.price - cost)}</span></div>
          <div><div class="row between"><span class="lbl">Food cost</span><span style="font-weight:800;font-size:20px;color:${fcColor}">${pct(fc)}</span></div>
            <div class="fc-meter"><div class="f" style="width:${Math.min(100, fc)}%;background:${fcColor}"></div><div class="tgt" style="left:${S.settings.targetFC}%" title="Target"></div></div>
            <div class="faint" style="font-size:11.5px;margin-top:4px">Garis hitam = target outlet ${S.settings.targetFC}%</div></div>
          <div class="sumline"><span>Dibayar tamu dine-in (+service & PB1)</span><span>${rp(custPays)}</span></div>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><h3>Harga jual saran</h3></div>
        <div class="card-b stack">
          <div class="row" style="flex-wrap:nowrap"><label class="lbl" for="me-target" style="white-space:nowrap">Target food cost</label><input class="input sm num" id="me-target" style="width:80px" value="${t}" data-ch="me-target"><span>%</span></div>
          <div class="row between"><span class="muted">Dibulatkan ke Rp 500</span><span style="font-weight:800;font-size:20px">${rp(sugg)}</span></div>
          <button class="btn btn-gold btn-block" data-act="me-apply" data-v="${sugg}" ${sugg === m.price ? 'disabled' : ''}>${icon('check', 16)} Pakai harga saran</button>
        </div>
      </div>
    </div>
  </div>
  <div class="grid g-2" style="align-items:start">
    <div class="card"><div class="card-h"><h3>Langkah pembuatan</h3><span class="sub">satu langkah per baris</span></div>
      <div class="card-b"><textarea class="input" rows="7" data-ch="me-steps" aria-label="Langkah pembuatan">${esc(m.steps.join('\n'))}</textarea>
      <ol class="steps" style="margin-top:12px">${m.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol></div></div>
    <div class="card"><div class="card-h"><h3>Standar penyajian</h3></div>
      <div class="card-b stack"><div class="field"><label for="me-serve">Alat saji, garnish, dan porsi</label><textarea class="input" id="me-serve" rows="3" data-ch="me-f" data-k="serve">${esc(m.serve || '')}</textarea></div>
      <div class="alert">${icon('scale', 16)}<div>Gunakan timbangan digital untuk protein dan nasi. Selisih takaran 10 gr ayam fillet = ${rp(ingById('BB02').avg * 10)} per porsi.</div></div></div></div>
  </div>`;
}
ACT['menu-cat'] = el => { UI.menu.cat = el.dataset.v; render(); };
ACT['menu-q'] = el => { UI.menu.q = el.value; render(); };
ACT['menu-open'] = el => {
  const m = menuById(el.dataset.id);
  MENU_EDIT = { ...m, recipe: m.recipe.map(r => r.slice()), steps: m.steps.slice(), isNew: false };
  UI.menu.detail = m.id; UI.menu.target = null; render(); window.scrollTo(0, 0);
};
ACT['menu-new'] = () => {
  const n = S.menu.length + 1;
  MENU_EDIT = { id: nextId(S.menu, 'MN'), name: 'Menu baru', cat: 'Makanan', price: 30000, pop: 3, prep: 8, icon: 'utensils', recipe: [['BB01', 150]], steps: ['Tulis langkah pertama'], serve: '', active: true, isNew: true };
  UI.menu.detail = MENU_EDIT.id; render(); window.scrollTo(0, 0);
};
ACT['menu-back'] = () => { UI.menu.detail = null; MENU_EDIT = null; render(); };
ACT['me-f'] = el => { MENU_EDIT[el.dataset.k] = el.dataset.num ? (+el.value.replace(/\D/g, '') || 0) : el.value; render(); };
ACT['me-active'] = el => { MENU_EDIT.active = el.checked; };
ACT['me-ing'] = el => { MENU_EDIT.recipe[+el.dataset.i][0] = el.value; render(); };
ACT['me-qty'] = el => { MENU_EDIT.recipe[+el.dataset.i][1] = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0); render(); };
ACT['me-del'] = el => { MENU_EDIT.recipe.splice(+el.dataset.i, 1); render(); };
ACT['me-add'] = () => { MENU_EDIT.recipe.push(['BB13', 1]); render(); };
ACT['me-steps'] = el => { MENU_EDIT.steps = el.value.split('\n').map(s => s.trim()).filter(Boolean); render(); };
ACT['me-target'] = el => { UI.menu.target = Math.min(90, Math.max(5, +el.value.replace(',', '.') || S.settings.targetFC)); render(); };
ACT['me-apply'] = el => { MENU_EDIT.price = +el.dataset.v; render(); toast('Harga jual diperbarui. Jangan lupa simpan.'); };
ACT['menu-save'] = () => {
  const m = MENU_EDIT;
  if (!m.name.trim() || !m.price || !m.recipe.length) { toast('Nama, harga, dan minimal satu bahan wajib diisi.', 'triangle-alert'); return; }
  const clean = { ...m, recipe: m.recipe.filter(r => r[1] > 0) };
  delete clean.isNew;
  if (m.isNew) S.menu.push(clean); else S.menu[S.menu.findIndex(x => x.id === m.id)] = clean;
  UI.menu.detail = null; MENU_EDIT = null;
  refresh(); toast(`Standar menu "${clean.name}" disimpan.`);
};

ACT['menu-del'] = el => {
  const m = menuById(el.dataset.id);
  if (menuInUse(m.id)) { toast(`"${m.name}" sudah punya riwayat penjualan atau ada di bill terbuka. Matikan "Tampil di kasir" untuk menyembunyikannya.`, 'ban'); return; }
  S.menu = S.menu.filter(x => x.id !== m.id);
  UI.menu.detail = null; MENU_EDIT = null;
  refresh(); toast(`Menu "${m.name}" dihapus.`, 'trash-2');
};

/* =========================== PEMASOK =========================== */
VIEWS.pemasok = () => {
  const r30 = range('30d');
  return `
  <div class="row between"><div class="muted">${S.suppliers.length} pemasok terdaftar · termin pembayaran dipakai untuk menghitung jatuh tempo hutang</div>
    <button class="btn btn-primary" data-act="sup-edit">${icon('plus', 16)} Tambah pemasok</button></div>
  <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Pemasok</th><th>Kategori</th><th>Kontak</th><th class="num">Termin</th><th class="num">Bahan dipasok</th><th class="num">Pembelian 30 hari</th><th class="num">Hutang berjalan</th><th></th></tr></thead><tbody>
  ${S.suppliers.map(s => {
    const off = s.active === false;
    const buy = sumBy(S.grns.filter(g => g.sup === s.id && inRange(g.t, r30)), g => g.value);
    const ap = sumBy(S.pos.filter(p => p.sup === s.id), poOutstanding);
    return `<tr class="click" data-act="sup-edit" data-id="${s.id}"><td class="mono">${s.id}</td><td><div class="strong">${esc(s.name)}</div><div class="sub">${esc(s.city)}</div></td><td>${esc(s.cat)}</td><td>${esc(s.pic)}<div class="sub">${esc(s.phone)}</div></td><td class="num">${s.terms} hari</td><td class="num">${S.ingredients.filter(i => i.sup === s.id).length}</td><td class="num">${rp(buy)}</td><td class="num strong">${ap ? rp(ap) : '<span class="faint">—</span>'}</td><td>${off ? '<span class="pill">Nonaktif</span>' : icon('pencil', 15)}</td></tr>`;
  }).join('')}</tbody></table></div></div>`;
};
ACT['sup-edit'] = el => {
  const s = el.dataset.id ? supById(el.dataset.id) : { id: nextId(S.suppliers, 'SP'), name: '', cat: '', pic: '', phone: '', terms: 14, city: '', active: true };
  const used = el.dataset.id && supplierInUse(s.id);
  openModal({
    title: el.dataset.id ? 'Ubah pemasok' : 'Tambah pemasok',
    body: `<div class="form-grid">
      <div class="field full"><label for="sp-name">Nama pemasok</label><input class="input" id="sp-name" value="${esc(s.name)}" autofocus></div>
      <div class="field"><label for="sp-cat">Kategori barang</label><input class="input" id="sp-cat" value="${esc(s.cat)}" placeholder="mis. Sayur & Bumbu"></div>
      <div class="field"><label for="sp-city">Kota</label><input class="input" id="sp-city" value="${esc(s.city)}"></div>
      <div class="field"><label for="sp-pic">Nama kontak</label><input class="input" id="sp-pic" value="${esc(s.pic)}"></div>
      <div class="field"><label for="sp-phone">Telepon / WhatsApp</label><input class="input" id="sp-phone" value="${esc(s.phone)}"></div>
      <div class="field"><label for="sp-terms">Termin pembayaran (hari)</label><input class="input num" id="sp-terms" inputmode="numeric" value="${s.terms}"></div>
      <label class="switch" style="align-self:end;padding-bottom:10px"><input type="checkbox" id="sp-active" ${s.active !== false ? 'checked' : ''}> Pemasok aktif</label></div>
      ${used ? '<div class="faint" style="font-size:12px">Pemasok ini sudah punya PO atau bahan, jadi tidak bisa dihapus. Nonaktifkan agar tidak muncul di PO baru.</div>' : ''}`,
    foot: `${el.dataset.id && !used ? `<button class="btn btn-danger" data-act="sup-del" data-id="${s.id}">${icon('trash-2', 16)} Hapus</button><span class="spacer"></span>` : ''}<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="sup-save" data-id="${s.id}">${icon('save', 16)} Simpan</button>`,
  });
};
ACT['sup-save'] = el => {
  const v = id => document.getElementById(id).value.trim();
  if (!v('sp-name')) { toast('Nama pemasok wajib diisi.', 'triangle-alert'); return; }
  let s = supById(el.dataset.id);
  if (!s) { s = { id: el.dataset.id }; S.suppliers.push(s); }
  Object.assign(s, { name: v('sp-name'), cat: v('sp-cat'), city: v('sp-city'), pic: v('sp-pic'), phone: v('sp-phone'), terms: +v('sp-terms') || 0, active: document.getElementById('sp-active').checked });
  closeModal(true); refresh(); toast('Data pemasok disimpan.');
};
ACT['sup-del'] = el => {
  const s = supById(el.dataset.id);
  if (supplierInUse(s.id)) { toast('Pemasok sudah dipakai PO atau bahan; nonaktifkan saja.', 'ban'); return; }
  S.suppliers = S.suppliers.filter(x => x.id !== s.id);
  closeModal(true); refresh(); toast(`Pemasok ${s.name} dihapus.`, 'trash-2');
};

/* =========================== PEMBELIAN =========================== */
function suggestions() {
  const by = {};
  for (const i of S.ingredients) {
    if (i.stock >= i.min) continue;
    const onOrder = sumBy(S.pos.filter(p => ['dikirim', 'sebagian', 'draft'].includes(p.status)), p => sumBy(p.lines.filter(l => l.ing === i.id), l => (l.qty - l.recv) * i.conv));
    const need = Math.max(0, i.target - i.stock - onOrder);
    const qty = Math.ceil(need / i.conv);
    (by[i.sup] = by[i.sup] || []).push({ i, onOrder, qty });
  }
  return by;
}
VIEWS.pembelian = () => {
  const b = UI.buy;
  const cnt = st => S.pos.filter(p => p.status === st).length;
  const sug = suggestions();
  const sugN = Object.values(sug).reduce((s, a) => s + a.length, 0);
  const tabs = [['po', 'Purchase Order', S.pos.length], ['grn', 'Penerimaan Barang', S.grns.length], ['hutang', 'Hutang Pemasok', S.pos.filter(p => poOutstanding(p) > 0).length], ['saran', 'Saran Pembelian', sugN]];
  let body = '';
  if (b.tab === 'po') {
    const list = S.pos.filter(p => b.status === 'all' || p.status === b.status).slice().reverse();
    body = `<div class="row between">
      <div class="chips">${[['all', 'Semua'], ['draft', 'Draft'], ['dikirim', 'Dikirim'], ['sebagian', 'Diterima sebagian'], ['diterima', 'Belum lunas'], ['lunas', 'Lunas'], ['batal', 'Batal']].map(([k, l]) => `<button type="button" class="chip ${b.status === k ? 'on' : ''}" data-act="po-filter" data-v="${k}">${l}${k !== 'all' && cnt(k) ? ` · ${cnt(k)}` : ''}</button>`).join('')}</div>
      <button class="btn btn-primary" data-act="po-new">${icon('plus', 16)} Buat PO</button></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>No. PO</th><th>Tanggal</th><th>Pemasok</th><th class="num">Item</th><th class="num">Total</th><th>Status</th><th>Jatuh tempo</th><th></th></tr></thead><tbody>
      ${list.slice(0, 60).map(p => `<tr class="click" data-act="po-view" data-no="${esc(p.no)}"><td class="mono">${esc(p.no)}</td><td>${fmtDate(p.t)}</td><td>${esc(supById(p.sup).name)}</td><td class="num">${p.lines.length}</td><td class="num strong">${rp(p.total)}</td><td>${poPill(p.status)}</td><td>${p.due ? `${fmtDate(p.due)}${poOutstanding(p) && p.due < Date.now() ? ' <span class="pill bad">Lewat</span>' : ''}` : '<span class="faint">—</span>'}</td><td>${icon('chevron-right', 16)}</td></tr>`).join('') || `<tr><td colspan="8">${emptyState('file-text', 'Tidak ada PO dengan status ini.')}</td></tr>`}
      </tbody></table></div></div>`;
  } else if (b.tab === 'grn') {
    body = `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>No. penerimaan</th><th>Tanggal</th><th>No. PO</th><th>Pemasok</th><th class="num">Item</th><th class="num">Nilai</th><th>Diterima oleh</th><th></th></tr></thead><tbody>
      ${S.grns.slice().reverse().slice(0, 60).map(g => `<tr class="click" data-act="grn-view" data-no="${esc(g.no)}"><td class="mono">${esc(g.no)}</td><td>${fmtDT(g.t)}</td><td class="mono">${esc(g.po)}</td><td>${esc(supById(g.sup).name)}</td><td class="num">${g.lines.length}</td><td class="num strong">${rp(g.value)}</td><td>${esc(g.receiver)}</td><td>${icon('chevron-right', 16)}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  } else if (b.tab === 'hutang') {
    const now = Date.now();
    const open = S.pos.filter(p => poOutstanding(p) > 0).sort((a, c) => a.due - c.due);
    const bucket = p => { const d = Math.floor((now - p.due) / DAY); return d < 0 ? 0 : d <= 30 ? 1 : d <= 60 ? 2 : 3; };
    const tot = [0, 0, 0, 0]; open.forEach(p => { tot[bucket(p)] += poOutstanding(p); });
    const bySup = {}; open.forEach(p => { const x = bySup[p.sup] || (bySup[p.sup] = [0, 0, 0, 0]); x[bucket(p)] += poOutstanding(p); });
    body = `<div class="strip">
      <div><div class="s-l">Total hutang</div><div class="s-v" style="color:var(--brand-text)">${rp(sumBy(tot, x => x))}</div></div>
      <div><div class="s-l">Belum jatuh tempo</div><div class="s-v">${rp(tot[0])}</div></div>
      <div><div class="s-l">Lewat 1–30 hari</div><div class="s-v" style="color:var(--warn)">${rp(tot[1])}</div></div>
      <div><div class="s-l">Lewat 31–60 hari</div><div class="s-v" style="color:var(--bad)">${rp(tot[2])}</div></div>
      <div><div class="s-l">Lewat &gt; 60 hari</div><div class="s-v" style="color:var(--bad)">${rp(tot[3])}</div></div></div>
      <div class="card"><div class="card-h"><h3>Umur hutang per pemasok</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Pemasok</th><th class="num">Belum jatuh tempo</th><th class="num">1–30 hari</th><th class="num">31–60 hari</th><th class="num">&gt; 60 hari</th><th class="num">Total</th></tr></thead><tbody>
      ${Object.entries(bySup).map(([id, x]) => `<tr><td class="strong">${esc(supById(id).name)}</td>${x.map(v => `<td class="num">${v ? rp(v) : '<span class="faint">—</span>'}</td>`).join('')}<td class="num strong">${rp(sumBy(x, v => v))}</td></tr>`).join('') || `<tr><td colspan="6">${emptyState('hand-coins', 'Tidak ada hutang pemasok.')}</td></tr>`}
      </tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Tagihan terbuka</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>No. PO</th><th>Pemasok</th><th>Diterima</th><th>Jatuh tempo</th><th class="num">Nilai diterima</th><th class="num">Sudah dibayar</th><th class="num">Sisa</th><th></th></tr></thead><tbody>
      ${open.map(p => `<tr><td class="mono">${esc(p.no)}</td><td>${esc(supById(p.sup).name)}</td><td>${fmtDate(p.t)}</td><td>${fmtDate(p.due)} ${p.due < now ? '<span class="pill bad">Lewat</span>' : p.due - now < 3 * DAY ? '<span class="pill warn">Segera</span>' : ''}</td><td class="num">${rp(p.recvValue)}</td><td class="num">${rp(p.paid)}</td><td class="num strong">${rp(poOutstanding(p))}</td><td><button class="btn btn-sm btn-primary" data-act="po-pay" data-no="${esc(p.no)}">Bayar</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
  } else {
    const entries = Object.entries(sug);
    body = `<div class="alert info">${icon('package-plus', 16)}<div>Saran dihitung dari bahan yang stoknya <b>di bawah minimum</b>. Jumlah beli = stok target (±9 hari pemakaian) − stok sekarang − barang yang masih dalam PO berjalan, dibulatkan ke satuan beli.</div></div>
    ${entries.length ? entries.map(([sid, rows]) => { const s = supById(sid); const est = sumBy(rows, r => r.qty * r.i.lastPrice); return `<div class="card">
      <div class="card-h"><div><h3>${esc(s.name)}</h3><div class="sub">${esc(s.pic)} · ${esc(s.phone)} · termin ${s.terms} hari</div></div><div class="right"><span class="muted">Estimasi ${rp(est)}</span><button class="btn btn-primary btn-sm" data-act="po-from-sug" data-sup="${sid}" ${rows.some(r => r.qty > 0) ? '' : 'disabled'}>${icon('file-text', 14)} Buat PO</button></div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Bahan</th><th class="num">Stok sekarang</th><th class="num">Minimum</th><th class="num">Dalam PO</th><th class="num">Saran beli</th><th class="num">Harga terakhir</th><th class="num">Estimasi</th></tr></thead><tbody>
      ${rows.map(r => `<tr><td class="strong">${esc(r.i.name)}</td><td class="num">${fmtQty(r.i, r.i.stock)} ${stockPill(r.i)}</td><td class="num">${fmtQty(r.i, r.i.min)}</td><td class="num">${r.onOrder ? fmtQty(r.i, r.onOrder) : '<span class="faint">—</span>'}</td><td class="num strong">${r.qty ? fmtBuy(r.i, r.qty) : '<span class="pill ok">Cukup dari PO</span>'}</td><td class="num">${rp(r.i.lastPrice)}/${r.i.buy}</td><td class="num">${rp(r.qty * r.i.lastPrice)}</td></tr>`).join('')}
      </tbody></table></div></div>`; }).join('') : `<div class="card">${emptyState('package-check', 'Semua bahan di atas stok minimum. Tidak ada saran pembelian.')}</div>`}`;
  }
  return `<div class="tabs">${tabs.map(([k, l, n]) => `<button type="button" class="${b.tab === k ? 'on' : ''}" data-act="buy-tab" data-v="${k}">${l}<span class="count">${n}</span></button>`).join('')}</div>${body}`;
};
ACT['buy-tab'] = el => { UI.buy.tab = el.dataset.v; render(); };
ACT['po-filter'] = el => { UI.buy.status = el.dataset.v; render(); };

/* ---------- Buat PO ---------- */
let PO_EDIT = null;
function poFormHTML() {
  const e = PO_EDIT;
  const supIngs = S.ingredients.filter(i => i.sup === e.sup);
  const others = S.ingredients.filter(i => i.sup !== e.sup);
  const total = sumBy(e.lines, l => l.qty * l.price);
  const ingSelect = (cur, i) => `<select class="input sm" data-ch="pol-ing" data-i="${i}" aria-label="Bahan"><optgroup label="Dipasok ${esc(supById(e.sup).name)}">${opts(supIngs.map(x => [x.id, x.name]), cur)}</optgroup><optgroup label="Bahan lain">${opts(others.map(x => [x.id, x.name]), cur)}</optgroup></select>`;
  return `<div class="form-grid" style="grid-template-columns:2fr 1fr 1fr">
      <div class="field"><label for="po-sup">Pemasok</label><select class="input" id="po-sup" data-ch="po-sup">${opts(S.suppliers.filter(s => s.active !== false || s.id === e.sup).map(s => [s.id, s.name]), e.sup)}</select></div>
      <div class="field"><label for="po-date">Tanggal PO</label><input class="input" id="po-date" value="${fmtDate(Date.now())}" disabled></div>
      <div class="field"><label for="po-terms">Termin</label><input class="input" id="po-terms" value="${supById(e.sup).terms} hari" disabled></div></div>
    <div class="table-wrap"><table class="tbl"><thead><tr><th style="min-width:200px">Bahan</th><th class="num" style="width:100px">Jumlah</th><th>Satuan</th><th class="num" style="width:140px">Harga / satuan</th><th class="num">Subtotal</th><th></th></tr></thead><tbody>
    ${e.lines.map((l, i) => { const ing = ingById(l.ing); return `<tr><td>${ingSelect(l.ing, i)}<div class="sub">Stok ${fmtQty(ing, ing.stock)} · min ${fmtQty(ing, ing.min)}</div></td>
      <td><input class="input sm num" inputmode="decimal" value="${l.qty}" data-ch="pol-qty" data-i="${i}" aria-label="Jumlah"></td><td>${ing.buy} <span class="faint">(${nf.format(ing.conv)} ${ing.unit})</span></td>
      <td><input class="input sm num" inputmode="numeric" value="${l.price}" data-ch="pol-price" data-i="${i}" aria-label="Harga"></td><td class="num strong">${rp(l.qty * l.price)}</td>
      <td><button class="btn btn-sm btn-ghost btn-danger" data-act="pol-del" data-i="${i}" aria-label="Hapus">${icon('trash-2', 14)}</button></td></tr>`; }).join('') || `<tr><td colspan="6">${emptyState('package', 'Belum ada barang. Tambahkan baris.')}</td></tr>`}
    </tbody><tfoot><tr><td colspan="4">Total PO</td><td class="num">${rp(total)}</td><td></td></tr></tfoot></table></div>
    <div class="row"><button class="btn btn-sm" data-act="pol-add">${icon('plus', 14)} Tambah baris</button><button class="btn btn-sm btn-ghost" data-act="pol-sug">${icon('package-plus', 14)} Isi dari saran pembelian</button></div>
    <div class="field"><label for="po-note">Catatan untuk pemasok</label><input class="input" id="po-note" value="${esc(e.note)}" data-in="po-note" placeholder="mis. Kirim sebelum jam 9 pagi, lewat pintu belakang"></div>`;
}
function openPOForm() {
  openModal({ title: PO_EDIT.no ? 'Ubah draft ' + esc(PO_EDIT.no) : 'Buat purchase order', size: 'lg', body: poFormHTML(),
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn" data-act="po-save" data-v="draft">Simpan draft</button><button class="btn btn-primary" data-act="po-save" data-v="dikirim">${icon('send', 16)} Simpan &amp; kirim ke pemasok</button>` });
}
const paintPO = () => { modalEl().querySelector('.modal-b').innerHTML = poFormHTML(); };
function sugLines(sup) {
  return (suggestions()[sup] || []).filter(r => r.qty > 0).map(r => ({ ing: r.i.id, qty: r.qty, price: Math.round(r.i.lastPrice) }));
}
ACT['po-new'] = () => {
  const sup = (S.suppliers.find(s => s.active !== false) || S.suppliers[0]).id;
  PO_EDIT = { sup, lines: sugLines(sup), note: '' }; openPOForm();
};
ACT['po-edit'] = el => {
  const p = poByNo(el.dataset.no);
  if (p.status !== 'draft') { toast('Hanya PO berstatus draft yang bisa diubah.', 'ban'); return; }
  PO_EDIT = { no: p.no, sup: p.sup, lines: p.lines.map(l => ({ ing: l.ing, qty: l.qty, price: l.price })), note: p.note };
  openPOForm();
};
ACT['po-from-sug'] = el => { PO_EDIT = { sup: el.dataset.sup, lines: sugLines(el.dataset.sup), note: '' }; openPOForm(); };
ACT['po-sup'] = el => { PO_EDIT.sup = el.value; PO_EDIT.lines = sugLines(el.value); paintPO(); };
ACT['pol-ing'] = el => { const l = PO_EDIT.lines[+el.dataset.i]; l.ing = el.value; l.price = Math.round(ingById(el.value).lastPrice); paintPO(); };
ACT['pol-qty'] = el => { PO_EDIT.lines[+el.dataset.i].qty = Math.max(0, parseFloat(el.value.replace(',', '.')) || 0); paintPO(); };
ACT['pol-price'] = el => { PO_EDIT.lines[+el.dataset.i].price = +el.value.replace(/\D/g, '') || 0; paintPO(); };
ACT['pol-del'] = el => { PO_EDIT.lines.splice(+el.dataset.i, 1); paintPO(); };
ACT['pol-add'] = () => { const i = S.ingredients.find(x => x.sup === PO_EDIT.sup) || S.ingredients[0]; PO_EDIT.lines.push({ ing: i.id, qty: 1, price: Math.round(i.lastPrice) }); paintPO(); };
ACT['pol-sug'] = () => { const s = sugLines(PO_EDIT.sup); if (!s.length) toast('Tidak ada saran untuk pemasok ini.', 'package-check'); else { PO_EDIT.lines = s; paintPO(); } };
ACT['po-note'] = el => { PO_EDIT.note = el.value; };
ACT['po-save'] = el => {
  const lines = PO_EDIT.lines.filter(l => l.qty > 0);
  if (!lines.length) { toast('Isi minimal satu barang dengan jumlah lebih dari 0.', 'triangle-alert'); return; }
  let po;
  if (PO_EDIT.no) {
    po = poByNo(PO_EDIT.no);
    updatePO(po, PO_EDIT.sup, lines, PO_EDIT.note);
    if (el.dataset.v === 'dikirim') { po.status = 'dikirim'; po.sentAt = Date.now(); }
  } else po = createPO(Date.now(), PO_EDIT.sup, lines, el.dataset.v, PO_EDIT.note);
  closeModal(true); UI.buy.tab = 'po'; UI.buy.status = 'all';
  refresh(); toast(`${po.no} ${el.dataset.v === 'draft' ? 'disimpan sebagai draft' : 'dikirim ke ' + supById(po.sup).name}.`, 'send');
};

/* ---------- Detail PO ---------- */
function poDetail(no) {
  const p = poByNo(no), s = supById(p.sup);
  const steps = [['Draft', true], ['Dikirim', p.status !== 'draft'], ['Diterima', ['diterima', 'lunas', 'sebagian'].includes(p.status)], ['Lunas', p.status === 'lunas']];
  const canRecv = ['dikirim', 'sebagian'].includes(p.status);
  const canPay = poOutstanding(p) > 0;
  openModal({
    title: `${esc(p.no)} · ${esc(s.name)}`, size: 'lg',
    body: `<div class="row between"><div class="row">${poPill(p.status)}<span class="muted">Dibuat ${fmtDT(p.t)}</span></div>${p.due ? `<span class="muted">Jatuh tempo <b>${fmtDate(p.due)}</b></span>` : ''}</div>
      ${p.status !== 'batal' ? `<div class="timeline">${steps.map(([l, d]) => `<div class="st ${d ? 'done' : ''}">${l}</div>`).join('')}</div>` : ''}
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Bahan</th><th class="num">Dipesan</th><th class="num">Diterima</th><th class="num">Harga</th><th class="num">Subtotal</th></tr></thead><tbody>
      ${p.lines.map(l => { const i = ingById(l.ing); return `<tr><td class="strong">${esc(i.name)}</td><td class="num">${fmtBuy(i, l.qty)}</td><td class="num">${l.recv >= l.qty ? `<span class="pos">${fmtBuy(i, l.recv)}</span>` : l.recv ? `<span class="pill warn">${fmtBuy(i, l.recv)}</span>` : '<span class="faint">—</span>'}</td><td class="num">${rp(l.price)}</td><td class="num">${rp(l.qty * l.price)}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td colspan="4">Total PO</td><td class="num">${rp(p.total)}</td></tr></tfoot></table></div>
      <div class="grid g-3">
        <div><div class="lbl">Nilai barang diterima</div><div class="strong" style="font-weight:800">${rp(p.recvValue || 0)}</div></div>
        <div><div class="lbl">Sudah dibayar</div><div style="font-weight:800">${rp(p.paid)}</div></div>
        <div><div class="lbl">Sisa hutang</div><div style="font-weight:800;color:var(--brand-text)">${rp(poOutstanding(p))}</div></div>
      </div>
      ${p.note ? `<div class="alert">${icon('notebook-pen', 16)}<div>${esc(p.note)}</div></div>` : ''}
      ${p.grns.length ? `<div class="muted" style="font-size:12.5px">Dokumen penerimaan: ${p.grns.map(g => `<span class="mono">${esc(g)}</span>`).join(', ')}</div>` : ''}`,
    foot: `${['draft', 'dikirim'].includes(p.status) ? `<button class="btn btn-danger" data-act="po-cancel" data-no="${esc(p.no)}">Batalkan PO</button>` : ''}<span class="spacer"></span>
      ${p.status === 'draft' ? `<button class="btn" data-act="po-edit" data-no="${esc(p.no)}">${icon('pencil', 16)} Ubah draft</button>` : ''}
      ${p.status === 'draft' ? `<button class="btn btn-primary" data-act="po-send" data-no="${esc(p.no)}">${icon('send', 16)} Kirim ke pemasok</button>` : ''}
      ${canRecv ? `<button class="btn btn-primary" data-act="po-recv" data-no="${esc(p.no)}">${icon('package-check', 16)} Terima barang</button>` : ''}
      ${canPay ? `<button class="btn btn-gold" data-act="po-pay" data-no="${esc(p.no)}">${icon('hand-coins', 16)} Catat pembayaran</button>` : ''}
      ${!canRecv && !canPay && p.status !== 'draft' ? '<button class="btn" data-act="modal-close">Tutup</button>' : ''}`,
  });
}
ACT['po-view'] = el => poDetail(el.dataset.no);
ACT['po-send'] = el => { const p = poByNo(el.dataset.no); p.status = 'dikirim'; p.sentAt = Date.now(); saveState(); render(); poDetail(p.no); toast(`${p.no} dikirim ke pemasok via WhatsApp (simulasi).`, 'send'); };
ACT['po-cancel'] = el => { const p = poByNo(el.dataset.no); p.status = 'batal'; closeModal(true); refresh(); toast(`${p.no} dibatalkan.`, 'ban'); };
ACT['po-recv'] = el => {
  const p = poByNo(el.dataset.no);
  openModal({
    title: 'Penerimaan barang · ' + esc(p.no), size: 'lg',
    body: `<div class="alert info">${icon('clipboard-check', 16)}<div>Cocokkan dengan surat jalan pemasok. Isi jumlah yang benar-benar diterima dalam kondisi baik. Harga aktual dipakai untuk menghitung ulang harga rata-rata bahan.</div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Bahan</th><th class="num">Dipesan</th><th class="num">Sudah diterima</th><th class="num" style="width:120px">Terima sekarang</th><th class="num" style="width:140px">Harga aktual</th></tr></thead><tbody>
      ${p.lines.map((l, i) => { const ing = ingById(l.ing); const rem = Math.max(0, l.qty - l.recv); return `<tr><td class="strong">${esc(ing.name)}<div class="sub">${ing.buy} = ${nf.format(ing.conv)} ${ing.unit}</div></td><td class="num">${fmtBuy(ing, l.qty)}</td><td class="num">${fmtBuy(ing, l.recv)}</td>
        <td><input class="input sm num grn-q" data-i="${i}" inputmode="decimal" value="${rem}" aria-label="Jumlah diterima"></td><td><input class="input sm num grn-p" data-i="${i}" inputmode="numeric" value="${l.price}" aria-label="Harga aktual"></td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="form-grid"><div class="field"><label for="grn-by">Diterima oleh</label><select class="input" id="grn-by">${opts(activeUsers().map(u => [u.name, u.name + ' · ' + roleById(u.role).name]), currentUser().name)}</select></div>
      <div class="field"><label for="grn-sj">No. surat jalan pemasok</label><input class="input" id="grn-sj" placeholder="mis. SJ-0925/118"></div></div>`,
    foot: `<button class="btn" data-act="po-view" data-no="${esc(p.no)}">Kembali</button><button class="btn btn-primary" data-act="grn-post" data-no="${esc(p.no)}">${icon('package-check', 16)} Posting penerimaan</button>`,
  });
};
ACT['grn-post'] = el => {
  const p = poByNo(el.dataset.no);
  const ov = modalEl();
  const recv = [...ov.querySelectorAll('.grn-q')].map(inp => {
    const i = +inp.dataset.i;
    return { idx: i, qty: Math.max(0, parseFloat(inp.value.replace(',', '.')) || 0), price: +ov.querySelector(`.grn-p[data-i="${i}"]`).value.replace(/\D/g, '') || p.lines[i].price };
  });
  const g = receivePO(Date.now(), p, recv, document.getElementById('grn-by').value);
  if (!g) { toast('Isi minimal satu jumlah diterima.', 'triangle-alert'); return; }
  closeModal(true); refresh();
  toast(`${g.no} diposting · stok bertambah ${rp(g.value)} · hutang ke ${supById(p.sup).name} tercatat.`, 'package-check');
};
ACT['po-pay'] = el => {
  const p = poByNo(el.dataset.no);
  openModal({
    title: 'Pembayaran pemasok · ' + esc(p.no), size: 'sm',
    body: `<div class="stack"><div class="sumline"><span>Pemasok</span><span class="strong">${esc(supById(p.sup).name)}</span></div><div class="sumline"><span>Sisa hutang</span><span class="strong">${rp(poOutstanding(p))}</span></div></div>
      <div class="field"><label for="pp-amt">Jumlah dibayar</label><input class="input num" id="pp-amt" inputmode="numeric" value="${poOutstanding(p)}" autofocus></div>
      <div class="field"><label for="pp-m">Dibayar dari</label><select class="input" id="pp-m">${opts([['transfer', 'Transfer Bank BCA'], ['tunai', 'Kas outlet (tunai)']], 'transfer')}</select></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="pp-save" data-no="${esc(p.no)}">${icon('hand-coins', 16)} Simpan pembayaran</button>`,
  });
};
ACT['pp-save'] = el => {
  const p = poByNo(el.dataset.no);
  const amt = +document.getElementById('pp-amt').value.replace(/\D/g, '') || 0;
  const m = document.getElementById('pp-m').value;
  if (amt <= 0) { toast('Jumlah pembayaran harus lebih dari 0.', 'triangle-alert'); return; }
  if (amt > poOutstanding(p)) { toast(`Jumlah melebihi sisa hutang ${rp(poOutstanding(p))}.`, 'triangle-alert'); return; }
  const bal = accBalance(cashAccount(m));
  if (amt > bal) { toast(`Saldo ${m === 'tunai' ? 'kas' : 'bank'} tidak cukup (${rp(bal)}).`, 'triangle-alert'); return; }
  const paid = payPO(Date.now(), p, amt, m);
  closeModal(true); refresh(); toast(`Pembayaran ${rp(paid)} untuk ${p.no} tercatat.`, 'hand-coins');
};
ACT['grn-view'] = el => {
  const g = S.grns.find(x => x.no === el.dataset.no);
  openModal({ title: 'Penerimaan ' + esc(g.no), size: 'lg',
    body: `<div class="row"><span class="pill ok">Diposting</span><span class="muted">${fmtDT(g.t)} · ${esc(supById(g.sup).name)} · PO <span class="mono">${esc(g.po)}</span> · diterima ${esc(g.receiver)}</span></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Bahan</th><th class="num">Jumlah</th><th class="num">Setara</th><th class="num">Harga</th><th class="num">Nilai</th></tr></thead><tbody>
      ${g.lines.map(l => { const i = ingById(l.ing); return `<tr><td class="strong">${esc(i.name)}</td><td class="num">${fmtBuy(i, l.qty)}</td><td class="num muted">${fmtQty(i, l.qty * i.conv)}</td><td class="num">${rp(l.price)}</td><td class="num">${rp(l.qty * l.price)}</td></tr>`; }).join('')}
      </tbody><tfoot><tr><td colspan="4">Total</td><td class="num">${rp(g.value)}</td></tr></tfoot></table></div>
      <div class="muted" style="font-size:12.5px">Jurnal: Persediaan Bahan Baku (D) ${rp(g.value)} · Hutang Usaha (K) ${rp(g.value)}</div>` });
};

/* =========================== PERSEDIAAN =========================== */
const MOVE_LABEL = { awal: 'Saldo awal', beli: 'Pembelian', jual: 'Pemakaian penjualan', waste: 'Bahan rusak', opname: 'Penyesuaian opname', void: 'Pembatalan penjualan' };
const ING_CATS = () => [...new Set(S.ingredients.map(i => i.cat))];
VIEWS.persediaan = () => {
  const st = UI.stock;
  const tabs = [['stok', 'Stok Bahan'], ['kartu', 'Kartu Stok'], ['opname', 'Stok Opname'], ['waste', 'Bahan Rusak']];
  let body = '';
  if (st.tab === 'stok') {
    const q = st.q.trim().toLowerCase();
    const list = S.ingredients.filter(i => (st.cat === 'Semua' || i.cat === st.cat) && (st.status === 'all' || stockStatus(i) === st.status) && (!q || i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q)));
    const val = sumBy(S.ingredients, i => Math.max(0, i.stock) * i.avg);
    body = `<div class="strip">
      <div><div class="s-l">Nilai persediaan</div><div class="s-v">${rp(val)}</div></div>
      <div><div class="s-l">Jumlah bahan</div><div class="s-v">${S.ingredients.length}</div></div>
      <div><div class="s-l">Di bawah minimum</div><div class="s-v" style="color:var(--warn)">${S.ingredients.filter(i => stockStatus(i) === 'menipis').length}</div></div>
      <div><div class="s-l">Habis</div><div class="s-v" style="color:var(--bad)">${S.ingredients.filter(i => stockStatus(i) === 'habis').length}</div></div></div>
    <div class="row between"><div class="row">
      <div class="search"><span>${icon('search', 16)}</span><input class="input" style="width:200px" placeholder="Cari bahan / kode" value="${esc(st.q)}" data-ch="stk-q" aria-label="Cari bahan"></div>
      <select class="input" style="width:auto" data-ch="stk-cat" aria-label="Kategori">${opts([['Semua', 'Semua kategori'], ...ING_CATS().map(c => [c, c])], st.cat)}</select>
      <select class="input" style="width:auto" data-ch="stk-status" aria-label="Status">${opts([['all', 'Semua status'], ['aman', 'Aman'], ['menipis', 'Menipis'], ['habis', 'Habis']], st.status)}</select></div>
      <div class="row"><button class="btn" data-act="waste-new">${icon('trash-2', 16)} Catat bahan rusak</button><button class="btn btn-primary" data-act="ing-edit">${icon('plus', 16)} Tambah bahan</button></div></div>
    <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Kode</th><th>Bahan</th><th>Kategori</th><th class="num">Stok</th><th class="num">Minimum</th><th>Status</th><th class="num">Harga rata-rata</th><th class="num">Nilai</th><th>Pemasok</th><th></th></tr></thead><tbody>
    ${list.map(i => `<tr><td class="mono">${i.id}</td><td class="strong">${esc(i.name)}</td><td>${esc(i.cat)}</td><td class="num strong">${fmtQty(i, i.stock)}</td><td class="num muted">${fmtQty(i, i.min)}</td><td>${stockPill(i)}</td><td class="num">${rp(i.avg * i.conv)}<span class="faint">/${i.buy}</span></td><td class="num">${rp(Math.max(0, i.stock) * i.avg)}</td><td class="muted">${esc(supById(i.sup).name)}</td>
      <td class="row" style="flex-wrap:nowrap;gap:4px"><button class="btn btn-sm btn-ghost" data-act="stk-card" data-id="${i.id}" title="Kartu stok">${icon('history', 15)}</button><button class="btn btn-sm btn-ghost" data-act="ing-edit" data-id="${i.id}" title="Ubah">${icon('pencil', 15)}</button></td></tr>`).join('')}
    </tbody><tfoot><tr><td colspan="7">Total ${list.length} bahan</td><td class="num">${rp(sumBy(list, i => Math.max(0, i.stock) * i.avg))}</td><td colspan="2"></td></tr></tfoot></table></div></div>`;
  } else if (st.tab === 'kartu') {
    const ing = ingById(st.card);
    const r = range(st.cardPeriod);
    const after = S.moves.filter(m => m.ing === ing.id && m.t >= r.from);
    let bal = ing.stock - sumBy(after, m => m.qty);
    let balV = Math.max(0, ing.stock) * ing.avg - sumBy(after, m => m.value);
    const rows = after.filter(m => m.t <= r.to).map(m => { bal += m.qty; balV += m.value; return { m, bal, balV }; });
    const opening = ing.stock - sumBy(after, m => m.qty);
    body = `<div class="row between"><div class="row"><select class="input" style="width:260px" data-ch="stk-card-sel" aria-label="Pilih bahan">${opts(S.ingredients.map(i => [i.id, i.id + ' · ' + i.name]), ing.id)}</select>${periodSeg(st.cardPeriod, 'stk-card-period', ['today', '7d', '30d'])}</div>
      <div class="row">${stockPill(ing)}<span class="muted">Stok sekarang <b>${fmtQty(ing, ing.stock)}</b> · rata-rata ${rp(ing.avg * ing.conv)}/${ing.buy}</span></div></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Referensi</th><th>Keterangan</th><th class="num">Masuk</th><th class="num">Keluar</th><th class="num">Saldo</th><th class="num">Nilai mutasi</th></tr></thead><tbody>
      <tr class="group"><td colspan="5">Saldo awal periode</td><td class="num">${fmtQty(ing, opening)}</td><td></td></tr>
      ${rows.map(({ m, bal: b }) => `<tr><td>${fmtDT(m.t)}</td><td class="mono">${esc(m.ref)}</td><td>${MOVE_LABEL[m.type]}${m.note && m.note !== MOVE_LABEL[m.type] ? ` <span class="faint">· ${esc(m.note)}</span>` : ''}</td><td class="num pos">${m.qty > 0 ? fmtQty(ing, m.qty) : ''}</td><td class="num neg">${m.qty < 0 ? fmtQty(ing, -m.qty) : ''}</td><td class="num strong">${fmtQty(ing, b)}</td><td class="num muted">${rp(m.value)}</td></tr>`).join('')}
      <tr class="total"><td colspan="3">Saldo akhir</td><td class="num">${fmtQty(ing, sumBy(rows.filter(x => x.m.qty > 0), x => x.m.qty))}</td><td class="num">${fmtQty(ing, -sumBy(rows.filter(x => x.m.qty < 0), x => x.m.qty))}</td><td class="num">${fmtQty(ing, ing.stock)}</td><td></td></tr>
      </tbody></table></div></div>`;
  } else if (st.tab === 'opname') {
    body = `<div class="row between"><div class="muted">Hitung fisik gudang dan dapur, lalu posting selisihnya sebagai penyesuaian stok.</div><button class="btn btn-primary" data-act="opn-new">${icon('clipboard-check', 16)} Mulai stok opname</button></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>No. opname</th><th>Tanggal</th><th>Petugas</th><th>Catatan</th><th class="num">Item selisih</th><th class="num">Nilai selisih bersih</th><th></th></tr></thead><tbody>
      ${S.opnames.slice().reverse().map(o => `<tr class="click" data-act="opn-view" data-no="${esc(o.no)}"><td class="mono">${esc(o.no)}</td><td>${fmtDT(o.t)}</td><td>${esc(o.by)}</td><td>${esc(o.note)}</td><td class="num">${o.lines.filter(l => Math.abs(l.diff) > 1e-9).length}</td><td class="num strong ${o.net < 0 ? 'neg' : 'pos'}">${rp(o.net)}</td><td>${icon('chevron-right', 16)}</td></tr>`).join('') || `<tr><td colspan="7">${emptyState('clipboard-check', 'Belum ada stok opname.')}</td></tr>`}
      </tbody></table></div></div>`;
  } else {
    body = `<div class="row between"><div class="muted">Bahan rusak, kedaluwarsa, atau terbuang dicatat agar food cost aktual tetap akurat.</div><button class="btn btn-primary" data-act="waste-new">${icon('plus', 16)} Catat bahan rusak</button></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>No.</th><th>Tanggal</th><th>Bahan</th><th class="num">Jumlah</th><th>Alasan</th><th>Dicatat oleh</th><th class="num">Nilai</th><th></th></tr></thead><tbody>
      ${S.wastes.slice().reverse().map(w => { const i = ingById(w.ing); const off = w.status === 'batal'; return `<tr><td class="mono">${esc(w.no)}</td><td>${fmtDT(w.t)}</td><td class="strong">${esc(i.name)}</td><td class="num">${fmtQty(i, w.qty)}</td><td>${esc(w.reason)}${off ? ` <span class="pill">Dibatalkan</span>` : ''}</td><td>${esc(w.by)}</td><td class="num ${off ? 'faint' : 'neg'}" ${off ? 'style="text-decoration:line-through"' : ''}>${rp(w.value)}</td><td>${off ? '' : `<button class="btn btn-sm btn-ghost" data-act="waste-void" data-no="${esc(w.no)}">Batalkan</button>`}</td></tr>`; }).join('') || `<tr><td colspan="8">${emptyState('trash-2', 'Belum ada catatan bahan rusak.')}</td></tr>`}
      </tbody><tfoot><tr><td colspan="6">Total (tanpa yang dibatalkan)</td><td class="num">${rp(sumBy(S.wastes.filter(w => w.status !== 'batal'), w => w.value))}</td><td></td></tr></tfoot></table></div></div>`;
  }
  return `<div class="tabs">${tabs.map(([k, l]) => `<button type="button" class="${st.tab === k ? 'on' : ''}" data-act="stk-tab" data-v="${k}">${l}</button>`).join('')}</div>${body}`;
};
ACT['stk-tab'] = el => { UI.stock.tab = el.dataset.v; render(); };
ACT['stk-q'] = el => { UI.stock.q = el.value; render(); };
ACT['stk-cat'] = el => { UI.stock.cat = el.value; render(); };
ACT['stk-status'] = el => { UI.stock.status = el.value; render(); };
ACT['stk-card'] = el => { UI.stock.card = el.dataset.id; UI.stock.tab = 'kartu'; render(); };
ACT['stk-card-sel'] = el => { UI.stock.card = el.value; render(); };
ACT['stk-card-period'] = el => { UI.stock.cardPeriod = el.dataset.v; render(); };

ACT['ing-edit'] = el => {
  const i = el.dataset.id ? ingById(el.dataset.id) : null;
  const d = i || { id: nextId(S.ingredients, 'BB'), name: '', cat: 'Bahan Pokok', unit: 'gr', buy: 'kg', conv: 1000, lastPrice: 0, min: 1000, sup: 'SP03' };
  openModal({
    title: i ? 'Ubah bahan' : 'Tambah bahan baku',
    body: `<div class="form-grid">
      <div class="field"><label for="ig-id">Kode</label><input class="input mono" id="ig-id" value="${d.id}" disabled></div>
      <div class="field"><label for="ig-cat">Kategori</label><input class="input" id="ig-cat" list="ig-cats" value="${esc(d.cat)}"><datalist id="ig-cats">${ING_CATS().map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
      <div class="field full"><label for="ig-name">Nama bahan</label><input class="input" id="ig-name" value="${esc(d.name)}" autofocus></div>
      <div class="field"><label for="ig-unit">Satuan pakai (resep)</label><select class="input" id="ig-unit" ${i ? 'disabled' : ''}>${opts([['gr', 'gram (gr)'], ['ml', 'mililiter (ml)'], ['pcs', 'buah (pcs)']], d.unit)}</select></div>
      <div class="field"><label for="ig-buy">Satuan beli</label><input class="input" id="ig-buy" value="${esc(d.buy)}" placeholder="kg, liter, pack…"></div>
      <div class="field"><label for="ig-conv">Isi per satuan beli (dalam satuan pakai)</label><input class="input num" id="ig-conv" inputmode="numeric" value="${d.conv}" ${i ? 'disabled' : ''}></div>
      <div class="field"><label for="ig-price">Harga beli terakhir / satuan beli</label><input class="input num" id="ig-price" inputmode="numeric" value="${Math.round(d.lastPrice)}"></div>
      <div class="field"><label for="ig-min">Stok minimum (satuan pakai)</label><input class="input num" id="ig-min" inputmode="numeric" value="${Math.round(d.min)}"></div>
      <div class="field"><label for="ig-sup">Pemasok utama</label><select class="input" id="ig-sup">${opts(S.suppliers.filter(s => s.active !== false || s.id === d.sup).map(s => [s.id, s.name]), d.sup)}</select></div></div>
      ${i && ingredientInUse(i.id) ? '<div class="faint" style="font-size:12px">Bahan ini sudah dipakai resep, PO, atau punya mutasi stok, jadi tidak bisa dihapus.</div>' : ''}`,
    foot: `${i && !ingredientInUse(i.id) ? `<button class="btn btn-danger" data-act="ing-del" data-id="${i.id}">${icon('trash-2', 16)} Hapus</button><span class="spacer"></span>` : ''}<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="ing-save" data-id="${d.id}" data-new="${i ? '' : '1'}">${icon('save', 16)} Simpan</button>`,
  });
};
ACT['ing-save'] = el => {
  const v = id => document.getElementById(id).value.trim();
  if (!v('ig-name')) { toast('Nama bahan wajib diisi.', 'triangle-alert'); return; }
  let i = ingById(el.dataset.id);
  if (!i) {
    const conv = +v('ig-conv') || 1, price = +v('ig-price') || 0;
    i = { id: el.dataset.id, unit: v('ig-unit'), conv, stock: 0, avg: price / conv, target: (+v('ig-min') || 0) * 3.6 };
    S.ingredients.push(i);
  }
  Object.assign(i, { name: v('ig-name'), cat: v('ig-cat') || 'Lainnya', buy: v('ig-buy') || i.unit, lastPrice: +v('ig-price') || 0, min: +v('ig-min') || 0, sup: v('ig-sup') });
  i.target = Math.max(i.target || 0, i.min * 3.6);
  closeModal(true); refresh(); toast('Data bahan disimpan.');
};

ACT['ing-del'] = el => {
  const i = ingById(el.dataset.id);
  if (ingredientInUse(i.id)) { toast('Bahan sudah dipakai; tidak bisa dihapus.', 'ban'); return; }
  S.ingredients = S.ingredients.filter(x => x.id !== i.id);
  closeModal(true); refresh(); toast(`Bahan ${i.name} dihapus.`, 'trash-2');
};

/* ---------- Opname ---------- */
ACT['opn-new'] = () => {
  openModal({
    title: 'Stok opname · ' + fmtDate(Date.now()), size: 'xl',
    body: `<div class="alert info">${icon('clipboard-check', 16)}<div>Isi kolom <b>Stok fisik</b> sesuai hasil hitung (satuan pakai). Kolom yang tidak diubah dianggap sama dengan stok sistem.</div></div>
      <div class="table-wrap" style="max-height:52vh"><table class="tbl"><thead><tr><th>Bahan</th><th>Kategori</th><th class="num">Stok sistem</th><th class="num" style="width:140px">Stok fisik</th><th class="num">Selisih</th><th class="num">Nilai selisih</th></tr></thead><tbody>
      ${S.ingredients.map(i => `<tr><td class="strong">${esc(i.name)}</td><td class="muted">${esc(i.cat)}</td><td class="num">${nf2.format(i.stock)} ${i.unit}</td>
        <td><input class="input sm num opn-in" data-id="${i.id}" inputmode="decimal" value="${String(Math.round(i.stock * 100) / 100).replace('.', ',')}" data-in="opn-row" aria-label="Stok fisik ${esc(i.name)}"></td>
        <td class="num" id="od-${i.id}"><span class="faint">0</span></td><td class="num" id="ov-${i.id}"><span class="faint">—</span></td></tr>`).join('')}
      </tbody></table></div>
      <div class="form-grid"><div class="field"><label for="opn-by">Petugas</label><select class="input" id="opn-by">${opts(activeUsers().map(u => [u.name, u.name]), currentUser().name)}</select></div>
      <div class="field"><label for="opn-note">Catatan</label><input class="input" id="opn-note" placeholder="mis. Opname akhir bulan"></div></div>
      <div class="row between"><span class="muted">Total nilai selisih</span><span id="opn-total" style="font-weight:800;font-size:18px">Rp 0</span></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="opn-post">${icon('check', 16)} Posting penyesuaian</button>`,
  });
};
ACT['opn-row'] = el => {
  const i = ingById(el.dataset.id);
  const v = parseFloat(el.value.replace(',', '.'));
  const diff = isNaN(v) ? 0 : v - i.stock;
  const d = Math.abs(diff) < 1e-9 ? 0 : diff;
  document.getElementById('od-' + i.id).innerHTML = d ? `<span class="${d < 0 ? 'neg' : 'pos'}">${d > 0 ? '+' : ''}${nf2.format(d)} ${i.unit}</span>` : '<span class="faint">0</span>';
  document.getElementById('ov-' + i.id).innerHTML = d ? `<span class="${d < 0 ? 'neg' : 'pos'}">${rp(d * i.avg)}</span>` : '<span class="faint">—</span>';
  let tot = 0;
  modalEl().querySelectorAll('.opn-in').forEach(inp => { const x = ingById(inp.dataset.id); const n = parseFloat(inp.value.replace(',', '.')); if (!isNaN(n)) tot += (n - x.stock) * x.avg; });
  const t = document.getElementById('opn-total'); t.textContent = rp(tot); t.style.color = tot < 0 ? 'var(--bad)' : '';
};
ACT['opn-post'] = () => {
  const counts = [...modalEl().querySelectorAll('.opn-in')].map(inp => ({ ing: inp.dataset.id, actual: Math.max(0, parseFloat(inp.value.replace(',', '.')) || 0) }));
  postOpname(Date.now(), counts, document.getElementById('opn-by').value, document.getElementById('opn-note').value.trim() || 'Stok opname');
  closeModal(true); refresh(); toast('Stok opname diposting dan stok sistem disesuaikan.', 'clipboard-check');
};
ACT['opn-view'] = el => {
  const o = S.opnames.find(x => x.no === el.dataset.no);
  const diffs = o.lines.filter(l => Math.abs(l.diff) > 1e-9).sort((a, b) => a.value - b.value);
  openModal({ title: 'Stok opname ' + esc(o.no), size: 'lg',
    body: `<div class="muted">${fmtDT(o.t)} · ${esc(o.by)} · ${esc(o.note)}</div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Bahan</th><th class="num">Sistem</th><th class="num">Fisik</th><th class="num">Selisih</th><th class="num">Nilai</th></tr></thead><tbody>
      ${diffs.map(l => { const i = ingById(l.ing); return `<tr><td class="strong">${esc(i.name)}</td><td class="num">${fmtQty(i, l.system)}</td><td class="num">${fmtQty(i, l.actual)}</td><td class="num ${l.diff < 0 ? 'neg' : 'pos'}">${fmtQty(i, l.diff)}</td><td class="num ${l.value < 0 ? 'neg' : 'pos'}">${rp(l.value)}</td></tr>`; }).join('') || `<tr><td colspan="5">${emptyState('check', 'Tidak ada selisih.')}</td></tr>`}
      </tbody><tfoot><tr><td colspan="4">Selisih bersih (${o.lines.length} bahan dihitung)</td><td class="num">${rp(o.net)}</td></tr></tfoot></table></div>` });
};

/* ---------- Waste ---------- */
ACT['waste-new'] = () => {
  openModal({ title: 'Catat bahan rusak', size: 'sm',
    body: `<div class="field"><label for="ws-ing">Bahan</label><select class="input" id="ws-ing" data-ch="ws-ing">${opts(S.ingredients.map(i => [i.id, i.name + ' (' + i.unit + ')']), 'BB17')}</select></div>
      <div class="field"><label for="ws-qty">Jumlah (<span id="ws-unit">gr</span>)</label><input class="input num" id="ws-qty" inputmode="decimal" value="" autofocus></div>
      <div class="field"><label for="ws-reason">Alasan</label><select class="input" id="ws-reason">${opts(['Layu / busuk', 'Kedaluwarsa', 'Rusak saat penyimpanan', 'Tumpah / jatuh', 'Salah masak / komplain tamu'].map(x => [x, x]), 'Layu / busuk')}</select></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="ws-save">${icon('save', 16)} Simpan</button>` });
};
ACT['waste-void'] = el => {
  const w = S.wastes.find(x => x.no === el.dataset.no);
  openModal({ title: 'Batalkan ' + esc(w.no), size: 'sm',
    body: `<div>${esc(ingById(w.ing).name)} ${fmtQty(ingById(w.ing), w.qty)} (${rp(w.value)}) akan dikembalikan ke stok dan jurnalnya dibalik.</div>
      <div class="field"><label for="wv-reason">Alasan</label><input class="input" id="wv-reason" placeholder="mis. Salah catat jumlah" autofocus></div>`,
    foot: `<button class="btn" data-act="modal-close">Kembali</button><button class="btn btn-primary" data-act="waste-void-ok" data-no="${esc(w.no)}">Batalkan catatan</button>` });
};
ACT['waste-void-ok'] = el => {
  const w = S.wastes.find(x => x.no === el.dataset.no), reason = document.getElementById('wv-reason').value.trim();
  if (!reason) { toast('Isi alasan pembatalan.', 'triangle-alert'); return; }
  voidWaste(Date.now(), w, reason, currentUser().name);
  audit('Bahan rusak dibatalkan', `${w.no}: ${reason}`);
  closeModal(true); refresh(); toast(`${w.no} dibatalkan; stok dikembalikan.`, 'check');
};
ACT['ws-ing'] = el => { document.getElementById('ws-unit').textContent = ingById(el.value).unit; };
ACT['ws-save'] = () => {
  const id = document.getElementById('ws-ing').value;
  const q = parseFloat(document.getElementById('ws-qty').value.replace(',', '.')) || 0;
  const i = ingById(id);
  if (q <= 0) { toast('Isi jumlah bahan rusak.', 'triangle-alert'); return; }
  if (q > i.stock) { toast('Jumlah melebihi stok sistem (' + fmtQty(i, i.stock) + ').', 'triangle-alert'); return; }
  recordWaste(Date.now(), id, q, document.getElementById('ws-reason').value, currentUser().name);
  closeModal(true); refresh(); toast(`Bahan rusak ${i.name} ${fmtQty(i, q)} dicatat.`, 'trash-2');
};
