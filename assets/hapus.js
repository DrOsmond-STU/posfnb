/* =========================================================================
   Racik POS — hapus data permanen (izin "data.hapus", bawaan: Pemilik)

   Dokumen dihapus beserta seluruh jejaknya (jurnal, mutasi stok, dan jurnal
   void/pembatalannya) seolah tidak pernah terjadi. Stok dan nilai persediaan
   dikoreksi dengan nilai yang sama persis dengan mutasi yang dihapus, sehingga
   neraca tetap seimbang, kartu stok tetap cocok dengan stok, dan akun
   persediaan tetap sama dengan nilai fisik.

   Setiap penghapusan dihitung dulu sebagai rencana (tanpa mengubah data) agar
   dampaknya bisa ditampilkan dan dicegah bila tidak sah, misalnya stok bahan
   akan menjadi minus karena barang dari penerimaan itu sudah terpakai.
   ========================================================================= */

const CASH_ACCS = ['1-101', '1-102'];
const payAcc = method => (PAY_METHODS.find(p => p.id === method) || PAY_METHODS[0]).acc;

function newPlan(label) {
  return {
    label, jRemove: new Set(), mRemove: new Set(), jEdit: [], mEdit: [], adj: {},
    cash: { '1-101': 0, '1-102': 0 }, effects: [], block: null, after: [],
  };
}
function addAdj(p, ing, dq, dv) {
  const a = p.adj[ing] || (p.adj[ing] = { qty: 0, value: 0 });
  a.qty += dq; a.value += dv;
}
/* hapus satu jurnal utuh */
function planRemoveJournal(p, j) {
  if (p.jRemove.has(j)) return;
  p.jRemove.add(j);
  for (const l of j.lines) if (CASH_ACCS.includes(l.acc)) p.cash[l.acc] -= (l.d - l.c);
}
/* hapus satu mutasi stok; stok berubah sebesar kebalikannya */
function planRemoveMove(p, m) {
  if (p.mRemove.has(m)) return;
  p.mRemove.add(m);
  addAdj(p, m.ing, -m.qty, -m.value);
}
/* kurangi sebagian baris jurnal rekap (lines bertanda sama dengan baris aslinya) */
function planEditJournal(p, j, lines) {
  p.jEdit.push([j, lines]);
  for (const l of lines) if (CASH_ACCS.includes(l.acc)) p.cash[l.acc] -= ((l.d || 0) - (l.c || 0));
}
/* ubah mutasi rekap sebesar (dq, dv); stok ikut berubah sebesar itu */
function planEditMove(p, m, dq, dv) {
  p.mEdit.push([m, dq, dv]);
  addAdj(p, m.ing, dq, dv);
}
/* cek akhir: stok tidak boleh minus, rekap harus cukup untuk dikurangi */
function planFinish(p) {
  if (p.block) return p;
  for (const id in p.adj) {
    const i = ingById(id);
    if (!i) continue;
    const after = i.stock + p.adj[id].qty;
    if (after < -1e-6) {
      p.block = `Stok ${i.name} tinggal ${fmtQty(i, i.stock)}, sedangkan penghapusan ini mengurangi ${fmtQty(i, -p.adj[id].qty)}. Barangnya sudah terpakai, jadi data ini tidak bisa dihapus tanpa membuat stok minus. Catat stok opname atau hapus transaksi pemakaiannya lebih dulu.`;
      return p;
    }
  }
  for (const [j, lines] of p.jEdit) {
    for (const l of lines) {
      const cur = j.lines.find(x => x.acc === l.acc);
      const need = (l.d || 0) + (l.c || 0);
      if (need && (!cur || (l.d ? cur.d : cur.c) < need)) { p.block = `Jurnal rekap ${j.ref} tidak cocok dengan transaksi ini; penghapusan dibatalkan agar pembukuan tidak rusak.`; return p; }
    }
  }
  return p;
}
function applyPlan(p) {
  if (p.block) throw new Error(p.block);
  for (const [j, lines] of p.jEdit) {
    for (const l of lines) {
      const cur = j.lines.find(x => x.acc === l.acc);
      if (cur) { cur.d -= l.d || 0; cur.c -= l.c || 0; }
    }
    j.lines = j.lines.filter(l => l.d || l.c);
    if (!j.lines.length) p.jRemove.add(j);
  }
  for (const [m, dq, dv] of p.mEdit) {
    m.qty += dq; m.value = Math.round(m.value + dv);
    if (Math.abs(m.qty) < 1e-9 && Math.abs(m.value) < 1) p.mRemove.add(m);
  }
  S.journals = S.journals.filter(j => !p.jRemove.has(j));
  S.moves = S.moves.filter(m => !p.mRemove.has(m));
  for (const id in p.adj) {
    const i = ingById(id); if (!i) continue;
    const val = Math.max(0, i.stock) * i.avg + p.adj[id].value;
    i.stock += p.adj[id].qty;
    if (Math.abs(i.stock) < 1e-6) i.stock = 0;
    if (i.stock > 1e-9 && val > 0) i.avg = val / i.stock;
  }
  p.after.forEach(fn => fn());
  saveState();
}

