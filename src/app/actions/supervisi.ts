'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { releaseMejaByTransaksi } from '@/lib/orders/order-flow';

export interface VoidTransaksiResult {
  success: boolean;
  nomor_struk?: string;
  pesan?: string;
  error?: string;
}

export interface VerifikasiShiftResult {
  success: boolean;
  pesan?: string;
  error?: string;
}

export interface SesuaikanStokResult {
  success: boolean;
  produk?: string;
  jumlah_baru?: number;
  pesan?: string;
  error?: string;
}

/**
 * Server Action: Melakukan void transaksi penjualan (BR-08, BR-12)
 * Hanya dapat dilakukan oleh Kepala Toko di cabangnya atau Owner.
 */
export async function voidTransaksiAction(
  transaksiId: string,
  alasanVoid: string
): Promise<VoidTransaksiResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    if (!transaksiId) {
      return { success: false, error: 'ID Transaksi tidak valid.' };
    }

    if (!alasanVoid || alasanVoid.trim().length < 10) {
      return { success: false, error: 'Alasan void wajib diisi minimal 10 karakter.' };
    }

    const { data, error } = await supabase.rpc('void_transaksi', {
      p_transaksi_id: transaksiId,
      p_alasan_void: alasanVoid.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    // Bebaskan meja operasional jika transaksi ini menempati meja
    releaseMejaByTransaksi(transaksiId);

    revalidatePath('/transaksi');
    revalidatePath('/stok');
    revalidatePath('/laporan');
    revalidatePath('/kasir');
    revalidatePath('/meja');
    revalidatePath('/antrean');

    return {
      success: true,
      nomor_struk: data?.nomor_struk,
      pesan: data?.pesan || 'Transaksi berhasil di-void dan stok telah dikembalikan.',
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memproses void.';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Memverifikasi shift kasir yang sudah ditutup (BR-10, BR-12)
 * Hanya dapat dilakukan oleh Kepala Toko di cabangnya atau Owner.
 */
export async function verifikasiShiftAction(
  shiftId: string,
  catatanVerifikasi?: string
): Promise<VerifikasiShiftResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    if (!shiftId) {
      return { success: false, error: 'ID Shift tidak valid.' };
    }

    const { data, error } = await supabase.rpc('verifikasi_shift', {
      p_shift_id: shiftId,
      p_catatan_verifikasi: catatanVerifikasi?.trim() || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/shift-cabang');
    revalidatePath('/pengaturan');

    return {
      success: true,
      pesan: data?.pesan || 'Shift berhasil diverifikasi.',
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat memverifikasi shift.';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Menyesuaikan stok cabang (BR-12)
 * Mencatat barang masuk, barang rusak, atau stock opname.
 */
export async function sesuaikanStokAction(
  cabangId: string,
  produkId: string,
  jumlahBaru: number,
  jenisPenyesuaian: 'barang_masuk' | 'barang_rusak' | 'stock_opname',
  alasan: string
): Promise<SesuaikanStokResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    if (!cabangId || !produkId) {
      return { success: false, error: 'Cabang dan produk wajib dipilih.' };
    }

    if (isNaN(jumlahBaru) || jumlahBaru < 0) {
      return { success: false, error: 'Jumlah stok baru tidak boleh bernilai negatif.' };
    }

    if (!alasan || alasan.trim().length < 5) {
      return { success: false, error: 'Alasan penyesuaian stok wajib diisi minimal 5 karakter.' };
    }

    const { data, error } = await supabase.rpc('sesuaikan_stok', {
      p_cabang_id: cabangId,
      p_produk_id: produkId,
      p_jumlah_baru: Math.round(jumlahBaru),
      p_jenis_penyesuaian: jenisPenyesuaian,
      p_alasan: alasan.trim(),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/stok');
    revalidatePath('/kasir');
    revalidatePath('/pengaturan');

    return {
      success: true,
      produk: data?.produk,
      jumlah_baru: data?.jumlah_baru,
      pesan: data?.pesan || 'Stok berhasil diperbarui dan dicatat ke audit log.',
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat menyesuaikan stok.';
    return { success: false, error: errorMsg };
  }
}
