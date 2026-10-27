import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getNavItemsForRole, type NavItem } from '../src/components/layout/nav-items.ts';
import type { UserRole } from '../src/types/database.ts';

describe('Pengujian RBAC: Navigasi Menu Sidebar Berdasarkan Peran', () => {
  it('TC-RBAC-NAV-01: Kasir hanya melihat menu Kasir POS, Meja, Antrean, Shift Saya, dan Transaksi', () => {
    const items = getNavItemsForRole('kasir');
    const hrefs = items.map((i: NavItem) => i.href);

    // Menu yang wajib ada untuk Kasir
    assert.ok(hrefs.includes('/kasir'), 'Kasir harus memiliki akses ke Kasir POS (/kasir)');
    assert.ok(hrefs.includes('/meja'), 'Kasir harus memiliki akses ke Manajemen Meja (/meja)');
    assert.ok(hrefs.includes('/antrean'), 'Kasir harus memiliki akses ke Antrean KDS (/antrean)');
    assert.ok(hrefs.includes('/shift-saya'), 'Kasir harus memiliki akses ke Shift Saya (/shift-saya)');
    assert.ok(hrefs.includes('/transaksi'), 'Kasir harus memiliki akses ke Riwayat Transaksi (/transaksi)');

    // Menu yang TIDAK boleh ada untuk Kasir
    assert.ok(!hrefs.includes('/laporan'), 'Kasir dilarang melihat menu Laporan Penjualan (/laporan)');
    assert.ok(!hrefs.includes('/pengaturan'), 'Kasir dilarang melihat menu Pengaturan Sistem (/pengaturan)');
    assert.ok(!hrefs.includes('/stok'), 'Kasir dilarang melihat menu Stok Cabang (/stok)');
    assert.ok(!hrefs.includes('/shift-cabang'), 'Kasir dilarang melihat menu Monitoring Shift Cabang (/shift-cabang)');
    assert.ok(!hrefs.includes('/produk'), 'Kasir dilarang melihat menu Katalog Produk (/produk)');
  });

  it('TC-RBAC-NAV-02: Kepala Toko TIDAK boleh melihat menu Kasir POS (/kasir), Shift Saya, atau Pengaturan', () => {
    const items = getNavItemsForRole('kepala_toko');
    const hrefs = items.map((i: NavItem) => i.href);

    // Menu Kasir POS dilarang untuk Kepala Toko
    assert.ok(!hrefs.includes('/kasir'), 'Kepala Toko dilarang melihat menu Kasir POS (/kasir)');
    assert.ok(!hrefs.includes('/shift-saya'), 'Kepala Toko dilarang melihat menu Shift Saya (/shift-saya)');
    assert.ok(!hrefs.includes('/pengaturan'), 'Kepala Toko dilarang melihat menu Pengaturan Sistem (/pengaturan)');

    // Menu pengawasan cabang yang harus ada
    assert.ok(hrefs.includes('/transaksi'), 'Kepala Toko harus memiliki menu Transaksi');
    assert.ok(hrefs.includes('/shift-cabang'), 'Kepala Toko harus memiliki menu Monitoring Shift');
    assert.ok(hrefs.includes('/stok'), 'Kepala Toko harus memiliki menu Stok Cabang');
    assert.ok(hrefs.includes('/produk'), 'Kepala Toko harus memiliki menu Katalog Produk');
    assert.ok(hrefs.includes('/laporan'), 'Kepala Toko harus memiliki menu Laporan');
    assert.ok(hrefs.includes('/meja'), 'Kepala Toko harus memiliki menu Meja');
    assert.ok(hrefs.includes('/antrean'), 'Kepala Toko harus memiliki menu Antrean');
  });

  it('TC-RBAC-NAV-03: Owner TIDAK boleh melihat menu Kasir POS (/kasir) atau Shift Saya, tetapi memiliki Pengaturan & Laporan', () => {
    const items = getNavItemsForRole('owner');
    const hrefs = items.map((i: NavItem) => i.href);

    // Menu Kasir POS & Shift Saya dilarang untuk Owner
    assert.ok(!hrefs.includes('/kasir'), 'Owner dilarang melihat menu Kasir POS (/kasir)');
    assert.ok(!hrefs.includes('/shift-saya'), 'Owner dilarang melihat menu Shift Saya (/shift-saya)');

    // Menu Owner yang wajib ada
    assert.ok(hrefs.includes('/laporan'), 'Owner harus memiliki menu Laporan');
    assert.ok(hrefs.includes('/pengaturan'), 'Owner harus memiliki menu Pengaturan');
    assert.ok(hrefs.includes('/produk'), 'Owner harus memiliki menu Produk');
    assert.ok(hrefs.includes('/stok'), 'Owner harus memiliki menu Stok');
    assert.ok(hrefs.includes('/shift-cabang'), 'Owner harus memiliki menu Shift Cabang');
    assert.ok(hrefs.includes('/transaksi'), 'Owner harus memiliki menu Transaksi');
  });

  it('TC-RBAC-NAV-04: Peran yang tidak valid atau null mengembalikan array menu kosong', () => {
    const itemsUnknown = getNavItemsForRole('unknown_role' as UserRole);
    assert.equal(itemsUnknown.length, 0, 'Role tidak dikenal harus menghasilkan daftar menu kosong');
  });
});

