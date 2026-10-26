'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { createMayarInvoice, MayarInvoiceItem } from '@/lib/mayar/client';
import {
  pesanTransaksiMayarDb,
  updateMayarInvoiceIdDb,
  batalkanTransaksiMayarDb,
  selesaikanTransaksiMayarDb,
  TransaksiMayarItem,
} from '@/lib/mayar/service';
import {
  isMejaAvailable,
  occupyMeja,
  releaseMeja,
  releaseMejaByTransaksi,
  getPesananByTransaksiId,
  JenisPesanan,
} from '@/lib/orders/order-flow';

export interface BuatTransaksiMayarParams {
  shift_id: string;
  diskon: number;
  alasan_diskon?: string;
  items: TransaksiMayarItem[];
  jenis_pesanan?: JenisPesanan;
  nomor_meja?: string | null;
  nama_pelanggan?: string | null;
  catatan_pesanan?: string | null;
}

export interface BuatTransaksiMayarResult {
  success: boolean;
  transaksi_id?: string;
  nomor_struk?: string;
  nomor_antrean?: string;
  jenis_pesanan?: JenisPesanan;
  nomor_meja?: string | null;
  nama_pelanggan?: string;
  invoice_id?: string;
  payment_url?: string;
  expired_at?: string;
  total?: number;
  subtotal?: number;
  cabang_nama?: string;
  items?: Array<{
    nama: string;
    harga: number;
    jumlah: number;
    subtotal: number;
  }>;
  error?: string;
}

/**
 * Server Action: Membuat transaksi QRIS Dinamis Mayar
 * - Melakukan reservasi stok di DB
 * - Memanggil Mayar API v2 create invoice (expired 10 menit)
 * - Jika gateway gagal, stok langsung dipulihkan secara otomatis
 */
