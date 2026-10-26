import { createAdminClient } from '../supabase/admin.ts';
import { createClient } from '../supabase/server.ts';
import {
  generateNomorAntrean,
  registerPesananAntrean,
  occupyMeja,
  releaseMejaByTransaksi,
  getPesananByTransaksiId,
  updatePesananPaymentStatus,
  removePesananFromAntrean,
  isMejaAvailable,
} from '../orders/order-flow.ts';
import {
  getEffectiveItemPrice,
  formatItemDisplayName,
  CustomOrderOptions,
} from '../products/product-config.ts';

export interface TransaksiMayarItem {
  produk_id: string;
  jumlah: number;
  options?: CustomOrderOptions;
  harga_satuan?: number;
}

export interface PesanTransaksiMayarParams {
  shift_id: string;
  diskon: number;
  alasan_diskon?: string;
  items: TransaksiMayarItem[];
  jenis_pesanan?: 'DINE_IN' | 'TAKEAWAY';
  nomor_meja?: string | null;
  nama_pelanggan?: string | null;
  catatan_pesanan?: string | null;
}

export interface PesanTransaksiMayarResult {
  success: boolean;
  transaksi_id?: string;
  nomor_struk?: string;
  nomor_antrean?: string;
  jenis_pesanan?: string;
  nomor_meja?: string | null;
  nama_pelanggan?: string | null;
  catatan_pesanan?: string | null;
  cabang_nama?: string;
  cabang_alamat?: string;
  subtotal?: number;
  diskon?: number;
  total?: number;
  items?: Array<{
    nama: string;
    harga: number;
    jumlah: number;
    subtotal: number;
  }>;
  error?: string;
}

export interface BatalkanTransaksiMayarResult {
  success: boolean;
  status?: string;
  pesan?: string;
  error?: string;
}

export interface SelesaikanTransaksiMayarResult {
  success: boolean;
  already_paid?: boolean;
  error_code?: string;
  transaksi_id?: string;
  nomor_struk?: string;
  nomor_antrean?: string;
  total?: number;
  pesan?: string;
  error?: string;
}

/**
 * 1. Pesan Transaksi Mayar (Status: menunggu_bayar & Reservasi Stok)
 */