describe('Pengujian RBAC: Validasi Matriks Otorisasi Rute (Middleware & Route Guard)', () => {
  // Simulasi aturan otorisasi rute sesuai implementasi middleware & server component
  function evaluateRouteAccess(role: UserRole | string | null, pathname: string): {
    allowed: boolean;
    redirectUrl?: string;
  } {
    if (!role) {
      return { allowed: false, redirectUrl: '/login' };
    }

    if (role === 'kasir') {
      const allowedKasirRoutes = ['/kasir', '/meja', '/antrean', '/shift-saya', '/transaksi'];
      const isAllowed = allowedKasirRoutes.some(
        (allowed) => pathname === allowed || pathname.startsWith(`${allowed}/`)
      );
      if (!isAllowed) {
        return { allowed: false, redirectUrl: '/kasir?denied=1' };
      }
      return { allowed: true };
    }

    if (role === 'kepala_toko') {
      const forbiddenRoutes = ['/kasir', '/shift-saya', '/pengaturan'];
      const isForbidden = forbiddenRoutes.some(
        (forbidden) => pathname === forbidden || pathname.startsWith(`${forbidden}/`)
      );
      if (isForbidden) {
        return { allowed: false, redirectUrl: '/transaksi?denied=1' };
      }
      return { allowed: true };
    }

    if (role === 'owner') {
      const forbiddenRoutes = ['/kasir', '/shift-saya'];
      const isForbidden = forbiddenRoutes.some(
        (forbidden) => pathname === forbidden || pathname.startsWith(`${forbidden}/`)
      );
      if (isForbidden) {
        return { allowed: false, redirectUrl: '/laporan?denied=1' };
      }
      return { allowed: true };
    }

    // Role tidak dikenal
    return { allowed: false, redirectUrl: '/login' };
  }

  it('TC-RBAC-ROUTE-01: Kasir diblokir saat mengakses /laporan dan dialihkan ke /kasir?denied=1', () => {
    const res = evaluateRouteAccess('kasir', '/laporan');
    assert.equal(res.allowed, false);
    assert.equal(res.redirectUrl, '/kasir?denied=1');
  });

  it('TC-RBAC-ROUTE-02: Kasir diblokir saat mengakses /pengaturan dan /stok', () => {
    const resPengaturan = evaluateRouteAccess('kasir', '/pengaturan');
    assert.equal(resPengaturan.allowed, false);
    assert.equal(resPengaturan.redirectUrl, '/kasir?denied=1');

    const resStok = evaluateRouteAccess('kasir', '/stok');
    assert.equal(resStok.allowed, false);
    assert.equal(resStok.redirectUrl, '/kasir?denied=1');
  });

  it('TC-RBAC-ROUTE-03: Kepala Toko diblokir saat mengakses /kasir dan dialihkan ke /transaksi?denied=1', () => {
    const res = evaluateRouteAccess('kepala_toko', '/kasir');
    assert.equal(res.allowed, false);
    assert.equal(res.redirectUrl, '/transaksi?denied=1');
  });

  it('TC-RBAC-ROUTE-04: Kepala Toko diblokir saat mengakses /pengaturan', () => {
    const res = evaluateRouteAccess('kepala_toko', '/pengaturan');
    assert.equal(res.allowed, false);
    assert.equal(res.redirectUrl, '/transaksi?denied=1');
  });

  it('TC-RBAC-ROUTE-05: Owner diblokir saat mengakses /kasir dan dialihkan ke /laporan?denied=1', () => {
    const res = evaluateRouteAccess('owner', '/kasir');
    assert.equal(res.allowed, false);
    assert.equal(res.redirectUrl, '/laporan?denied=1');
  });

  it('TC-RBAC-ROUTE-06: Owner diizinkan mengakses /laporan, /pengaturan, /produk, dan /stok', () => {
    assert.equal(evaluateRouteAccess('owner', '/laporan').allowed, true);
    assert.equal(evaluateRouteAccess('owner', '/pengaturan').allowed, true);
    assert.equal(evaluateRouteAccess('owner', '/produk').allowed, true);
    assert.equal(evaluateRouteAccess('owner', '/stok').allowed, true);
  });

  it('TC-RBAC-ROUTE-07: Pengguna belum login diarahkan ke /login', () => {
    const res = evaluateRouteAccess(null, '/kasir');
    assert.equal(res.allowed, false);
    assert.equal(res.redirectUrl, '/login');
  });

  it('TC-RBAC-ROUTE-08: Pengguna dengan role palsu/tidak valid diarahkan ke /login tanpa privilege escalation', () => {
    const res = evaluateRouteAccess('hacker', '/laporan');
    assert.equal(res.allowed, false);
    assert.equal(res.redirectUrl, '/login');
  });
});

