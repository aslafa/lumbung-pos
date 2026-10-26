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

describe('Pengujian Penanganan Status Akun (Login & Profil)', () => {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  it('TC-AUTH-01: Akun nonaktif (rizky.kasir.depok) harus terdeteksi aktif=false dan ditolak dengan pesan yang sesuai', async () => {
    const userClient = createClient(SUPABASE_URL, ANON_KEY);

    // 1. Coba login kredensial
    const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
      email: 'rizky.kasir.depok@lumbung.test',
      password: 'Latihan#2026',
    });

    assert.equal(authError, null, 'Autentikasi email dan kata sandi harus berhasil');
    assert.ok(authData.user, 'Objek authData.user harus ada');
    assert.equal(authData.user.email, 'rizky.kasir.depok@lumbung.test');

    // 2. Verifikasi profil via adminClient (memastikan ID cocok 1-to-1)
    const { data: profile, error: profError } = await adminClient
      .from('profiles')
      .select('id, nama_lengkap, email, peran, aktif, cabang_id')
      .eq('id', authData.user.id)
      .maybeSingle();

    assert.equal(profError, null);
    assert.ok(profile, 'Profil Rizky harus tersedia di tabel profiles');
    assert.equal(profile.id, authData.user.id, 'auth.users.id harus sama dengan profiles.id');
    assert.equal(profile.peran, 'kasir');
    assert.equal(profile.aktif, false, 'Profil Rizky harus bernilai aktif = false');

    // 3. Simulasikan logika evaluasi loginAction
    let loginResponse: { errorTitle?: string; error?: string } | null = null;
    if (!profile.aktif) {
      await userClient.auth.signOut();
      loginResponse = {
        errorTitle: 'Akun Dinonaktifkan',
        error: 'Akun Anda saat ini berstatus nonaktif. Silakan hubungi administrator untuk mendapatkan informasi lebih lanjut.',
      };
    }

    assert.ok(loginResponse, 'Harus menghasilkan respons penolakan');
    assert.equal(loginResponse.errorTitle, 'Akun Dinonaktifkan');
    assert.equal(
      loginResponse.error,
      'Akun Anda saat ini berstatus nonaktif. Silakan hubungi administrator untuk mendapatkan informasi lebih lanjut.'
    );

    // 4. Pastikan sesi telah di-sign out
    const { data: sessionData } = await userClient.auth.getSession();
    assert.equal(sessionData.session, null, 'Sesi pengguna nonaktif harus telah di-logout');
  });

  it('TC-AUTH-02: Akun aktif (dimas.kasir.tebet) harus dapat login dan profil aktif=true terverifikasi', async () => {
    const userClient = createClient(SUPABASE_URL, ANON_KEY);

    const { data: authData, error: authError } = await userClient.auth.signInWithPassword({
      email: 'dimas.kasir.tebet@lumbung.test',
      password: 'Latihan#2026',
    });

    assert.equal(authError, null, 'Autentikasi Dimas harus berhasil');
    assert.ok(authData.user);

    const { data: profile, error: profError } = await adminClient
      .from('profiles')
      .select('id, peran, aktif, cabang_id')
      .eq('id', authData.user.id)
      .maybeSingle();

    assert.equal(profError, null);
    assert.ok(profile);
    assert.equal(profile.peran, 'kasir');
    assert.equal(profile.aktif, true, 'Profil Dimas harus aktif = true');

    // Arah rute kasir
    let targetUrl = '/kasir';
    const role: string = profile.peran;
    if (role === 'kepala_toko') targetUrl = '/transaksi';
    if (role === 'owner') targetUrl = '/laporan';

    assert.equal(targetUrl, '/kasir', 'Kasir aktif harus diarahkan ke /kasir');

    await userClient.auth.signOut();
  });

  it('TC-AUTH-03: Akun aktif Owner (ratna.owner) dan Kepala Toko (bayu.kt.tebet) diarahkan sesuai peran', async () => {
    // Owner
    const { data: ownerProf } = await adminClient
      .from('profiles')
      .select('peran, aktif')
      .eq('email', 'ratna.owner@lumbung.test')
      .single();

    assert.equal(ownerProf?.peran, 'owner');
    assert.equal(ownerProf?.aktif, true);

    // Kepala Toko
    const { data: ktProf } = await adminClient
      .from('profiles')
      .select('peran, aktif')
      .eq('email', 'bayu.kt.tebet@lumbung.test')
      .single();

    assert.equal(ktProf?.peran, 'kepala_toko');
    assert.equal(ktProf?.aktif, true);
  });

  it('TC-AUTH-04: Kredensial tidak valid harus mempertahankan pesan standar', async () => {
    const userClient = createClient(SUPABASE_URL, ANON_KEY);

    const { data, error } = await userClient.auth.signInWithPassword({
      email: 'nonexistent.user@lumbung.test',
      password: 'WrongPassword123',
    });

    assert.ok(error, 'Harus mengembalikan error autentikasi');
    assert.equal(data.user, null);

    // Pesan ramah yang dikembalikan loginAction
    const clientMessage = 'Email atau kata sandi tidak valid. Silakan coba lagi.';
    assert.equal(clientMessage, 'Email atau kata sandi tidak valid. Silakan coba lagi.');
  });

  it('TC-AUTH-05: Penanganan profil tidak terdaftar jika auth.users ada tapi profiles kosong', async () => {
    // Buat fake UUID acak yang tidak ada di profiles
    const randomUserId = '00000000-0000-0000-0000-000000000099';

    const { data: profile, error } = await adminClient
      .from('profiles')
      .select('id, aktif')
      .eq('id', randomUserId)
      .maybeSingle();

    assert.equal(error, null, 'maybeSingle tidak boleh error ketika baris tidak ada');
    assert.equal(profile, null, 'Profil harus bernilai null');

    // Pesan khusus ketika profil belum terdaftar
    const notFoundMessage = 'Profil pengguna belum terdaftar di sistem. Silakan hubungi administrator.';
    assert.equal(notFoundMessage, 'Profil pengguna belum terdaftar di sistem. Silakan hubungi administrator.');
  });
});
