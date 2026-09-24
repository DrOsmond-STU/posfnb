/* =========================================================================
   Racik POS — Operasional: Dasbor, Kasir, Meja, Layar Dapur, Riwayat Penjualan
   ========================================================================= */

/* laporan hanya menghitung transaksi yang tidak di-void */
const salesIn = r => S.sales.filter(s => s.status !== 'void' && inRange(s.t, r));
const salesAllIn = r => S.sales.filter(s => inRange(s.t, r));
const sumBy = (arr, f) => arr.reduce((s, x) => s + f(x), 0);

/* =========================== DASBOR =========================== */
VIEWS.dashboard = () => {
  const today = salesIn(range('today')), yest = salesIn(range('yesterday'));
  const net = sumBy(today, s => s.net), netY = sumBy(yest, s => s.net);
  const cogs = sumBy(today, s => s.cogs), cogsY = sumBy(yest, s => s.cogs);
  const fc = net ? cogs / net * 100 : 0, fcY = netY ? cogsY / netY * 100 : 0;
  const avg = today.length ? net / today.length : 0;
  const invVal = sumBy(S.ingredients, i => Math.max(0, i.stock) * i.avg);
  const low = S.ingredients.filter(i => i.stock < i.min).sort((a, b) => a.stock / a.min - b.stock / b.min);

  // 30 hari
  const t0 = startOfDay(Date.now());
  const days = [];
  for (let d = 29; d >= 0; d--) {
    const from = t0 - d * DAY, list = salesIn({ from, to: from + DAY - 1 });
    const v = sumBy(list, s => s.net);
    const dt = new Date(from);
    days.push({ label: String(dt.getDate()), value: v, hi: d === 0,
      tip: `<b>${fmtDay(from)}</b><br>Penjualan bersih ${rp(v)}<br>${list.length} transaksi${d === 0 ? ' (berjalan)' : ''}` });
  }
  const total30 = sumBy(days, d => d.value);

  // kategori & menu terlaris 7 hari
  const w = salesIn(range('7d'));
  const byCat = {}, byMenu = {};
  for (const s of w) for (const l of s.items) {
    byCat[l.cat] = (byCat[l.cat] || 0) + l.qty * l.price;
    const m = byMenu[l.mid] || (byMenu[l.mid] = { name: l.name, qty: 0, rev: 0 });
    m.qty += l.qty; m.rev += l.qty * l.price;
  }
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v }));
  const top = Object.values(byMenu).sort((a, b) => b.qty - a.qty).slice(0, 6);

  const due = S.pos.filter(p => poOutstanding(p) > 0).sort((a, b) => a.due - b.due).slice(0, 5);
  const apTotal = sumBy(S.pos, poOutstanding);
  const occupied = S.tables.filter(t => t.status === 'terisi').length;
  const openVal = sumBy(S.bills, b => calcBill(b.items, b.type, b.discPct).total);

  return `
  <div class="grid g-4">
    ${kpi('banknote', 'Penjualan bersih hari ini', rp(net), `${delta(net, netY)} vs kemarin (${rpShort(netY)})`)}
    ${kpi('receipt', 'Transaksi hari ini', nf.format(today.length) + ' struk', `Rata-rata ${rp(avg)} / struk`, true)}
    ${kpi('percent', 'Food cost hari ini', pct(fc), `${fcPill(fc)} target ≤ ${S.settings.targetFC}% · kemarin ${pct(fcY)}`)}
    ${kpi('boxes', 'Nilai persediaan', rp(invVal), low.length ? `<span class="pill warn">${low.length} bahan di bawah minimum</span>` : '<span class="pill ok">Semua stok aman</span>', true)}
  </div>
  <div class="grid g-main">
    <div class="card">
      <div class="card-h"><div><h3>Penjualan bersih 30 hari terakhir</h3><div class="sub">Total ${rp(total30)} · rata-rata ${rp(total30 / 30)} / hari · batang terakhir = hari ini</div></div></div>
      <div class="card-b">${barChart(days, { label: 'Penjualan 30 hari', height: 240 })}</div>
    </div>
    <div class="card">
      <div class="card-h"><div><h3>Penjualan per kategori</h3><div class="sub">7 hari terakhir, sebelum diskon</div></div></div>
      <div class="card-b">${hbars(cats)}</div>
    </div>
  </div>
  <div class="grid g-3">
    <div class="card">
      <div class="card-h"><h3>Menu terlaris</h3><span class="sub">7 hari</span><div class="right"><button class="btn btn-sm btn-ghost" data-act="go" data-to="lap-penjualan">Detail ${icon('chevron-right', 14)}</button></div></div>
      <div>${top.map((m, i) => `<div class="li"><span class="rank">${i + 1}</span><div class="grow"><div class="t">${esc(m.name)}</div><div class="s">${nf.format(m.qty)} porsi terjual</div></div><div class="num strong">${rpShort(m.rev)}</div></div>`).join('')}</div>
    </div>
    <div class="card">
      <div class="card-h"><h3>Stok perlu dibeli</h3><span class="pill warn no-dot">${low.length}</span><div class="right"><button class="btn btn-sm" data-act="dash-suggest">${icon('package-plus', 14)} Saran PO</button></div></div>
      <div>${low.length ? low.slice(0, 6).map(i => `<div class="li"><div class="grow"><div class="t">${esc(i.name)}</div><div class="s">Sisa ${fmtQty(i, i.stock)} · minimum ${fmtQty(i, i.min)}</div></div>${stockPill(i)}</div>`).join('') : emptyState('package-check', 'Semua bahan di atas stok minimum.')}</div>
    </div>
    <div class="card">
      <div class="card-h"><h3>Operasional saat ini</h3></div>
      <div>
        <div class="li"><span class="li-ic">${icon('armchair', 16)}</span><div class="grow"><div class="t">${occupied} dari ${S.tables.length} meja terisi</div><div class="s">${S.bills.length} bill terbuka senilai ${rp(openVal)}</div></div><button class="btn btn-sm btn-ghost" data-act="go" data-to="meja">${icon('chevron-right', 14)}</button></div>
        <div class="li"><span class="li-ic">${icon('chef-hat', 16)}</span><div class="grow"><div class="t">${S.kds.filter(k => k.status !== 'selesai').length} tiket di dapur</div><div class="s">${S.kds.filter(k => k.status === 'siap').length} siap diantar ke meja</div></div><button class="btn btn-sm btn-ghost" data-act="go" data-to="dapur">${icon('chevron-right', 14)}</button></div>
        <div class="li"><span class="li-ic">${icon('hand-coins', 16)}</span><div class="grow"><div class="t">Hutang pemasok ${rp(apTotal)}</div><div class="s">${due.length ? 'Terdekat: ' + esc(supById(due[0].sup).name) + ', jatuh tempo ' + fmtDate(due[0].due) : 'Tidak ada hutang'}</div></div><button class="btn btn-sm btn-ghost" data-act="buy-tab-go" data-v="hutang">${icon('chevron-right', 14)}</button></div>
        <div class="li"><span class="li-ic">${icon('truck', 16)}</span><div class="grow"><div class="t">${S.pos.filter(p => p.status === 'dikirim').length} PO menunggu barang datang</div><div class="s">${S.pos.filter(p => p.status === 'draft').length} draft belum dikirim</div></div><button class="btn btn-sm btn-ghost" data-act="buy-tab-go" data-v="po">${icon('chevron-right', 14)}</button></div>
      </div>
    </div>
  </div>`;
};
VIEWS.dashboard.after = el => bindTips(el);
ACT['dash-suggest'] = () => { UI.buy.tab = 'saran'; go('pembelian'); };
ACT['buy-tab-go'] = el => { UI.buy.tab = el.dataset.v; go('pembelian'); };