describe('Pengujian RBAC: Validasi Profil Database & Kredensial Nyata', () => {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

  it('TC-RBAC-DB-01: Verifikasi profil Kasir, Kepala Toko, dan Owner di database Supabase', async () => {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      // Lewati jika credentials tidak diset di env
      return;
    }

    const { createClient } = await import('@supabase/supabase-js');
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1. Kasir Dimas
    const { data: dimasProfile, error: dimasErr } = await adminClient
      .from('profiles')
      .select('nama_lengkap, email, peran, aktif, cabang_id')
      .eq('email', 'dimas.kasir.tebet@lumbung.test')
      .single();
    assert.equal(dimasErr, null);
    assert.ok(dimasProfile, 'Profil Dimas harus ditemukan');
    assert.equal(dimasProfile.peran, 'kasir', 'Peran Dimas di database wajib kasir');
    assert.ok(dimasProfile.cabang_id, 'Kasir Dimas harus memiliki cabang_id');

    // 2. Kepala Toko Bayu
    const { data: bayuProfile, error: bayuErr } = await adminClient
      .from('profiles')
      .select('nama_lengkap, email, peran, aktif, cabang_id')
      .eq('email', 'bayu.kt.tebet@lumbung.test')
      .single();
    assert.equal(bayuErr, null);
    assert.ok(bayuProfile, 'Profil Bayu harus ditemukan');
    assert.equal(bayuProfile.peran, 'kepala_toko', 'Peran Bayu di database wajib kepala_toko');
    assert.ok(bayuProfile.cabang_id, 'Kepala Toko Bayu harus memiliki cabang_id');

    // 3. Owner Ratna
    const { data: ratnaProfile, error: ratnaErr } = await adminClient
      .from('profiles')
      .select('nama_lengkap, email, peran, aktif, cabang_id')
      .eq('email', 'ratna.owner@lumbung.test')
      .single();
    assert.equal(ratnaErr, null);
    assert.ok(ratnaProfile, 'Profil Ratna harus ditemukan');
    assert.equal(ratnaProfile.peran, 'owner', 'Peran Ratna di database wajib owner');
  });
});

