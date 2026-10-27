import { getUserProfile } from '@/lib/auth/get-user-profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { ProdukClient, ProdukItem } from './produk-client';

export const instant = false;

export default async function ProdukPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir dilarang mengakses katalog master produk
  if (profile.peran === 'kasir') {
    redirect('/kasir?denied=1');
  }

  const isOwner = profile.peran === 'owner';
  const supabase = await createClient();

  // 1. Query master produk nyata dari Supabase
  const { data: produkRaw } = await supabase
    .from('produk')
    .select('id, sku, nama, kategori, harga_jual, lacak_stok, aktif')
    .order('kategori', { ascending: true })
    .order('sku', { ascending: true });

  // 2. Jika role Owner, ambil snapshot riwayat modal terkini (BR-11)
  const modalMap = new Map<string, number>();
  if (isOwner && produkRaw && produkRaw.length > 0) {
    const { data: modalRaw } = await supabase
      .from('riwayat_harga_modal')
      .select('produk_id, harga_modal, berlaku_mulai')
      .order('berlaku_mulai', { ascending: false });

    if (modalRaw) {
      for (const m of modalRaw) {
        if (!modalMap.has(m.produk_id)) {
          modalMap.set(m.produk_id, m.harga_modal);
        }
      }
    }
  }

  const produkList: ProdukItem[] = (produkRaw || []).map((p) => ({
    id: p.id,
    sku: p.sku,
    nama: p.nama,
    kategori: p.kategori,
    harga_jual: p.harga_jual,
    lacak_stok: p.lacak_stok,
    aktif: p.aktif,
    harga_modal: isOwner ? modalMap.get(p.id) ?? null : undefined,
  }));

  return <ProdukClient initialProduk={produkList} userRole={profile.peran} />;
}
