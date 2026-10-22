import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/types/database';

export interface UserProfileResult {
  user: { id: string; email?: string } | null;
  profile: Profile | null;
  isInactive: boolean;
}

export async function getUserProfile(): Promise<UserProfileResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, profile: null, isInactive: false };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*, cabang:cabang_id(*)')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) {
    // Akun terdaftar di auth tapi belum ada profil atau gagal dibaca
    return { user, profile: null, isInactive: false };
  }

  if (!profile.aktif) {
    return { user, profile: profile as Profile, isInactive: true };
  }

  return { user, profile: profile as Profile, isInactive: false };
}
