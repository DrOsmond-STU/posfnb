/* Dimuat di <head>: tema dipasang sebelum halaman digambar supaya tidak ada kedipan.
   Dipisah dari index.html agar Content-Security-Policy bisa melarang skrip inline. */
try {
  var rpt = localStorage.getItem('racikpos-theme');
  if (rpt === 'dark' || rpt === 'light') document.documentElement.setAttribute('data-theme', rpt);
} catch (e) { /* penyimpanan tidak tersedia */ }
