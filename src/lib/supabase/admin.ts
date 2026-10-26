import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Membuat Supabase Client dengan Service Role Key untuk verifikasi server-side internal.
 * Digunakan untuk membaca status profil pengguna secara akurat (misal mendeteksi akun nonaktif)
 * ketika RLS database membatasi pembacaan profil oleh sesi akun nonaktif itu sendiri.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