export async function pesanTransaksiMayarDb(
  params: PesanTransaksiMayarParams
): Promise<PesanTransaksiMayarResult> {
  const admin = createAdminClient();
  let user: { id: string } | null = null;

  try {
    const supabase = await createClient();
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      user = authData.user;
    }
  } catch {
    // Di luar request scope Next.js (misal script pengujian otomatis)
  }

  // Jika di luar request scope, ambil kasir dari shift_kasir aktif
  if (!user && admin && params.shift_id) {
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

  // Validasi database client admin
  if (!admin) {
    return { success: false, error: 'Gagal menginisialisasi database client admin.' };
  }

  // Validasi Shift
  const { data: shift, error: shiftErr } = await admin
    .from('shift_kasir')
    .select('id, cabang_id, kasir_id, status')
    .eq('id', params.shift_id)
    .single();

  if (shiftErr || !shift || shift.status !== 'buka') {
    return { success: false, error: 'Shift kasir tidak ditemukan atau sudah tidak berstatus buka.' };
  }

  if (shift.kasir_id !== user.id) {
    // Cek peran user
    const { data: prof } = await admin.from('profiles').select('peran').eq('id', user.id).single();
    if (prof?.peran !== 'owner') {
      return { success: false, error: 'Hanya kasir pemilik shift yang berhak memproses transaksi ini.' };
    }
  }

  // Validasi & Ambil Cabang untuk Nomor Struk
  const { data: cabang, error: cabangErr } = await admin
    .from('cabang')
    .select('*')
    .eq('id', shift.cabang_id)
    .single();

  if (cabangErr || !cabang) {
    return { success: false, error: 'Data cabang tidak valid.' };
  }

  const nowWib = new Date(Date.now() + 7 * 3600 * 1000);
  const todayWibStr = nowWib.toISOString().slice(0, 10);
  const urutTanggalStr = cabang.urut_struk_tanggal ? String(cabang.urut_struk_tanggal) : null;
  const counter = (!urutTanggalStr || urutTanggalStr < todayWibStr)
    ? 1
    : (cabang.urut_struk_terakhir || 0) + 1;

  await admin
    .from('cabang')
    .update({
      urut_struk_tanggal: todayWibStr,
      urut_struk_terakhir: counter,
    })
    .eq('id', cabang.id);

  const nomorStruk = `${cabang.kode}-${todayWibStr.replace(/-/g, '')}-${String(counter).padStart(4, '0')}`;
  const nomorAntrean = generateNomorAntrean(cabang.kode);

  // Ambil Data Produk
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
  const itemsFormatted: Array<{ nama: string; harga: number; jumlah: number; subtotal: number }> = [];

  for (const it of params.items) {
    const prod = produkMap.get(it.produk_id);
    if (!prod || !prod.aktif) {
      return { success: false, error: `Produk "${prod?.nama || it.produk_id}" tidak aktif atau tidak ditemukan.` };
    }
    const unitPrice = getEffectiveItemPrice(prod, it.options, it.harga_satuan);
    const lineTotal = unitPrice * it.jumlah;
    subtotal += lineTotal;
    itemsFormatted.push({
      nama: formatItemDisplayName(prod.nama, it.options),
      harga: unitPrice,
      jumlah: it.jumlah,
      subtotal: lineTotal,
    });
  }

  const maxDiskon = Math.floor((subtotal * 10) / 100);
  const diskonVal = Math.round(params.diskon || 0);
  if (diskonVal < 0 || diskonVal > maxDiskon) {
    return { success: false, error: 'Diskon maksimal 10% dari subtotal.' };
  }
  if (diskonVal > 0 && (!params.alasan_diskon || params.alasan_diskon.trim().length < 3)) {
    return { success: false, error: 'Alasan diskon wajib diisi minimal 3 karakter jika diskon > Rp0.' };
  }

  const total = subtotal - diskonVal;

  // Cek & Reservasi Stok
  for (const it of params.items) {
    const prod = produkMap.get(it.produk_id);
    if (prod && prod.lacak_stok) {
      const { data: stokRow, error: stokErr } = await admin
        .from('stok_cabang')
        .select('id, jumlah')
        .eq('cabang_id', shift.cabang_id)
        .eq('produk_id', it.produk_id)
        .single();

      if (stokErr || !stokRow || stokRow.jumlah < it.jumlah) {
        return {
          success: false,
          error: `Stok untuk "${prod.nama}" tidak mencukupi (sisa: ${stokRow?.jumlah || 0} pcs). Seluruh transaksi dibatalkan.`,
        };
      }

      // Potong stok (reservasi)
      await admin
        .from('stok_cabang')
        .update({
          jumlah: stokRow.jumlah - it.jumlah,
          diubah_pada: new Date().toISOString(),
        })
        .eq('id', stokRow.id);
    }
  }

  // Validasi Aturan Operasional Dine In vs Takeaway
  const jenisPesanan: 'DINE_IN' | 'TAKEAWAY' = params.jenis_pesanan || 'DINE_IN';
  if (jenisPesanan === 'DINE_IN') {
    if (!params.nomor_meja || !params.nomor_meja.trim()) {
      return {
        success: false,
        error: 'Pesanan Dine In wajib memilih nomor meja sebelum pembayaran.',
      };
    }
    const cleanMeja = params.nomor_meja.trim();
    if (!isMejaAvailable(shift.cabang_id, cleanMeja)) {
      return {
        success: false,
        error: `Meja ${cleanMeja} saat ini sedang terisi oleh pesanan lain. Silakan pilih meja yang tersedia.`,
      };
    }
  }

  // Simpan Transaksi (status: menunggu_bayar)
  const baseTrxPayload = {
    nomor_struk: nomorStruk,
    cabang_id: shift.cabang_id,
    shift_id: shift.id,
    kasir_id: user.id,
    status: 'menunggu_bayar',
    subtotal,
    diskon: diskonVal,
    alasan_diskon: params.alasan_diskon?.trim() || null,
    total,
    metode_bayar: 'qris',
    uang_diterima: total,
    kembalian: 0,
    dibuat_pada: new Date().toISOString(),
  };

  const fullTrxPayload = {
    ...baseTrxPayload,
    nomor_antrean: nomorAntrean,
    jenis_pesanan: jenisPesanan,
    nomor_meja: params.nomor_meja || null,
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
    // Fallback jika database belum memiliki kolom baru (Error 42703)
    const insertBase = await admin
      .from('transaksi')
      .insert(baseTrxPayload)
      .select('id')
      .single();

    if (insertBase.error || !insertBase.data) {
      return {
        success: false,
        error: `Gagal membuat transaksi: ${insertBase.error?.message || insertFull.error?.message}`,
      };
    }
    newTrx = insertBase.data;
  }

  // Agregasikan kuantitas & subtotal per produk_id agar mematuhi constraint uq_transaksi_produk di database
  const dbItemMap = new Map<string, { prod: (typeof produkList)[0]; jumlah: number; subtotal: number }>();
  for (const it of params.items) {
    const prod = produkMap.get(it.produk_id)!;
    const unitPrice = getEffectiveItemPrice(prod, it.options);
    const existing = dbItemMap.get(prod.id);
    if (existing) {
      existing.jumlah += it.jumlah;
      existing.subtotal += unitPrice * it.jumlah;
    } else {
      dbItemMap.set(prod.id, { prod, jumlah: it.jumlah, subtotal: unitPrice * it.jumlah });
    }
  }

  // Simpan Transaksi Item & Modal
  for (const [, agg] of dbItemMap.entries()) {
    const avgHarga = Math.round(agg.subtotal / agg.jumlah);
    const { data: itemTrx } = await admin
      .from('transaksi_item')
      .insert({
        transaksi_id: newTrx.id,
        produk_id: agg.prod.id,
        nama_produk: agg.prod.nama,
        harga_satuan: avgHarga,
        jumlah: agg.jumlah,
        subtotal: agg.subtotal,
      })
      .select('id')
      .single();

    if (itemTrx) {
      // Ambil riwayat modal
      const { data: modalRow } = await admin
        .from('riwayat_harga_modal')
        .select('harga_modal')
        .eq('produk_id', agg.prod.id)
        .lte('berlaku_mulai', new Date().toISOString())
        .order('berlaku_mulai', { ascending: false })
        .limit(1)
        .maybeSingle();

      const modalVal = modalRow?.harga_modal || 0;
      await admin.from('transaksi_item_modal').insert({
        transaksi_item_id: itemTrx.id,
        transaksi_id: newTrx.id,
        harga_modal_satuan: modalVal,
        subtotal_modal: modalVal * agg.jumlah,
      });
    }
  }

  const cleanNomorMeja = jenisPesanan === 'DINE_IN' ? (params.nomor_meja?.trim() || null) : null;
  const cleanNamaPelanggan = params.nama_pelanggan?.trim() || 'Pelanggan Umum';
  const cleanCatatanPesanan = params.catatan_pesanan?.trim() || null;

  // 1. Daftarkan langsung ke Antrean KDS dengan status MENUNGGU_BAYAR agar tidak hilang saat polling
  registerPesananAntrean({
    transaksi_id: newTrx.id,
    nomor_struk: nomorStruk,
    nomor_antrean: nomorAntrean,
    cabang_id: shift.cabang_id,
    cabang_nama: cabang.nama,
    jenis_pesanan: jenisPesanan,
    nomor_meja: cleanNomorMeja,
    nama_pelanggan: cleanNamaPelanggan,
    catatan_pesanan: cleanCatatanPesanan,
    status_pengerjaan: 'MENUNGGU',
    dibuat_pada: baseTrxPayload.dibuat_pada,
    items: itemsFormatted,
    total,
    metode_bayar: 'qris',
    status_pembayaran: 'MENUNGGU_BAYAR',
  });

  // 2. Kunci status meja jika DINE_IN
  if (jenisPesanan === 'DINE_IN' && cleanNomorMeja) {
    occupyMeja(shift.cabang_id, cleanNomorMeja, newTrx.id, nomorStruk, {
      nomor_struk: nomorStruk,
      nomor_antrean: nomorAntrean,
      total,
      status_pembayaran: 'MENUNGGU_BAYAR',
      status_pengerjaan: 'MENUNGGU',
      items: itemsFormatted.map((it) => ({ nama: it.nama, jumlah: it.jumlah })),
    });
  }

  // 3. Catat ke audit_log Supabase sebagai cadangan cloud permanen
  try {
    await admin.from('audit_log').insert({
      pelaku_id: user.id,
      aksi: 'pesan_transaksi_mayar',
      tabel: 'transaksi',
      data_id: newTrx.id,
      nilai_sebelum: null,
      nilai_sesudah: {
        nomor_struk: nomorStruk,
        nomor_antrean: nomorAntrean,
        jenis_pesanan: jenisPesanan,
        nomor_meja: cleanNomorMeja,
        nama_pelanggan: cleanNamaPelanggan,
        catatan_pesanan: cleanCatatanPesanan,
        status: 'menunggu_bayar',
        status_pengerjaan: 'MENUNGGU',
        total,
        cabang_id: shift.cabang_id,
        cabang_nama: cabang.nama,
      },
    });
  } catch (auditErr) {
    console.warn('[pesanTransaksiMayarDb] Warning audit_log:', auditErr);
  }

  return {
    success: true,
    transaksi_id: newTrx.id,
    nomor_struk: nomorStruk,
    nomor_antrean: nomorAntrean,
    jenis_pesanan: jenisPesanan,
    nomor_meja: cleanNomorMeja,
    nama_pelanggan: cleanNamaPelanggan,
    catatan_pesanan: cleanCatatanPesanan,
    cabang_nama: cabang.nama,
    cabang_alamat: cabang.alamat,
    subtotal,
    diskon: diskonVal,
    total,
    items: itemsFormatted,
  };
}