export async function buatTransaksiMayarAction(
  params: BuatTransaksiMayarParams
): Promise<BuatTransaksiMayarResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi kasir telah berakhir. Silakan login kembali.' };
    }

    if (!params.shift_id) {
      return { success: false, error: 'Shift kasir tidak ditemukan atau belum dibuka.' };
    }

    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Keranjang transaksi tidak boleh kosong.' };
    }

    // Ambil info shift & cabang
    const { data: shiftData } = await supabase
      .from('shift_kasir')
      .select('cabang_id, cabang:cabang_id(kode, nama)')
      .eq('id', params.shift_id)
      .single();

    const cabangId = shiftData?.cabang_id || '';
    const cleanNomorMeja = params.jenis_pesanan === 'DINE_IN' ? params.nomor_meja?.trim() || null : null;

    // Validasi meja sebelum reservasi stok (Wajib untuk Dine In, isolasi cabang, mencegah race condition)
    if (params.jenis_pesanan === 'DINE_IN') {
      if (!cleanNomorMeja) {
        return {
          success: false,
          error: 'Pesanan Dine In wajib memilih nomor meja yang tersedia.',
        };
      }
      if (!cabangId) {
        return {
          success: false,
          error: 'Cabang aktif tidak terdeteksi untuk shift ini.',
        };
      }
      if (!isMejaAvailable(cabangId, cleanNomorMeja)) {
        return {
          success: false,
          error: `Meja ${cleanNomorMeja} saat ini sedang terisi oleh pesanan lain. Silakan pilih meja yang tersedia.`,
        };
      }
    }

    // 1. Pesan Transaksi & Reservasi Stok di Database
    const dbResult = await pesanTransaksiMayarDb({
      ...params,
      nomor_meja: cleanNomorMeja,
    });
    if (!dbResult.success || !dbResult.transaksi_id) {
      return { success: false, error: dbResult.error || 'Gagal mereservasi stok transaksi.' };
    }

    const transaksiId = dbResult.transaksi_id;
    const nomorStruk = dbResult.nomor_struk || 'STRUK';

    // Kunci meja jika Dine In selama menunggu bayar QRIS
    if (params.jenis_pesanan === 'DINE_IN' && cleanNomorMeja && cabangId) {
      occupyMeja(cabangId, cleanNomorMeja, transaksiId, nomorStruk, {
        nomor_struk: nomorStruk,
        total: dbResult.total || 0,
        items: (dbResult.items || []).map((it) => ({ nama: it.nama, jumlah: it.jumlah })),
      });
    }

    // 2. Siapkan Payload Invoice Mayar (Expired 10 Menit Sesuai PRD)
    const expiredAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const mayarItems: MayarInvoiceItem[] = (dbResult.items || []).map((it) => ({
      description: it.nama,
      quantity: it.jumlah,
      rate: it.harga,
    }));

    // Bila ada diskon transaksi, tambahkan item penyesuaian diskon agar total tagihan Mayar sama persis
    if (dbResult.diskon && dbResult.diskon > 0) {
      mayarItems.push({
        description: `Diskon Transaksi (${dbResult.nomor_struk})`,
        quantity: 1,
        rate: -Math.abs(dbResult.diskon),
      });
    }

    // 3. Panggil Gateway Mayar API
    try {
      const customerDisplayName =
        (params.nama_pelanggan && params.nama_pelanggan.trim() && params.nama_pelanggan.trim() !== 'Pelanggan Umum')
          ? params.nama_pelanggan.trim()
          : (dbResult.nama_pelanggan && dbResult.nama_pelanggan.trim() && dbResult.nama_pelanggan.trim() !== 'Pelanggan Umum')
          ? dbResult.nama_pelanggan.trim()
          : `Pelanggan ${dbResult.cabang_nama || 'Lumbung POS'}`;

      const mayarRes = await createMayarInvoice({
        name: customerDisplayName,
        email: 'transaksi@lumbungpos.local',
        mobile: '081234567890',
        description: `Pembayaran Struk ${nomorStruk}`,
        expiredAt,
        items: mayarItems,
      });

      const invoiceData = mayarRes.data;
      if (!invoiceData?.id) {
        throw new Error('Respons gateway Mayar tidak memuat ID Invoice.');
      }

      // 4. Update ID Invoice Mayar ke Transaksi POS
      await updateMayarInvoiceIdDb(transaksiId, invoiceData.id);

      revalidatePath('/kasir');
      revalidatePath('/stok');
      revalidatePath('/transaksi');
      revalidatePath('/meja');

      return {
        success: true,
        transaksi_id: transaksiId,
        nomor_struk: nomorStruk,
        nomor_antrean: dbResult.nomor_antrean,
        jenis_pesanan: params.jenis_pesanan,
        nomor_meja: cleanNomorMeja,
        nama_pelanggan: params.nama_pelanggan || dbResult.nama_pelanggan || 'Pelanggan Umum',
        invoice_id: invoiceData.id,
        payment_url: invoiceData.paymentUrl || invoiceData.link,
        expired_at: expiredAt,
        total: dbResult.total,
        subtotal: dbResult.subtotal,
        cabang_nama: dbResult.cabang_nama,
        items: dbResult.items,
      };
    } catch (gatewayErr: unknown) {
      // Bebaskan meja jika gateway gagal
      if (params.jenis_pesanan === 'DINE_IN' && cleanNomorMeja && cabangId) {
        releaseMeja(cabangId, cleanNomorMeja);
      }

      // 5. ROLLBACK ATOMIK: Jika panggil Mayar gagal, batalkan transaksi dan pulihkan stok seketika
      const gatewayMsg =
        gatewayErr instanceof Error ? gatewayErr.message : 'Gagal menghubungi gateway Mayar';

      const rollbackRes = await batalkanTransaksiMayarDb(
        transaksiId,
        `Rollback otomatis: Gagal panggil Mayar API (${gatewayMsg})`
      );

      revalidatePath('/kasir');
      revalidatePath('/stok');
      revalidatePath('/meja');

      const stokStatus = rollbackRes.success
        ? 'Stok telah dikembalikan aman.'
        : `Peringatan status stok: ${rollbackRes.pesan || rollbackRes.error || 'Periksa status transaksi'}.`;

      return {
        success: false,
        error: `Gagal memproses QRIS Mayar: ${gatewayMsg}. ${stokStatus}`,
      };
    }
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat membuat transaksi Mayar.';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Batalkan transaksi QRIS Mayar (oleh kasir atau timeout)
 */
