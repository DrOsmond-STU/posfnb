/* =========================================================================
   Racik POS — Kas & Biaya, Laporan Penjualan, Laporan Keuangan,
   Laporan Persediaan, Pengaturan
   ========================================================================= */

/* =========================== KAS & BIAYA =========================== */
VIEWS.kas = () => {
  const r = range(UI.kas.period);
  const exp = S.expenses.filter(e => inRange(e.t, r)).slice().reverse();
  const byAcc = {};
  exp.forEach(e => { byAcc[e.acc] = (byAcc[e.acc] || 0) + e.amount; });
  return `
  <div class="grid g-4">
    ${kpi('banknote', 'Saldo kas outlet', rp(accBalance('1-101')), 'Uang tunai di laci kasir & brankas')}
    ${kpi('landmark', 'Saldo Bank BCA', rp(accBalance('1-102')), 'Termasuk settlement QRIS, EDC & ojol', true)}
    ${kpi('wallet', 'Beban operasional', rp(sumBy(exp, e => e.amount)), PERIODS[UI.kas.period])}
    ${kpi('percent', 'PB1 belum disetor', rp(accBalance('2-102')), 'Disetor ke Bapenda paling lambat tgl 10', true)}
  </div>
  <div class="row between">${periodSeg(UI.kas.period, 'kas-period', ['7d', '30d', 'month'])}
    <div class="row"><button class="btn" data-act="cash-deposit">${icon('landmark', 16)} Setor kas ke bank</button><button class="btn" data-act="tax-pay">${icon('file-text', 16)} Setor PB1</button><button class="btn btn-primary" data-act="exp-new">${icon('plus', 16)} Catat biaya</button></div></div>
  <div class="grid g-main" style="align-items:start">
    <div class="card"><div class="card-h"><h3>Bukti kas keluar (biaya operasional)</h3></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>No. BKK</th><th>Tanggal</th><th>Akun</th><th>Keterangan</th><th>Dari</th><th class="num">Jumlah</th></tr></thead><tbody>
      ${exp.map(e => `<tr><td class="mono">${esc(e.no)}</td><td>${fmtDate(e.t)}</td><td>${esc(accName(e.acc))}</td><td>${esc(e.desc)}</td><td>${e.method === 'tunai' ? 'Kas' : 'Bank'}</td><td class="num strong">${rp(e.amount)}</td></tr>`).join('') || `<tr><td colspan="6">${emptyState('wallet', 'Belum ada biaya di periode ini.')}</td></tr>`}
      </tbody></table></div></div>
    <div class="card"><div class="card-h"><h3>Komposisi biaya</h3><span class="sub">${PERIODS[UI.kas.period]}</span></div>
      <div class="card-b">${Object.keys(byAcc).length ? hbars(Object.entries(byAcc).sort((a, b) => b[1] - a[1]).map(([a, v]) => ({ label: accName(a).replace('Beban ', ''), value: v })), { cls: 'gold' }) : emptyState('chart-pie', 'Tidak ada data.')}</div></div>
  </div>`;
};
ACT['kas-period'] = el => { UI.kas.period = el.dataset.v; render(); };
ACT['exp-new'] = () => {
  openModal({ title: 'Catat biaya operasional',
    body: `<div class="form-grid">
      <div class="field"><label for="ex-acc">Akun biaya</label><select class="input" id="ex-acc">${opts(EXPENSE_ACCOUNTS.map(a => [a.code, a.code + ' · ' + a.name]), '6-106')}</select></div>
      <div class="field"><label for="ex-m">Dibayar dari</label><select class="input" id="ex-m">${opts([['tunai', 'Kas outlet'], ['transfer', 'Bank BCA']], 'tunai')}</select></div>
      <div class="field full"><label for="ex-desc">Keterangan</label><input class="input" id="ex-desc" placeholder="mis. Servis kompresor chiller" autofocus></div>
      <div class="field"><label for="ex-amt">Jumlah (Rp)</label><input class="input num" id="ex-amt" inputmode="numeric"></div>
      <div class="field"><label for="ex-att">Lampiran nota</label><input class="input" id="ex-att" type="file" accept="image/*,application/pdf" style="padding-top:6px"></div></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="exp-save">${icon('save', 16)} Simpan</button>` });
};
ACT['exp-save'] = () => {
  const amt = +document.getElementById('ex-amt').value.replace(/\D/g, '') || 0;
  const desc = document.getElementById('ex-desc').value.trim();
  if (!desc || amt <= 0) { toast('Isi keterangan dan jumlah biaya.', 'triangle-alert'); return; }
  recordExpense(Date.now(), document.getElementById('ex-acc').value, desc, amt, document.getElementById('ex-m').value);
  closeModal(true); refresh(); toast('Biaya dicatat dan dijurnal otomatis.');
};
ACT['cash-deposit'] = () => {
  const bal = accBalance('1-101');
  openModal({ title: 'Setor kas ke bank', size: 'sm',
    body: `<div class="sumline"><span>Saldo kas outlet</span><span class="strong">${rp(bal)}</span></div>
      <div class="field"><label for="cd-amt">Jumlah disetor</label><input class="input num" id="cd-amt" inputmode="numeric" value="${Math.max(0, bal - 1000000)}" autofocus></div>
      <div class="faint" style="font-size:12px">Saran: sisakan Rp 1.000.000 sebagai modal kembalian kasir.</div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="cd-save">Setor</button>` });
};
ACT['cd-save'] = () => {
  const amt = +document.getElementById('cd-amt').value.replace(/\D/g, '') || 0;
  if (amt <= 0 || amt > accBalance('1-101')) { toast('Jumlah setoran tidak valid.', 'triangle-alert'); return; }
  const t = Date.now();
  postJournal(t, 'STR-' + ymd(t) + '-' + pad(S.journals.length % 100), 'Setor kas ke Bank BCA', 'transfer', [{ acc: '1-102', d: amt }, { acc: '1-101', c: amt }]);
  closeModal(true); refresh(); toast(`Setoran ${rp(amt)} ke Bank BCA dicatat.`, 'landmark');
};
ACT['tax-pay'] = () => {
  const bal = accBalance('2-102');
  if (bal <= 0) { toast('Tidak ada PB1 terutang.', 'check'); return; }
  openModal({ title: 'Setor PB1 (Pajak Restoran)', size: 'sm',
    body: `<div class="sumline"><span>PB1 terutang</span><span class="strong">${rp(bal)}</span></div>
      <div class="alert info">${icon('file-text', 16)}<div>Pembayaran lewat e-SPTPD / kode bayar Bapenda DKI dari rekening Bank BCA.</div></div>`,
    foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="tax-save">Setor ${rp(bal)}</button>` });
};
ACT['tax-save'] = () => {
  const bal = accBalance('2-102'), t = Date.now();
  postJournal(t, nextNo('BKK', t), 'Setor PB1 ke Bapenda DKI', 'tax', [{ acc: '2-102', d: bal }, { acc: '1-102', c: bal }]);
  closeModal(true); refresh(); toast('Setoran PB1 dicatat.');
};

/* =========================== LAPORAN PENJUALAN =========================== */
VIEWS['lap-penjualan'] = () => {
  const r = range(UI.rsales.period);
  const list = salesIn(r);
  const gross = sumBy(list, s => s.sub), disc = sumBy(list, s => s.disc), net = sumBy(list, s => s.net);
  const svc = sumBy(list, s => s.svc), tax = sumBy(list, s => s.tax), cogs = sumBy(list, s => s.cogs);

  // harian
  const days = [];
  const from = startOfDay(r.from), to = startOfDay(Math.min(r.to, Date.now()));
  for (let t = from; t <= to; t += DAY) {
    const l = list.filter(s => s.t >= t && s.t < t + DAY);
    days.push({ label: new Date(t).getDate() + '/' + (new Date(t).getMonth() + 1), value: sumBy(l, s => s.net), tip: `<b>${fmtDay(t)}</b><br>${rp(sumBy(l, s => s.net))} · ${l.length} transaksi` });
  }
  // per jam
  const hours = [];
  for (let h = 10; h <= 21; h++) {
    const l = list.filter(s => new Date(s.t).getHours() === h);
    hours.push({ label: pad(h) + '', value: sumBy(l, s => s.net), tip: `<b>${pad(h)}:00–${pad(h)}:59</b><br>${rp(sumBy(l, s => s.net))} · ${l.length} transaksi` });
  }
  const peak = hours.reduce((a, b) => (b.value > a.value ? b : a), hours[0]);
  peak.hi = true;
  // metode & tipe
  const byPay = PAY_METHODS.map(p => ({ p, v: sumBy(list.filter(s => s.method === p.id), s => s.total), n: list.filter(s => s.method === p.id).length }));
  const payTot = sumBy(byPay, x => x.v) || 1;
  const payColors = ['var(--brand-700)', 'var(--brand-400)', 'var(--ink-500)', 'var(--border-200)'];
  const byType = ['dinein', 'takeaway', 'online'].map(k => ({ label: TYPE_LABEL[k], value: sumBy(list.filter(s => s.type === k), s => s.net), sub: list.filter(s => s.type === k).length + ' trx' }));
  // per menu + menu engineering
  const mm = {};
  for (const s of list) for (const l of s.items) {
    const m = mm[l.mid] || (mm[l.mid] = { mid: l.mid, name: l.name, cat: l.cat, qty: 0, rev: 0, cost: 0 });
    m.qty += l.qty; m.rev += l.qty * l.price; m.cost += l.qty * l.cost;
  }
  const rows = Object.values(mm).sort((a, b) => b.rev - a.rev);
  const totQty = sumBy(rows, x => x.qty) || 1, totRev = sumBy(rows, x => x.rev) || 1;
  const popLine = 0.7 / (rows.length || 1);
  const avgCM = sumBy(rows, x => x.rev - x.cost) / totQty;
  rows.forEach(x => {
    const hiPop = x.qty / totQty >= popLine, hiCM = (x.rev - x.cost) / x.qty >= avgCM;
    x.cls = hiPop && hiCM ? 'Star' : hiPop ? 'Plowhorse' : hiCM ? 'Puzzle' : 'Dog';
  });
  const ME = {
    Star: ['ok', 'Laris & untung tinggi', 'Pertahankan kualitas dan posisi di menu.'],
    Plowhorse: ['gold', 'Laris, untung rendah', 'Tinjau takaran atau naikkan harga sedikit.'],
    Puzzle: ['info', 'Untung tinggi, kurang laku', 'Promosikan, ubah nama atau posisi di menu.'],
    Dog: ['bad', 'Kurang laku & untung rendah', 'Pertimbangkan ganti resep atau hapus.'],
  };
  return `
  <div class="row between">${periodSeg(UI.rsales.period, 'rs-period', ['today', '7d', '30d', 'month'])}<button class="btn" data-act="export">${icon('download', 16)} Ekspor Excel</button></div>
  <div class="strip">
    <div><div class="s-l">Penjualan kotor</div><div class="s-v">${rp(gross)}</div></div>
    <div><div class="s-l">Diskon</div><div class="s-v neg" style="color:var(--bad)">−${rp(disc)}</div></div>
    <div><div class="s-l">Penjualan bersih</div><div class="s-v" style="color:var(--brand-text)">${rp(net)}</div></div>
    <div><div class="s-l">Service charge</div><div class="s-v">${rp(svc)}</div></div>
    <div><div class="s-l">PB1 dipungut</div><div class="s-v">${rp(tax)}</div></div>
    <div><div class="s-l">Transaksi · rata-rata</div><div class="s-v">${nf.format(list.length)} · ${rpShort(list.length ? net / list.length : 0)}</div></div>
    <div><div class="s-l">Food cost (HPP teoritis)</div><div class="s-v">${pct(net ? cogs / net * 100 : 0)}</div></div>
  </div>
  <div class="grid g-2">
    <div class="card"><div class="card-h"><div><h3>Penjualan bersih per hari</h3><div class="sub">${days.length} hari</div></div></div><div class="card-b">${barChart(days, { label: 'Penjualan harian', height: 220 })}</div></div>
    <div class="card"><div class="card-h"><div><h3>Penjualan per jam</h3><div class="sub">Jam tersibuk ${peak.label}:00 · atur jadwal staf mengikuti puncak ini</div></div></div><div class="card-b">${barChart(hours, { label: 'Penjualan per jam', height: 220, cls: 'gold' })}</div></div>
  </div>
  <div class="grid g-2">
    <div class="card"><div class="card-h"><h3>Metode pembayaran</h3><span class="sub">total diterima</span></div><div class="card-b stack">
      <div class="share">${byPay.map((x, i) => `<span style="width:${x.v / payTot * 100}%;background:${payColors[i]}" data-tip="<b>${x.p.name}</b><br>${rp(x.v)} · ${pct(x.v / payTot * 100)}"></span>`).join('')}</div>
      <table class="tbl"><tbody>${byPay.map((x, i) => `<tr><td><span class="legend"><span><i style="background:${payColors[i]}"></i>${x.p.name}</span></span></td><td class="num">${x.n} trx</td><td class="num">${pct(x.v / payTot * 100)}</td><td class="num strong">${rp(x.v)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="card"><div class="card-h"><h3>Tipe pesanan</h3><span class="sub">penjualan bersih</span></div><div class="card-b">${hbars(byType)}</div></div>
  </div>
  <div class="card"><div class="card-h"><div><h3>Menu engineering</h3><div class="sub">Popularitas (≥ 70% rata-rata porsi) × margin kontribusi per porsi (≥ rata-rata ${rp(avgCM)})</div></div></div>
    <div class="card-b"><div class="matrix">${['Star', 'Puzzle', 'Plowhorse', 'Dog'].map(k => `<div class="mx"><h4><span class="pill ${ME[k][0]} no-dot">${k}</span>${ME[k][1]}</h4><p>${ME[k][2]}</p><div class="items">${rows.filter(x => x.cls === k).map(x => `<span>${esc(x.name)}</span>`).join('') || '<span class="faint" style="border:0;background:none">—</span>'}</div></div>`).join('')}</div></div></div>
  <div class="card"><div class="card-h"><h3>Penjualan per menu</h3></div><div class="table-wrap"><table class="tbl"><thead><tr><th>Menu</th><th>Kategori</th><th class="num">Porsi</th><th class="num">Penjualan</th><th class="num">Kontribusi</th><th class="num">HPP</th><th class="num">Laba kotor</th><th class="num">Food cost</th><th>Klasifikasi</th></tr></thead><tbody>
    ${rows.map(x => `<tr><td class="strong">${esc(x.name)}</td><td>${x.cat}</td><td class="num">${nf.format(x.qty)}</td><td class="num">${rp(x.rev)}</td><td class="num">${pct(x.rev / totRev * 100)}</td><td class="num muted">${rp(x.cost)}</td><td class="num strong">${rp(x.rev - x.cost)}</td><td class="num">${fcPill(x.rev ? x.cost / x.rev * 100 : 0)}</td><td><span class="pill ${ME[x.cls][0]} no-dot">${x.cls}</span></td></tr>`).join('')}
  </tbody><tfoot><tr><td colspan="2">Total</td><td class="num">${nf.format(totQty)}</td><td class="num">${rp(sumBy(rows, x => x.rev))}</td><td class="num">100%</td><td class="num">${rp(sumBy(rows, x => x.cost))}</td><td class="num">${rp(sumBy(rows, x => x.rev - x.cost))}</td><td colspan="2"></td></tr></tfoot></table></div></div>`;
};
VIEWS['lap-penjualan'].after = el => bindTips(el);
ACT['rs-period'] = el => { UI.rsales.period = el.dataset.v; render(); };
ACT['export'] = () => toast('File laporan .xlsx disiapkan (simulasi purwarupa).', 'download');

/* =========================== LAPORAN KEUANGAN =========================== */
function sumAccs(codes, from, to) { return sumBy(codes, c => accBalance(c, from, to)); }
function plData(from, to) {
  const b = c => accBalance(c, from, to);
  const sales = b('4-101'), svc = b('4-102'), disc = b('4-103');
  const rev = sales + svc - disc;
  const hpp = b('5-101'), var_ = b('5-102');
  const cogs = hpp + var_;
  const gp = rev - cogs;
  const opex = EXPENSE_ACCOUNTS.map(a => ({ a, v: b(a.code) }));
  const opexT = sumBy(opex, x => x.v);
  return { sales, svc, disc, rev, hpp, var_, cogs, gp, opex, opexT, np: gp - opexT };
}
VIEWS['lap-keuangan'] = () => {
  const f = UI.rfin;
  const r = range(f.period);
  const tabs = [['lr', 'Laba Rugi'], ['neraca', 'Neraca'], ['kas', 'Arus Kas'], ['jurnal', 'Jurnal Umum'], ['bb', 'Buku Besar']];
  const line = (label, v, cls, pctOf) => `<tr class="${cls || ''}"><td class="${cls ? '' : 'indent'}">${label}</td><td class="num">${pctOf != null ? `<span class="faint">${pct(pctOf)}</span>` : ''}</td><td class="num ${v < 0 ? 'neg' : ''}">${rp(v)}</td></tr>`;
  let body = '';
  if (f.tab === 'lr') {
    const p = plData(r.from, r.to);
    const P = v => (p.rev ? v / p.rev * 100 : 0);
    body = `<div class="grid g-4">
      ${kpi('banknote', 'Pendapatan bersih', rp(p.rev), PERIODS[f.period])}
      ${kpi('percent', 'Laba kotor', rp(p.gp), `Margin ${pct(P(p.gp))}`, true)}
      ${kpi('wallet', 'Beban operasional', rp(p.opexT), `${pct(P(p.opexT))} dari pendapatan`)}
      ${kpi(p.np >= 0 ? 'trending-up' : 'trending-down', 'Laba bersih', rp(p.np), `Margin ${pct(P(p.np))}`, true)}</div>
      <div class="card"><div class="card-h"><div><h3>Laporan laba rugi</h3><div class="sub">${esc(S.settings.outlet)} · ${fmtDate(r.from)} – ${fmtDate(Math.min(r.to, Date.now()))}</div></div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Keterangan</th><th class="num">% pendapatan</th><th class="num">Jumlah</th></tr></thead><tbody>
      <tr class="group"><td colspan="3">PENDAPATAN</td></tr>
      ${line('4-101 Penjualan Makanan & Minuman', p.sales, '', P(p.sales))}
      ${line('4-102 Pendapatan Service Charge', p.svc, '', P(p.svc))}
      ${line('4-103 Diskon Penjualan', -p.disc, '', P(-p.disc))}
      ${line('Pendapatan bersih', p.rev, 'total', 100)}
      <tr class="group"><td colspan="3">HARGA POKOK PENJUALAN</td></tr>
      ${line('5-101 HPP Bahan Baku (sesuai resep)', -p.hpp, '', P(-p.hpp))}
      ${line('5-102 Selisih Persediaan & Bahan Rusak', -p.var_, '', P(-p.var_))}
      ${line('Total HPP', -p.cogs, 'total', P(-p.cogs))}
      ${line('LABA KOTOR', p.gp, 'total', P(p.gp))}
      <tr class="group"><td colspan="3">BEBAN OPERASIONAL</td></tr>
      ${p.opex.map(x => line(x.a.code + ' ' + x.a.name, -x.v, '', P(-x.v))).join('')}
      ${line('Total beban operasional', -p.opexT, 'total', P(-p.opexT))}
      <tr class="grand"><td>LABA BERSIH SEBELUM PAJAK PENGHASILAN</td><td class="num">${pct(P(p.np))}</td><td class="num">${rp(p.np)}</td></tr>
      </tbody></table></div></div>
      <div class="alert info">${icon('file-text', 16)}<div>PB1 (Pajak Restoran ${S.settings.taxRate}%) bukan pendapatan. PB1 dicatat sebagai <b>hutang pajak</b> dan disetor ke Bapenda setiap bulan.</div></div>`;
  } else if (f.tab === 'neraca') {
    const b = c => accBalance(c);
    const p = plData(null, null);
    const assets = [['1-101', b('1-101')], ['1-102', b('1-102')], ['1-104', b('1-104')]];
    const fixed = [['1-201', b('1-201')]];
    const liab = [['2-101', b('2-101')], ['2-102', b('2-102')]];
    const totA = sumBy([...assets, ...fixed], x => x[1]), totL = sumBy(liab, x => x[1]);
    const eq = b('3-101'), totE = eq + p.np;
    const bal = Math.abs(totA - totL - totE) < 2;
    const row = ([c, v]) => `<tr><td class="indent">${c} ${esc(accName(c))}</td><td class="num">${rp(v)}</td></tr>`;
    body = `<div class="row between"><div class="muted">Posisi per ${fmtDT(Date.now())}</div>${bal ? '<span class="pill ok">Seimbang: aset = kewajiban + ekuitas</span>' : '<span class="pill bad">Tidak seimbang</span>'}</div>
      <div class="grid g-2" style="align-items:start">
      <div class="card"><div class="card-h"><h3>Aset</h3></div><div class="table-wrap"><table class="tbl"><tbody>
        <tr class="group"><td colspan="2">Aset lancar</td></tr>${assets.map(row).join('')}
        <tr class="total"><td>Total aset lancar</td><td class="num">${rp(sumBy(assets, x => x[1]))}</td></tr>
        <tr class="group"><td colspan="2">Aset tetap</td></tr>${fixed.map(row).join('')}
        <tr class="grand"><td>TOTAL ASET</td><td class="num">${rp(totA)}</td></tr></tbody></table></div></div>
      <div class="card"><div class="card-h"><h3>Kewajiban &amp; ekuitas</h3></div><div class="table-wrap"><table class="tbl"><tbody>
        <tr class="group"><td colspan="2">Kewajiban jangka pendek</td></tr>${liab.map(row).join('')}
        <tr class="total"><td>Total kewajiban</td><td class="num">${rp(totL)}</td></tr>
        <tr class="group"><td colspan="2">Ekuitas</td></tr>${row(['3-101', eq])}
        <tr><td class="indent">Laba periode berjalan</td><td class="num">${rp(p.np)}</td></tr>
        <tr class="total"><td>Total ekuitas</td><td class="num">${rp(totE)}</td></tr>
        <tr class="grand"><td>TOTAL KEWAJIBAN &amp; EKUITAS</td><td class="num">${rp(totL + totE)}</td></tr></tbody></table></div></div></div>`;
  } else if (f.tab === 'kas') {
    const cash = ['1-101', '1-102'];
    const open = sumBy(cash, c => accBalance(c, null, r.from - 1));
    const cat = { sale: 'Penerimaan dari pelanggan', ap: 'Pembayaran ke pemasok', expense: 'Pembayaran beban operasional', tax: 'Setoran PB1 ke Bapenda', opening: 'Setoran modal pemilik' };
    const flows = {};
    for (const j of S.journals) {
      if (!inRange(j.t, r) || j.type === 'transfer') continue;
      const net = sumBy(j.lines.filter(l => cash.includes(l.acc)), l => l.d - l.c);
      if (!net) continue;
      const k = cat[j.type] || 'Lain-lain';
      flows[k] = (flows[k] || 0) + net;
    }
    const opKeys = ['Penerimaan dari pelanggan', 'Pembayaran ke pemasok', 'Pembayaran beban operasional', 'Setoran PB1 ke Bapenda'];
    const opT = sumBy(opKeys, k => flows[k] || 0);
    const finT = flows['Setoran modal pemilik'] || 0;
    const close = open + opT + finT;
    body = `<div class="card"><div class="card-h"><div><h3>Laporan arus kas (metode langsung)</h3><div class="sub">Kas outlet + Bank BCA · ${fmtDate(r.from)} – ${fmtDate(Math.min(r.to, Date.now()))}</div></div></div>
      <div class="table-wrap"><table class="tbl"><tbody>
      <tr class="group"><td colspan="2">ARUS KAS DARI AKTIVITAS OPERASI</td></tr>
      ${opKeys.map(k => `<tr><td class="indent">${k}</td><td class="num ${(flows[k] || 0) < 0 ? 'neg' : ''}">${rp(flows[k] || 0)}</td></tr>`).join('')}
      <tr class="total"><td>Kas bersih dari aktivitas operasi</td><td class="num">${rp(opT)}</td></tr>
      <tr class="group"><td colspan="2">ARUS KAS DARI AKTIVITAS PENDANAAN</td></tr>
      <tr><td class="indent">Setoran modal pemilik</td><td class="num">${rp(finT)}</td></tr>
      <tr class="total"><td>Kenaikan (penurunan) kas bersih</td><td class="num">${rp(opT + finT)}</td></tr>
      <tr><td>Saldo kas &amp; bank awal periode</td><td class="num">${rp(open)}</td></tr>
      <tr class="grand"><td>SALDO KAS &amp; BANK AKHIR PERIODE</td><td class="num">${rp(close)}</td></tr>
      </tbody></table></div></div>
      <div class="muted" style="font-size:12.5px">Setoran kas harian ke bank adalah pemindahan internal dan tidak mengubah total kas.</div>`;
  } else if (f.tab === 'jurnal') {
    const js = S.journals.filter(j => inRange(j.t, r)).slice().reverse();
    const per = 20, pages = Math.max(1, Math.ceil(js.length / per));
    f.jpage = Math.min(f.jpage, pages - 1);
    body = `<div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Referensi</th><th>Akun</th><th class="num">Debit</th><th class="num">Kredit</th></tr></thead><tbody>
      ${js.slice(f.jpage * per, f.jpage * per + per).map(j => `<tr class="group"><td>${fmtDT(j.t)}</td><td class="mono">${esc(j.ref)}</td><td colspan="3" style="font-weight:600">${esc(j.desc)}</td></tr>
        ${j.lines.map(l => `<tr><td></td><td></td><td class="${l.c ? 'indent' : ''}">${l.acc} ${esc(accName(l.acc))}</td><td class="num">${l.d ? rp(l.d) : ''}</td><td class="num">${l.c ? rp(l.c) : ''}</td></tr>`).join('')}`).join('') || `<tr><td colspan="5">${emptyState('file-text', 'Tidak ada jurnal.')}</td></tr>`}
      </tbody></table></div>
      <div class="card-h" style="border-top:1px solid var(--line);border-bottom:0"><span class="sub">${js.length} jurnal · halaman ${f.jpage + 1} dari ${pages}</span><div class="right"><button class="btn btn-sm" data-act="j-page" data-v="-1" ${f.jpage === 0 ? 'disabled' : ''}>${icon('chevron-left', 14)}</button><button class="btn btn-sm" data-act="j-page" data-v="1" ${f.jpage >= pages - 1 ? 'disabled' : ''}>${icon('chevron-right', 14)}</button></div></div></div>`;
  } else {
    const code = f.acc;
    const acc = ACCOUNTS.find(a => a.code === code);
    const dn = ['aset', 'hpp', 'beban'].includes(acc.type) || code === '4-103';
    let bal = accBalance(code, null, r.from - 1);
    const openBal = bal;
    const rows = [];
    for (const j of S.journals) {
      if (!inRange(j.t, r)) continue;
      for (const l of j.lines) if (l.acc === code) { bal += dn ? l.d - l.c : l.c - l.d; rows.push({ j, l, bal }); }
    }
    body = `<div class="row"><select class="input" style="width:320px" data-ch="bb-acc" aria-label="Pilih akun">${opts(ACCOUNTS.map(a => [a.code, a.code + ' · ' + a.name]), code)}</select><span class="muted">Saldo normal ${dn ? 'debit' : 'kredit'}</span></div>
      <div class="card"><div class="table-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Referensi</th><th>Keterangan</th><th class="num">Debit</th><th class="num">Kredit</th><th class="num">Saldo</th></tr></thead><tbody>
      <tr class="group"><td colspan="5">Saldo awal</td><td class="num">${rp(openBal)}</td></tr>
      ${rows.slice(-200).map(x => `<tr><td>${fmtDT(x.j.t)}</td><td class="mono">${esc(x.j.ref)}</td><td>${esc(x.j.desc)}</td><td class="num">${x.l.d ? rp(x.l.d) : ''}</td><td class="num">${x.l.c ? rp(x.l.c) : ''}</td><td class="num strong">${rp(x.bal)}</td></tr>`).join('')}
      <tr class="total"><td colspan="5">Saldo akhir</td><td class="num">${rp(bal)}</td></tr></tbody></table></div></div>`;
  }
  const showPeriod = f.tab !== 'neraca';
  return `<div class="tabs">${tabs.map(([k, l]) => `<button type="button" class="${f.tab === k ? 'on' : ''}" data-act="rf-tab" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="row between">${showPeriod ? periodSeg(f.period, 'rf-period', ['today', '7d', '30d', 'month']) : '<span></span>'}<button class="btn" data-act="export">${icon('download', 16)} Ekspor PDF / Excel</button></div>${body}`;
};
ACT['rf-tab'] = el => { UI.rfin.tab = el.dataset.v; render(); };
ACT['rf-period'] = el => { UI.rfin.period = el.dataset.v; UI.rfin.jpage = 0; render(); };
ACT['j-page'] = el => { UI.rfin.jpage += +el.dataset.v; render(); };
ACT['bb-acc'] = el => { UI.rfin.acc = el.value; render(); };

/* =========================== LAPORAN PERSEDIAAN =========================== */
VIEWS['lap-persediaan'] = () => {
  const r = range(UI.rinv.period);
  const rows = S.ingredients.map(i => {
    const mv = S.moves.filter(m => m.ing === i.id);
    const after = mv.filter(m => m.t >= r.from);
    const closeQ = i.stock, closeV = Math.max(0, i.stock) * i.avg;
    const openQ = closeQ - sumBy(after, m => m.qty), openV = closeV - sumBy(after, m => m.value);
    const inP = after.filter(m => m.t <= r.to);
    const g = t => ({ q: sumBy(inP.filter(m => m.type === t), m => m.qty), v: sumBy(inP.filter(m => m.type === t), m => m.value) });
    const buy = g('beli'), use = g('jual'), waste = g('waste'), adj = g('opname');
    return { i, openQ, openV, buy, use, waste, adj, closeQ, closeV };
  });
  const T = k => sumBy(rows, x => (k.includes('.') ? x[k.split('.')[0]][k.split('.')[1]] : x[k]));
  const days = Math.max(1, Math.round((Math.min(r.to, Date.now()) - r.from) / DAY));
  const avgInv = (T('openV') + T('closeV')) / 2;
  const usePerDay = -T('use.v') / days;
  const doh = usePerDay ? avgInv / usePerDay : 0;
  const topUse = rows.slice().sort((a, b) => a.use.v - b.use.v).slice(0, 8).map(x => ({ label: x.i.name, value: -x.use.v, sub: fmtQty(x.i, -x.use.q) }));
  const varPct = -T('use.v') ? (-(T('waste.v') + T('adj.v'))) / -T('use.v') * 100 : 0;
  return `
  <div class="row between">${periodSeg(UI.rinv.period, 'ri-period', ['7d', '30d', 'month'])}<button class="btn" data-act="export">${icon('download', 16)} Ekspor Excel</button></div>
  <div class="grid g-4">
    ${kpi('boxes', 'Nilai persediaan akhir', rp(T('closeV')), `Awal periode ${rp(T('openV'))}`)}
    ${kpi('truck', 'Pembelian diterima', rp(T('buy.v')), `${S.grns.filter(g => inRange(g.t, r)).length} dokumen penerimaan`, true)}
    ${kpi('utensils', 'Pemakaian (HPP resep)', rp(-T('use.v')), `Rata-rata ${rp(usePerDay)} / hari`)}
    ${kpi('hourglass', 'Hari persediaan', nf1.format(doh) + ' hari', `Selisih waste + opname ${pct(varPct)} dari pemakaian`, true)}
  </div>
  <div class="grid g-main" style="align-items:start">
    <div class="card"><div class="card-h"><div><h3>Mutasi persediaan per bahan</h3><div class="sub">Nilai dalam Rupiah · harga rata-rata tertimbang</div></div></div>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Bahan</th><th class="num">Saldo awal</th><th class="num">Pembelian</th><th class="num">Pemakaian</th><th class="num">Waste</th><th class="num">Opname</th><th class="num">Saldo akhir</th><th class="num">Nilai akhir</th></tr></thead><tbody>
      ${rows.map(x => `<tr><td><div class="strong">${esc(x.i.name)}</div><div class="sub">${x.i.id} · ${esc(x.i.cat)}</div></td>
        <td class="num">${fmtQty(x.i, x.openQ)}</td><td class="num pos">${x.buy.q ? fmtQty(x.i, x.buy.q) : '—'}</td><td class="num">${x.use.q ? fmtQty(x.i, -x.use.q) : '—'}</td>
        <td class="num ${x.waste.q ? 'neg' : ''}">${x.waste.q ? fmtQty(x.i, -x.waste.q) : '—'}</td><td class="num ${x.adj.q < 0 ? 'neg' : x.adj.q > 0 ? 'pos' : ''}">${x.adj.q ? fmtQty(x.i, x.adj.q) : '—'}</td>
        <td class="num strong">${fmtQty(x.i, x.closeQ)}</td><td class="num">${rp(x.closeV)}</td></tr>`).join('')}
      </tbody><tfoot><tr><td>Total nilai</td><td class="num">${rp(T('openV'))}</td><td class="num">${rp(T('buy.v'))}</td><td class="num">${rp(-T('use.v'))}</td><td class="num">${rp(-T('waste.v'))}</td><td class="num">${rp(T('adj.v'))}</td><td></td><td class="num">${rp(T('closeV'))}</td></tr></tfoot></table></div></div>
    <div class="stack">
      <div class="card"><div class="card-h"><h3>Pemakaian terbesar</h3><span class="sub">nilai</span></div><div class="card-b">${hbars(topUse)}</div></div>
      <div class="card"><div class="card-h"><h3>Rekonsiliasi nilai</h3></div><div class="card-b stack" style="gap:6px">
        <div class="sumline"><span>Saldo awal</span><span>${rp(T('openV'))}</span></div>
        <div class="sumline"><span>+ Pembelian</span><span>${rp(T('buy.v'))}</span></div>
        <div class="sumline"><span>− Pemakaian resep</span><span>${rp(T('use.v'))}</span></div>
        <div class="sumline"><span>− Bahan rusak</span><span>${rp(T('waste.v'))}</span></div>
        <div class="sumline"><span>± Selisih opname</span><span>${rp(T('adj.v'))}</span></div>
        <div class="sumline total" style="font-size:16px"><span>Saldo akhir</span><span>${rp(T('closeV'))}</span></div>
        <div class="faint" style="font-size:11.5px">Cocok dengan saldo akun 1-104 Persediaan Bahan Baku: ${rp(accBalance('1-104'))}</div></div></div>
    </div>
  </div>`;
};
ACT['ri-period'] = el => { UI.rinv.period = el.dataset.v; render(); };

/* =========================== PENGATURAN =========================== */
VIEWS.pengaturan = () => {
  const st = S.settings;
  return `
  <div class="grid g-2" style="align-items:start">
    <div class="card"><div class="card-h"><h3>Profil outlet</h3><span class="sub">tampil di struk</span></div><div class="card-b form-grid">
      <div class="field"><label for="st-outlet">Nama usaha</label><input class="input" id="st-outlet" value="${esc(st.outlet)}"></div>
      <div class="field"><label for="st-branch">Cabang</label><input class="input" id="st-branch" value="${esc(st.branch)}"></div>
      <div class="field full"><label for="st-address">Alamat</label><input class="input" id="st-address" value="${esc(st.address)}"></div>
      <div class="field"><label for="st-phone">Telepon</label><input class="input" id="st-phone" value="${esc(st.phone)}"></div>
      <div class="field"><label for="st-npwp">NPWP</label><input class="input" id="st-npwp" value="${esc(st.npwp)}"></div>
      <div class="field full"><label for="st-footer">Pesan kaki struk</label><input class="input" id="st-footer" value="${esc(st.footer)}"></div></div></div>
    <div class="stack">
      <div class="card"><div class="card-h"><h3>Pajak &amp; biaya layanan</h3></div><div class="card-b form-grid">
        <div class="field"><label for="st-tax">PB1 / Pajak Restoran (%)</label><input class="input num" id="st-tax" value="${st.taxRate}"></div>
        <div class="field"><label for="st-svc">Service charge (%)</label><input class="input num" id="st-svc" value="${st.serviceRate}"></div>
        <label class="switch full"><input type="checkbox" id="st-taxon" ${st.taxOn ? 'checked' : ''}> Pungut PB1 di setiap transaksi</label>
        <label class="switch full"><input type="checkbox" id="st-svcta" ${st.serviceTakeaway ? 'checked' : ''}> Kenakan service charge untuk take away</label></div></div>
      <div class="card"><div class="card-h"><h3>Target biaya</h3></div><div class="card-b form-grid">
        <div class="field"><label for="st-fc">Target food cost (%)</label><input class="input num" id="st-fc" value="${st.targetFC}"></div>
        <div class="field"><label class="lbl">Metode penilaian persediaan</label><input class="input" value="Rata-rata tertimbang (moving average)" disabled></div></div></div>
    </div>
  </div>
  <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" data-act="st-save">${icon('save', 16)} Simpan pengaturan</button></div>
  <div class="grid g-2" style="align-items:start">
    <div class="card"><div class="card-h"><h3>Pengguna &amp; hak akses</h3></div><div class="card-b stack">
      <div class="muted">${activeUsers().length} pengguna aktif dalam ${AUTH.roles.length} peran. Akun, PIN kasir, matriks izin, dan log aktivitas dikelola di menu tersendiri.</div>
      <div class="row">${AUTH.roles.map(r => rolePill(r.id)).join('')}</div>
      <div><button class="btn" data-act="go" data-to="pengguna">${icon('shield', 16)} Buka Pengguna &amp; Akses</button></div></div></div>
    <div class="stack">
      <div class="card"><div class="card-h"><h3>Metode pembayaran</h3></div><div>
        ${PAY_METHODS.map(p => `<div class="li">${icon(p.icon, 18)}<div class="grow"><div class="t">${p.name}</div><div class="s">Masuk ke akun ${p.acc} ${esc(accName(p.acc))}</div></div><label class="switch"><input type="checkbox" checked aria-label="Aktifkan ${p.name}"></label></div>`).join('')}</div></div>
      <div class="card"><div class="card-h"><h3>Perangkat</h3></div><div>
        <div class="li">${icon('printer', 18)}<div class="grow"><div class="t">Printer struk kasir</div><div class="s">Epson TM-T82X · USB · kertas 80 mm</div></div><span class="pill ok">Terhubung</span></div>
        <div class="li">${icon('chef-hat', 18)}<div class="grow"><div class="t">Printer dapur</div><div class="s">Xprinter XP-Q200 · LAN 192.168.1.40</div></div><span class="pill ok">Terhubung</span></div>
        <div class="li">${icon('credit-card', 18)}<div class="grow"><div class="t">Mesin EDC</div><div class="s">BCA · terminal 88120931</div></div><span class="pill warn">Belum dites hari ini</span></div></div></div>
      <div class="card"><div class="card-h"><h3>Data demo</h3></div><div class="card-b stack">
        <div class="muted">Data transaksi 30 hari dibuat otomatis dan disimpan di browser ini. Atur ulang untuk kembali ke kondisi awal.</div>
        <button class="btn btn-danger" data-act="reset-ask">${icon('refresh-cw', 16)} Atur ulang data demo</button></div></div>
    </div>
  </div>`;
};
ACT['st-save'] = () => {
  const v = id => document.getElementById(id).value.trim();
  const n = (id, d) => { const x = parseFloat(v(id).replace(',', '.')); return isNaN(x) ? d : x; };
  Object.assign(S.settings, {
    outlet: v('st-outlet'), branch: v('st-branch'), address: v('st-address'), phone: v('st-phone'), npwp: v('st-npwp'), footer: v('st-footer'),
    taxRate: n('st-tax', 10), serviceRate: n('st-svc', 5), targetFC: n('st-fc', 35),
    taxOn: document.getElementById('st-taxon').checked, serviceTakeaway: document.getElementById('st-svcta').checked,
  });
  refresh(); paintChrome(); toast('Pengaturan disimpan.');
};
ACT['reset-ask'] = () => openModal({ title: 'Atur ulang data demo?', size: 'sm',
  body: '<div>Semua transaksi, PO, dan perubahan resep yang Anda buat di purwarupa ini akan dihapus dan diganti data demo baru.</div>',
  foot: `<button class="btn" data-act="modal-close">Batal</button><button class="btn btn-primary" data-act="reset-do">${icon('refresh-cw', 16)} Atur ulang</button>` });
ACT['reset-do'] = () => { resetState(); UI.cart = newCart(); closeModal(true); render(); paintChrome(); toast('Data demo dibuat ulang.'); };

/* =========================== HERO PER HALAMAN ===========================
   Judul besar bergradasi di atas setiap halaman, mengikuti pola KG SafeGuard:
   eyebrow grup modul, judul, deskripsi, dan satu angka utama di kanan. */
VIEWS.kasir.compact = true;
VIEWS.dapur.compact = true;
VIEWS.dashboard.hero = () => {
  const net = sumBy(salesIn(range('today')), s => s.net);
  return {
    title: 'Halo, ' + S.session.manager.split(' ')[0],
    desc: fmtDay(Date.now()) + '. Ringkasan penjualan, stok, dan operasional ' + S.settings.outlet + ' hari ini.',
    metric: rpShort(net), label: 'Penjualan bersih hari ini',
    actions: (canView('lap-penjualan') ? `<button class="btn btn-onhero" data-act="go" data-to="lap-penjualan">${icon('chart-column', 16)} Laporan</button>` : '') + (canView('kasir') ? `<button class="btn btn-hero" data-act="go" data-to="kasir">${icon('shopping-cart', 16)} Buka Kasir</button>` : ''),
  };
};
VIEWS.kasir.hero = () => ({ metric: nf.format(salesIn(range('today')).length), label: 'Struk hari ini' });
VIEWS.meja.hero = () => ({ metric: S.tables.filter(t => t.status === 'terisi').length + '/' + S.tables.length, label: 'Meja terisi' });
VIEWS.dapur.hero = () => ({ metric: S.kds.filter(k => k.status !== 'selesai').length, label: 'Tiket aktif' });
VIEWS.penjualan.hero = () => {
  const mine = !can('penjualan.semua');
  const list = salesIn(range('today')).filter(s => !mine || s.cashier === currentUser().name);
  return { metric: rpShort(sumBy(list, s => s.total)), label: mine ? 'Diterima oleh Anda hari ini' : 'Diterima hari ini' };
};
VIEWS.menu.hero = () => {
  const act = S.menu.filter(m => m.active);
  return { metric: pct(sumBy(act, m => recipeCost(m) / m.price * 100) / (act.length || 1)), label: 'Rata-rata food cost' };
};
VIEWS.pembelian.hero = () => ({ metric: rpShort(sumBy(S.pos, poOutstanding)), label: 'Hutang pemasok' });
VIEWS.pemasok.hero = () => ({ metric: S.suppliers.length, label: 'Pemasok aktif' });
VIEWS.persediaan.hero = () => ({ metric: rpShort(sumBy(S.ingredients, i => Math.max(0, i.stock) * i.avg)), label: 'Nilai persediaan' });
VIEWS.kas.hero = () => ({ metric: rpShort(accBalance('1-101') + accBalance('1-102')), label: 'Kas + bank' });
VIEWS['lap-penjualan'].hero = () => ({ metric: rpShort(sumBy(salesIn(range(UI.rsales.period)), s => s.net)), label: 'Penjualan bersih · ' + PERIODS[UI.rsales.period] });
VIEWS['lap-keuangan'].hero = () => ({ metric: rpShort(plData(range('month').from, range('month').to).np), label: 'Laba bersih bulan ini' });
VIEWS['lap-persediaan'].hero = () => ({ metric: rpShort(accBalance('1-104')), label: 'Saldo akun persediaan' });