/* ---------- Rencana per jenis data ---------- */
const PURGE = {
  sale(no) {
    const s = S.sales.find(x => x.no === no); if (!s) return null;
    const p = newPlan(`Penjualan ${s.no} · ${rp(s.total)}${s.status === 'void' ? ' (void)' : ''}`);
    const refs = [s.no, s.voidNo].filter(Boolean);
    S.journals.filter(j => refs.includes(j.ref)).forEach(j => planRemoveJournal(p, j));
    S.moves.filter(m => refs.includes(m.ref)).forEach(m => planRemoveMove(p, m));
    if (!S.journals.some(j => j.ref === s.no)) {
      // transaksi lama direkap per hari: kurangi kontribusinya dari jurnal & mutasi rekap
      const ref = 'REKAP-' + ymd(s.t);
      const rj = S.journals.find(j => j.ref === ref && j.type === 'sale');
      if (!rj) { p.block = 'Jurnal penjualan transaksi ini tidak ditemukan, jadi tidak bisa dihapus dengan aman.'; return p; }
      planEditJournal(p, rj, [
        { acc: payAcc(s.method), d: s.total }, { acc: '4-103', d: s.disc }, { acc: '4-101', c: s.sub },
        { acc: '4-102', c: s.svc }, { acc: '2-102', c: s.tax }, { acc: '5-101', d: s.cogs }, { acc: '1-104', c: s.cogs },
      ].filter(l => l.d || l.c));
      const used = JSON.parse(JSON.stringify(saleUsage(s)));
      const ids = Object.keys(used);
      const diff = s.cogs - ids.reduce((a, id) => a + used[id][1], 0);
      if (ids.length && diff) { const big = ids.reduce((a, id) => (used[id][1] > used[a][1] ? id : a), ids[0]); used[big][1] += diff; }
      for (const id of ids) {
        const m = S.moves.find(x => x.ref === ref && x.ing === id);
        if (!m) { p.block = `Mutasi rekap ${ref} untuk ${(ingById(id) || {}).name || id} tidak ditemukan; penghapusan dibatalkan.`; return p; }
        planEditMove(p, m, used[id][0], used[id][1]);
      }
      p.effects.push(`Jurnal rekap penjualan ${fmtDate(s.t)} dikurangi sebesar transaksi ini.`);
    }
    p.after.push(() => { S.sales = S.sales.filter(x => x !== s); });
    return planFinish(p);
  },

  po(no) {
    const po = poByNo(no); if (!po) return null;
    const p = newPlan(`Purchase order ${po.no} · ${(supById(po.sup) || {}).name || po.sup}`);
    const grns = S.grns.filter(g => g.po === po.no), grnNos = grns.map(g => g.no);
    S.journals.filter(j => grnNos.includes(j.ref)).forEach(j => planRemoveJournal(p, j));
    S.moves.filter(m => grnNos.includes(m.ref)).forEach(m => planRemoveMove(p, m));
    const pays = S.journals.filter(j => j.type === 'ap' && j.desc.startsWith(`Pembayaran ${po.no} `));
    const paidJ = pays.reduce((a, j) => a + j.lines.filter(l => l.acc === '2-101').reduce((b, l) => b + l.d, 0), 0);
    if (paidJ !== po.paid) { p.block = `Jurnal pembayaran ${po.no} (${rp(paidJ)}) tidak sama dengan catatan pembayaran PO (${rp(po.paid)}); penghapusan dibatalkan.`; return p; }
    pays.forEach(j => planRemoveJournal(p, j));
    if (grns.length) p.effects.push(`${grns.length} dokumen penerimaan barang ikut dihapus: ${grnNos.join(', ')}.`);
    if (pays.length) p.effects.push(`${pays.length} pembayaran (${rp(po.paid)}) ikut dihapus; dana kembali ke kas/bank.`);
    p.after.push(() => { S.grns = S.grns.filter(g => g.po !== po.no); S.pos = S.pos.filter(x => x !== po); });
    return planFinish(p);
  },

  grn(no) {
    const g = S.grns.find(x => x.no === no); if (!g) return null;
    const po = poByNo(g.po);
    const p = newPlan(`Penerimaan barang ${g.no} · ${rp(g.value)}`);
    const recvLeft = (po ? po.recvValue || 0 : 0) - g.value;
    if (po && po.paid > recvLeft) { p.block = `${po.no} sudah dibayar ${rp(po.paid)}, lebih besar dari nilai barang yang tersisa bila penerimaan ini dihapus (${rp(Math.max(0, recvLeft))}). Hapus PO ${po.no} sekaligus agar pembayarannya ikut terhapus.`; return p; }
    S.journals.filter(j => j.ref === g.no).forEach(j => planRemoveJournal(p, j));
    S.moves.filter(m => m.ref === g.no).forEach(m => planRemoveMove(p, m));
    if (po) p.effects.push(`Jumlah diterima dan hutang pada ${po.no} dikurangi; status PO disesuaikan.`);
    p.after.push(() => {
      S.grns = S.grns.filter(x => x !== g);
      if (!po) return;
      po.grns = po.grns.filter(x => x !== g.no);
      po.recvValue = Math.max(0, recvLeft);
      for (const gl of g.lines) {
        const l = po.lines.find(x => x.ing === gl.ing && x.recv >= gl.qty - 1e-9) || po.lines.find(x => x.ing === gl.ing);
        if (l) l.recv = Math.max(0, l.recv - gl.qty);
      }
      const any = po.lines.some(l => l.recv > 1e-9), full = po.lines.every(l => l.recv >= l.qty - 1e-9);
      po.status = !any ? 'dikirim' : !full ? 'sebagian' : po.paid >= po.recvValue ? 'lunas' : 'diterima';
      if (!any) po.due = null;
    });
    return planFinish(p);
  },

  expense(no) {
    const e = S.expenses.find(x => x.no === no); if (!e) return null;
    const p = newPlan(`Biaya ${e.no} · ${e.desc} · ${rp(e.amount)}${e.status === 'batal' ? ' (dibatalkan)' : ''}`);
    S.journals.filter(j => j.ref === e.no || j.ref === 'BTL-' + e.no).forEach(j => planRemoveJournal(p, j));
    p.after.push(() => { S.expenses = S.expenses.filter(x => x !== e); });
    return planFinish(p);
  },

  waste(no) {
    const w = S.wastes.find(x => x.no === no); if (!w) return null;
    const i = ingById(w.ing);
    const p = newPlan(`Bahan rusak ${w.no} · ${i ? i.name : w.ing} ${i ? fmtQty(i, w.qty) : w.qty}${w.status === 'batal' ? ' (dibatalkan)' : ''}`);
    const refs = [w.no, 'BTL-' + w.no];
    S.journals.filter(j => refs.includes(j.ref)).forEach(j => planRemoveJournal(p, j));
    S.moves.filter(m => refs.includes(m.ref)).forEach(m => planRemoveMove(p, m));
    p.after.push(() => { S.wastes = S.wastes.filter(x => x !== w); });
    return planFinish(p);
  },

  opname(no) {
    const o = S.opnames.find(x => x.no === no); if (!o) return null;
    const p = newPlan(`Stok opname ${o.no} · selisih bersih ${rp(o.net)}`);
    S.journals.filter(j => j.ref === o.no).forEach(j => planRemoveJournal(p, j));
    S.moves.filter(m => m.ref === o.no).forEach(m => planRemoveMove(p, m));
    p.effects.push('Stok tiap bahan dikembalikan ke angka sebelum opname ini diposting.');
    p.after.push(() => { S.opnames = S.opnames.filter(x => x !== o); });
    return planFinish(p);
  },

  /* jurnal tanpa dokumen: setor kas ke bank & setor PB1 */
  journal(ref) {
    const js = S.journals.filter(j => j.ref === ref);
    if (js.length !== 1 || !['transfer', 'tax'].includes(js[0].type)) return null;
    const j = js[0];
    const p = newPlan(`${j.desc} · ${j.ref} · ${rp(j.lines.reduce((a, l) => a + l.d, 0))}`);
    planRemoveJournal(p, j);
    if (j.type === 'tax') p.effects.push('PB1 yang sudah disetor kembali tercatat sebagai PB1 terutang.');
    return planFinish(p);
  },
};

