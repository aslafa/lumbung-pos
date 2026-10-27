import { getUserProfile } from '@/lib/auth/get-user-profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { KasirPOSClient, ProdukPOS, ShiftAktifInfo } from './kasir-client';

export const instant = false;

export default async function KasirPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Halaman Kasir POS dikhususkan hanya untuk staf Kasir
  if (profile.peran !== 'kasir') {
    redirect(profile.peran === 'owner' ? '/laporan?denied=1' : '/transaksi?denied=1');
  }

  const supabase = await createClient();

  // 1. Ambil data shift aktif kasir yang sedang login (status = 'buka')
  const { data: shiftData } = await supabase
    .from('shift_kasir')
    .select('id, kasir_id, cabang_id, kas_awal, dibuka_pada, status')
    .eq('kasir_id', profile.id)
    .eq('status', 'buka')
    .maybeSingle();

  const shiftAktif: ShiftAktifInfo | null = shiftData
    ? {
      id: shiftData.id,
      kasir_id: shiftData.kasir_id,
      cabang_id: shiftData.cabang_id,
      kas_awal: shiftData.kas_awal,
      dibuka_pada: shiftData.dibuka_pada,
    }
    : null;

  // 2. Tentukan cabang yang digunakan untuk filter stok
  // Jika Owner tidak punya cabang_id tetap, gunakan cabang dari shift aktif atau default cabang pertama
  let targetCabangId = profile.cabang_id;
  if (!targetCabangId && shiftAktif) {
    targetCabangId = shiftAktif.cabang_id;
  }
  if (!targetCabangId) {
    const { data: cabangList } = await supabase
      .from('cabang')
      .select('id')
      .eq('aktif', true)
      .limit(1);
    targetCabangId = cabangList?.[0]?.id || null;
  }

  // 3. Ambil data produk aktif
  const { data: produkList } = await supabase
    .from('produk')
    .select('id, sku, nama, kategori, harga_jual, lacak_stok, aktif')
    .eq('aktif', true)
    .order('kategori', { ascending: true })
    .order('nama', { ascending: true });

  // 4. Ambil stok cabang pengguna saat ini (TIDAK mengambil stok cabang lain)
  const stokMap = new Map<string, number>();
  if (targetCabangId) {
    const { data: stokList } = await supabase
      .from('stok_cabang')
      .select('produk_id, jumlah')
      .eq('cabang_id', targetCabangId);

    if (stokList) {
      for (const item of stokList) {
        stokMap.set(item.produk_id, item.jumlah);
      }
    }
  }

  // 5. Gabungkan produk dan stok cabang spesifik
  const initialProducts: ProdukPOS[] = (produkList || []).map((p) => {
    let stokTersedia: number | null = null;
    if (p.lacak_stok) {
      stokTersedia = stokMap.has(p.id) ? (stokMap.get(p.id) ?? 0) : 0;
    }

    return {
      id: p.id,
      sku: p.sku,
      nama: p.nama,
      kategori: p.kategori,
      harga_jual: p.harga_jual,
      lacak_stok: p.lacak_stok,
      stok_tersedia: stokTersedia,
    };
  });

  // 6. Muat data meja fisik dan antrean cabang aktif
  const { getAntreanDataAction } = await import('@/app/actions/antrean');
  const antreanRes = await getAntreanDataAction(targetCabangId || undefined);
  const initialMejaList = antreanRes.mejaList || [];
  const initialAntreanList = antreanRes.antrean || [];

  return (
    <KasirPOSClient
      initialProducts={initialProducts}
      initialMejaList={initialMejaList}
      initialAntreanList={initialAntreanList}
      targetCabangId={targetCabangId || ''}
      shiftAktif={shiftAktif}
      kasirNama={profile.nama_lengkap}
      cabangNama={profile.cabang?.nama || 'Lumbung Cabang'}
      cabangAlamat={profile.cabang?.alamat || undefined}
      userRole={profile.peran}
    />
  );
}
