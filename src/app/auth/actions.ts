'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

import { isRedirectError } from 'next/dist/client/components/redirect-error';

import { createAdminClient } from '@/lib/supabase/admin';

export interface LoginActionResult {
  errorTitle?: string;
  error?: string;
}

export async function loginAction(
  prevState: LoginActionResult | null | undefined,
  formData: FormData
): Promise<LoginActionResult | null> {
  try {
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    if (!email || !password) {
      return { error: 'Email dan kata sandi wajib diisi.' };
    }

    const supabase = await createClient();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (authError || !authData.user) {
      return { error: 'Email atau kata sandi tidak valid. Silakan coba lagi.' };
    }

    // 1. Ambil profil pengguna menggunakan ID dari sesi Supabase Auth (auth.users.id = profiles.id)
    let profile = null;
    let queryError = null;

    // Coba query melalui client sesi pengguna
    const { data: userProfile, error: userProfileError } = await supabase
      .from('profiles')
      .select('id, nama_lengkap, email, peran, aktif, cabang_id')
      .eq('id', authData.user.id)
      .maybeSingle();

    profile = userProfile;
    queryError = userProfileError;

    // Jika query lewat client pengguna tidak menghasilkan data dan tidak error,
    // gunakan admin client untuk memastikan apakah profil sebenarnya ada
    // (mengantisipasi jika RLS database membatasi pembacaan bagi akun nonaktif)
    if (!profile && !queryError) {
      const adminClient = createAdminClient();
      if (adminClient) {
        const { data: adminProfile, error: adminProfileError } = await adminClient
          .from('profiles')
          .select('id, nama_lengkap, email, peran, aktif, cabang_id')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (adminProfile) {
          profile = adminProfile;
        } else if (adminProfileError) {
          queryError = adminProfileError;
        }
      }
    }

    // 2. Pastikan error RLS atau kegagalan query tidak salah dikategorikan sebagai "profil tidak ditemukan"
    if (queryError) {
      await supabase.auth.signOut();

      if (queryError.code === '42501') {
        return {
          error:
            'Akses database ditolak (Error 42501: Permission Denied). Hubungi administrator untuk memeriksa izin tabel.',
        };
      }
      return {
        error: `Gagal memuat profil pengguna: ${queryError.message || 'Terjadi kesalahan sistem.'}`,
      };
    }

    // 3. Jika profil benar-benar tidak ditemukan di database
    if (!profile) {
      await supabase.auth.signOut();
      return {
        error: 'Profil pengguna belum terdaftar di sistem. Silakan hubungi administrator.',
      };
    }

    // 4. Periksa nilai profiles.aktif setelah profil ditemukan
    if (!profile.aktif) {
      await supabase.auth.signOut();
      return {
        errorTitle: 'Akun Dinonaktifkan',
        error:
          'Akun Anda saat ini berstatus nonaktif. Silakan hubungi administrator untuk mendapatkan informasi lebih lanjut.',
      };
    }

    // 5. Arahkan pengguna aktif sesuai peran masing-masing (PRD Bagian 7)
    let targetUrl = '/kasir';
    if (profile.peran === 'kepala_toko') {
      targetUrl = '/transaksi';
    } else if (profile.peran === 'owner') {
      targetUrl = '/laporan';
    }

    redirect(targetUrl);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }
    console.error('Unhandled login error:', error);
    return {
      error:
        error instanceof Error
          ? error.message
          : 'Terjadi kesalahan tidak terduga pada server saat proses login.',
    };
  }
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