/* =========================== KASIR =========================== */
function cartQty(mid) { return UI.cart.items.filter(i => i.mid === mid).reduce((s, i) => s + i.qty, 0); }
function menuCard(m) {
  const inCart = cartQty(m.id);
  const left = portionsLeft(m, UI.cart.items);
  const out = left <= 0;
  return `<button type="button" class="mcard ${out ? 'out' : ''}" data-act="pos-add" data-id="${m.id}" ${out ? 'aria-disabled="true"' : ''}>
    <div class="m-img c-${m.cat}">${icon(m.icon || CAT_ICONS[m.cat], 30)}${inCart ? `<span class="m-qty">${inCart}</span>` : ''}</div>
    <div class="m-body"><div class="m-name">${esc(m.name)}</div><div class="m-price">${rp(m.price)}</div>
    <div class="m-stock ${!out && left <= 10 ? 'low' : ''}">${out ? 'Bahan habis' : `Bisa dibuat ±${nf.format(left)} porsi`}</div></div></button>`;
}
function menuGridHTML() {
  const q = UI.pos.q.trim().toLowerCase();
  const list = S.menu.filter(m => m.active && (UI.pos.cat === 'Semua' || m.cat === UI.pos.cat) && (!q || m.name.toLowerCase().includes(q)));
  return list.length ? list.map(menuCard).join('') : `<div style="grid-column:1/-1">${emptyState('search', 'Menu tidak ditemukan.')}</div>`;
}
function orderPanelHTML() {
  const c = UI.cart;
  const bill = c.billId ? S.bills.find(b => b.id === c.billId) : null;
  const calc = calcBill(c.items, c.type, c.discPct);
  const tables = S.tables.filter(t => t.status !== 'terisi' || t.no === c.table);
  return `
  <div class="order-h">
    <div class="row between">
      <div><div style="font-weight:800;font-size:15px">${bill ? 'Bill ' + esc(bill.no) : 'Pesanan baru'}</div><div class="faint" style="font-size:12px">Kasir: ${esc(S.session.cashier)} · ${fmtTime(Date.now())}</div></div>
      <div class="row" style="gap:6px"><button class="btn btn-sm" data-act="bills-open">${icon('clipboard-list', 14)} Bill tersimpan <span class="pill brand no-dot">${S.bills.length}</span></button>
      ${bill ? `<button class="btn btn-sm btn-ghost btn-danger" data-act="bill-cancel" title="Batalkan bill">${icon('ban', 15)}</button>` : ''}
      <button class="btn btn-sm btn-ghost" data-act="cart-clear" title="Kosongkan layar">${icon('trash-2', 15)}</button></div>
    </div>
    <div class="seg" style="width:100%">${[['dinein', 'Dine-in', 'armchair'], ['takeaway', 'Take away', 'package'], ['online', 'Online', 'smartphone']].map(([k, l, ic]) =>
      `<button type="button" style="flex:1;justify-content:center" class="${c.type === k ? 'on' : ''}" data-act="cart-type" data-v="${k}">${icon(ic, 14)} ${l}</button>`).join('')}</div>
    <div class="row" style="flex-wrap:nowrap">
      ${c.type === 'dinein' ? `<select class="input sm" style="width:120px" data-ch="cart-table" aria-label="Meja"><option value="">Pilih meja</option>${tables.map(t => `<option value="${t.no}" ${t.no === c.table ? 'selected' : ''}>Meja ${t.no} · ${t.area}</option>`).join('')}</select>` : ''}
      <input class="input sm" id="cart-cust" placeholder="${c.type === 'online' ? 'No. order ojol (mis. GF-2211)' : 'Nama pelanggan (opsional)'}" value="${esc(c.customer)}" data-in="cart-cust">
    </div>
  </div>
  <div class="order-items">${c.items.length ? c.items.map((it, i) => {
    const m = menuById(it.mid);
    return `<div class="oi"><div><div class="n">${esc(m.name)}</div><div class="p">${rp(m.price)}${it.sent ? ` · <span class="faint">${it.sent} sudah ke dapur</span>` : ''}</div></div><div class="tot">${rp(m.price * it.qty)}</div>
      ${it.note ? `<div class="note">${icon('notebook-pen', 13)} ${esc(it.note)}</div>` : ''}
      <div class="ctl"><div class="stepper"><button type="button" data-act="cart-dec" data-i="${i}" aria-label="Kurangi">${icon('minus', 14)}</button><span>${it.qty}</span><button type="button" data-act="cart-inc" data-i="${i}" aria-label="Tambah">${icon('plus', 14)}</button></div>
      <button class="btn btn-sm btn-ghost" data-act="cart-note" data-i="${i}">${icon('pencil', 13)} Catatan</button><span class="spacer"></span>
      <button class="btn btn-sm btn-ghost btn-danger" data-act="cart-del" data-i="${i}" aria-label="Hapus">${icon('x', 14)}</button></div></div>`;
  }).join('') : emptyState('shopping-cart', 'Ketuk menu di kiri untuk menambahkan pesanan.')}</div>
  <div class="order-f">
    <div class="row between"><span class="lbl">Diskon</span><select class="input sm" style="width:auto" data-ch="cart-disc" aria-label="Diskon">${opts([[0, 'Tanpa diskon'], [10, 'Member 10%'], [15, 'Promo Gajian 15%'], [20, 'Karyawan 20%']], c.discPct)}</select></div>
    <div class="sumline"><span>Subtotal (${c.items.reduce((s, i) => s + i.qty, 0)} item)</span><span>${rp(calc.sub)}</span></div>
    ${calc.disc ? `<div class="sumline"><span>Diskon ${c.discPct}%</span><span>−${rp(calc.disc)}</span></div>` : ''}
    <div class="sumline"><span>Service charge ${calc.svc ? S.settings.serviceRate + '%' : '(tidak berlaku)'}</span><span>${rp(calc.svc)}</span></div>
    <div class="sumline"><span>PB1 ${S.settings.taxRate}%</span><span>${rp(calc.tax)}</span></div>
    <div class="sumline total"><span>Total</span><span>${rp(calc.total)}</span></div>
    <div class="row" style="flex-wrap:nowrap;margin-top:6px">
      <button class="btn btn-lg" style="flex:1" data-act="cart-hold" ${c.items.length ? '' : 'disabled'}>${icon('send', 16)} Simpan &amp; ke Dapur</button>
      <button class="btn btn-lg btn-primary" style="flex:1.2" data-act="cart-pay" ${c.items.length ? '' : 'disabled'}>${icon('wallet', 16)} Bayar</button>
    </div>
  </div>`;
}
VIEWS.kasir = () => `
  <div class="pos">
    <div class="pos-left">
      <div class="row" style="flex-wrap:nowrap">
        <div class="search" style="flex:1"><span>${icon('search', 16)}</span><input class="input" id="pos-q" placeholder="Cari menu…" value="${esc(UI.pos.q)}" data-in="pos-q" aria-label="Cari menu"></div>
      </div>
      <div class="chips">${['Semua', ...MENU_CATS].map(c => `<button type="button" class="chip ${UI.pos.cat === c ? 'on' : ''}" data-act="pos-cat" data-v="${c}">${c !== 'Semua' ? icon(CAT_ICONS[c], 14) : ''}${c}</button>`).join('')}</div>
      <div class="menu-grid" id="menu-grid">${menuGridHTML()}</div>
    </div>
    <div class="card order" id="order-panel">${orderPanelHTML()}</div>
  </div>`;
