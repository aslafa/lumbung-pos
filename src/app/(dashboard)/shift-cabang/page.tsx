import { getUserProfile } from '@/lib/auth/get-user-profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ShiftCabangClient, ShiftCabangItem } from './shift-cabang-client';
import { formatRentangWaktuShift } from '@/lib/utils/format';

export const instant = false;

interface RawShiftCabangRow {
  id: string;
  cabang_id: string;
  status: 'buka' | 'ditutup' | 'diverifikasi';
  dibuka_pada: string;
  ditutup_pada: string | null;
  kas_awal: number;
  kas_seharusnya: number;
  uang_fisik: number | null;
  selisih: number | null;
  kasir?: { nama_lengkap: string } | null;
  cabang?: { nama: string; kode: string } | null;
}

export default async function ShiftCabangPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir dilarang mengakses pengawasan shift cabang
  if (profile.peran === 'kasir') {
    redirect('/kasir');
  }

  const isOwner = profile.peran === 'owner';
  const supabase = await createClient();

  // Query daftar cabang untuk filter Owner
  const { data: cabangRaw } = await supabase
    .from('cabang')
    .select('id, nama, kode')
    .eq('aktif', true)
    .order('nama', { ascending: true });

  const cabangList = cabangRaw || [];

  // Query shift cabang dari database
  // - Kepala Toko: hanya melihat shift di cabangnya
  // - Owner: melihat seluruh shift semua cabang
  let query = supabase
    .from('shift_kasir')
    .select('id, cabang_id, status, dibuka_pada, ditutup_pada, kas_awal, kas_seharusnya, uang_fisik, selisih, kasir:kasir_id(nama_lengkap), cabang:cabang_id(nama, kode)')
    .order('dibuka_pada', { ascending: false });

  if (!isOwner && profile.cabang_id) {
    query = query.eq('cabang_id', profile.cabang_id);
  }

  const { data: shiftRaw } = await query;

  const shiftList: ShiftCabangItem[] = ((shiftRaw as unknown as RawShiftCabangRow[]) || []).map((s: RawShiftCabangRow) => {
    return {
      id: s.id,
      kasir_nama: s.kasir?.nama_lengkap || 'Kasir',
      cabang_id: s.cabang_id,
      cabang_nama: s.cabang?.nama || 'Cabang',
      waktu: formatRentangWaktuShift(s.dibuka_pada, s.ditutup_pada),
      awal: s.kas_awal,
      seharusnya: s.kas_seharusnya,
      fisik: s.uang_fisik,
      selisih: s.selisih,
      status: s.status,
    };
  });

  return (
    <ShiftCabangClient
      initialShifts={shiftList}
      cabangList={cabangList}
      userRole={profile.peran}
      userCabangNama={profile.cabang?.nama}
    />
  );
}