/**
 * 2. Update Invoice ID Mayar ke Transaksi
 */
export async function updateMayarInvoiceIdDb(
  transaksiId: string,
  invoiceId: string
): Promise<boolean> {
  const admin = createAdminClient();
  if (!admin) return false;

  const { error } = await admin
    .from('transaksi')
    .update({ mayar_invoice_id: invoiceId })
    .eq('id', transaksiId);

  return !error;
}

/**
 * 3. Pembatalan Transaksi Mayar (Kembalikan Stok Tepat 1x)
 */
export async function batalkanTransaksiMayarDb(
  transaksiId: string,
  alasan: string = 'Pembatalan transaksi Mayar'
): Promise<BatalkanTransaksiMayarResult> {
  const admin = createAdminClient();
  if (!admin) {
    return { success: false, error: 'Admin database client tidak tersedia.' };
  }

  // Coba via RPC
  const { data: rpcData, error: rpcErr } = await admin.rpc('batalkan_transaksi_mayar', {
    p_transaksi_id: transaksiId,
    p_alasan: alasan,
  });

  if (!rpcErr && rpcData) {
    removePesananFromAntrean(transaksiId);
    releaseMejaByTransaksi(transaksiId);
    return rpcData as BatalkanTransaksiMayarResult;
  }

  // Fallback logika atomik
  const { data: trx, error: trxErr } = await admin
    .from('transaksi')
    .select('id, cabang_id, status, nomor_struk')
    .eq('id', transaksiId)
    .single();

  if (trxErr || !trx) {
    return { success: false, error: 'Transaksi tidak ditemukan.' };
  }

  if (trx.status !== 'menunggu_bayar') {
    return {
      success: false,
      status: trx.status,
      pesan: `Transaksi tidak dapat dibatalkan karena status saat ini: ${trx.status}`,
    };
  }

  // Update status transaksi menjadi 'batal'
  await admin.from('transaksi').update({ status: 'batal' }).eq('id', trx.id);

  // Hapus dari antrean operasional & bebaskan meja jika terisi
  removePesananFromAntrean(trx.id);
  releaseMejaByTransaksi(trx.id);

  // Kembalikan stok item
  const { data: items } = await admin
    .from('transaksi_item')
    .select('produk_id, jumlah')
    .eq('transaksi_id', trx.id);

  if (items && items.length > 0) {
    for (const it of items) {
      const { data: prod } = await admin
        .from('produk')
        .select('lacak_stok')
        .eq('id', it.produk_id)
        .single();

      if (prod?.lacak_stok) {
        const { data: stokRow } = await admin
          .from('stok_cabang')
          .select('id, jumlah')
          .eq('cabang_id', trx.cabang_id)
          .eq('produk_id', it.produk_id)
          .single();

        if (stokRow) {
          await admin
            .from('stok_cabang')
            .update({
              jumlah: stokRow.jumlah + it.jumlah,
              diubah_pada: new Date().toISOString(),
            })
            .eq('id', stokRow.id);
        }
      }
    }
  }

  return {
    success: true,
    status: 'batal',
    pesan: 'Transaksi berhasil dibatalkan dan stok dikembalikan.',
  };
}