function rerenderPOS() {
  const g = document.getElementById('menu-grid'), o = document.getElementById('order-panel');
  if (g) g.innerHTML = menuGridHTML();
  if (o) o.innerHTML = orderPanelHTML();
}
ACT['pos-cat'] = el => { UI.pos.cat = el.dataset.v; render(); };
ACT['pos-q'] = el => { UI.pos.q = el.value; document.getElementById('menu-grid').innerHTML = menuGridHTML(); };
ACT['pos-add'] = el => {
  const m = menuById(el.dataset.id);
  if (portionsLeft(m, UI.cart.items) <= 0) { toast('Bahan untuk ' + m.name + ' tidak cukup. Cek persediaan.', 'triangle-alert'); return; }
  const ex = UI.cart.items.find(i => i.mid === m.id && !i.note);
  if (ex) ex.qty++; else UI.cart.items.push({ mid: m.id, qty: 1, note: '', sent: 0 });
  rerenderPOS();
};
ACT['cart-inc'] = el => {
  const it = UI.cart.items[+el.dataset.i], m = menuById(it.mid);
  if (portionsLeft(m, UI.cart.items) <= 0) { toast('Bahan tidak cukup untuk menambah porsi.', 'triangle-alert'); return; }
  it.qty++; rerenderPOS();
};
ACT['cart-dec'] = el => {
  const it = UI.cart.items[+el.dataset.i];
  if (it.qty - 1 < (it.sent || 0)) { toast('Item sudah dikirim ke dapur. Batalkan lewat Layar Dapur.', 'ban'); return; }
  it.qty--; if (it.qty <= 0) UI.cart.items.splice(+el.dataset.i, 1);
  rerenderPOS();
};
ACT['cart-del'] = el => {
  const it = UI.cart.items[+el.dataset.i];
  if (it.sent) { toast('Item sudah dikirim ke dapur dan tidak bisa dihapus.', 'ban'); return; }
  UI.cart.items.splice(+el.dataset.i, 1); rerenderPOS();
};
ACT['cart-type'] = el => {
  UI.cart.type = el.dataset.v;
  if (UI.cart.type !== 'dinein' && !UI.cart.billId) UI.cart.table = null;
  rerenderPOS();
};
ACT['cart-table'] = el => { UI.cart.table = el.value ? +el.value : null; };
ACT['cart-cust'] = el => { UI.cart.customer = el.value; };
ACT['cart-disc'] = el => {
  const v = +el.value;
  if (v > 0 && !can('kasir.diskon')) {
    el.value = UI.cart.discPct;
    askDiscountApproval(v, u => { UI.cart.discPct = v; UI.cart.discBy = u.name; rerenderPOS(); toast(`Diskon ${v}% disetujui ${u.name}.`, 'shield'); });
    return;
  }
  UI.cart.discPct = v; UI.cart.discBy = v ? currentUser().name : ''; rerenderPOS();
};
ACT['cart-clear'] = () => {
  if (UI.cart.billId) { UI.cart = newCart(); toast('Bill tetap tersimpan. Layar kasir dikosongkan.'); }
  else UI.cart = newCart();
  rerenderPOS();
};
ACT['cart-note'] = el => {
  const i = +el.dataset.i, it = UI.cart.items[i];
  const quick = ['Tidak pedas', 'Pedas level 3', 'Es sedikit', 'Tanpa sayur', 'Kurang manis', 'Dibungkus', 'Sambal pisah'];
  openModal({
    title: 'Catatan untuk ' + esc(menuById(it.mid).name), size: 'sm',
    body: `<div class="field"><label for="note-in">Catatan dapur</label><input class="input" id="note-in" value="${esc(it.note)}" autofocus></div>
      <div class="chips" style="flex-wrap:wrap">${quick.map(q => `<button type="button" class="chip" data-act="note-quick" data-v="${q}">${q}</button>`).join('')}</div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="note-save" data-i="${i}">Simpan catatan</button>`,
  });
};
ACT['note-quick'] = el => { const n = document.getElementById('note-in'); n.value = n.value ? n.value + ', ' + el.dataset.v : el.dataset.v; };
ACT['note-save'] = el => { UI.cart.items[+el.dataset.i].note = document.getElementById('note-in').value.trim(); closeModal(true); rerenderPOS(); };

