<?php
declare(strict_types=1);

/** Katalog izin & peran bawaan. Sama dengan docs/03-peran-hak-akses.md. */
final class Permissions
{
    public const MODULES = [
        'dashboard', 'kasir', 'meja', 'dapur', 'penjualan', 'menu', 'pembelian', 'pemasok', 'persediaan',
        'kas', 'lap-penjualan', 'lap-keuangan', 'lap-persediaan', 'pengguna', 'pengaturan',
    ];

    public const ACTIONS = [
        'kasir.bayar', 'kasir.diskon', 'penjualan.semua', 'penjualan.void', 'menu.edit', 'po.buat', 'po.terima',
        'po.bayar', 'stok.bahan', 'stok.opname', 'stok.waste', 'kas.catat', 'pengaturan.ubah', 'pengguna.kelola', 'data.reset',
    ];

    /** Semua izin yang sah (akses modul berawalan "m:"). */
    public static function all(): array
    {
        $mods = array_map(function ($m) { return 'm:' . $m; }, self::MODULES);
        return array_merge($mods, self::ACTIONS);
    }

    public static function isValid(string $p): bool
    {
        return in_array($p, self::all(), true);
    }

    /** Peran bawaan untuk migrasi awal. */
    public static function defaultRoles(): array
    {
        return [
            ['owner', 'Pemilik', 'bad', 1, 'Akses penuh ke semua modul dan pengaturan.', ['*']],
            ['manajer', 'Manajer Outlet', 'gold', 0, 'Menjalankan operasional harian, menyetujui diskon, dan membaca semua laporan.',
                ['m:dashboard', 'm:kasir', 'm:meja', 'm:dapur', 'm:penjualan', 'm:menu', 'm:pembelian', 'm:pemasok', 'm:persediaan', 'm:kas',
                 'm:lap-penjualan', 'm:lap-keuangan', 'm:lap-persediaan', 'm:pengaturan', 'kasir.bayar', 'kasir.diskon', 'penjualan.semua',
                 'penjualan.void', 'menu.edit', 'po.buat', 'po.terima', 'po.bayar', 'stok.bahan', 'stok.opname', 'stok.waste', 'kas.catat', 'pengaturan.ubah']],
            ['kasir', 'Kasir', 'info', 0, 'Mencatat pesanan dan menerima pembayaran. Diskon perlu PIN manajer.',
                ['m:kasir', 'm:meja', 'm:dapur', 'm:penjualan', 'kasir.bayar']],
            ['dapur', 'Kepala Dapur', 'ok', 0, 'Mengelola layar dapur, standar resep, stok opname, dan bahan rusak.',
                ['m:dapur', 'm:menu', 'm:persediaan', 'm:lap-persediaan', 'menu.edit', 'stok.opname', 'stok.waste']],
            ['gudang', 'Staf Gudang', '', 0, 'Membuat PO, menerima barang, dan menjaga data persediaan.',
                ['m:pembelian', 'm:pemasok', 'm:persediaan', 'po.buat', 'po.terima', 'stok.bahan', 'stok.opname', 'stok.waste']],
            ['akuntan', 'Akuntan', 'warn', 0, 'Mencatat kas & biaya, membayar pemasok, dan menyusun laporan.',
                ['m:dashboard', 'm:penjualan', 'm:pembelian', 'm:pemasok', 'm:kas', 'm:lap-penjualan', 'm:lap-keuangan', 'm:lap-persediaan',
                 'penjualan.semua', 'po.bayar', 'kas.catat']],
        ];
    }

    /** Izin sebuah peran; '*' berarti semua. */
    public static function forRole(string $roleId): array
    {
        $rows = Db::all('SELECT permission FROM role_permissions WHERE role_id = ?', [$roleId]);
        $perms = array_column($rows, 'permission');
        return in_array('*', $perms, true) ? array_merge(['*'], self::all()) : $perms;
    }

    public static function userHas(array $user, string $perm): bool
    {
        $perms = self::forRole($user['role_id']);
        return in_array('*', $perms, true) || in_array($perm, $perms, true);
    }
}
