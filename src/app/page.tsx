import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth/get-user-profile';

export default async function HomePage() {
  const { user, profile, isInactive } = await getUserProfile();

  if (!user || !profile) {
    redirect('/login');
  }

  if (isInactive) {
    redirect('/nonaktif');
  }

  // Redirect ke halaman awal masing-masing peran (PRD Bagian 7)
  if (profile.peran === 'kasir') {
    redirect('/kasir');
  } else if (profile.peran === 'kepala_toko') {
    redirect('/transaksi');
  } else if (profile.peran === 'owner') {
    redirect('/laporan');
  }

  redirect('/kasir');
}
