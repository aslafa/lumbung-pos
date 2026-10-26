import { getUserProfile } from '@/lib/auth/get-user-profile';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Ban, AlertCircle } from 'lucide-react';
import { TransaksiClient, TransaksiRowData } from './transaksi-client';

export const instant = false;

interface RawTransaksiJoined {
  id: string;
  nomor_struk: string;
  dibuat_pada: string;
  subtotal: number;
  diskon: number;
  alasan_diskon?: string | null;
  total: number;
  metode_bayar: string;
  status: string;
  kasir?: { nama_lengkap: string } | null;
  cabang?: { nama: string; kode: string } | null;
  transaksi_item?: Array<{
    id: string;
    nama_produk: string;
    harga_satuan: number;
    jumlah: number;
    subtotal: number;
  }>;
}

export default async function TransaksiPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  const isVoidAllowed = profile.peran === 'kepala_toko' || profile.peran === 'owner';
  const supabase = await createClient();

  // Query transaksi dari database dengan RLS filter otomatis sesuai peran pengguna
  let query = supabase
    .from('transaksi')
    .select(
      'id, nomor_struk, dibuat_pada, subtotal, diskon, alasan_diskon, total, metode_bayar, status, kasir:kasir_id(nama_lengkap), cabang:cabang_id(nama, kode), transaksi_item(id, nama_produk, harga_satuan, jumlah, subtotal)'
    )
    .order('dibuat_pada', { ascending: false });

  if (profile.peran === 'kasir') {
    query = query.eq('kasir_id', profile.id);
  } else if (profile.peran === 'kepala_toko' && profile.cabang_id) {
    query = query.eq('cabang_id', profile.cabang_id);
  }

  const { data: transaksiRaw, error: transaksiError } = await query;

  const transaksiList: TransaksiRowData[] = (
    (transaksiRaw as unknown as RawTransaksiJoined[]) || []
  ).map((trx: RawTransaksiJoined) => ({
    id: trx.id,
    nomor_struk: trx.nomor_struk,
    dibuat_pada: trx.dibuat_pada,
    waktu_wib:
      new Date(trx.dibuat_pada).toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }) + ' WIB',
    subtotal: trx.subtotal || trx.total,
    diskon: trx.diskon || 0,
    alasan_diskon: trx.alasan_diskon,
    total: trx.total,
    metode_bayar: trx.metode_bayar,
    status: trx.status,
    kasir_nama: trx.kasir?.nama_lengkap || 'Kasir',
    cabang_nama: trx.cabang?.nama || 'Cabang',
    items: trx.transaksi_item || [],
    voidEligible: trx.status === 'lunas' && isVoidAllowed,
  }));

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E8DFD3] dark:border-[#382F28] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[#2C1810] dark:text-[#FAF7F2] tracking-tight">
            Riwayat Transaksi Penjualan
          </h1>
          <p className="text-xs text-[#78716C] dark:text-[#A89F91] mt-0.5">
            {profile.peran === 'kasir'
              ? 'Daftar transaksi yang Anda layani pada cabang Anda'
              : profile.peran === 'kepala_toko'
              ? `Seluruh transaksi cabang ${profile.cabang?.nama || ''} (Supervisi & Otorisasi Void)`
              : 'Seluruh riwayat transaksi penjualan di semua cabang Lumbung Kopi dan Roti'}
          </p>
        </div>

        {isVoidAllowed && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 font-bold shrink-0">
            <Ban className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>Otorisasi Void Aktif</span>
          </div>
        )}
      </div>

      {/* Error state if database query failed */}
      {transaksiError && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-2xl p-4 flex items-start gap-3 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="font-bold">Gagal memuat transaksi dari database</p>
            <p className="text-[11px] mt-0.5">{transaksiError.message}</p>
          </div>
        </div>
      )}

      {/* Interactive Transaksi Client Component */}
      <TransaksiClient
        transaksiList={transaksiList}
        peran={profile.peran}
        isVoidAllowed={isVoidAllowed}
      />
    </div>
  );
}
