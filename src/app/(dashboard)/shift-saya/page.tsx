import { getUserProfile } from '@/lib/auth/get-user-profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ShiftSayaClient, ShiftDetailData } from './shift-saya-client';

export const instant = false;

export default async function ShiftSayaPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Hanya Kasir yang mengoperasikan Shift Saya (PRD: Owner & Kepala Toko memantau Shift Cabang)
  if (profile.peran === 'owner' || profile.peran === 'kepala_toko') {
    redirect('/shift-cabang');
  }

  const supabase = await createClient();

  // Query shift kasir aktif saat ini (status = 'buka')
  const { data: shiftRaw } = await supabase
    .from('shift_kasir')
    .select(
      'id, cabang_id, kasir_id, status, kas_awal, total_tunai, total_qris, kas_seharusnya, uang_fisik, selisih, catatan_tutup, dibuka_pada, ditutup_pada'
    )
    .eq('kasir_id', profile.id)
    .eq('status', 'buka')
    .maybeSingle();

  const initialShift: ShiftDetailData | null = shiftRaw
    ? {
        id: shiftRaw.id,
        cabang_id: shiftRaw.cabang_id,
        kasir_id: shiftRaw.kasir_id,
        status: shiftRaw.status,
        kas_awal: shiftRaw.kas_awal,
        total_tunai: shiftRaw.total_tunai,
        total_qris: shiftRaw.total_qris,
        kas_seharusnya: shiftRaw.kas_seharusnya,
        uang_fisik: shiftRaw.uang_fisik,
        selisih: shiftRaw.selisih,
        catatan_tutup: shiftRaw.catatan_tutup,
        dibuka_pada: shiftRaw.dibuka_pada,
        ditutup_pada: shiftRaw.ditutup_pada,
      }
    : null;

  return (
    <ShiftSayaClient
      kasirNama={profile.nama_lengkap}
      cabangNama={profile.cabang?.nama || 'Lumbung Cabang'}
      initialShift={initialShift}
    />
  );
}
