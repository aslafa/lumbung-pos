'use server';

import { getUserProfile } from '../../lib/auth/get-user-profile.ts';
import {
  getAntreanList,
  transitionStatusPengerjaan,
  updateStatusMeja,
  getDefaultMejaCabang,
  StatusPengerjaan,
  PesananAntreanItem,
  MejaItem,
  JenisPesanan
} from '../../lib/orders/order-flow.ts';
import { revalidatePath } from 'next/cache';

export interface AntreanDataResponse {
  success: boolean;
  antrean: PesananAntreanItem[];
  mejaList: MejaItem[];
  error?: string;
}

/**
 * Server Action: Mengambil data antrean KDS dan status meja untuk cabang aktif
 */
export async function getAntreanDataAction(targetCabangId?: string): Promise<AntreanDataResponse> {
  try {
    const { profile } = await getUserProfile();
    if (!profile) {
      return { success: false, antrean: [], mejaList: [], error: 'Sesi tidak valid.' };
    }

    const effectiveCabangId = profile.peran === 'owner' && targetCabangId
      ? targetCabangId
      : profile.cabang_id || '';

    let antrean = getAntreanList(effectiveCabangId || undefined);
    const mejaList = effectiveCabangId ? getDefaultMejaCabang(effectiveCabangId) : [];

    // Hydrate & sinkronkan pesanan aktif dari Supabase transaksi
    try {
      const { createAdminClient } = await import('../../lib/supabase/admin.ts');
      const admin = createAdminClient();

      if (admin) {
        let query = admin
          .from('transaksi')
          .select(`
            id,
            nomor_struk,
            nomor_antrean,
            jenis_pesanan,
            nomor_meja,
            nama_pelanggan,
            catatan_pesanan,
            status_pengerjaan,
            diselesaikan_pada,
            cabang_id,
            status,
            total,
            metode_bayar,
            dibuat_pada,
            cabang:cabang_id (
              nama,
              kode
            ),
            transaksi_item (
              id,
              nama_produk,
              jumlah,
              subtotal
            )
          `)
          .in('status', ['lunas', 'menunggu_bayar'])
          .order('dibuat_pada', { ascending: false })
          .limit(50);

        if (effectiveCabangId && effectiveCabangId !== 'all') {
          query = query.eq('cabang_id', effectiveCabangId);
        }

        interface RawTransaksiRow {
          id: string;
          nomor_struk: string;
          nomor_antrean?: string | null;
          jenis_pesanan?: JenisPesanan | null;
          nomor_meja?: string | null;
          nama_pelanggan?: string | null;
          catatan_pesanan?: string | null;
          status_pengerjaan?: string | null;
          diselesaikan_pada?: string | null;
          cabang_id: string;
          status: string;
          total: number;
          metode_bayar: string | null;
          dibuat_pada: string;
          cabang?: { nama?: string; kode?: string } | { nama?: string; kode?: string }[] | null;
          transaksi_item?: Array<{
            id: string;
            nama_produk: string;
            jumlah: number;
            subtotal: number;
          }> | null;
        }

        let trxList: RawTransaksiRow[] | null = null;
        const mainRes = await query;
        if (mainRes.error && mainRes.error.code === '42703') {
          let fallbackQuery = admin
            .from('transaksi')
            .select(`
              id,
              nomor_struk,
              cabang_id,
              status,
              total,
              metode_bayar,
              dibuat_pada,
              cabang:cabang_id (
                nama,
                kode
              ),
              transaksi_item (
                id,
                nama_produk,
                jumlah,
                subtotal
              )
            `)
            .in('status', ['lunas', 'menunggu_bayar'])
            .order('dibuat_pada', { ascending: false })
            .limit(50);

          if (effectiveCabangId && effectiveCabangId !== 'all') {
            fallbackQuery = fallbackQuery.eq('cabang_id', effectiveCabangId);
          }
          const fallbackRes = await fallbackQuery;
          trxList = fallbackRes.data as unknown as RawTransaksiRow[] | null;

          // Pulihkan metadata operasional (status_pengerjaan, meja, nama, antrean) dari audit_log
          if (trxList && trxList.length > 0) {
            const trxIds = trxList.map((t) => t.id);
            try {
              const { data: auditLogs } = await admin
                .from('audit_log')
                .select('data_id, nilai_sesudah')
                .in('data_id', trxIds);

              if (auditLogs && auditLogs.length > 0) {
                const auditMap = new Map<string, Record<string, unknown>>();
                for (const al of auditLogs) {
                  if (al.data_id && al.nilai_sesudah) {
                    auditMap.set(al.data_id, al.nilai_sesudah as Record<string, unknown>);
                  }
                }

                for (const t of trxList) {
                  const auditVal = auditMap.get(t.id);
                  if (auditVal) {
                    t.status_pengerjaan = (auditVal.status_pengerjaan as string) || (t.status === 'lunas' ? 'MENUNGGU' : undefined);
                    t.jenis_pesanan = (auditVal.jenis_pesanan as JenisPesanan) || (auditVal.nomor_meja ? 'DINE_IN' : 'TAKEAWAY');
                    t.nomor_meja = (auditVal.nomor_meja as string) || null;
                    t.nama_pelanggan = (auditVal.nama_pelanggan as string) || null;
                    t.catatan_pesanan = (auditVal.catatan_pesanan as string) || null;
                    t.nomor_antrean = (auditVal.nomor_antrean as string) || null;
                  }
                }
              }
            } catch {
              // Non-fatal
            }
          }
        } else {
          trxList = mainRes.data as unknown as RawTransaksiRow[] | null;
        }

        if (trxList && trxList.length > 0) {
          const { registerPesananAntrean, getPesananByTransaksiId } = await import('../../lib/orders/order-flow.ts');
          for (const trx of trxList) {
            // HANYA sinkronkan jika memiliki status_pengerjaan aktif yang belum selesai di database
            if (!trx.status_pengerjaan || !['MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL'].includes(trx.status_pengerjaan)) {
              continue;
            }

            const existing = antrean.find((a) => a.transaksi_id === trx.id) || getPesananByTransaksiId(trx.id);

            // Jika sudah berstatus SELESAI di operational store, abaikan
            if (existing && existing.status_pengerjaan === 'SELESAI') {
              continue;
            }

            const rawCabang = Array.isArray(trx.cabang) ? trx.cabang[0] : trx.cabang;
            const cName = rawCabang?.nama || 'Lumbung Kopi';
            const cKode = rawCabang?.kode || 'POS';
            const prefix = cKode === 'TBT' ? 'A' : cKode === 'BTR' ? 'B' : cKode === 'DPK' ? 'C' : 'Q';
            const numPart = (trx.nomor_struk || '').replace(/[^0-9]/g, '').slice(-3) || '001';
            const antreanNum = trx.nomor_antrean || existing?.nomor_antrean || `${prefix}-${numPart}`;

            const statusPengerjaan = (trx.status_pengerjaan as StatusPengerjaan) || existing?.status_pengerjaan || 'MENUNGGU';

            if (!existing) {
              registerPesananAntrean({
                transaksi_id: trx.id,
                nomor_struk: trx.nomor_struk,
                nomor_antrean: antreanNum,
                cabang_id: trx.cabang_id,
                cabang_nama: cName,
                jenis_pesanan: trx.jenis_pesanan || (trx.nomor_meja ? 'DINE_IN' : 'TAKEAWAY'),
                nomor_meja: trx.nomor_meja || null,
                nama_pelanggan: trx.nama_pelanggan || null,
                catatan_pesanan: trx.catatan_pesanan || null,
                status_pengerjaan: statusPengerjaan,
                dibuat_pada: trx.dibuat_pada,
                diselesaikan_pada: trx.diselesaikan_pada || undefined,
                items: (trx.transaksi_item || []).map((it) => ({
                  nama: it.nama_produk,
                  jumlah: it.jumlah,
                  subtotal: it.subtotal,
                })),
                total: trx.total,
                metode_bayar: trx.metode_bayar || 'tunai',
                status_pembayaran: 'LUNAS',
              });
            } else {
              existing.status_pembayaran = 'LUNAS';
            }
          }
          antrean = getAntreanList(effectiveCabangId || undefined);
        }
        // Filter agar pesanan yang menunggu bayar tidak tampil sebagai antrean siap racik
        antrean = antrean.filter((a) => a.status_pembayaran === 'LUNAS' && a.status_pengerjaan !== 'SELESAI');
      }
    } catch (hydrateErr) {
      console.warn('[KDS Hydration] Tidak dapat menyinkronkan transaksi historis Supabase:', hydrateErr);
    }

    return {
      success: true,
      antrean,
      mejaList,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengambil data antrean.';
    return { success: false, antrean: [], mejaList: [], error: msg };
  }
}

/**
 * Server Action: Memperbarui status pengerjaan pesanan barista / dapur
 */
export async function updateStatusPengerjaanAction(
  transaksiId: string,
  nextStatus: StatusPengerjaan
): Promise<{ success: boolean; error?: string; pesanan?: PesananAntreanItem }> {
  try {
    const { profile } = await getUserProfile();
    if (!profile) {
      return { success: false, error: 'Sesi tidak valid.' };
    }

    const res = await transitionStatusPengerjaan(transaksiId, nextStatus, {
      id: profile.id,
      nama_lengkap: profile.nama_lengkap,
      peran: profile.peran,
      cabang_id: profile.cabang_id,
    });

    if (res.success) {
      revalidatePath('/antrean');
      revalidatePath('/kasir');
      revalidatePath('/transaksi');
      revalidatePath('/meja');
    }

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memperbarui status pengerjaan.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Menyelesaikan pembersihan meja (kembali ke 'tersedia')
 */
export async function bersihkanMejaAction(
  cabangId: string,
  nomorMeja: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await getUserProfile();
    if (!profile) {
      return { success: false, error: 'Sesi tidak valid.' };
    }

    const effectiveCabangId =
      profile.peran === 'owner' && cabangId && cabangId !== 'all'
        ? cabangId
        : profile.cabang_id || cabangId || 'cabang-utama';

    if (profile.peran !== 'owner' && profile.cabang_id && effectiveCabangId && profile.cabang_id !== effectiveCabangId) {
      return { success: false, error: 'Tidak memiliki otorisasi pada cabang ini.' };
    }

    const res = updateStatusMeja(effectiveCabangId, nomorMeja, 'tersedia');

    // Sinkronisasi status ke Supabase table meja jika tersedia
    try {
      const { createAdminClient } = await import('../../lib/supabase/admin.ts');
      const admin = createAdminClient();
      if (admin) {
        await admin
          .from('meja')
          .update({ status: 'tersedia', diubah_pada: new Date().toISOString() })
          .match({ cabang_id: effectiveCabangId, nomor_meja: nomorMeja });
      }
    } catch {
      // Non-fatal jika tabel meja tidak ada di remote db
    }

    if (res.success) {
      revalidatePath('/kasir');
      revalidatePath('/antrean');
      revalidatePath('/meja');
    }

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengubah status meja.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Memindahkan meja dari 'terisi' ke 'menunggu_dibersihkan' (Perlu Dibersihkan)
 */
export async function pindahkanMejaKePerluDibersihkanAction(
  cabangId: string,
  nomorMeja: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await getUserProfile();
    if (!profile) {
      return { success: false, error: 'Sesi tidak valid.' };
    }

    const effectiveCabangId =
      profile.peran === 'owner' && cabangId && cabangId !== 'all'
        ? cabangId
        : profile.cabang_id || cabangId || 'cabang-utama';

    if (profile.peran !== 'owner' && profile.cabang_id && effectiveCabangId && profile.cabang_id !== effectiveCabangId) {
      return { success: false, error: 'Tidak memiliki otorisasi pada cabang ini.' };
    }

    const res = updateStatusMeja(effectiveCabangId, nomorMeja, 'menunggu_dibersihkan');

    // Sinkronisasi status ke Supabase table meja jika tersedia
    try {
      const { createAdminClient } = await import('../../lib/supabase/admin.ts');
      const admin = createAdminClient();
      if (admin) {
        await admin
          .from('meja')
          .update({ status: 'menunggu_dibersihkan', diubah_pada: new Date().toISOString() })
          .match({ cabang_id: effectiveCabangId, nomor_meja: nomorMeja });
      }
    } catch {
      // Non-fatal jika tabel meja tidak ada di remote db
    }

    if (res.success) {
      revalidatePath('/kasir');
      revalidatePath('/antrean');
      revalidatePath('/meja');
    }

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal memindahkan meja ke perlu dibersihkan.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Menambahkan atau mengedit konfigurasi meja (Khusus Owner)
 */
export async function tambahAtauUbahMejaAction(
  cabangId: string,
  data: {
    nomor_meja: string;
    kapasitas: number;
    area?: 'Indoor' | 'Outdoor' | 'Teras';
    bentuk?: 'lingkaran' | 'persegi' | 'persegi_panjang';
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { profile } = await getUserProfile();
    if (!profile) {
      return { success: false, error: 'Sesi tidak valid.' };
    }

    if (profile.peran !== 'owner') {
      return { success: false, error: 'Hanya Owner yang berwenang mengatur konfigurasi denah meja.' };
    }

    const { addOrUpdateMeja } = await import('../../lib/orders/order-flow.ts');
    const res = addOrUpdateMeja(cabangId, data);

    if (res.success) {
      revalidatePath('/meja');
      revalidatePath('/kasir');
      revalidatePath('/antrean');
    }

    return res;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal menyimpan data meja.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Mengosongkan daftar antrean pesanan aktif untuk cabang tertentu atau seluruh cabang.
 * Memperbarui status_pengerjaan menjadi 'SELESAI' di operational store dan database Supabase
 * tanpa menghapus transaksi ataupun mengubah riwayat penjualan / keuangan.
 */
export async function kosongkanAntreanAction(
  targetCabangId?: string
): Promise<{ success: boolean; error?: string; count?: number }> {
  try {
    const { profile } = await getUserProfile();
    if (!profile) {
      return { success: false, error: 'Sesi tidak valid.' };
    }

    // Validasi otorisasi peran & cabang (BR-01)
    if (profile.peran !== 'owner' && targetCabangId && targetCabangId !== 'all' && targetCabangId !== profile.cabang_id) {
      return { success: false, error: 'Tidak memiliki otorisasi untuk mengosongkan antrean cabang lain.' };
    }

    if (profile.peran !== 'owner' && !profile.cabang_id) {
      return { success: false, error: 'Cabang pengguna tidak terdaftar.' };
    }

    const effectiveCabangId = profile.peran === 'owner' && targetCabangId
      ? targetCabangId
      : profile.cabang_id || undefined;

    const { createAdminClient } = await import('../../lib/supabase/admin.ts');
    const admin = createAdminClient();
    const dbActiveTrxIds: string[] = [];
    const nowIso = new Date().toISOString();

    if (admin) {
      try {
        // Query seluruh transaksi aktif yang memenuhi syarat dikosongkan (status lunas dan belum selesai)
        let query = admin
          .from('transaksi')
          .select('id, cabang_id, status, status_pengerjaan')
          .in('status', ['lunas'])
          .in('status_pengerjaan', ['MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL']);

        if (effectiveCabangId && effectiveCabangId !== 'all') {
          query = query.eq('cabang_id', effectiveCabangId);
        }

        const { data: activeTrx, error: queryErr } = await query;

        if (queryErr) {
          // Jika kolom status_pengerjaan belum ada di database lama (code 42703), lanjutkan via fallback operational store
          if (queryErr.code !== '42703') {
            console.error('[kosongkanAntreanAction] Database select error:', queryErr);
            return { success: false, error: `Gagal membaca transaksi antrean: ${queryErr.message}` };
          }
        } else if (activeTrx && activeTrx.length > 0) {
          for (const t of activeTrx) {
            dbActiveTrxIds.push(t.id);
          }

          // Update status_pengerjaan transaksi yang aktif menjadi 'SELESAI'
          const { error: updateErr } = await admin
            .from('transaksi')
            .update({
              status_pengerjaan: 'SELESAI',
              diselesaikan_pada: nowIso,
            })
            .in('id', dbActiveTrxIds);

          if (updateErr) {
            console.error('[kosongkanAntreanAction] Database update error:', updateErr);
            return { success: false, error: `Gagal memperbarui status transaksi di database: ${updateErr.message}` };
          }
        }
      } catch (dbErr) {
        console.error('[kosongkanAntreanAction] Database exception:', dbErr);
        return {
          success: false,
          error: dbErr instanceof Error ? dbErr.message : 'Terjadi kesalahan database saat mengosongkan antrean.',
        };
      }
    }

    // Sinkronkan pembersihan ke operational store (file & in-memory)
    const { clearAntreanList } = await import('../../lib/orders/order-flow.ts');
    const opRes = clearAntreanList(effectiveCabangId, dbActiveTrxIds);

    const totalCleared = Math.max(opRes.clearedCount, dbActiveTrxIds.length);

    revalidatePath('/antrean');
    revalidatePath('/kasir');
    revalidatePath('/transaksi');
    revalidatePath('/meja');

    return {
      success: true,
      count: totalCleared,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Gagal mengosongkan antrean.';
    return { success: false, error: msg };
  }
}