/* ---------- Antarmuka ---------- */
const PURGE_KIND_LABEL = { sale: 'penjualan', po: 'purchase order', grn: 'penerimaan barang', expense: 'biaya', waste: 'catatan bahan rusak', opname: 'stok opname', journal: 'jurnal' };
const canPurge = () => can('data.hapus');
/* tombol "Hapus permanen" hanya tampil untuk pengguna yang punya izin */
function purgeBtn(kind, key, small) {
  if (!canPurge()) return '';
  return small
    ? `<button class="btn btn-sm btn-ghost" data-act="purge-ask" data-kind="${kind}" data-key="${esc(key)}" title="Hapus permanen" aria-label="Hapus permanen ${esc(key)}">${icon('trash-2', 15)}</button>`
    : `<button class="btn btn-danger" data-act="purge-ask" data-kind="${kind}" data-key="${esc(key)}">${icon('trash-2', 16)} Hapus permanen</button>`;
}
function planSummaryHTML(p) {
  const out = [];
  const jt = [p.jRemove.size ? `${p.jRemove.size} jurnal dihapus` : '', p.jEdit.length ? `${p.jEdit.length} jurnal rekap dikoreksi` : ''].filter(Boolean);
  if (jt.length) out.push(jt.join(', '));
  const ids = Object.keys(p.adj).filter(id => Math.abs(p.adj[id].qty) > 1e-9);
  if (ids.length) {
    const parts = ids.slice(0, 6).map(id => { const i = ingById(id); return i ? `${esc(i.name)} ${p.adj[id].qty > 0 ? '+' : '−'}${fmtQty(i, Math.abs(p.adj[id].qty))}` : esc(id); });
    out.push(`Stok disesuaikan: ${parts.join(', ')}${ids.length > 6 ? ` dan ${ids.length - 6} bahan lain` : ''}`);
  } else if (p.mRemove.size || p.mEdit.length) out.push('Mutasi stok yang saling meniadakan ikut dihapus; jumlah stok tidak berubah');
  for (const acc of CASH_ACCS) {
    const d = Math.round(p.cash[acc]);
    if (!d) continue;
    const after = accBalance(acc) + d;
    out.push(`Saldo ${acc === '1-101' ? 'kas outlet' : 'Bank BCA'} ${d > 0 ? 'bertambah' : 'berkurang'} ${rp(Math.abs(d))} menjadi ${rp(after)}${after < 0 ? ' <span class="pill bad">minus</span>' : ''}`);
  }
  p.effects.forEach(e => out.push(esc(e)));
  return out.length ? `<ul style="margin:0;padding-left:18px;color:var(--ink-700)">${out.map(x => `<li>${x}</li>`).join('')}</ul>` : '';
}
ACT['purge-ask'] = el => {
  const { kind, key } = el.dataset;
  const p = PURGE[kind] && PURGE[kind](key);
  if (!p) { toast('Data tidak ditemukan atau tidak bisa dihapus.', 'ban'); return; }
  const negCash = CASH_ACCS.some(acc => Math.round(p.cash[acc]) && accBalance(acc) + p.cash[acc] < 0);
  openModal({
    title: 'Hapus permanen', size: 'sm',
    body: `<div class="strong">${esc(p.label)}</div>
      ${p.block
        ? `<div class="alert bad">${icon('ban', 16)}<div>${esc(p.block)}</div></div>`
        : `<div class="alert bad">${icon('triangle-alert', 16)}<div>Data ini dan seluruh jejaknya akan dihapus <b>permanen</b> seolah tidak pernah terjadi. Laporan pada tanggal transaksi ikut berubah. Tindakan ini tidak bisa dibatalkan.</div></div>
      ${planSummaryHTML(p)}
      ${negCash ? `<div class="alert">${icon('triangle-alert', 16)}<div>Saldo kas/bank akan menjadi minus karena dana dari transaksi ini sudah dipakai atau disetor. Periksa kembali setelah menghapus.</div></div>` : ''}
      <div class="field"><label for="pg-reason">Alasan penghapusan</label><input class="input" id="pg-reason" placeholder="mis. Data uji coba / salah input" autofocus></div>
      <label class="check"><input type="checkbox" id="pg-ok"> Saya mengerti data ini tidak bisa dikembalikan</label>`}`,
    foot: `<button class="btn" data-act="modal-close">${p.block ? 'Tutup' : 'Batal'}</button>${p.block ? '' : `<button class="btn btn-danger" data-act="purge-do" data-kind="${kind}" data-key="${esc(key)}">${icon('trash-2', 16)} Hapus permanen</button>`}`,
  });
};
ACT['purge-do'] = el => {
  const { kind, key } = el.dataset;
  const reason = document.getElementById('pg-reason').value.trim();
  if (!reason) { toast('Isi alasan penghapusan.', 'triangle-alert'); return; }
  if (!document.getElementById('pg-ok').checked) { toast('Centang konfirmasi terlebih dahulu.', 'triangle-alert'); return; }
  const p = PURGE[kind] && PURGE[kind](key);   // dihitung ulang: data bisa berubah sejak dialog dibuka
  if (!p || p.block) { toast(p ? p.block : 'Data sudah tidak ada.', 'ban'); closeModal(true); refresh(); return; }
  applyPlan(p);
  audit('Data dihapus', `${p.label}: ${reason}`);
  closeModal(true); refresh();
  toast(`${PURGE_KIND_LABEL[kind][0].toUpperCase() + PURGE_KIND_LABEL[kind].slice(1)} dihapus permanen.`, 'trash-2');
};