function sendToKitchen(bill) {
  const delta = [];
  for (const it of bill.items) {
    const d = it.qty - (it.sent || 0);
    if (d > 0) { delta.push({ name: menuById(it.mid).name, qty: d, note: it.note }); it.sent = it.qty; }
  }
  if (!delta.length) return 0;
  S.kds.push({ id: 'K' + Date.now() + Math.random().toString(36).slice(2, 6), billNo: bill.no, created: Date.now(), status: 'antri', items: delta,
    where: bill.type === 'dinein' ? 'Meja ' + bill.table : bill.type === 'online' ? 'Online · ' + (bill.customer || 'Ojol') : 'Take away' + (bill.customer ? ' · ' + bill.customer : '') });
  return delta.length;
}
ACT['cart-hold'] = () => {
  const c = UI.cart;
  if (c.type === 'dinein' && !c.table) { toast('Pilih meja terlebih dahulu.', 'triangle-alert'); return; }
  let bill = c.billId ? S.bills.find(b => b.id === c.billId) : null;
  if (!bill) {
    const now = Date.now();
    bill = { id: 'B' + now, no: nextNo('ORD', now, true), created: now };
    S.bills.push(bill);
  }
  // pindah meja
  S.tables.forEach(t => { if (t.bill === bill.id) { t.status = 'kosong'; t.bill = null; } });
  Object.assign(bill, { type: c.type, table: c.type === 'dinein' ? c.table : null, customer: c.customer, items: c.items.map(i => ({ ...i })), discPct: c.discPct });
  if (bill.table) { const t = S.tables.find(x => x.no === bill.table); t.status = 'terisi'; t.bill = bill.id; t.resv = null; }
  const n = sendToKitchen(bill);
  UI.cart = newCart();
  refresh();
  toast(`Bill ${bill.no} disimpan${n ? ' · ' + n + ' item dikirim ke dapur' : ''}.`, 'send');
};
/* batalkan bill terbuka: bila ada item yang sudah dikirim ke dapur, perlu izin void / PIN penyetuju */
ACT['bill-cancel'] = () => {
  const bill = S.bills.find(b => b.id === UI.cart.billId); if (!bill) return;
  const sent = bill.items.some(i => i.sent > 0);
  openModal({ title: 'Batalkan bill ' + esc(bill.no), size: 'sm',
    body: `<div>${bill.table ? 'Meja ' + bill.table + ' akan dikosongkan. ' : ''}Bill dihapus dari daftar tersimpan dan tiket dapur yang belum selesai ikut dibatalkan. Stok tidak berubah karena bill belum dibayar.</div>
      ${sent ? `<div class="alert">${icon('triangle-alert', 16)}<div>Sebagian item sudah dikirim ke dapur. Bila bahan sudah terpakai, catat sebagai bahan rusak.</div></div>` : ''}
      <div class="field"><label for="bc-reason">Alasan</label><input class="input" id="bc-reason" placeholder="mis. Tamu batal pesan" autofocus></div>`,
    foot: `<button class="btn" data-act="modal-close">Kembali</button><button class="btn btn-primary" data-act="bill-cancel-ok">${icon('ban', 16)} Batalkan bill</button>` });
};
ACT['bill-cancel-ok'] = () => {
  const bill = S.bills.find(b => b.id === UI.cart.billId);
  const reason = document.getElementById('bc-reason').value.trim();
  if (!reason) { toast('Isi alasan pembatalan.', 'triangle-alert'); return; }
  const doCancel = u => {
    S.bills = S.bills.filter(b => b !== bill);
    S.tables.forEach(t => { if (t.bill === bill.id) { t.status = 'kosong'; t.bill = null; } });
    S.kds = S.kds.filter(k => k.billNo !== bill.no);
    audit('Bill dibatalkan', `${bill.no}: ${reason}${u.id !== currentUser().id ? ' · disetujui ' + u.name : ''}`);
    UI.cart = newCart(); closeModal(true); refresh(); paintChrome();
    toast(`Bill ${bill.no} dibatalkan.`, 'ban');
  };
  if (bill.items.some(i => i.sent > 0)) withApproval('penjualan.void', 'Persetujuan batal bill', 'Item bill ini sudah dikirim ke dapur.', doCancel);
  else doCancel(currentUser());
};
ACT['bills-open'] = () => {
  openModal({
    title: 'Bill tersimpan', size: 'lg',
    body: S.bills.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>No. order</th><th>Meja / tipe</th><th>Pelanggan</th><th>Dibuka</th><th class="num">Item</th><th class="num">Total</th><th></th></tr></thead><tbody>
      ${S.bills.map(b => { const c = calcBill(b.items, b.type, b.discPct); return `<tr><td class="mono">${esc(b.no)}</td><td>${b.table ? 'Meja ' + b.table : TYPE_LABEL[b.type]}</td><td>${esc(b.customer) || '<span class="faint">—</span>'}</td><td>${fmtTime(b.created)} <span class="faint">(${Math.round((Date.now() - b.created) / 60000)} mnt)</span></td><td class="num">${b.items.reduce((s, i) => s + i.qty, 0)}</td><td class="num strong">${rp(c.total)}</td><td><button class="btn btn-sm btn-primary" data-act="bill-load" data-id="${b.id}">Buka</button></td></tr>`; }).join('')}
      </tbody></table></div>` : emptyState('clipboard-list', 'Belum ada bill tersimpan.'),
  });
};
function loadBill(id) {
  const b = S.bills.find(x => x.id === id);
  UI.cart = { billId: b.id, type: b.type, table: b.table, customer: b.customer, items: b.items.map(i => ({ ...i })), discPct: b.discPct || 0 };
}
ACT['bill-load'] = el => { loadBill(el.dataset.id); closeModal(true); go('kasir'); };

/* ---------- Pembayaran ---------- */
const PAY = { method: 'tunai', paid: 0, ref: '' };
function qrSVG(seed) {
  const r = mulberry32(seed), n = 25, s = 7;
  let cells = '';
  const finder = (x, y) => `<rect x="${x * s}" y="${y * s}" width="${7 * s}" height="${7 * s}" fill="#111"/><rect x="${(x + 1) * s}" y="${(y + 1) * s}" width="${5 * s}" height="${5 * s}" fill="#fff"/><rect x="${(x + 2) * s}" y="${(y + 2) * s}" width="${3 * s}" height="${3 * s}" fill="#111"/>`;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const inF = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
    if (!inF && r() < 0.48) cells += `<rect x="${x * s}" y="${y * s}" width="${s}" height="${s}" fill="#111"/>`;
  }
  return `<svg viewBox="0 0 ${n * s} ${n * s}" width="100%" height="100%" role="img" aria-label="Kode QRIS simulasi"><rect width="${n * s}" height="${n * s}" fill="#fff"/>${cells}${finder(0, 0)}${finder(n - 7, 0)}${finder(0, n - 7)}</svg>`;
}
function payBodyHTML() {
  const c = calcBill(UI.cart.items, UI.cart.type, UI.cart.discPct);
  const total = c.total;
  const rounds = [...new Set([total, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000, Math.ceil(total / 100000) * 100000, Math.ceil(total / 100000) * 100000 + 50000, Math.ceil(total / 100000) * 100000 + 100000])].slice(0, 6);
  const ch = PAY.paid - total;
  let detail = '';
  if (PAY.method === 'tunai') {
    detail = `<div class="field"><label for="pay-amt">Uang diterima</label><input class="input num" id="pay-amt" inputmode="numeric" style="height:48px;font-size:20px;font-weight:800" value="${PAY.paid ? nf.format(PAY.paid) : ''}" placeholder="0" data-in="pay-amt" autofocus></div>
      <div class="quick">${rounds.map((v, i) => `<button type="button" data-act="pay-quick" data-v="${v}">${i === 0 ? 'Uang pas' : nf.format(v)}</button>`).join('')}</div>
      <div class="change ${ch < 0 ? 'short' : ''}" id="pay-change"><span>${ch < 0 ? 'Kurang' : 'Kembalian'}</span><span>${rp(Math.abs(ch))}</span></div>`;
  } else if (PAY.method === 'qris') {
    detail = `<div class="qr">${qrSVG(total)}</div><div class="c muted" style="text-align:center;font-size:12.5px">Minta pelanggan memindai QRIS di layar pelanggan.<br><b>NMID ID1024300781123</b> · berlaku 5 menit</div>
      <div class="alert info">${icon('clock', 16)}<div>Simulasi: tekan <b>Konfirmasi pembayaran</b> setelah notifikasi dana masuk.</div></div>`;
  } else if (PAY.method === 'kartu') {
    detail = `<div class="form-grid"><div class="field"><label for="pay-ref">No. approval EDC</label><input class="input" id="pay-ref" placeholder="mis. 004512" data-in="pay-ref" value="${esc(PAY.ref)}"></div>
      <div class="field"><label for="pay-bank">Mesin EDC</label><select class="input" id="pay-bank"><option>BCA</option><option>Mandiri</option><option>BRI</option></select></div></div>`;
  } else {
    detail = `<div class="field"><label for="pay-ref">No. order aplikasi</label><input class="input" id="pay-ref" placeholder="mis. GF-882910" data-in="pay-ref" value="${esc(PAY.ref || UI.cart.customer)}"></div>
      <div class="alert">${icon('triangle-alert', 16)}<div>Pembayaran diterima dari aplikasi mitra (settlement H+1 ke Bank BCA).</div></div>`;
  }
  return `<div class="grid g-2" style="align-items:start">
    <div class="stack">
      <div class="bigtotal"><div class="l">Total tagihan</div><div class="v">${rp(total)}</div><div class="l">${UI.cart.items.reduce((s, i) => s + i.qty, 0)} item · ${TYPE_LABEL[UI.cart.type]}${UI.cart.table ? ' · Meja ' + UI.cart.table : ''}</div></div>
      <div class="lbl">Metode pembayaran</div>
      <div class="pay-methods">${PAY_METHODS.map(p => `<button type="button" class="pm ${PAY.method === p.id ? 'on' : ''}" data-act="pay-method" data-v="${p.id}">${icon(p.icon, 20)}<span>${p.name}</span></button>`).join('')}</div>
      <div class="stack" style="gap:4px;font-size:12.5px">
        <div class="sumline"><span>Subtotal</span><span>${rp(c.sub)}</span></div>
        ${c.disc ? `<div class="sumline"><span>Diskon</span><span>−${rp(c.disc)}</span></div>` : ''}
        <div class="sumline"><span>Service charge</span><span>${rp(c.svc)}</span></div>
        <div class="sumline"><span>PB1</span><span>${rp(c.tax)}</span></div>
      </div>
    </div>
    <div class="stack" id="pay-detail">${detail}</div>
  </div>`;
}
function paintPay() {
  const ov = modalEl(); if (!ov) return;
  ov.querySelector('.modal-b').innerHTML = payBodyHTML();
  const inp = ov.querySelector('#pay-amt'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
ACT['cart-pay'] = () => {
  const c = UI.cart;
  if (c.type === 'dinein' && !c.table) { toast('Pilih meja terlebih dahulu.', 'triangle-alert'); return; }
  PAY.method = c.type === 'online' ? 'online' : 'tunai'; PAY.paid = 0; PAY.ref = '';
  openModal({ title: 'Pembayaran', size: 'lg', body: payBodyHTML(),
    foot: `<button class="btn" data-act="modal-close">Kembali</button><button class="btn btn-primary btn-lg" data-act="pay-confirm">${icon('circle-check', 18)} Konfirmasi pembayaran</button>` });
};
ACT['pay-method'] = el => { PAY.method = el.dataset.v; PAY.paid = 0; paintPay(); };
ACT['pay-quick'] = el => { PAY.paid = +el.dataset.v; paintPay(); };
ACT['pay-ref'] = el => { PAY.ref = el.value; };
ACT['pay-amt'] = el => {
  PAY.paid = +el.value.replace(/\D/g, '') || 0;
  const total = calcBill(UI.cart.items, UI.cart.type, UI.cart.discPct).total;
  const ch = PAY.paid - total;
  const box = document.getElementById('pay-change');
  box.className = 'change ' + (ch < 0 ? 'short' : '');
  box.innerHTML = `<span>${ch < 0 ? 'Kurang' : 'Kembalian'}</span><span>${rp(Math.abs(ch))}</span>`;
};
ACT['pay-confirm'] = () => {
  const c = UI.cart;
  const total = calcBill(c.items, c.type, c.discPct).total;
  if (PAY.method === 'tunai' && PAY.paid < total) { toast('Uang diterima kurang dari total tagihan.', 'triangle-alert'); return; }
  const short = stockShortage(c.items);
  if (short) { toast(`Stok ${short.ing.name} tidak cukup: perlu ${fmtQty(short.ing, short.need)}, tersedia ${fmtQty(short.ing, short.have)}.`, 'triangle-alert'); return; }
  const now = Date.now();
  let bill = c.billId ? S.bills.find(b => b.id === c.billId) : null;
  const kitchenBill = bill || { no: 'TA', type: c.type, table: c.table, customer: c.customer, items: c.items.map(i => ({ ...i, sent: 0 })) };
  if (bill) kitchenBill.items = c.items.map(i => ({ ...i }));
  const sale = recordSale(now, { type: c.type, table: c.table, customer: c.customer, items: c.items, discPct: c.discPct, discBy: c.discBy },
    { method: PAY.method, paid: PAY.method === 'tunai' ? PAY.paid : total, ref: PAY.ref });
  if (!bill) kitchenBill.no = sale.no;
  sendToKitchen(kitchenBill);
  if (bill) {
    S.bills = S.bills.filter(b => b.id !== bill.id);
    S.tables.forEach(t => { if (t.bill === bill.id) { t.status = 'kosong'; t.bill = null; } });
  }
  UI.cart = newCart();
  saveState();
  render();
  showReceipt(sale, true);
};
function receiptHTML(s) {
  const st = S.settings;
  return `<div class="receipt">
    <div class="c b big">${esc(st.outlet.toUpperCase())}</div>
    <div class="c">${esc(st.branch)}<br>${esc(st.address)}<br>Telp ${esc(st.phone)}<br>NPWP ${esc(st.npwp)}</div>
    <div class="hr"></div>
    <div class="r"><span>${esc(s.no)}</span><span></span></div>
    <div class="r"><span>${fmtDate(s.t)} ${fmtTime(s.t)}</span><span>${esc(s.cashier.split(' ')[0])}</span></div>
    <div class="r"><span>${TYPE_LABEL[s.type]}${s.table ? ' · Meja ' + s.table : ''}</span><span>${esc(s.customer || '')}</span></div>
    <div class="hr"></div>
    ${s.items.map(l => `<div>${esc(l.name)}</div><div class="r"><span>&nbsp;&nbsp;${l.qty} x ${nf.format(l.price)}</span><span>${nf.format(l.qty * l.price)}</span></div>${l.note ? `<div>&nbsp;&nbsp;* ${esc(l.note)}</div>` : ''}`).join('')}
    <div class="hr"></div>
    <div class="r"><span>Subtotal</span><span>${nf.format(s.sub)}</span></div>
    ${s.disc ? `<div class="r"><span>Diskon ${s.discPct}%</span><span>-${nf.format(s.disc)}</span></div>` : ''}
    ${s.svc ? `<div class="r"><span>Service ${S.settings.serviceRate}%</span><span>${nf.format(s.svc)}</span></div>` : ''}
    <div class="r"><span>PB1 ${S.settings.taxRate}%</span><span>${nf.format(s.tax)}</span></div>
    <div class="r b big"><span>TOTAL</span><span>${nf.format(s.total)}</span></div>
    <div class="hr"></div>
    <div class="r"><span>${esc(payName(s.method))}</span><span>${nf.format(s.paid)}</span></div>
    ${s.change ? `<div class="r"><span>Kembali</span><span>${nf.format(s.change)}</span></div>` : ''}
    <div class="hr"></div>
    <div class="c">${esc(st.footer)}</div>
  </div>`;
}
function showReceipt(s, fresh) {
  const isVoid = s.status === 'void';
  openModal({
    title: fresh ? 'Pembayaran berhasil' : 'Detail transaksi ' + esc(s.no), size: 'sm',
    body: `${fresh ? `<div class="change"><span>${s.change ? 'Kembalian' : 'Lunas'}</span><span>${rp(s.change || s.total)}</span></div>` : ''}
      ${isVoid ? `<div class="alert bad">${icon('ban', 16)}<div><b>Transaksi di-void</b> (${esc(s.voidNo)}) oleh ${esc(s.voidBy)} pada ${fmtDT(s.voidAt)}. Alasan: ${esc(s.voidReason)}. Stok dan jurnal sudah dibalik.</div></div>` : ''}
      ${s.discBy ? `<div class="muted" style="font-size:12px">Diskon ${s.discPct}% disetujui ${esc(s.discBy)}</div>` : ''}
      <div style="background:var(--surface-3);padding:16px;border-radius:10px">${receiptHTML(s)}</div>
      <div class="muted" style="font-size:12px">HPP transaksi ini ${rp(s.cogs)} · food cost ${pct(s.net ? s.cogs / s.net * 100 : 0)}</div>`,
    foot: `${!fresh && !isVoid && canView('penjualan') ? `<button class="btn btn-danger" data-act="sale-void" data-no="${esc(s.no)}">${icon('ban', 16)} Void</button><span class="spacer"></span>` : ''}<button class="btn" data-act="receipt-print">${icon('printer', 16)} Cetak struk</button>${fresh ? `<button class="btn btn-primary" data-act="modal-close">${icon('plus', 16)} Transaksi baru</button>` : `<button class="btn btn-primary" data-act="modal-close">Tutup</button>`}`,
  });
}
ACT['receipt-print'] = () => toast('Struk dikirim ke printer kasir (simulasi).', 'printer');

/* =========================== MEJA =========================== */
VIEWS.meja = () => {
  const areas = ['Semua', ...new Set(S.tables.map(t => t.area))];
  const list = S.tables.filter(t => UI.meja.area === 'Semua' || t.area === UI.meja.area);
  const cnt = s => S.tables.filter(t => t.status === s).length;
  const others = S.bills.filter(b => !b.table);
  const openVal = sumBy(S.bills, b => calcBill(b.items, b.type, b.discPct).total);
  return `
  <div class="strip">
    <div><div class="s-l">Meja kosong</div><div class="s-v">${cnt('kosong')}</div></div>
    <div><div class="s-l">Meja terisi</div><div class="s-v" style="color:var(--brand-text)">${cnt('terisi')}</div></div>
    <div><div class="s-l">Reservasi hari ini</div><div class="s-v" style="color:var(--gold-text)">${cnt('reservasi')}</div></div>
    <div><div class="s-l">Take away / online aktif</div><div class="s-v">${others.length}</div></div>
    <div><div class="s-l">Nilai bill terbuka</div><div class="s-v">${rp(openVal)}</div></div>
  </div>
  <div class="row between">
    <div class="chips">${areas.map(a => `<button type="button" class="chip ${UI.meja.area === a ? 'on' : ''}" data-act="meja-area" data-v="${a}">${a}</button>`).join('')}</div>
    <div class="row"><button class="btn btn-sm" data-act="resv-new">${icon('calendar', 14)} Tambah reservasi</button>
    <div class="legend"><span><i style="background:var(--line-strong)"></i>Kosong</span><span><i style="background:var(--brand)"></i>Terisi</span><span><i style="background:var(--gold)"></i>Reservasi</span></div></div>
  </div>
  <div class="tables">${list.map(t => {
    let info = '<span class="faint">Ketuk untuk buka bill</span>', st = '';
    if (t.status === 'terisi') {
      const b = S.bills.find(x => x.id === t.bill);
      const c = b ? calcBill(b.items, b.type, b.discPct) : { total: 0 };
      const mins = b ? Math.round((Date.now() - b.created) / 60000) : 0;
      info = `<div class="strong" style="font-weight:800">${rp(c.total)}</div><div class="muted">${b ? esc(b.customer || b.no) : ''} · ${mins} mnt</div>`;
      st = '<span class="pill brand">Terisi</span>';
    } else if (t.status === 'reservasi') {
      info = `<div style="font-weight:700">${esc(t.resv.name)}</div><div class="muted">${t.resv.time} · ${t.resv.pax} orang</div>`;
      st = '<span class="pill gold">Reservasi</span>';
    }
    return `<button type="button" class="tcard ${t.status}" data-act="table-open" data-no="${t.no}"><span class="tst">${st}</span><div class="tno">${t.no}</div><div class="tseat">${icon('users', 13)} ${t.seats} kursi · ${t.area}</div><div class="tinfo">${info}</div></button>`;
  }).join('')}</div>
  <div class="card">
    <div class="card-h"><h3>Pesanan take away &amp; online aktif</h3><div class="right"><button class="btn btn-sm btn-primary" data-act="new-ta">${icon('plus', 14)} Pesanan take away</button></div></div>
    ${others.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>No. order</th><th>Tipe</th><th>Pelanggan</th><th>Dibuka</th><th class="num">Total</th><th></th></tr></thead><tbody>${others.map(b => `<tr><td class="mono">${esc(b.no)}</td><td>${TYPE_LABEL[b.type]}</td><td>${esc(b.customer)}</td><td>${fmtTime(b.created)}</td><td class="num strong">${rp(calcBill(b.items, b.type, b.discPct).total)}</td><td><button class="btn btn-sm" data-act="bill-load" data-id="${b.id}">Buka di kasir</button></td></tr>`).join('')}</tbody></table></div>` : emptyState('package', 'Tidak ada pesanan take away atau online yang terbuka.')}
  </div>`;
};
ACT['meja-area'] = el => { UI.meja.area = el.dataset.v; render(); };
ACT['resv-new'] = () => {
  const free = S.tables.filter(t => t.status === 'kosong');
  if (!free.length) { toast('Tidak ada meja kosong untuk direservasi.', 'triangle-alert'); return; }
  openModal({ title: 'Tambah reservasi', size: 'sm',
    body: `<div class="field"><label for="rv-name">Atas nama</label><input class="input" id="rv-name" autofocus></div>
      <div class="form-grid"><div class="field"><label for="rv-time">Jam</label><input class="input" id="rv-time" type="time" value="19:00"></div>
      <div class="field"><label for="rv-pax">Jumlah tamu</label><input class="input num" id="rv-pax" inputmode="numeric" value="2"></div></div>
      <div class="field"><label for="rv-table">Meja</label><select class="input" id="rv-table">${opts(free.map(t => [t.no, `Meja ${t.no} · ${t.area} · ${t.seats} kursi`]), free[0].no)}</select></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="resv-save">${icon('save', 16)} Simpan reservasi</button>` });
};
ACT['resv-save'] = () => {
  const name = document.getElementById('rv-name').value.trim(), time = document.getElementById('rv-time').value;
  const pax = +document.getElementById('rv-pax').value || 0, t = S.tables.find(x => x.no === +document.getElementById('rv-table').value);
  if (!name || !time || pax <= 0) { toast('Isi nama, jam, dan jumlah tamu.', 'triangle-alert'); return; }
  if (pax > t.seats) { toast(`Meja ${t.no} hanya ${t.seats} kursi.`, 'triangle-alert'); return; }
  t.status = 'reservasi'; t.resv = { name, time, pax };
  closeModal(true); refresh(); toast(`Reservasi ${name} di meja ${t.no} pukul ${time} disimpan.`, 'calendar');
};
ACT['new-ta'] = () => { UI.cart = newCart(); UI.cart.type = 'takeaway'; go('kasir'); };
ACT['table-open'] = el => {
  const t = S.tables.find(x => x.no === +el.dataset.no);
  if (t.status === 'terisi') { loadBill(t.bill); go('kasir'); return; }
  if (t.status === 'reservasi') {
    openModal({ title: `Meja ${t.no} · Reservasi`, size: 'sm',
      body: `<div class="stack"><div><div class="lbl">Atas nama</div><div style="font-weight:800;font-size:16px">${esc(t.resv.name)}</div></div><div class="row"><span class="pill gold">${t.resv.time}</span><span class="pill no-dot">${t.resv.pax} orang</span><span class="pill no-dot">${t.seats} kursi · ${t.area}</span></div></div>`,
      foot: `<button class="btn btn-danger" data-act="resv-cancel" data-no="${t.no}">Batalkan reservasi</button><button class="btn btn-primary" data-act="resv-arrive" data-no="${t.no}">Tamu datang · buka bill</button>` });
    return;
  }
  UI.cart = newCart(); UI.cart.table = t.no; go('kasir');
};
ACT['resv-cancel'] = el => { const t = S.tables.find(x => x.no === +el.dataset.no); t.status = 'kosong'; t.resv = null; closeModal(true); refresh(); toast('Reservasi dibatalkan.'); };
ACT['resv-arrive'] = el => { const t = S.tables.find(x => x.no === +el.dataset.no); UI.cart = newCart(); UI.cart.table = t.no; UI.cart.customer = t.resv.name; t.status = 'kosong'; t.resv = null; saveState(); closeModal(true); go('kasir'); };

/* =========================== LAYAR DAPUR =========================== */
VIEWS.dapur = () => {
  const cols = [['antri', 'Antrian', 'hourglass'], ['dimasak', 'Sedang dimasak', 'flame'], ['siap', 'Siap diantar', 'circle-check']];
  const active = S.kds.filter(k => k.status !== 'selesai');
  const oldest = active.length ? Math.max(...active.map(k => (Date.now() - k.created) / 60000)) : 0;
  const allDay = {};
  for (const k of active.filter(k => k.status !== 'siap')) for (const it of k.items) allDay[it.name] = (allDay[it.name] || 0) + it.qty;
  const ad = Object.entries(allDay).sort((a, b) => b[1] - a[1]);
  const ticket = k => {
    const mins = Math.floor((Date.now() - k.created) / 60000);
    const cls = mins >= 20 ? 'bad' : mins >= 10 ? 'warn' : '';
    const next = { antri: ['Mulai masak', 'flame'], dimasak: ['Tandai siap', 'circle-check'], siap: ['Sudah diantar', 'check'] }[k.status];
    return `<div class="ticket ${cls === 'bad' && k.status !== 'siap' ? 'late' : ''}">
      <div class="ticket-h"><div><b>${esc(k.where)}</b><div class="faint mono" style="font-size:11px">${esc(k.billNo)}</div></div><span class="timer ${k.status !== 'siap' ? cls : ''}">${icon('timer', 14)} ${mins} mnt</span></div>
      <ul>${k.items.map(it => `<li><span class="q">${it.qty}×</span><span>${esc(it.name)}${it.note ? `<span class="nt">${esc(it.note)}</span>` : ''}</span></li>`).join('')}</ul>
      <div class="ticket-f"><button class="btn btn-sm ${k.status === 'siap' ? '' : 'btn-primary'}" style="flex:1" data-act="kds-next" data-id="${k.id}">${icon(next[1], 14)} ${next[0]}</button></div></div>`;
  };
  return `
  <div class="strip">
    <div><div class="s-l">Tiket aktif</div><div class="s-v">${active.length}</div></div>
    <div><div class="s-l">Porsi belum selesai</div><div class="s-v">${ad.reduce((s, x) => s + x[1], 0)}</div></div>
    <div><div class="s-l">Tiket terlama</div><div class="s-v" style="color:${oldest >= 20 ? 'var(--bad)' : 'inherit'}">${Math.floor(oldest)} mnt</div></div>
    <div><div class="s-l">Target waktu saji</div><div class="s-v">15 mnt</div></div>
  </div>
  <div class="grid" style="grid-template-columns:minmax(0,1fr) 260px;align-items:start" id="kds-wrap">
    <div class="kds">${cols.map(([st, label, ic]) => {
      const list = S.kds.filter(k => k.status === st).sort((a, b) => a.created - b.created);
      return `<div class="kcol"><div class="kcol-h">${icon(ic, 16)} ${label}<span class="n">${list.length}</span></div>${list.map(ticket).join('') || '<div class="faint" style="padding:12px;text-align:center;font-size:12.5px">Kosong</div>'}</div>`;
    }).join('')}</div>
    <div class="card"><div class="card-h"><h3>Total per menu</h3><span class="sub">antrian + dimasak</span></div>
      <div>${ad.length ? ad.map(([n, q]) => `<div class="li"><div class="grow t">${esc(n)}</div><div class="num" style="font-weight:800;font-size:16px">${q}</div></div>`).join('') : emptyState('chef-hat', 'Dapur sedang kosong.')}</div></div>
  </div>`;
};
VIEWS.dapur.after = () => {
  const w = document.getElementById('kds-wrap');
  if (w && window.innerWidth < 1080) w.style.gridTemplateColumns = 'minmax(0,1fr)';
};
ACT['kds-next'] = el => {
  const k = S.kds.find(x => x.id === el.dataset.id);
  const flow = { antri: 'dimasak', dimasak: 'siap', siap: 'selesai' };
  k.status = flow[k.status];
  if (k.status === 'selesai') S.kds = S.kds.filter(x => x !== k);
  refresh(); paintChrome();
  toast(k.status === 'dimasak' ? `${k.where}: mulai dimasak` : k.status === 'siap' ? `${k.where}: siap diantar` : `${k.where}: sudah diantar`, 'chef-hat');
};

/* =========================== RIWAYAT PENJUALAN =========================== */
VIEWS.penjualan = () => {
  const f = UI.sales;
  const q = f.q.trim().toLowerCase();
  const mine = !can('penjualan.semua');
  const all = salesAllIn(range(f.period)).filter(s => (!mine || s.cashier === currentUser().name) && (f.method === 'all' || s.method === f.method) && (f.type === 'all' || s.type === f.type) && (!q || s.no.toLowerCase().includes(q) || (s.customer || '').toLowerCase().includes(q))).reverse();
  const list = all.filter(s => s.status !== 'void');
  const voids = all.length - list.length;
  const per = 25, pages = Math.max(1, Math.ceil(all.length / per));
  f.page = Math.min(f.page, pages - 1);
  const rows = all.slice(f.page * per, f.page * per + per);
  return `
  <div class="row between">
    ${periodSeg(f.period, 'sales-period', ['today', 'yesterday', '7d', '30d'])}
    <div class="row">
      <div class="search"><span>${icon('search', 16)}</span><input class="input" style="width:220px" placeholder="No. invoice / pelanggan" value="${esc(f.q)}" data-ch="sales-q" aria-label="Cari transaksi"></div>
      <select class="input" style="width:auto" data-ch="sales-method" aria-label="Metode">${opts([['all', 'Semua metode'], ...PAY_METHODS.map(p => [p.id, p.name])], f.method)}</select>
      <select class="input" style="width:auto" data-ch="sales-type" aria-label="Tipe">${opts([['all', 'Semua tipe'], ['dinein', 'Dine-in'], ['takeaway', 'Take away'], ['online', 'Online']], f.type)}</select>
    </div>
  </div>
  ${mine ? `<div class="alert info">${icon('user', 16)}<div>Menampilkan transaksi yang Anda proses saja. Transaksi kasir lain hanya bisa dilihat manajer, akuntan, atau pemilik.</div></div>` : ''}
  <div class="strip">
    <div><div class="s-l">Transaksi sah</div><div class="s-v">${nf.format(list.length)}${voids ? ` <span class="faint" style="font-size:12px">+${voids} void</span>` : ''}</div></div>
    <div><div class="s-l">Penjualan kotor</div><div class="s-v">${rp(sumBy(list, s => s.sub))}</div></div>
    <div><div class="s-l">Diskon</div><div class="s-v">${rp(sumBy(list, s => s.disc))}</div></div>
    <div><div class="s-l">Service + PB1</div><div class="s-v">${rp(sumBy(list, s => s.svc + s.tax))}</div></div>
    <div><div class="s-l">Total diterima</div><div class="s-v" style="color:var(--brand-text)">${rp(sumBy(list, s => s.total))}</div></div>
  </div>
  <div class="card">
    <div class="table-wrap"><table class="tbl"><thead><tr><th>No. invoice</th><th>Waktu</th><th>Tipe</th><th>Kasir</th><th class="num">Item</th><th>Metode</th><th class="num">Total</th><th class="num">HPP</th><th></th></tr></thead><tbody>
    ${rows.map(s => `<tr class="click" data-act="sale-view" data-no="${esc(s.no)}"><td class="mono">${esc(s.no)}</td><td>${fmtDT(s.t)}</td><td>${TYPE_LABEL[s.type]}${s.table ? ` <span class="faint">· M${s.table}</span>` : ''}</td><td>${esc(s.cashier)}</td><td class="num">${s.items.reduce((a, l) => a + l.qty, 0)}</td><td>${esc(payName(s.method))}</td><td class="num strong" ${s.status === 'void' ? 'style="text-decoration:line-through;color:var(--ink-400)"' : ''}>${rp(s.total)}</td><td class="num muted">${s.status === 'void' ? '<span class="pill bad">Void</span>' : rp(s.cogs)}</td><td>${icon('chevron-right', 16)}</td></tr>`).join('') || `<tr><td colspan="9">${emptyState('receipt', 'Tidak ada transaksi pada filter ini.')}</td></tr>`}
    </tbody></table></div>
    <div class="card-h" style="border-top:1px solid var(--line);border-bottom:0"><span class="sub">Halaman ${f.page + 1} dari ${pages}</span><div class="right"><button class="btn btn-sm" data-act="sales-page" data-v="-1" ${f.page === 0 ? 'disabled' : ''}>${icon('chevron-left', 14)} Sebelumnya</button><button class="btn btn-sm" data-act="sales-page" data-v="1" ${f.page >= pages - 1 ? 'disabled' : ''}>Berikutnya ${icon('chevron-right', 14)}</button></div></div>
  </div>`;
};
ACT['sales-period'] = el => { UI.sales.period = el.dataset.v; UI.sales.page = 0; render(); };
ACT['sales-method'] = el => { UI.sales.method = el.value; UI.sales.page = 0; render(); };
ACT['sales-type'] = el => { UI.sales.type = el.value; UI.sales.page = 0; render(); };
ACT['sales-q'] = el => { UI.sales.q = el.value; UI.sales.page = 0; render(); };
ACT['sales-page'] = el => { UI.sales.page += +el.dataset.v; render(); };
ACT['sale-view'] = el => showReceipt(S.sales.find(s => s.no === el.dataset.no));
ACT['sale-void'] = el => {
  const sale = S.sales.find(s => s.no === el.dataset.no);
  openModal({ title: 'Void ' + esc(sale.no), size: 'sm',
    body: `<div>Transaksi senilai <b>${rp(sale.total)}</b> (${esc(payName(sale.method))}) akan dibatalkan:</div>
      <ul style="margin:0;padding-left:18px;color:var(--ink-700)"><li>stok bahan dikembalikan sesuai resep</li><li>jurnal penjualan, PBJT, dan HPP dibalik</li><li>dana ${sale.method === 'tunai' ? 'dikembalikan dari kas' : 'dikembalikan lewat bank'} ke pelanggan</li></ul>
      <div class="field"><label for="sv-reason">Alasan void</label><input class="input" id="sv-reason" placeholder="mis. Salah input menu" autofocus></div>`,
    foot: `<button class="btn" data-act="sale-view" data-no="${esc(sale.no)}">Kembali</button><button class="btn btn-primary" data-act="sale-void-ok" data-no="${esc(sale.no)}">${icon('ban', 16)} Void transaksi</button>` });
};
ACT['sale-void-ok'] = el => {
  const sale = S.sales.find(s => s.no === el.dataset.no);
  const reason = document.getElementById('sv-reason').value.trim();
  if (!reason) { toast('Isi alasan void.', 'triangle-alert'); return; }
  withApproval('penjualan.void', 'Persetujuan void ' + sale.no, 'Void transaksi memerlukan izin manajer.', u => {
    const no = voidSale(Date.now(), sale, reason, u.name);
    audit('Void transaksi', `${sale.no} (${rp(sale.total)}): ${reason}${u.id !== currentUser().id ? ' · disetujui ' + u.name : ''}`);
    refresh(); showReceipt(sale);
    toast(`${sale.no} di-void (${no}). Stok & jurnal dibalik.`, 'ban');
  });
};