export async function batalkanTransaksiMayarAction(
  transaksiId: string,
  alasan: string = 'Dibatalkan oleh kasir'
) {
  try {
    const res = await batalkanTransaksiMayarDb(transaksiId, alasan);

    // Bebaskan meja operasional jika transaksi ini menempati meja
    releaseMejaByTransaksi(transaksiId);

    revalidatePath('/kasir');
    revalidatePath('/stok');
    revalidatePath('/transaksi');
    revalidatePath('/meja');
    revalidatePath('/antrean');

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal membatalkan transaksi.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Cek status terkini transaksi (untuk polling real-time kasir dan verifikasi gateway)
 */
export async function cekStatusTransaksiMayarAction(transaksiId: string) {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return { success: false, error: 'Client database tidak tersedia.' };
    }

    // Ambil data pesanan dari store operasional terlebih dahulu sebagai referensi awal
    const pesananOps = getPesananByTransaksiId(transaksiId);

    interface TrxQueryResult {
      id: string;
      nomor_struk: string;
      nomor_antrean?: string | null;
      jenis_pesanan?: JenisPesanan | null;
      nomor_meja?: string | null;
      nama_pelanggan?: string | null;
      catatan_pesanan?: string | null;
      status: string;
      status_pengerjaan?: string | null;
      total: number;
      dibayar_pada?: string | null;
      mayar_invoice_id?: string | null;
    }

    // Coba query Supabase dengan kolom lengkap, atau fallback ke kolom dasar jika kolom antrean belum dimigrasi
    let trx: TrxQueryResult | null = null;
    let queryError: { code?: string; message?: string } | null = null;

    // 1. Coba query dengan kolom lengkap
    const fullQuery = await admin
      .from('transaksi')
      .select('id, nomor_struk, nomor_antrean, jenis_pesanan, nomor_meja, nama_pelanggan, status, status_pengerjaan, total, dibayar_pada, mayar_invoice_id')
      .or(`id.eq.${transaksiId},nomor_struk.eq.${transaksiId}`)
      .maybeSingle();

    if (fullQuery.error) {
      if (fullQuery.error.code === '42703') {
        // Kolom belum ada di database remote, fallback ke query kolom dasar
        const basicQuery = await admin
          .from('transaksi')
          .select('id, nomor_struk, status, total, dibayar_pada, mayar_invoice_id')
          .or(`id.eq.${transaksiId},nomor_struk.eq.${transaksiId}`)
          .maybeSingle();

        if (basicQuery.error) {
          queryError = basicQuery.error;
        } else {
          trx = basicQuery.data as unknown as TrxQueryResult;
        }
      } else {
        queryError = fullQuery.error;
      }
    } else {
      trx = fullQuery.data as unknown as TrxQueryResult;
    }

    if (!trx && pesananOps?.transaksi_id) {
      // Jika transaksi belum ditemukan di Supabase tetapi ada di operational store
      trx = {
        id: pesananOps.transaksi_id,
        nomor_struk: pesananOps.nomor_struk,
        status: pesananOps.status_pembayaran === 'LUNAS' ? 'selesai' : 'menunggu_bayar',
        total: pesananOps.total,
        dibayar_pada: pesananOps.status_pembayaran === 'LUNAS' ? new Date().toISOString() : null,
        mayar_invoice_id: null,
      };
    }

    if (!trx) {
      console.warn(`[cekStatusTransaksiMayarAction] Transaksi not found for ID/Struk: ${transaksiId}. DB error:`, queryError);
      return { success: false, error: 'Transaksi tidak ditemukan di sistem kasir.' };
    }

    // Jika masih menunggu bayar dan memiliki invoice_id, cek langsung ke gateway Mayar untuk verifikasi
    if (trx.status === 'menunggu_bayar' && trx.mayar_invoice_id) {
      try {
        const { getMayarInvoiceDetail } = await import('@/lib/mayar/client');
        const mayarDetail = await getMayarInvoiceDetail(trx.mayar_invoice_id);
        const invoiceStatus = (mayarDetail.data?.status || '').toUpperCase();
        const paidAmount = mayarDetail.data?.amount;

        if (invoiceStatus === 'PAID' || invoiceStatus === 'SETTLED' || invoiceStatus === 'SUCCESS') {
          // Validasi nominal pembayaran jika gateway mengembalikan amount
          if (typeof paidAmount === 'number' && paidAmount > 0 && paidAmount !== trx.total) {
            console.error(`[cekStatusTransaksiMayarAction] Mismatch amount! Expected: ${trx.total}, Paid: ${paidAmount}`);
            return {
              success: false,
              error: `Ketidaksesuaian nominal pembayaran: total tagihan sistem Rp${trx.total.toLocaleString('id-ID')}, namun nominal invoice Mayar Rp${paidAmount.toLocaleString('id-ID')}. Transaksi ditahan untuk investigasi.`,
            };
          }

          const settleRes = await selesaikanTransaksiMayarDb(trx.mayar_invoice_id, undefined, paidAmount);
          if (!settleRes.success) {
            return {
              success: false,
              error: settleRes.error || settleRes.pesan || 'Gagal menyelesaikan transaksi di database.',
            };
          }

          trx.status = 'selesai';
          trx.dibayar_pada = trx.dibayar_pada || new Date().toISOString();
        }
      } catch (gatewayCheckErr) {
        // Gateway Mayar tidak dapat dijangkau sementara / error network
        console.warn('[cekStatusTransaksiMayarAction] Mayar verification warning:', gatewayCheckErr);
      }
    }

    // Refresh operational store jika status telah lunas
    const refreshedPesanan = getPesananByTransaksiId(trx.id) || getPesananByTransaksiId(trx.nomor_struk) || pesananOps;

    // Pemulihan cadangan cloud dari audit_log jika jenis_pesanan belum tercatat di operational store
    let auditBackup: {
      jenis_pesanan?: JenisPesanan;
      nomor_meja?: string | null;
      nama_pelanggan?: string | null;
      nomor_antrean?: string | null;
    } | null = null;

    if (!trx.jenis_pesanan && !refreshedPesanan?.jenis_pesanan) {
      try {
        const { data: auditLogs } = await admin
          .from('audit_log')
          .select('nilai_sesudah')
          .eq('tabel', 'transaksi')
          .eq('data_id', trx.id)
          .order('dibuat_pada', { ascending: false })
          .limit(1);

        if (auditLogs && auditLogs.length > 0 && auditLogs[0].nilai_sesudah) {
          const val = auditLogs[0].nilai_sesudah as Record<string, unknown>;
          auditBackup = {
            jenis_pesanan: val.jenis_pesanan as JenisPesanan,
            nomor_meja: (val.nomor_meja as string) || null,
            nama_pelanggan: (val.nama_pelanggan as string) || null,
            nomor_antrean: (val.nomor_antrean as string) || null,
          };
        }
      } catch (auditErr) {
        console.warn('[cekStatusTransaksiMayarAction] Failed to read audit_log backup:', auditErr);
      }
    }

    const finalNomorMeja = trx.nomor_meja || refreshedPesanan?.nomor_meja || auditBackup?.nomor_meja || null;
    const isDineIn = trx.jenis_pesanan === 'DINE_IN' || refreshedPesanan?.jenis_pesanan === 'DINE_IN' || auditBackup?.jenis_pesanan === 'DINE_IN' || !!finalNomorMeja;
    const finalJenisPesanan: JenisPesanan = isDineIn ? 'DINE_IN' : ((trx.jenis_pesanan || refreshedPesanan?.jenis_pesanan || auditBackup?.jenis_pesanan || 'TAKEAWAY') as JenisPesanan);
    const finalNamaPelanggan =
      (refreshedPesanan?.nama_pelanggan && refreshedPesanan.nama_pelanggan !== 'Pelanggan Umum')
        ? refreshedPesanan.nama_pelanggan
        : (trx.nama_pelanggan && trx.nama_pelanggan !== 'Pelanggan Umum')
        ? trx.nama_pelanggan
        : (auditBackup?.nama_pelanggan && auditBackup.nama_pelanggan !== 'Pelanggan Umum')
        ? auditBackup.nama_pelanggan
        : refreshedPesanan?.nama_pelanggan || auditBackup?.nama_pelanggan || trx.nama_pelanggan || 'Pelanggan Umum';

    let finalNomorAntrean =
      (trx.nomor_antrean && trx.nomor_antrean !== '-')
        ? trx.nomor_antrean
        : (refreshedPesanan?.nomor_antrean && refreshedPesanan.nomor_antrean !== '-')
        ? refreshedPesanan.nomor_antrean
        : auditBackup?.nomor_antrean;

    if (!finalNomorAntrean || finalNomorAntrean === '-') {
      const match = (trx.nomor_struk || '').replace(/[^0-9]/g, '').slice(-3) || '001';
      finalNomorAntrean = `A-${match.padStart(3, '0')}`;
    }

    return {
      success: true,
      transaksi_id: trx.id,
      nomor_struk: trx.nomor_struk,
      nomor_antrean: finalNomorAntrean,
      jenis_pesanan: finalJenisPesanan,
      nomor_meja: finalNomorMeja,
      nama_pelanggan: finalNamaPelanggan,
      status: trx.status,
      status_pengerjaan: trx.status_pengerjaan || refreshedPesanan?.status_pengerjaan || 'MENUNGGU',
      dibayar_pada: trx.dibayar_pada,
      total: trx.total,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memeriksa status transaksi.';
    console.error('[cekStatusTransaksiMayarAction] Error:', err);
    return { success: false, error: msg };
  }
}
