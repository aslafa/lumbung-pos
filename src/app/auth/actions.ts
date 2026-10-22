'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function loginAction(prevState: { error?: string } | null, formData: FormData) {
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

  // Cek profil pengguna di database (BR-01)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('peran, aktif, cabang_id')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    // Profil belum ada
    return { error: 'Profil pengguna tidak ditemukan di sistem. Hubungi administrator.' };
  }

  if (!profile.aktif) {
    await supabase.auth.signOut();
    return { error: 'Akun Anda berstatus nonaktif. Silakan hubungi Owner untuk aktivasi akun.' };
  }

  // Arahkan sesuai peran pengguna (PRD Bagian 7)
  let targetUrl = '/kasir';
  if (profile.peran === 'kepala_toko') {
    targetUrl = '/transaksi';
  } else if (profile.peran === 'owner') {
    targetUrl = '/laporan';
  }

  redirect(targetUrl);
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
