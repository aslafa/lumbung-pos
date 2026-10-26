import { getUserProfile } from '@/lib/auth/get-user-profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { LaporanClient, LaporanTxItem, TopProductItem, LaporanShiftItem } from './laporan-client';

export const instant = false;

interface RawTxRow {
  id: string;
  total: number;
  metode_bayar: string;
  dibuat_pada: string;
  cabang_id: string;
  cabang?: { nama: string; kode: string } | null;
}

interface RawShiftRow {
  id: string;
  cabang_id: string;
  cabang?: { nama: string; kode: string } | null;
  kasir?: { nama_lengkap: string } | null;
  dibuka_pada: string;
  ditutup_pada: string | null;
  status: string;
  kas_awal: number;
  kas_seharusnya: number;
  uang_fisik: number | null;
  selisih: number | null;
  catatan_tutup: string | null;
}

interface RawTxItemRow {
  jumlah: number;
  subtotal: number;
  produk?: { nama: string; kategori: string } | null;
}

export default async function LaporanPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir dilarang mengakses laporan
  if (profile.peran === 'kasir') {
    redirect('/kasir');
  }

  const isOwner = profile.peran === 'owner';
  const supabase = await createClient();

  // 1. Query seluruh cabang (untuk filter Owner)
  const { data: cabangRaw } = await supabase
    .from('cabang')
    .select('id, nama, kode')
    .eq('aktif', true)
    .order('nama', { ascending: true });

  const cabangList = cabangRaw || [];

  // 2. Query transaksi berstatus 'lunas' (BR-04, BR-11)
  let txQuery = supabase
    .from('transaksi')
    .select('id, total, metode_bayar, dibuat_pada, cabang_id, cabang:cabang_id(nama, kode)')
    .eq('status', 'lunas')
    .order('dibuat_pada', { ascending: false });

  if (!isOwner && profile.cabang_id) {
    txQuery = txQuery.eq('cabang_id', profile.cabang_id);
  }

  const { data: transaksiRaw } = await txQuery;

  const transaksiList: LaporanTxItem[] = ((transaksiRaw as unknown as RawTxRow[]) || []).map((t) => ({
    id: t.id,
    total: t.total,
    metode_bayar: t.metode_bayar,
    dibuat_pada: t.dibuat_pada,
    cabang_id: t.cabang_id,
    cabang_nama: t.cabang?.nama || 'Cabang',
  }));

  // 2b. Query count transaksi void (PRD Bagian 9)
  let voidQuery = supabase
    .from('transaksi')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'void');

  if (!isOwner && profile.cabang_id) {
    voidQuery = voidQuery.eq('cabang_id', profile.cabang_id);
  }
  const { count: voidCount } = await voidQuery;

  // 2c. Query data shift untuk tabel selisih kas per shift (PRD Bagian 9)
  let shiftQuery = supabase
    .from('shift_kasir')
    .select('id, cabang_id, cabang:cabang_id(nama, kode), kasir:kasir_id(nama_lengkap), dibuka_pada, ditutup_pada, status, kas_awal, kas_seharusnya, uang_fisik, selisih, catatan_tutup')
    .in('status', ['ditutup', 'diverifikasi'])
    .order('dibuka_pada', { ascending: false })
    .limit(25);

  if (!isOwner && profile.cabang_id) {
    shiftQuery = shiftQuery.eq('cabang_id', profile.cabang_id);
  }
  const { data: shiftRaw } = await shiftQuery;

  const shiftSelisihList: LaporanShiftItem[] = ((shiftRaw as unknown as RawShiftRow[]) || []).map((s) => ({
    id: s.id,
    cabang_id: s.cabang_id,
    cabang_nama: s.cabang?.nama || 'Cabang',
    cabang_kode: s.cabang?.kode || 'CAB',
    kasir_nama: s.kasir?.nama_lengkap || 'Kasir',
    dibuka_pada: s.dibuka_pada,
    ditutup_pada: s.ditutup_pada,
    status: s.status,
    kas_awal: s.kas_awal,
    kas_seharusnya: s.kas_seharusnya,
    uang_fisik: s.uang_fisik,
    selisih: s.selisih,
    catatan_tutup: s.catatan_tutup,
  }));

  // 3. Query Top Products dari transaksi_item yang lunas
  const { data: txItemRaw } = await supabase
    .from('transaksi_item')
    .select('jumlah, subtotal, produk:produk_id(nama, kategori)');

  const productAggMap = new Map<string, { nama: string; kategori: string; total_qty: number; total_omzet: number }>();

  ((txItemRaw as unknown as RawTxItemRow[]) || []).forEach((item) => {
    const prodName = item.produk?.nama || 'Item Lainnya';
    const prodCat = item.produk?.kategori || 'kopi';
    const existing = productAggMap.get(prodName);
    if (existing) {
      existing.total_qty += item.jumlah || 0;
      existing.total_omzet += item.subtotal || 0;
    } else {
      productAggMap.set(prodName, {
        nama: prodName,
        kategori: prodCat,
        total_qty: item.jumlah || 0,
        total_omzet: item.subtotal || 0,
      });
    }
  });

  const topProducts: TopProductItem[] = Array.from(productAggMap.values())
    .sort((a, b) => b.total_qty - a.total_qty)
    .slice(0, 10);

  // 4. Khusus Owner: Ambil modal dari transaksi_item_modal (BR-11)
  let totalModalOwner = 0;
  if (isOwner && transaksiList.length > 0) {
    const { data: modalList } = await supabase
      .from('transaksi_item_modal')
      .select('subtotal_modal');

    totalModalOwner = (modalList || []).reduce((sum, m) => sum + (m.subtotal_modal || 0), 0);
  }

  // 5. Query jumlah stok kritis/habis
  let stokQuery = supabase
    .from('stok_cabang')
    .select('jumlah, stok_minimum');

  if (!isOwner && profile.cabang_id) {
    stokQuery = stokQuery.eq('cabang_id', profile.cabang_id);
  }

  const { data: stokRaw } = await stokQuery;
  const lowStockCount = (stokRaw || []).filter(
    (s) => s.jumlah === 0 || s.jumlah <= s.stok_minimum
  ).length;

  return (
    <LaporanClient
      transaksiList={transaksiList}
      topProducts={topProducts}
      cabangList={cabangList}
      userRole={profile.peran}
      userCabangNama={profile.cabang?.nama}
      totalModalOwner={totalModalOwner}
      lowStockCount={lowStockCount}
      voidCount={voidCount || 0}
      shiftSelisihList={shiftSelisihList}
    />
  );
}
