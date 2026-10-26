'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export interface BukaShiftResult {
  success: boolean;
  shift_id?: string;
  kas_awal?: number;
  pesan?: string;
  error?: string;
}

export interface TutupShiftResult {
  success: boolean;
  shift_id?: string;
  kas_seharusnya?: number;
  uang_fisik?: number;
  selisih?: number;
  pesan?: string;
  error?: string;
}

/**
 * Server Action: Membuka shift kasir dengan kas awal
 */
export async function bukaShiftAction(kasAwal: number): Promise<BukaShiftResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    if (isNaN(kasAwal) || kasAwal < 0 || kasAwal > 2000000) {
      return { success: false, error: 'Kas awal harus antara Rp0 dan Rp2.000.000.' };
    }

    const { data, error } = await supabase.rpc('buka_shift', {
      p_kas_awal: Math.round(kasAwal),
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/kasir');
    revalidatePath('/shift-saya');

    return {
      success: true,
      shift_id: data?.shift_id,
      kas_awal: data?.kas_awal,
      pesan: data?.pesan || 'Shift berhasil dibuka.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat membuka shift.';
    return { success: false, error: errorMsg };
  }
}

/**
 * Server Action: Menutup shift kasir dengan uang fisik dan catatan
 */
export async function tutupShiftAction(
  shiftId: string,
  uangFisik: number,
  catatanTutup?: string
): Promise<TutupShiftResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    if (!shiftId) {
      return { success: false, error: 'ID Shift tidak valid.' };
    }

    if (isNaN(uangFisik) || uangFisik < 0) {
      return { success: false, error: 'Uang fisik di laci tidak boleh bernilai negatif.' };
    }

    const { data, error } = await supabase.rpc('tutup_shift', {
      p_shift_id: shiftId,
      p_uang_fisik: Math.round(uangFisik),
      p_catatan_tutup: catatanTutup?.trim() || null,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath('/kasir');
    revalidatePath('/shift-saya');
    revalidatePath('/shift-cabang');

    return {
      success: true,
      shift_id: data?.shift_id,
      kas_seharusnya: data?.kas_seharusnya,
      uang_fisik: data?.uang_fisik,
      selisih: data?.selisih,
      pesan: data?.pesan || 'Shift berhasil ditutup dan angka telah dikunci.',
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat menutup shift.';
    return { success: false, error: errorMsg };
  }
}
