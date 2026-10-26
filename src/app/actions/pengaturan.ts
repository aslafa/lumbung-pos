'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

export interface ActionResult {
  success: boolean;
  pesan?: string;
  error?: string;
}

/**
 * Server Action: Mengubah status aktif/nonaktif akun staf (Khusus Owner, BR-01, BR-12)
 */
export async function toggleStatusAkunAction(
  targetProfileId: string,
  aktifBaru: boolean
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    // Verifikasi role pemanggil harus Owner
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('peran, aktif')
      .eq('id', user.id)
      .single();

    if (!myProfile || !myProfile.aktif || myProfile.peran !== 'owner') {
      return { success: false, error: 'Hanya Owner yang berhak mengelola status akun staf.' };
    }

    // Ambil data profil lama
    const { data: oldProfile } = await supabase
      .from('profiles')
      .select('nama_lengkap, email, aktif, peran, cabang_id')
      .eq('id', targetProfileId)
      .single();

    if (!oldProfile) {
      return { success: false, error: 'Akun staf tidak ditemukan.' };
    }

    // Cegah menonaktifkan akun owner sendiri
    if (targetProfileId === user.id && !aktifBaru) {
      return { success: false, error: 'Owner tidak dapat menonaktifkan akunnya sendiri.' };
    }

    // Update status profil
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ aktif: aktifBaru })
      .eq('id', targetProfileId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    // Catat ke audit log (BR-12)
    const admin = createAdminClient();
    if (admin) {
      await admin.from('audit_log').insert({
        pelaku_id: user.id,
        aksi: 'ubah_akun',
        tabel: 'profiles',
        data_id: targetProfileId,
        nilai_sebelum: { aktif: oldProfile.aktif, peran: oldProfile.peran },
        nilai_sesudah: { aktif: aktifBaru, peran: oldProfile.peran },
      });
    }

    revalidatePath('/pengaturan');
    revalidatePath('/login');

    return {
      success: true,
      pesan: `Status akun ${oldProfile.nama_lengkap} berhasil diubah menjadi ${
        aktifBaru ? 'Aktif' : 'Nonaktif'
      }.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Mengubah peran dan cabang staf (Khusus Owner, BR-01, BR-12)
 */
export async function ubahPeranCabangAction(
  targetProfileId: string,
  peranBaru: 'kasir' | 'kepala_toko' | 'owner',
  cabangIdBaru: string | null
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('peran, aktif')
      .eq('id', user.id)
      .single();

    if (!myProfile || !myProfile.aktif || myProfile.peran !== 'owner') {
      return { success: false, error: 'Hanya Owner yang berhak mengubah peran dan cabang staf.' };
    }

    if (peranBaru !== 'owner' && !cabangIdBaru) {
      return { success: false, error: 'Kasir dan Kepala Toko wajib terikat ke cabang.' };
    }

    const finalCabangId = peranBaru === 'owner' ? null : cabangIdBaru;

    const { data: oldProfile } = await supabase
      .from('profiles')
      .select('nama_lengkap, peran, cabang_id')
      .eq('id', targetProfileId)
      .single();

    if (!oldProfile) {
      return { success: false, error: 'Akun staf tidak ditemukan.' };
    }

    const { error: updErr } = await supabase
      .from('profiles')
      .update({ peran: peranBaru, cabang_id: finalCabangId })
      .eq('id', targetProfileId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    const admin = createAdminClient();
    if (admin) {
      await admin.from('audit_log').insert({
        pelaku_id: user.id,
        aksi: 'ubah_akun',
        tabel: 'profiles',
        data_id: targetProfileId,
        nilai_sebelum: { peran: oldProfile.peran, cabang_id: oldProfile.cabang_id },
        nilai_sesudah: { peran: peranBaru, cabang_id: finalCabangId },
      });
    }

    revalidatePath('/pengaturan');

    return {
      success: true,
      pesan: `Peran akun ${oldProfile.nama_lengkap} berhasil diperbarui.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Menambah akun staf baru (Khusus Owner, BR-01, BR-12)
 * Menggunakan Supabase Auth Admin API (password terenkripsi standar bcrypt/argon2 auth.users, tidak pernah disimpan plaintext di profil)
 */
export async function tambahAkunStafAction(params: {
  nama_lengkap: string;
  email: string;
  peran: 'kasir' | 'kepala_toko' | 'owner';
  cabang_id: string | null;
  password_awal: string;
}): Promise<ActionResult & { newStaf?: {
  id: string;
  nama_lengkap: string;
  email: string;
  peran: 'kasir' | 'kepala_toko' | 'owner';
  aktif: boolean;
  cabang_id: string | null;
  cabang_nama?: string;
  cabang_kode?: string;
} }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('peran, aktif')
      .eq('id', user.id)
      .single();

    if (!myProfile || !myProfile.aktif || myProfile.peran !== 'owner') {
      return { success: false, error: 'Hanya Owner yang berhak menambah akun staf baru.' };
    }

    if (!params.nama_lengkap.trim() || !params.email.trim()) {
      return { success: false, error: 'Nama lengkap dan email wajib diisi.' };
    }

    if (!params.password_awal || params.password_awal.length < 6) {
      return { success: false, error: 'Password awal minimal 6 karakter.' };
    }

    // Aturan ERD & PRD: Kasir & KT wajib terikat cabang, Owner harus NULL
    if (params.peran !== 'owner' && !params.cabang_id) {
      return { success: false, error: 'Kasir dan Kepala Toko wajib terikat pada suatu cabang.' };
    }

    if (params.peran === 'owner' && params.cabang_id) {
      return { success: false, error: 'Role Owner tidak boleh terikat ke cabang tertentu.' };
    }

    const admin = createAdminClient();
    if (!admin) {
      return { success: false, error: 'Koneksi database admin tidak tersedia.' };
    }

    // Validasi aturan ERD: Tepat 1 Kepala Toko aktif per cabang
    if (params.peran === 'kepala_toko' && params.cabang_id) {
      const { data: existingKt } = await admin
        .from('profiles')
        .select('id, nama_lengkap')
        .eq('cabang_id', params.cabang_id)
        .eq('peran', 'kepala_toko')
        .eq('aktif', true)
        .maybeSingle();

      if (existingKt) {
        return {
          success: false,
          error: `Cabang ini sudah memiliki Kepala Toko aktif (${existingKt.nama_lengkap}). Berdasarkan aturan ERD, hanya boleh 1 Kepala Toko aktif per cabang.`,
        };
      }
    }

    // 1. Buat user di Supabase Auth via Admin Client
    const cleanEmail = params.email.trim().toLowerCase();
    const { data: createdAuth, error: createAuthErr } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password: params.password_awal,
      email_confirm: true,
      user_metadata: {
        nama_lengkap: params.nama_lengkap.trim(),
        peran: params.peran,
      },
    });

    if (createAuthErr || !createdAuth.user) {
      return {
        success: false,
        error: createAuthErr?.message || 'Gagal membuat kredensial akun di sistem autentikasi.',
      };
    }

    const newUserId = createdAuth.user.id;
    const finalCabangId = params.peran === 'owner' ? null : params.cabang_id;

    // 2. Insert baris ke tabel profiles
    interface ProfileWithCabang {
      id: string;
      nama_lengkap: string;
      email: string;
      peran: 'kasir' | 'kepala_toko' | 'owner';
      aktif: boolean;
      cabang_id: string | null;
      cabang?: { nama: string; kode: string } | null;
    }

    const { data: newProfile, error: profErr } = await admin
      .from('profiles')
      .insert({
        id: newUserId,
        nama_lengkap: params.nama_lengkap.trim(),
        email: cleanEmail,
        peran: params.peran,
        cabang_id: finalCabangId,
        aktif: true,
      })
      .select('id, nama_lengkap, email, peran, aktif, cabang_id, cabang:cabang_id(nama, kode)')
      .single();

    if (profErr || !newProfile) {
      // Rollback auth user jika insert profile gagal
      await admin.auth.admin.deleteUser(newUserId);
      return { success: false, error: `Gagal membuat profil: ${profErr?.message || 'Data profil tidak tersimpan'}` };
    }

    const typedProfile = newProfile as unknown as ProfileWithCabang;

    // 3. Catat ke audit log (BR-12)
    await admin.from('audit_log').insert({
      pelaku_id: user.id,
      aksi: 'tambah_akun',
      tabel: 'profiles',
      data_id: newUserId,
      nilai_sebelum: null,
      nilai_sesudah: {
        nama_lengkap: params.nama_lengkap.trim(),
        email: cleanEmail,
        peran: params.peran,
        cabang_id: finalCabangId,
        aktif: true,
      },
    });

    revalidatePath('/pengaturan');

    return {
      success: true,
      pesan: `Akun staf "${params.nama_lengkap}" (${cleanEmail}) berhasil dibuat.`,
      newStaf: {
        id: typedProfile.id,
        nama_lengkap: typedProfile.nama_lengkap,
        email: typedProfile.email,
        peran: typedProfile.peran,
        aktif: typedProfile.aktif,
        cabang_id: typedProfile.cabang_id,
        cabang_nama: typedProfile.cabang?.nama,
        cabang_kode: typedProfile.cabang?.kode,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Menambah cabang baru (Khusus Owner, BR-01, BR-12)
 */
export async function tambahCabangAction(params: {
  kode: string;
  nama: string;
  alamat?: string;
}): Promise<ActionResult & { newCabang?: { id: string; nama: string; kode: string; alamat: string | null; aktif: boolean } }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('peran, aktif')
      .eq('id', user.id)
      .single();

    if (!myProfile || !myProfile.aktif || myProfile.peran !== 'owner') {
      return { success: false, error: 'Hanya Owner yang berhak menambah cabang baru.' };
    }

    const cleanKode = params.kode.trim().toUpperCase();
    const cleanNama = params.nama.trim();
    const cleanAlamat = params.alamat?.trim() || null;

    if (!/^[A-Z]{3}$/.test(cleanKode)) {
      return { success: false, error: 'Kode cabang harus tepat 3 huruf kapital (contoh: BDG, SBY, YOG).' };
    }

    if (!cleanNama) {
      return { success: false, error: 'Nama cabang wajib diisi.' };
    }

    const admin = createAdminClient();
    if (!admin) {
      return { success: false, error: 'Koneksi database admin tidak tersedia.' };
    }

    // Cek apakah kode sudah digunakan
    const { data: existingKode } = await admin
      .from('cabang')
      .select('id, nama')
      .eq('kode', cleanKode)
      .maybeSingle();

    if (existingKode) {
      return { success: false, error: `Kode cabang "${cleanKode}" sudah digunakan oleh cabang ${existingKode.nama}.` };
    }

    // 1. Simpan ke tabel cabang
    const { data: newCabang, error: cabangErr } = await admin
      .from('cabang')
      .insert({
        kode: cleanKode,
        nama: cleanNama,
        alamat: cleanAlamat,
        aktif: true,
        urut_struk_terakhir: 0,
      })
      .select('id, nama, kode, alamat, aktif')
      .single();

    if (cabangErr || !newCabang) {
      return { success: false, error: cabangErr?.message || 'Gagal menyimpan cabang baru.' };
    }

    // 2. Inisialisasi baris stok_cabang untuk produk yang dilacak
    const { data: produkList } = await admin
      .from('produk')
      .select('id')
      .eq('lacak_stok', true);

    if (produkList && produkList.length > 0) {
      const stokRows = produkList.map((p) => ({
        cabang_id: newCabang.id,
        produk_id: p.id,
        jumlah: 0,
        stok_minimum: 5,
      }));
      await admin.from('stok_cabang').insert(stokRows);
    }

    // 3. Catat ke audit log (BR-12)
    await admin.from('audit_log').insert({
      pelaku_id: user.id,
      aksi: 'tambah_cabang',
      tabel: 'cabang',
      data_id: newCabang.id,
      nilai_sebelum: null,
      nilai_sesudah: {
        kode: cleanKode,
        nama: cleanNama,
        alamat: cleanAlamat,
        aktif: true,
      },
    });

    revalidatePath('/pengaturan');
    revalidatePath('/stok');
    revalidatePath('/laporan');

    return {
      success: true,
      pesan: `Cabang baru "${cleanNama}" (${cleanKode}) berhasil ditambahkan.`,
      newCabang: {
        id: newCabang.id,
        nama: newCabang.nama,
        kode: newCabang.kode,
        alamat: newCabang.alamat,
        aktif: newCabang.aktif,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Mengubah informasi cabang (Khusus Owner, BR-01, BR-12)
 */
export async function ubahCabangAction(params: {
  cabangId: string;
  nama: string;
  alamat?: string;
  aktif: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('peran, aktif')
      .eq('id', user.id)
      .single();

    if (!myProfile || !myProfile.aktif || myProfile.peran !== 'owner') {
      return { success: false, error: 'Hanya Owner yang berhak mengubah data cabang.' };
    }

    const cleanNama = params.nama.trim();
    if (!cleanNama) {
      return { success: false, error: 'Nama cabang tidak boleh kosong.' };
    }

    const admin = createAdminClient();
    if (!admin) {
      return { success: false, error: 'Koneksi database admin tidak tersedia.' };
    }

    const { data: oldCabang } = await admin
      .from('cabang')
      .select('nama, kode, alamat, aktif')
      .eq('id', params.cabangId)
      .single();

    if (!oldCabang) {
      return { success: false, error: 'Cabang tidak ditemukan.' };
    }

    const cleanAlamat = params.alamat?.trim() || null;

    const { error: updErr } = await admin
      .from('cabang')
      .update({
        nama: cleanNama,
        alamat: cleanAlamat,
        aktif: params.aktif,
      })
      .eq('id', params.cabangId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    // Catat ke audit log (BR-12)
    await admin.from('audit_log').insert({
      pelaku_id: user.id,
      aksi: 'ubah_cabang',
      tabel: 'cabang',
      data_id: params.cabangId,
      nilai_sebelum: {
        nama: oldCabang.nama,
        alamat: oldCabang.alamat,
        aktif: oldCabang.aktif,
      },
      nilai_sesudah: {
        nama: cleanNama,
        alamat: cleanAlamat,
        aktif: params.aktif,
      },
    });

    revalidatePath('/pengaturan');
    revalidatePath('/stok');
    revalidatePath('/laporan');

    return {
      success: true,
      pesan: `Informasi cabang "${cleanNama}" berhasil diperbarui.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Menambah produk baru dan harga modal awal (Khusus Owner, BR-05, BR-11, BR-12)
 */
export async function tambahProdukAction(params: {
  sku: string;
  nama: string;
  kategori: 'kopi' | 'non_kopi' | 'roti' | 'snack' | 'kemasan';
  hargaJual: number;
  hargaModal: number;
  lacakStok: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('peran, aktif')
      .eq('id', user.id)
      .single();

    if (!myProfile || !myProfile.aktif || myProfile.peran !== 'owner') {
      return { success: false, error: 'Hanya Owner yang berhak menambah produk baru.' };
    }

    if (!params.sku || !params.nama) {
      return { success: false, error: 'SKU dan Nama Produk wajib diisi.' };
    }

    if (params.hargaJual <= 0) {
      return { success: false, error: 'Harga jual harus lebih dari Rp0.' };
    }

    if (params.hargaModal < 0) {
      return { success: false, error: 'Harga modal tidak boleh bernilai negatif.' };
    }

    // 1. Simpan ke tabel produk
    const { data: newProd, error: prodErr } = await supabase
      .from('produk')
      .insert({
        sku: params.sku.trim().toUpperCase(),
        nama: params.nama.trim(),
        kategori: params.kategori,
        harga_jual: Math.round(params.hargaJual),
        lacak_stok: params.lacakStok,
        aktif: true,
      })
      .select('id, nama, harga_jual')
      .single();

    if (prodErr || !newProd) {
      return { success: false, error: prodErr?.message || 'Gagal menyimpan produk baru.' };
    }

    // 2. Simpan harga modal awal (BR-11)
    const { error: modalErr } = await supabase.from('riwayat_harga_modal').insert({
      produk_id: newProd.id,
      harga_modal: Math.round(params.hargaModal),
      berlaku_mulai: new Date().toISOString(),
      dibuat_oleh: user.id,
    });

    if (modalErr) {
      console.error('Gagal mencatat harga modal:', modalErr.message);
    }

    // 3. Inisialisasi baris stok_cabang untuk setiap cabang toko jika dilacak
    if (params.lacakStok) {
      const { data: cabangList } = await supabase.from('cabang').select('id');
      if (cabangList && cabangList.length > 0) {
        const stokRows = cabangList.map((c) => ({
          cabang_id: c.id,
          produk_id: newProd.id,
          jumlah: 0,
          stok_minimum: 5,
        }));
        await supabase.from('stok_cabang').insert(stokRows);
      }
    }

    // 4. Catat ke audit log (BR-12)
    const admin = createAdminClient();
    if (admin) {
      await admin.from('audit_log').insert({
        pelaku_id: user.id,
        aksi: 'ubah_harga_jual',
        tabel: 'produk',
        data_id: newProd.id,
        nilai_sebelum: null,
        nilai_sesudah: {
          sku: params.sku,
          nama: params.nama,
          harga_jual: params.hargaJual,
          harga_modal: params.hargaModal,
        },
      });
    }

    revalidatePath('/produk');
    revalidatePath('/kasir');
    revalidatePath('/stok');

    return {
      success: true,
      pesan: `Produk "${newProd.nama}" berhasil ditambahkan.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { success: false, error: msg };
  }
}

/**
 * Server Action: Mengubah harga jual atau status produk (Khusus Owner, BR-05, BR-12)
 */
export async function ubahProdukAction(params: {
  produkId: string;
  hargaJualBaru: number;
  aktifBaru: boolean;
}): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { success: false, error: 'Sesi Anda telah kedaluwarsa. Silakan login kembali.' };
    }

    const { data: myProfile } = await supabase
      .from('profiles')
      .select('peran, aktif')
      .eq('id', user.id)
      .single();

    if (!myProfile || !myProfile.aktif || myProfile.peran !== 'owner') {
      return { success: false, error: 'Hanya Owner yang berhak mengubah produk.' };
    }

    if (params.hargaJualBaru <= 0) {
      return { success: false, error: 'Harga jual harus lebih dari Rp0.' };
    }

    const { data: oldProd } = await supabase
      .from('produk')
      .select('nama, harga_jual, aktif')
      .eq('id', params.produkId)
      .single();

    if (!oldProd) {
      return { success: false, error: 'Produk tidak ditemukan.' };
    }

    const { error: updErr } = await supabase
      .from('produk')
      .update({
        harga_jual: Math.round(params.hargaJualBaru),
        aktif: params.aktifBaru,
        diubah_pada: new Date().toISOString(),
      })
      .eq('id', params.produkId);

    if (updErr) {
      return { success: false, error: updErr.message };
    }

    const admin = createAdminClient();
    if (admin) {
      const aksiLog =
        oldProd.aktif !== params.aktifBaru && !params.aktifBaru
          ? 'nonaktifkan_produk'
          : 'ubah_harga_jual';

      await admin.from('audit_log').insert({
        pelaku_id: user.id,
        aksi: aksiLog,
        tabel: 'produk',
        data_id: params.produkId,
        nilai_sebelum: { harga_jual: oldProd.harga_jual, aktif: oldProd.aktif },
        nilai_sesudah: { harga_jual: params.hargaJualBaru, aktif: params.aktifBaru },
      });
    }

    revalidatePath('/produk');
    revalidatePath('/kasir');

    return {
      success: true,
      pesan: `Produk "${oldProd.nama}" berhasil diperbarui.`,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem.';
    return { success: false, error: msg };
  }
}