/**
 * 4. Pelunasan Transaksi Mayar (Dipanggil oleh Webhook Handler setelah verifikasi)
 */
export async function selesaikanTransaksiMayarDb(
  invoiceId: string,
  eventId?: string,
  expectedAmount?: number
): Promise<SelesaikanTransaksiMayarResult> {
  const admin = createAdminClient();
  if (!admin) {
    return { success: false, error: 'Admin database client tidak tersedia.' };
  }

  let settledTrxId = '';
  let settledStruk = '';
  let settledTotal = 0;

  // 1. Ambil data transaksi lokal untuk validasi integritas
  const { data: trx, error: trxErr } = await admin
    .from('transaksi')
    .select('id, status, total, nomor_struk')
    .eq('mayar_invoice_id', invoiceId)
    .single();

  if (trxErr || !trx) {
    return {
      success: false,
      error_code: 'NOT_FOUND',
      error: 'Transaksi dengan invoice Mayar tersebut tidak ditemukan.',
    };
  }

  // 2. Validasi Integritas Nominal Pembayaran
  if (expectedAmount !== undefined && expectedAmount > 0 && trx.total !== expectedAmount) {
    console.error(`[selesaikanTransaksiMayarDb] Mismatch amount! DB: ${trx.total}, Expected/Gateway: ${expectedAmount}`);
    return {
      success: false,
      error_code: 'AMOUNT_MISMATCH',
      transaksi_id: trx.id,
      nomor_struk: trx.nomor_struk,
      error: `Ketidaksesuaian nominal pembayaran: total tagihan sistem Rp${trx.total.toLocaleString('id-ID')}, namun nominal terbayar Rp${expectedAmount.toLocaleString('id-ID')}. Transaksi ditahan untuk investigasi.`,
    };
  }

  // 3. Validasi Status Transaksi
  if (trx.status === 'batal') {
    return {
      success: false,
      error_code: 'LATE_PAYMENT',
      transaksi_id: trx.id,
      nomor_struk: trx.nomor_struk,
      pesan: 'Pembayaran diterima setelah transaksi dibatalkan (Late Payment).',
    };
  }

  const isAlreadyPaid = trx.status === 'lunas';
  if (isAlreadyPaid) {
    settledTrxId = trx.id;
    settledStruk = trx.nomor_struk;
    settledTotal = trx.total;
  } else {
    // Update status transaksi menjadi 'lunas'
    await admin
      .from('transaksi')
      .update({
        status: 'lunas',
        dibayar_pada: new Date().toISOString(),
      })
      .eq('id', trx.id);

    settledTrxId = trx.id;
    settledStruk = trx.nomor_struk;
    settledTotal = trx.total;
  }

  // Daftarkan pesanan yang telah lunas ke Antrean KDS dan Meja
  let nomorAntrean = '';
  if (settledTrxId) {
    let existingOp = getPesananByTransaksiId(settledTrxId);

    // Ambil data transaksi dari database
    const { data: trxRow } = await admin
      .from('transaksi')
      .select(`
        id,
        nomor_struk,
        total,
        cabang_id,
        dibuat_pada,
        cabang:cabang_id(nama, kode),
        transaksi_item(nama_produk, jumlah, subtotal)
      `)
      .eq('id', settledTrxId)
      .single();

    // Jika belum ada di memori operasional (misal server restart di tengah jalan), pulihkan
    if (!existingOp) {
      let auditData: Record<string, unknown> | undefined;
      try {
        const { data: auditRows } = await admin
          .from('audit_log')
          .select('nilai_sesudah')
          .eq('data_id', settledTrxId)
          .order('dibuat_pada', { ascending: false })
          .limit(1);
        auditData = auditRows?.[0]?.nilai_sesudah as Record<string, unknown> | undefined;
      } catch {
        // silent
      }

      const cInfo = trxRow?.cabang as unknown as { nama?: string; kode?: string } | null;
      const cName = cInfo?.nama || (auditData?.cabang_nama as string) || 'Lumbung Kopi';
      const nomorMejaAudit = (auditData?.nomor_meja as string) || null;
      const isDineInAudit = auditData?.jenis_pesanan === 'DINE_IN' || !!nomorMejaAudit;
      const jenisPesananAudit: 'DINE_IN' | 'TAKEAWAY' = isDineInAudit ? 'DINE_IN' : 'TAKEAWAY';
      const namaPelangganAudit = (auditData?.nama_pelanggan as string) || null;
      const catatanPesananAudit = (auditData?.catatan_pesanan as string) || null;
      const defaultAntrean = (settledStruk || '').replace(/[^0-9]/g, '').slice(-3) || '001';
      nomorAntrean = (auditData?.nomor_antrean as string) || `A-${defaultAntrean.padStart(3, '0')}`;

      registerPesananAntrean({
        transaksi_id: settledTrxId,
        nomor_struk: settledStruk,
        nomor_antrean: nomorAntrean,
        cabang_id: trxRow?.cabang_id || (auditData?.cabang_id as string) || '',
        cabang_nama: cName,
        jenis_pesanan: jenisPesananAudit,
        nomor_meja: nomorMejaAudit,
        nama_pelanggan: namaPelangganAudit,
        catatan_pesanan: catatanPesananAudit,
        status_pengerjaan: 'MENUNGGU',
        dibuat_pada: trxRow?.dibuat_pada || new Date().toISOString(),
        items: (trxRow?.transaksi_item || []).map((it: { nama_produk?: string; jumlah?: number; subtotal?: number }) => ({
          nama: it.nama_produk || 'Item',
          jumlah: it.jumlah || 1,
          subtotal: it.subtotal || 0,
        })),
        total: settledTotal,
        metode_bayar: 'qris',
        status_pembayaran: 'LUNAS',
      });

      existingOp = getPesananByTransaksiId(settledTrxId);
    }

    if (existingOp) {
      nomorAntrean = existingOp.nomor_antrean;

      // Update status pembayaran pesanan menjadi LUNAS
      updatePesananPaymentStatus(settledTrxId, 'LUNAS');

      // Jika Dine In, pastikan meja tetap terkunci dengan status pembayaran LUNAS
      if (existingOp.jenis_pesanan === 'DINE_IN' && existingOp.nomor_meja) {
        occupyMeja(existingOp.cabang_id, existingOp.nomor_meja, settledTrxId, existingOp.nomor_struk, {
          nomor_struk: existingOp.nomor_struk,
          nomor_antrean: existingOp.nomor_antrean,
          total: existingOp.total,
          status_pembayaran: 'LUNAS',
          status_pengerjaan: existingOp.status_pengerjaan,
          items: existingOp.items.map((it) => ({ nama: it.nama, jumlah: it.jumlah })),
        });
      }
    }
  }

  return {
    success: true,
    already_paid: isAlreadyPaid,
    transaksi_id: settledTrxId,
    nomor_struk: settledStruk,
    nomor_antrean: nomorAntrean,
    total: settledTotal,
    pesan: isAlreadyPaid
      ? 'Transaksi sudah berstatus lunas sebelumnya.'
      : 'Transaksi berhasil dilunasi dan diteruskan ke antrean barista.',
  };
}

/**
 * 5. Pengecekan Idempotensi Webhook & Catat Event
 */
export async function catatMayarWebhookEventDb(
  eventId: string,
  invoiceId: string,
  status: string,
  payload: Record<string, unknown>
): Promise<{ isNew: boolean; error?: string }> {
  const admin = createAdminClient();
  if (!admin) {
    return { isNew: false, error: 'Database admin client tidak tersedia.' };
  }

  // Cek apakah event_id sudah ada
  const { data: existing } = await admin
    .from('mayar_webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing) {
    return { isNew: false };
  }

  const { error: insErr } = await admin.from('mayar_webhook_events').insert({
    event_id: eventId,
    invoice_id: invoiceId,
    status_pembayaran: status,
    payload,
    diterima_pada: new Date().toISOString(),
  });

  if (insErr) {
    if (insErr.code === '23505') {
      // Unique violation
      return { isNew: false };
    }
    return { isNew: false, error: insErr.message };
  }

  return { isNew: true };
}
