import { getUserProfile } from '@/lib/auth/get-user-profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { StokClient, StokItem } from './stok-client';

export const instant = false;

interface RawStokRow {
  id: string;
  cabang_id: string;
  produk_id: string;
  jumlah: number;
  stok_minimum: number;
  cabang?: { nama: string; kode: string } | null;
  produk?: { id: string; sku: string; nama: string; kategori: string; lacak_stok: boolean } | null;
}

export default async function StokPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir dilarang mengakses halaman stok
  if (profile.peran === 'kasir') {
    redirect('/kasir?denied=1');
  }

  const isOwner = profile.peran === 'owner';
  const supabase = await createClient();

  // Query daftar cabang untuk filter dan modal
  const { data: cabangRaw } = await supabase
    .from('cabang')
    .select('id, nama, kode')
    .eq('aktif', true)
    .order('nama', { ascending: true });

  const cabangList = cabangRaw || [];

  // Query stok cabang dengan filter cabang sesuai role (Kepala Toko hanya melihat cabangnya)
  let query = supabase
    .from('stok_cabang')
    .select('id, cabang_id, produk_id, jumlah, stok_minimum, diubah_pada, cabang:cabang_id(nama, kode), produk:produk_id(id, sku, nama, kategori, lacak_stok)')
    .order('jumlah', { ascending: true });

  if (!isOwner && profile.cabang_id) {
    query = query.eq('cabang_id', profile.cabang_id);
  }

  const { data: stokRaw } = await query;

  const stokList: StokItem[] = ((stokRaw as unknown as RawStokRow[]) || []).map((item: RawStokRow) => {
    let status: 'habis' | 'kritis' | 'menipis' | 'aman' = 'aman';
    if (item.jumlah === 0) {
      status = 'habis';
    } else if (item.jumlah < item.stok_minimum) {
      status = 'kritis';
    } else if (item.jumlah === item.stok_minimum) {
      status = 'menipis';
    }

    return {
      id: item.id,
      cabang_id: item.cabang_id,
      cabang_nama: item.cabang?.nama || 'Cabang',
      produk_id: item.produk_id || item.produk?.id || '',
      sku: item.produk?.sku || '-',
      nama: item.produk?.nama || 'Produk Tidak Ditemukan',
      kategori: item.produk?.kategori || '-',
      jumlah: item.jumlah,
      stok_minimum: item.stok_minimum,
      status,
    };
  });

  return (
    <StokClient
      initialStok={stokList}
      cabangList={cabangList}
      userRole={profile.peran}
      userCabangId={profile.cabang_id}
      userCabangNama={profile.cabang?.nama}
    />
  );
}
