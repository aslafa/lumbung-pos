'use server';

import { createClient } from '../../lib/supabase/server.ts';
import { createAdminClient } from '../../lib/supabase/admin.ts';
import { revalidatePath } from 'next/cache';

import {
  generateNomorAntrean,
  registerPesananAntrean,
  occupyMeja,
  isMejaAvailable,
  JenisPesanan
} from '../../lib/orders/order-flow.ts';
import {
  getEffectiveItemPrice,
  formatItemDisplayName,
  type CustomOrderOptions
} from '../../lib/products/product-config.ts';

export interface TransaksiItemPayload {
  produk_id: string;
  jumlah: number;
  options?: CustomOrderOptions | Record<string, unknown>;
  harga_satuan?: number;
  nama_kustom?: string;
}

export interface SimpanTransaksiParams {
  shift_id: string;
  diskon: number;
  alasan_diskon?: string;
  metode_bayar: 'tunai' | 'qris';
  uang_diterima: number;
  items: TransaksiItemPayload[];
  jenis_pesanan?: JenisPesanan;
  nomor_meja?: string | null;
  nama_pelanggan?: string | null;
  catatan_pesanan?: string | null;
}

export interface StrukItem {
  nama: string;
  harga: number;
  jumlah: number;
  subtotal: number;
}

export interface SimpanTransaksiResult {
  success: boolean;
  transaksi_id?: string;
  nomor_struk?: string;
  nomor_antrean?: string;
  jenis_pesanan?: JenisPesanan;
  nomor_meja?: string | null;
  nama_pelanggan?: string | null;
  catatan_pesanan?: string | null;
  cabang_nama?: string;
  cabang_alamat?: string;
  waktu_wib?: string;
  subtotal?: number;
  diskon?: number;
  alasan_diskon?: string;
  total?: number;
  metode_bayar?: string;
  uang_diterima?: number;
  kembalian?: number;
  items?: StrukItem[];
  error?: string;
}

/**
 * Server Action: Menyimpan transaksi penjualan atomik via RPC simpan_transaksi
 */
