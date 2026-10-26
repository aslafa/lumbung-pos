import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/types/database';
import { connection } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';

export interface UserProfileResult {
  user: { id: string; email?: string } | null;
  profile: Profile | null;
  isInactive: boolean;
}

export async function getUserProfile(): Promise<UserProfileResult> {
  await connection();
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, profile: null, isInactive: false };
  }

  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('*, cabang:cabang_id(*)')
    .eq('id', user.id)
    .maybeSingle();

  let profile = profileData;

  // Jika tidak ditemukan lewat client pengguna (misal karena RLS membatasi akun nonaktif),
  // verifikasi melalui admin client agar status aktif/nonaktif teridentifikasi secara presisi
  if (!profile && !profileError) {
    const adminClient = createAdminClient();
    if (adminClient) {
      const { data: adminProfile } = await adminClient
        .from('profiles')
        .select('*, cabang:cabang_id(*)')
        .eq('id', user.id)
        .maybeSingle();

      if (adminProfile) {
        profile = adminProfile;
      }
    }
  }

  if (profileError || !profile) {
    // Akun terdaftar di auth tapi belum ada profil atau gagal dibaca
    return { user, profile: null, isInactive: false };
  }

  if (!profile.aktif) {
    return { user, profile: profile as Profile, isInactive: true };
  }

  return { user, profile: profile as Profile, isInactive: false };
}
