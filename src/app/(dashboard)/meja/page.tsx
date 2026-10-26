import { getUserProfile } from '@/lib/auth/get-user-profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDefaultMejaCabang } from '@/lib/orders/order-flow';
import { MejaClient } from './meja-client';

export const instant = false;

export default async function MejaPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  const supabase = await createClient();

  // Query daftar seluruh cabang jika Owner
  const { data: rawCabang } = await supabase
    .from('cabang')
    .select('id, nama, kode')
    .order('nama', { ascending: true });

  const cabangList = rawCabang || [];
  const initialCabangId =
    profile.peran === 'owner' ? (cabangList[0]?.id || '') : (profile.cabang_id || '');

  const { getAntreanDataAction } = await import('@/app/actions/antrean');
  const antreanRes = await getAntreanDataAction(initialCabangId);
  const initialMejaList = antreanRes.mejaList && antreanRes.mejaList.length > 0
    ? antreanRes.mejaList
    : (initialCabangId ? getDefaultMejaCabang(initialCabangId) : []);

  return (
    <MejaClient
      userRole={profile.peran}
      userCabangId={profile.cabang_id}
      userCabangNama={profile.cabang?.nama}
      cabangList={cabangList}
      initialMejaList={initialMejaList}
    />
  );
}