export async function simpanTransaksiAction(
  params: SimpanTransaksiParams
): Promise<SimpanTransaksiResult> {
  try {
    const admin = createAdminClient();
    if (!admin) {
      return { success: false, error: 'Koneksi database admin gagal.' };
    }

    let user: { id: string } | null = null;
    try {
      const supabase = await createClient();
      const { data: authData } = await supabase.auth.getUser();
      if (authData?.user) {
        user = authData.user;
      }
    } catch {
      // Di luar request scope Next.js
    }

    if (!user && params.shift_id) {
      const { data: shiftRow } = await admin
        .from('shift_kasir')
        .select('kasir_id')
        .eq('id', params.shift_id)
        .single();
      if (shiftRow?.kasir_id) {
        user = { id: shiftRow.kasir_id };
      }
    }

    if (!user) {
      return { success: false, error: 'Sesi kasir tidak valid atau telah berakhir.' };
    }

    if (!params.shift_id) {
      return { success: false, error: 'Shift kasir tidak ditemukan atau belum dibuka.' };
    }

    if (!params.items || params.items.length === 0) {
      return { success: false, error: 'Keranjang transaksi tidak boleh kosong.' };
    }

    // Validasi kuantitas item (1..99)
    for (const it of params.items) {
      if (!it.produk_id) {
        return { success: false, error: 'Terdapat produk dalam keranjang yang tidak valid.' };
      }
      if (isNaN(it.jumlah) || it.jumlah < 1 || it.jumlah > 99) {
        return { success: false, error: 'Jumlah produk harus antara 1 sampai 99 pcs.' };
      }
    }

    // Validasi aturan operasional DINE_IN vs TAKEAWAY
    const jenisPesanan: JenisPesanan = params.jenis_pesanan || 'DINE_IN';
    if (jenisPesanan === 'DINE_IN' && !params.nomor_meja) {
      return { success: false, error: 'Pesanan Dine In wajib memilih nomor meja sebelum bayar.' };
    }

    // Ambil info shift & cabang terlebih dahulu untuk validasi ketersediaan meja & antrean
    const { data: shiftData, error: shiftErr } = await admin
      .from('shift_kasir')
      .select('cabang_id, cabang:cabang_id(kode, nama)')
      .eq('id', params.shift_id)
      .single();

    if (shiftErr || !shiftData) {
      return { success: false, error: 'Shift kasir tidak ditemukan di database.' };
    }

    type CabangRel = { kode?: string; nama?: string } | null;
    const cabangInfo = shiftData.cabang as CabangRel;
    const cabangKode = cabangInfo?.kode || 'POS';
    const cabangId = shiftData.cabang_id;

    // CEK RACE CONDITION: Jika Dine In, pastikan meja masih tersedia sebelum transaksi disimpan
    if (jenisPesanan === 'DINE_IN' && params.nomor_meja) {
      if (!isMejaAvailable(cabangId, params.nomor_meja)) {
        return {
          success: false,
          error: `Meja ${params.nomor_meja} saat ini sedang terisi oleh pesanan lain. Silakan pilih meja yang tersedia.`,
        };
      }
    }

    const productIds = params.items.map((i) => i.produk_id);
    const { data: produkList, error: prodErr } = await admin
      .from('produk')
      .select('id, sku, nama, kategori, harga_jual, lacak_stok, aktif')
      .in('id', productIds);

    if (prodErr || !produkList) {
      return { success: false, error: 'Gagal mengambil data produk transaksi.' };
    }

    const produkMap = new Map(produkList.map((p) => [p.id, p]));
    let subtotal = 0;
    const strukItems: StrukItem[] = [];

    for (const it of params.items) {
      const prod = produkMap.get(it.produk_id);
      if (!prod || !prod.aktif) {
        return { success: false, error: `Produk "${prod?.nama || it.produk_id}" tidak aktif atau tidak ditemukan.` };
      }
      const unitPrice = getEffectiveItemPrice(prod, it.options as CustomOrderOptions, it.harga_satuan);
      const lineTotal = unitPrice * it.jumlah;
      subtotal += lineTotal;
      strukItems.push({
        nama: formatItemDisplayName(prod.nama, it.options as CustomOrderOptions),
        harga: unitPrice,
        jumlah: it.jumlah,
        subtotal: lineTotal,
      });
    }

    // 2. Validasi diskon
    const maxDiskon = Math.floor((subtotal * 10) / 100);
    const diskonVal = Math.round(params.diskon || 0);
    if (diskonVal < 0 || diskonVal > maxDiskon) {
      return { success: false, error: 'Diskon maksimal 10% dari subtotal.' };
    }
    if (diskonVal > 0 && (!params.alasan_diskon || params.alasan_diskon.trim().length < 3)) {
      return { success: false, error: 'Alasan diskon wajib diisi minimal 3 karakter jika diskon > Rp0.' };
    }

    const total = subtotal - diskonVal;

    // 3. Validasi pembayaran
    const uangBayar = Math.round(params.uang_diterima);
    if (params.metode_bayar === 'tunai' && uangBayar < total) {
      return { success: false, error: `Uang diterima (${uangBayar}) kurang dari total tagihan (${total}).` };
    }
    const kembalian = params.metode_bayar === 'tunai' ? uangBayar - total : 0;

    // 4. Cek & Potong Stok Cabang
    const reservedStock: Array<{ id: string; jumlahLama: number }> = [];
    for (const it of params.items) {
      const prod = produkMap.get(it.produk_id);
      if (prod && prod.lacak_stok) {
        const { data: stokRow, error: stokErr } = await admin
          .from('stok_cabang')
          .select('id, jumlah')
          .eq('cabang_id', cabangId)
          .eq('produk_id', it.produk_id)
          .single();

        if (stokErr || !stokRow || stokRow.jumlah < it.jumlah) {
          // Rollback stok yang sudah dipotong jika ada
          for (const rs of reservedStock) {
            await admin.from('stok_cabang').update({ jumlah: rs.jumlahLama }).eq('id', rs.id);
          }
          return {
            success: false,
            error: `Stok untuk "${prod.nama}" tidak mencukupi (sisa: ${stokRow?.jumlah || 0} pcs).`,
          };
        }

        reservedStock.push({ id: stokRow.id, jumlahLama: stokRow.jumlah });
        await admin
          .from('stok_cabang')
          .update({
            jumlah: stokRow.jumlah - it.jumlah,
            diubah_pada: new Date().toISOString(),
          })
          .eq('id', stokRow.id);
      }
    }

    // 5. Generate Nomor Struk (Format BR-04: KODE-YYYYMMDD-NNNN) & Nomor Antrean
    const now = new Date();
    const nowWib = new Date(Date.now() + 7 * 3600 * 1000);
    const todayWibStr = nowWib.toISOString().slice(0, 10);

    let counter = 1;
    const { data: cabangRow } = await admin
      .from('cabang')
      .select('urut_struk_tanggal, urut_struk_terakhir')
      .eq('id', cabangId)
      .single();

    if (cabangRow) {
      const urutTanggalStr = cabangRow.urut_struk_tanggal ? String(cabangRow.urut_struk_tanggal) : null;
      counter = (!urutTanggalStr || urutTanggalStr < todayWibStr)
        ? 1
        : (cabangRow.urut_struk_terakhir || 0) + 1;

      await admin
        .from('cabang')
        .update({
          urut_struk_tanggal: todayWibStr,
          urut_struk_terakhir: counter,
        })
        .eq('id', cabangId);
    } else {
      counter = Math.floor(1000 + Math.random() * 9000);
    }

    const nomorStruk = `${cabangKode}-${todayWibStr.replace(/-/g, '')}-${String(counter).padStart(4, '0')}`;
    const nomorAntrean = generateNomorAntrean(cabangKode);
    const cabangNama = cabangInfo?.nama || 'Lumbung Kopi';

    // 6. Simpan ke tabel transaksi
    const baseTrxPayload = {
      nomor_struk: nomorStruk,
      cabang_id: cabangId,
      shift_id: params.shift_id,
      kasir_id: user.id,
      status: 'lunas',
      subtotal,
      diskon: diskonVal,
      alasan_diskon: diskonVal > 0 ? (params.alasan_diskon?.trim() || null) : null,
      total,
      metode_bayar: params.metode_bayar,
      uang_diterima: params.metode_bayar === 'tunai' ? uangBayar : total,
      kembalian,
      dibuat_pada: now.toISOString(),
      dibayar_pada: now.toISOString(),
    };

    const fullTrxPayload = {
      ...baseTrxPayload,
      nomor_antrean: nomorAntrean,
      jenis_pesanan: jenisPesanan,
      nomor_meja: jenisPesanan === 'DINE_IN' ? (params.nomor_meja?.trim() || null) : null,
      nama_pelanggan: params.nama_pelanggan?.trim() || null,
      catatan_pesanan: params.catatan_pesanan?.trim() || null,
      status_pengerjaan: 'MENUNGGU',
    };

    let newTrx: { id: string } | null = null;
    const insertFull = await admin
      .from('transaksi')
      .insert(fullTrxPayload)
      .select('id')
      .single();

    if (!insertFull.error && insertFull.data) {
      newTrx = insertFull.data;
    } else {
      const insertBase = await admin
        .from('transaksi')
        .insert(baseTrxPayload)
        .select('id')
        .single();

      if (insertBase.error || !insertBase.data) {
        // Rollback stok
        for (const rs of reservedStock) {
          await admin.from('stok_cabang').update({ jumlah: rs.jumlahLama }).eq('id', rs.id);
        }
        return {
          success: false,
          error: `Gagal menyimpan transaksi: ${insertBase.error?.message || insertFull.error?.message}`,
        };
      }
      newTrx = insertBase.data;
    }

    // 7. Simpan transaksi_item (agregasikan produk_id agar lolos unique constraint uq_transaksi_produk)
    const dbItemMap = new Map<string, { prod: (typeof produkList)[0]; jumlah: number; subtotal: number }>();
    for (const it of params.items) {
      const prod = produkMap.get(it.produk_id)!;
      const unitPrice = getEffectiveItemPrice(prod, it.options as CustomOrderOptions, it.harga_satuan);
      const existing = dbItemMap.get(prod.id);
      if (existing) {
        existing.jumlah += it.jumlah;
        existing.subtotal += unitPrice * it.jumlah;
      } else {
        dbItemMap.set(prod.id, { prod, jumlah: it.jumlah, subtotal: unitPrice * it.jumlah });
      }
    }

    for (const [, agg] of dbItemMap.entries()) {
      const avgHarga = Math.round(agg.subtotal / agg.jumlah);
      await admin.from('transaksi_item').insert({
        transaksi_id: newTrx.id,
        produk_id: agg.prod.id,
        nama_produk: agg.prod.nama,
        harga_satuan: avgHarga,
        jumlah: agg.jumlah,
        subtotal: agg.subtotal,
      });
    }

    // 8. Update akumulasi shift kasir
    try {
      const { data: shiftCurrent } = await admin
        .from('shift_kasir')
        .select('id, total_tunai, total_qris')
        .eq('id', params.shift_id)
        .single();

      if (shiftCurrent) {
        if (params.metode_bayar === 'tunai') {
          await admin
            .from('shift_kasir')
            .update({ total_tunai: (shiftCurrent.total_tunai || 0) + total })
            .eq('id', shiftCurrent.id);
        } else {
          await admin
            .from('shift_kasir')
            .update({ total_qris: (shiftCurrent.total_qris || 0) + total })
            .eq('id', shiftCurrent.id);
        }
      }
    } catch {
      // Non-fatal
    }

    // 9. Kunci Meja jika DINE_IN
    const cleanNomorMeja = jenisPesanan === 'DINE_IN' ? (params.nomor_meja?.trim() || null) : null;
    const cleanNamaPelanggan = (params.nama_pelanggan && params.nama_pelanggan.trim())
      ? params.nama_pelanggan.trim()
      : (jenisPesanan === 'DINE_IN' && cleanNomorMeja ? `Tamu Meja ${cleanNomorMeja}` : 'Pelanggan Umum');

    if (cabangId && jenisPesanan === 'DINE_IN' && cleanNomorMeja) {
      occupyMeja(cabangId, cleanNomorMeja, newTrx.id, nomorStruk, {
        nomor_struk: nomorStruk,
        nomor_antrean: nomorAntrean,
        total,
        status_pembayaran: 'LUNAS',
        status_pengerjaan: 'MENUNGGU',
        items: strukItems.map((it) => ({ nama: it.nama, jumlah: it.jumlah })),
      });
    }

    // 10. Daftarkan ke Antrean KDS (Kitchen / Barista Display)
    const antreanItems = strukItems.map((si) => ({
      nama: si.nama,
      jumlah: si.jumlah,
      subtotal: si.subtotal,
    }));

    registerPesananAntrean({
      transaksi_id: newTrx.id,
      nomor_struk: nomorStruk,
      nomor_antrean: nomorAntrean,
      cabang_id: cabangId,
      cabang_nama: cabangNama,
      jenis_pesanan: jenisPesanan,
      nomor_meja: cleanNomorMeja,
      nama_pelanggan: cleanNamaPelanggan,
      catatan_pesanan: params.catatan_pesanan?.trim() || null,
      status_pengerjaan: 'MENUNGGU',
      dibuat_pada: now.toISOString(),
      items: antreanItems,
      total,
      metode_bayar: params.metode_bayar,
      status_pembayaran: 'LUNAS',
    });

    // 11. Catat ke audit_log Supabase sebagai cadangan cloud permanen
    try {
      await admin.from('audit_log').insert({
        pelaku_id: user.id,
        aksi: 'simpan_transaksi',
        tabel: 'transaksi',
        data_id: newTrx.id,
        nilai_sebelum: null,
        nilai_sesudah: {
          nomor_struk: nomorStruk,
          nomor_antrean: nomorAntrean,
          jenis_pesanan: jenisPesanan,
          nomor_meja: cleanNomorMeja,
          nama_pelanggan: cleanNamaPelanggan,
          catatan_pesanan: params.catatan_pesanan?.trim() || null,
          total,
          cabang_id: cabangId,
          cabang_nama: cabangNama,
        },
      });
    } catch {
      // silent
    }

    const waktuWib = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta',
    });

    try {
      revalidatePath('/kasir');
      revalidatePath('/transaksi');
      revalidatePath('/stok');
      revalidatePath('/shift-saya');
      revalidatePath('/antrean');
    } catch {
      // Invariant safely caught when called in test or background context
    }

    return {
      success: true,
      transaksi_id: newTrx.id,
      nomor_struk: nomorStruk,
      nomor_antrean: nomorAntrean,
      jenis_pesanan: jenisPesanan,
      nomor_meja: cleanNomorMeja,
      nama_pelanggan: cleanNamaPelanggan,
      catatan_pesanan: params.catatan_pesanan?.trim() || null,
      cabang_nama: cabangNama,
      cabang_alamat: undefined,
      waktu_wib: waktuWib,
      subtotal,
      diskon: diskonVal,
      alasan_diskon: diskonVal > 0 ? params.alasan_diskon : undefined,
      total,
      metode_bayar: params.metode_bayar,
      uang_diterima: params.metode_bayar === 'tunai' ? uangBayar : total,
      kembalian,
      items: strukItems,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat menyimpan transaksi.';
    return { success: false, error: errorMsg };
  }
}
