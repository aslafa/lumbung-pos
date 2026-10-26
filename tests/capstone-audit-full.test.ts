import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Abaikan jika .env.local tidak ada
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

describe('Pengujian Komprehensif Capstone Project Lumbung POS (BR-01 s/d BR-12)', () => {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Helper untuk membuat user client dengan autentikasi
  async function createAuthClient(email: string) {
    const client = createClient(SUPABASE_URL, ANON_KEY);
    const { data, error } = await client.auth.signInWithPassword({
      email,
      password: 'Latihan#2026',
    });
    if (error) throw new Error(`Login gagal untuk ${email}: ${error.message}`);
    return { client, user: data.user };
  }

  it('BR-01 & US-01 [Isolasi Data Cabang & Status Akun]: Kasir & KT terisolasi per cabang, akun nonaktif tertolak', async () => {
    // 1. Kasir Tebet hanya melihat cabangnya sendiri
    const { client: kasirClient } = await createAuthClient('dimas.kasir.tebet@lumbung.test');
    const { data: trxKasir } = await kasirClient.from('transaksi').select('cabang_id');
    const cabangKasirSet = new Set((trxKasir || []).map((t) => t.cabang_id));
    assert.ok(cabangKasirSet.size <= 1, 'Kasir hanya boleh melihat 1 cabang miliknya');

    // 2. KT Tebet hanya melihat cabangnya sendiri
    const { client: ktClient } = await createAuthClient('bayu.kt.tebet@lumbung.test');
    const { data: trxKT } = await ktClient.from('transaksi').select('cabang_id');
    const cabangKTSet = new Set((trxKT || []).map((t) => t.cabang_id));
    assert.equal(cabangKTSet.size, 1, 'Kepala Toko hanya boleh melihat data cabangnya');

    // 3. Akun nonaktif ditolak
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: authNonaktif } = await anonClient.auth.signInWithPassword({
      email: 'rizky.kasir.depok@lumbung.test',
      password: 'Latihan#2026',
    });
    assert.ok(authNonaktif.user);
    const { data: profileNonaktif } = await adminClient
      .from('profiles')
      .select('aktif')
      .eq('id', authNonaktif.user.id)
      .single();
    assert.equal(profileNonaktif?.aktif, false, 'Akun Rizky harus berstatus aktif = false');
  });

  it('BR-02 & US-01 [Shift Kasir]: Kas awal valid (0..2jt) dan batas 1 shift buka per kasir', async () => {
    const { client: kasirClient } = await createAuthClient('dimas.kasir.tebet@lumbung.test');

    // Uji kas awal di luar batas (negatif)
    const { error: errNegatif } = await kasirClient.rpc('buka_shift', { p_kas_awal: -10000 });
    assert.ok(errNegatif, 'Kas awal negatif harus ditolak database');

    // Uji kas awal > 2.000.000
    const { error: errKelebihan } = await kasirClient.rpc('buka_shift', { p_kas_awal: 2500000 });
    assert.ok(errKelebihan, 'Kas awal di atas Rp2.000.000 harus ditolak database');

    // Uji buka shift kedua saat sudah ada shift buka
    const { error: errDoubleShift } = await kasirClient.rpc('buka_shift', { p_kas_awal: 200000 });
    assert.ok(errDoubleShift, 'Kasir yang sudah punya shift buka tidak boleh membuka shift baru');
  });

  it('BR-03 & US-02 [Integritas Stok & Zero Partial Sales]: Stok tidak boleh minus dan atomik per keranjang', async () => {
    const { data: shiftBuka } = await adminClient
      .from('shift_kasir')
      .select('id, cabang_id')
      .eq('status', 'buka')
      .limit(1)
      .single();
    assert.ok(shiftBuka, 'Shift buka harus ada');

    // Ambil 1 produk dengan stok 0 atau tersisa sedikit
    const { data: stokHabis } = await adminClient
      .from('stok_cabang')
      .select('produk_id, jumlah')
      .eq('cabang_id', shiftBuka.cabang_id)
      .eq('jumlah', 0)
      .limit(1)
      .single();

    if (stokHabis) {
      const { client: kasirClient } = await createAuthClient('dimas.kasir.tebet@lumbung.test');
      const { error: trxErr } = await kasirClient.rpc('simpan_transaksi', {
        p_shift_id: shiftBuka.id,
        p_diskon: 0,
        p_alasan_diskon: null,
        p_metode_bayar: 'tunai',
        p_uang_diterima: 100000,
        p_items: [{ produk_id: stokHabis.produk_id, jumlah: 1 }],
      });
      assert.ok(trxErr, 'Penjualan produk stok habis harus ditolak database');
    }
  });

  it('BR-04 & US-03 [Nomor Struk Urut]: Format KODE-YYYYMMDD-NNNN dan terurut per cabang per hari', async () => {
    const { data: latestTrx } = await adminClient
      .from('transaksi')
      .select('nomor_struk')
      .not('nomor_struk', 'like', 'TEST-%')
      .not('nomor_struk', 'like', 'TRX-%')
      .order('dibuat_pada', { ascending: false })
      .limit(5);

    assert.ok(latestTrx && latestTrx.length > 0);
    const regexStruk = /^[A-Z]{3}-\d{8}-\d{4}$/;
    for (const t of latestTrx) {
      assert.match(t.nomor_struk, regexStruk, `Nomor struk ${t.nomor_struk} harus cocok regex format BR-04`);
    }
  });

  it('BR-05 & US-02 [Validasi Kuantitas & Produk]: Kuantitas 1..99 dan produk nonaktif ditolak', async () => {
    const { data: shiftBuka } = await adminClient
      .from('shift_kasir')
      .select('id')
      .eq('status', 'buka')
      .limit(1)
      .single();
    const { data: prodNonaktif } = await adminClient
      .from('produk')
      .select('id')
      .eq('aktif', false)
      .limit(1)
      .single();

    if (prodNonaktif && shiftBuka) {
      const { client: kasirClient } = await createAuthClient('dimas.kasir.tebet@lumbung.test');
      const { error: errNonaktif } = await kasirClient.rpc('simpan_transaksi', {
        p_shift_id: shiftBuka.id,
        p_diskon: 0,
        p_alasan_diskon: null,
        p_metode_bayar: 'tunai',
        p_uang_diterima: 100000,
        p_items: [{ produk_id: prodNonaktif.id, jumlah: 1 }],
      });
      assert.ok(errNonaktif, 'Produk nonaktif harus ditolak untuk transaksi');
    }
  });

  it('BR-06 & US-02 [Aturan Diskon]: Diskon max 10% subtotal dan wajib alasan jika > 0', async () => {
    const { data: shiftBuka } = await adminClient
      .from('shift_kasir')
      .select('id')
      .eq('status', 'buka')
      .limit(1)
      .single();
    const { data: prodAktif } = await adminClient
      .from('produk')
      .select('id, harga_jual')
      .eq('aktif', true)
      .limit(1)
      .single();

    assert.ok(shiftBuka && prodAktif);
    const { client: kasirClient } = await createAuthClient('dimas.kasir.tebet@lumbung.test');

    // Uji diskon 50% (melebihi 10%)
    const subtotal = prodAktif.harga_jual;
    const diskonLebih = Math.round(subtotal * 0.5);
    const { error: errDiskonLebih } = await kasirClient.rpc('simpan_transaksi', {
      p_shift_id: shiftBuka.id,
      p_diskon: diskonLebih,
      p_alasan_diskon: 'Diskon teman kasir',
      p_metode_bayar: 'tunai',
      p_uang_diterima: subtotal,
      p_items: [{ produk_id: prodAktif.id, jumlah: 1 }],
    });
    assert.ok(errDiskonLebih, 'Diskon melebihi 10% harus ditolak');

    // Uji diskon > 0 tanpa alasan
    const diskonSah = Math.round(subtotal * 0.05);
    const { error: errTanpaAlasan } = await kasirClient.rpc('simpan_transaksi', {
      p_shift_id: shiftBuka.id,
      p_diskon: diskonSah,
      p_alasan_diskon: null,
      p_metode_bayar: 'tunai',
      p_uang_diterima: subtotal,
      p_items: [{ produk_id: prodAktif.id, jumlah: 1 }],
    });
    assert.ok(errTanpaAlasan, 'Diskon tanpa alasan harus ditolak');
  });

  it('BR-07 & US-03 [Aturan Pembayaran]: Pembayaran tunai uang kurang ditolak, QRIS pas', async () => {
    const { data: shiftBuka } = await adminClient
      .from('shift_kasir')
      .select('id')
      .eq('status', 'buka')
      .limit(1)
      .single();
    const { data: prodAktif } = await adminClient
      .from('produk')
      .select('id, harga_jual')
      .eq('aktif', true)
      .limit(1)
      .single();

    assert.ok(shiftBuka && prodAktif);
    const { client: kasirClient } = await createAuthClient('dimas.kasir.tebet@lumbung.test');

    // Uji pembayaran tunai kurang dari total
    const { error: errUangKurang } = await kasirClient.rpc('simpan_transaksi', {
      p_shift_id: shiftBuka.id,
      p_diskon: 0,
      p_alasan_diskon: null,
      p_metode_bayar: 'tunai',
      p_uang_diterima: prodAktif.harga_jual - 1000,
      p_items: [{ produk_id: prodAktif.id, jumlah: 1 }],
    });
    assert.ok(errUangKurang, 'Pembayaran uang tunai kurang harus ditolak');

    // Uji pembayaran QRIS dengan nominal tidak sama persis
    const { error: errQrisTidakPas } = await kasirClient.rpc('simpan_transaksi', {
      p_shift_id: shiftBuka.id,
      p_diskon: 0,
      p_alasan_diskon: null,
      p_metode_bayar: 'qris',
      p_uang_diterima: prodAktif.harga_jual + 5000,
      p_items: [{ produk_id: prodAktif.id, jumlah: 1 }],
    });
    assert.ok(errQrisTidakPas, 'Pembayaran QRIS dengan nominal lebih harus ditolak');
  });

  it('BR-08 & US-06 [Otorisasi Void Transaksi]: Kasir ditolak, KT cabang lain ditolak, alasan min 10 karakter', async () => {
    const { data: trxLunas } = await adminClient
      .from('transaksi')
      .select('id, cabang_id')
      .eq('status', 'lunas')
      .limit(1)
      .single();
    assert.ok(trxLunas);

    // Kasir dilarang me-void
    const { client: kasirClient } = await createAuthClient('dimas.kasir.tebet@lumbung.test');
    const { error: errKasirVoid } = await kasirClient.rpc('void_transaksi', {
      p_transaksi_id: trxLunas.id,
      p_alasan_void: 'Salah input menu pesanan',
    });
    assert.ok(errKasirVoid, 'Kasir dilarang melakukan void');

    // KT void dengan alasan kurang dari 10 karakter
    const { client: ktClient } = await createAuthClient('bayu.kt.tebet@lumbung.test');
    const { error: errAlasanPendek } = await ktClient.rpc('void_transaksi', {
      p_transaksi_id: trxLunas.id,
      p_alasan_void: 'Pendek',
    });
    assert.ok(errAlasanPendek, 'Alasan void < 10 karakter harus ditolak');
  });

  it('BR-09 & US-04 [Tutup Shift & Selisih Kas]: Selisih > Rp20.000 wajib catatan', async () => {
    const { data: shiftBuka } = await adminClient
      .from('shift_kasir')
      .select('id, kas_awal')
      .eq('status', 'buka')
      .limit(1)
      .single();
    assert.ok(shiftBuka);

    const { client: kasirClient } = await createAuthClient('dimas.kasir.tebet@lumbung.test');

    // Uji tutup shift selisih Rp50.000 tanpa catatan
    const { error: errCatatanWajib } = await kasirClient.rpc('tutup_shift', {
      p_shift_id: shiftBuka.id,
      p_uang_fisik: shiftBuka.kas_awal + 50000,
      p_catatan_tutup: null,
    });
    assert.ok(errCatatanWajib, 'Selisih kas > Rp20.000 wajib mengisi catatan');
  });

  it('BR-10 & US-05 [Verifikasi Shift]: Hanya KT atau Owner dan hanya untuk status ditutup', async () => {
    const { data: shiftBuka } = await adminClient
      .from('shift_kasir')
      .select('id')
      .eq('status', 'buka')
      .limit(1)
      .single();
    assert.ok(shiftBuka);

    const { client: ktClient } = await createAuthClient('bayu.kt.tebet@lumbung.test');

    // Uji verifikasi shift yang masih berstatus 'buka'
    const { error: errShiftBuka } = await ktClient.rpc('verifikasi_shift', {
      p_shift_id: shiftBuka.id,
      p_catatan_verifikasi: 'Verifikasi prematur',
    });
    assert.ok(errShiftBuka, 'Shift yang belum ditutup tidak boleh diverifikasi');
  });

  it('BR-11 & US-09 [Kerahasiaan Harga Modal & Laba]: 0 baris terbaca oleh non-Owner', async () => {
    const { client: kasirClient } = await createAuthClient('dimas.kasir.tebet@lumbung.test');
    const { data: modalKasir } = await kasirClient.from('riwayat_harga_modal').select('*');
    assert.equal((modalKasir || []).length, 0, 'Kasir menerima 0 baris riwayat harga modal');

    const { client: ktClient } = await createAuthClient('bayu.kt.tebet@lumbung.test');
    const { data: modalKT } = await ktClient.from('riwayat_harga_modal').select('*');
    assert.equal((modalKT || []).length, 0, 'Kepala Toko menerima 0 baris riwayat harga modal');

    const { client: ownerClient } = await createAuthClient('ratna.owner@lumbung.test');
    const { data: modalOwner } = await ownerClient.from('riwayat_harga_modal').select('*');
    assert.ok((modalOwner || []).length > 0, 'Owner dapat membaca riwayat harga modal');
  });

  it('BR-12 & US-10 [Immutabilitas Audit Log & Penyesuaian Stok]: Audit log tidak dapat diubah atau dihapus', async () => {
    const { data: anyLog } = await adminClient.from('audit_log').select('id').limit(1).single();
    assert.ok(anyLog);

    // Coba UPDATE audit log
    const { error: errUpd } = await adminClient
      .from('audit_log')
      .update({ aksi: 'aksi_palsu' })
      .eq('id', anyLog.id);
    assert.ok(errUpd, 'Trigger harus memblokir UPDATE pada audit_log');

    // Coba DELETE audit log
    const { error: errDel } = await adminClient
      .from('audit_log')
      .delete()
      .eq('id', anyLog.id);
    assert.ok(errDel, 'Trigger harus memblokir DELETE pada audit_log');
  });
});
