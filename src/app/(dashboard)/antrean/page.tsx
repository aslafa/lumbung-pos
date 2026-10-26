import { getUserProfile } from '@/lib/auth/get-user-profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getDefaultMejaCabang } from '@/lib/orders/order-flow';
import { AntreanClient } from './antrean-client';

export const instant = false;

export default async function AntreanPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  const supabase = await createClient();

  // Query seluruh cabang jika Owner
  const { data: rawCabang } = await supabase
    .from('cabang')
    .select('id, nama, kode')
    .order('nama', { ascending: true });

  const cabangList = rawCabang || [];
  const initialCabangId = profile.peran === 'owner' ? (cabangList[0]?.id || '') : (profile.cabang_id || '');

  const { getAntreanDataAction } = await import('@/app/actions/antrean');
  const antreanRes = await getAntreanDataAction(initialCabangId);
  const initialAntrean = antreanRes.antrean || [];
  const initialMeja = antreanRes.mejaList && antreanRes.mejaList.length > 0
    ? antreanRes.mejaList
    : (initialCabangId ? getDefaultMejaCabang(initialCabangId) : []);

  return (
    <AntreanClient
      userRole={profile.peran}
      userCabangId={profile.cabang_id}
      userCabangNama={profile.cabang?.nama}
      cabangList={cabangList}
      initialAntrean={initialAntrean}
      initialMejaList={initialMeja}
    />
  );
}
