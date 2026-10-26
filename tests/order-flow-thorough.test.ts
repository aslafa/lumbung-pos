if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Abaikan jika .env.local tidak ada
  }
}

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import {
  pesanTransaksiMayarDb,
  selesaikanTransaksiMayarDb,
} from '../src/lib/mayar/service.ts';
import {
  getPesananByTransaksiId,
  isMejaAvailable,
  releaseMeja,
  getAntreanList,
  getDefaultMejaCabang,
  matchNomorMeja,
} from '../src/lib/orders/order-flow.ts';
import {
  getEffectiveItemPrice,
  getVariantPriceDelta,
  formatItemDisplayName,
} from '../src/lib/products/product-config.ts';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

describe('Audit & Pengujian Komprehensif: Alur Pemesanan Lumbung POS', () => {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let activeShiftId = '';
  let activeCabangId = '';
  let caffeLatteProd: { id: string; sku: string; nama: string; harga_jual: number; kategori: string };
  let matchaLatteProd: { id: string; sku: string; nama: string; harga_jual: number; kategori: string };
  let croissantProd: { id: string; sku: string; nama: string; harga_jual: number; kategori: string };

  it('Setup: Membaca shift aktif dan produk uji Caffe Latte & Matcha Latte', async () => {
    let { data: shift } = await adminClient
      .from('shift_kasir')
      .select('id, cabang_id, status')
      .eq('status', 'buka')
      .limit(1)
      .maybeSingle();

    if (!shift) {
      const { data: anyShift } = await adminClient
        .from('shift_kasir')
        .select('id, cabang_id')
        .limit(1)
        .single();
      assert.ok(anyShift, 'Harus ada shift untuk pengujian');
      await adminClient.from('shift_kasir').update({ status: 'buka' }).eq('id', anyShift.id);
      shift = { id: anyShift.id, cabang_id: anyShift.cabang_id, status: 'buka' };
    }

    activeShiftId = shift.id;
    activeCabangId = shift.cabang_id;

    // Ambil Caffe Latte, Matcha Latte, dan Croissant
    const { data: prods } = await adminClient
      .from('produk')
      .select('id, sku, nama, kategori, harga_jual')
      .in('sku', ['KOP-005', 'NKP-001', 'ROT-001']);

    assert.ok(prods && prods.length >= 2, 'Produk KOP-005 dan NKP-001 harus ada di database');

    caffeLatteProd = prods.find((p) => p.sku === 'KOP-005')!;
    matchaLatteProd = prods.find((p) => p.sku === 'NKP-001')!;
    croissantProd = prods.find((p) => p.sku === 'ROT-001') || {
      id: 'mock-croissant',
      sku: 'ROT-001',
      nama: 'Croissant Mentega',
      kategori: 'roti',
      harga_jual: 24000,
    };

    assert.equal(caffeLatteProd.harga_jual, 28000, 'Harga dasar Caffe Latte harus Rp28.000');
    assert.equal(matchaLatteProd.harga_jual, 30000, 'Harga dasar Matcha Latte harus Rp30.000');
  });

  it('TEST KASUS UJI C: Perhitungan Harga Large Cup (+Rp5.000)', () => {
    // 1. Caffe Latte Regular + Matcha Latte Regular = Rp58.000
    const p1Reg = getEffectiveItemPrice(caffeLatteProd, { ukuran: 'Regular' });
    const p2Reg = getEffectiveItemPrice(matchaLatteProd, { ukuran: 'Regular' });
    assert.equal(p1Reg, 28000, 'Caffe Latte Regular harus Rp28.000');
    assert.equal(p2Reg, 30000, 'Matcha Latte Regular harus Rp30.000');
    assert.equal(p1Reg + p2Reg, 58000, 'Total Regular + Regular harus Rp58.000');

    // 2. Keduanya Large Cup (+Rp5.000 per minuman) = Rp68.000
    const p1Large = getEffectiveItemPrice(caffeLatteProd, { ukuran: 'Large' });
    const p2Large = getEffectiveItemPrice(matchaLatteProd, { ukuran: 'Large' });
    assert.equal(p1Large, 33000, 'Caffe Latte Large harus Rp33.000 (28.000 + 5.000)');
    assert.equal(p2Large, 35000, 'Matcha Latte Large harus Rp35.000 (30.000 + 5.000)');
    assert.equal(p1Large + p2Large, 68000, 'Total Large + Large harus Rp68.000');

    // 3. Caffe Latte Large dan Matcha Latte Regular = Rp63.000
    assert.equal(p1Large + p2Reg, 63000, 'Total Large + Regular harus Rp63.000');
    assert.equal(getVariantPriceDelta(caffeLatteProd.sku, { ukuran: 'Large' }, caffeLatteProd.kategori), 5000, 'Delta varian Large harus 5000');

    // 4. Produk non-minuman (roti) tidak bertambah harga jika ukuran diberikan
    const pRoti = getEffectiveItemPrice(croissantProd, { ukuran: 'Large' as 'Large' | 'Regular' });
    assert.equal(pRoti, 24000, 'Produk roti tidak boleh dikenai biaya ukuran minuman');

    // 5. Display name format
    assert.equal(formatItemDisplayName('Caffe Latte', { ukuran: 'Large' }), 'Caffe Latte (Large)');
    assert.equal(formatItemDisplayName('Caffe Latte', { ukuran: 'Regular' }), 'Caffe Latte');
  });

  it('TEST KASUS UJI A & B: Dine In Meja 07 + Nama Dino -> Pembayaran QRIS Mayar -> Lunas & KDS Konsisten', async () => {
    const tableId = '07';
    releaseMeja(activeCabangId, tableId);
    assert.equal(isMejaAvailable(activeCabangId, tableId), true, 'Meja 07 harus tersedia sebelum transaksi');

    const customerName = 'Dino';
    const mockInvoiceId = `inv_test_dino_${Date.now()}`;

    // 1. Buat transaksi pesanan Mayar dengan 2 Large Drinks
    const pesananRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'DINE_IN',
      nomor_meja: tableId,
      nama_pelanggan: customerName,
      catatan_pesanan: 'Less sugar, meja 07',
      items: [
        {
          produk_id: caffeLatteProd.id,
          jumlah: 1,
          options: { ukuran: 'Large', suhu: 'Dingin', gula: 'Less Sugar' },
          harga_satuan: 33000,
        },
        {
          produk_id: matchaLatteProd.id,
          jumlah: 1,
          options: { ukuran: 'Large', suhu: 'Dingin', gula: 'Normal' },
          harga_satuan: 35000,
        },
      ],
    });

    assert.equal(pesananRes.success, true, 'pesanTransaksiMayarDb harus berhasil');
    const trxId = pesananRes.transaksi_id!;
    const nomorStruk = pesananRes.nomor_struk!;
    assert.ok(nomorStruk, 'Nomor struk harus ada');

    // Total tagihan harus Rp68.000
    assert.equal(pesananRes.total, 68000, 'Total tagihan transaksi Mayar harus Rp68.000');

    // Meja 07 harus langsung terkunci
    assert.equal(isMejaAvailable(activeCabangId, tableId), false, 'Meja 07 harus terisi');

    // Simulasikan gateway invoice ID Mayar
    const { updateMayarInvoiceIdDb } = await import('../src/lib/mayar/service');
    await updateMayarInvoiceIdDb(trxId, mockInvoiceId);

    // Verifikasi data pesanan sebelum lunas
    const preOrder = getPesananByTransaksiId(trxId);
    assert.ok(preOrder, 'Pesanan harus terdaftar di operational store');
    assert.equal(preOrder.jenis_pesanan, 'DINE_IN', 'Tipe pesanan sebelum bayar harus DINE_IN');
    assert.equal(preOrder.nomor_meja, tableId, 'Nomor meja sebelum bayar harus 07');
    assert.equal(preOrder.nama_pelanggan, 'Dino', 'Nama pelanggan sebelum bayar harus Dino');
    assert.equal(preOrder.total, 68000, 'Total pesanan sebelum bayar harus Rp68.000');

    // 2. Simulasikan Konfirmasi Pembayaran Mayar Berhasil
    const settleRes = await selesaikanTransaksiMayarDb(mockInvoiceId);
    assert.equal(settleRes.success, true, 'selesaikanTransaksiMayarDb harus sukses');
    assert.equal(settleRes.total, 68000, 'Total struk lunas harus tetap Rp68.000');

    // 3. Verifikasi Konsistensi Setelah Pembayaran
    const postOrder = getPesananByTransaksiId(trxId);
    assert.ok(postOrder, 'Pesanan harus tetap ada di antrean setelah pembayaran');
    assert.equal(postOrder.status_pembayaran, 'LUNAS', 'Status pembayaran harus LUNAS');
    assert.equal(postOrder.jenis_pesanan, 'DINE_IN', 'Tipe pesanan setelah lunas TIDAK BOLEH berubah ke TAKEAWAY');
    assert.equal(postOrder.nomor_meja, tableId, 'Nomor meja setelah lunas harus tetap 07');
    assert.equal(postOrder.nama_pelanggan, 'Dino', 'Nama pelanggan setelah lunas harus tetap Dino');
    assert.equal(postOrder.total, 68000, 'Total transaksi setelah lunas harus tetap Rp68.000');

    // 4. Verifikasi Status Meja Tetap Terisi dengan Status LUNAS
    const mejaList = getDefaultMejaCabang(activeCabangId);
    const meja07 = mejaList.find((m) => matchNomorMeja(m.nomor_meja, tableId));
    assert.ok(meja07, 'Meja 07 harus ada dalam daftar meja');
    assert.equal(meja07.status, 'terisi', 'Meja 07 harus tetap berstatus terisi');
    assert.equal(meja07.transaksi_terkini_id, trxId, 'ID transaksi meja 07 harus cocok');
    assert.equal(meja07.pesanan_aktif?.status_pembayaran, 'LUNAS', 'Status pesanan aktif meja harus LUNAS');

    // 5. Verifikasi Antrean KDS Menampilkan Pesanan Tepat Satu Kali
    const allAntrean = getAntreanList(activeCabangId);
    const orderMatches = allAntrean.filter((p) => p.transaksi_id === trxId);
    assert.equal(orderMatches.length, 1, 'Pesanan harus muncul tepat satu kali di antrean KDS');

    // 6. Cleanup Meja setelah selesai tes
    releaseMeja(activeCabangId, tableId);
    assert.equal(isMejaAvailable(activeCabangId, tableId), true, 'Meja 07 harus kembali tersedia');
  });

  it('TEST KASUS UJI D: Refreshing antrean mempertahankan nama, meja, tipe, dan nomor antrean', async () => {
    const tableId = '07';
    releaseMeja(activeCabangId, tableId);

    const pesananRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'DINE_IN',
      nomor_meja: tableId,
      nama_pelanggan: 'Dino',
      catatan_pesanan: 'Uji refresh',
      items: [
        {
          produk_id: caffeLatteProd.id,
          jumlah: 1,
          options: { ukuran: 'Large' },
          harga_satuan: 33000,
        },
      ],
    });

    const trxId = pesananRes.transaksi_id!;
    const mockInvoiceId = `inv_test_refresh_${Date.now()}`;
    const { updateMayarInvoiceIdDb } = await import('../src/lib/mayar/service');
    await updateMayarInvoiceIdDb(trxId, mockInvoiceId);
    await selesaikanTransaksiMayarDb(mockInvoiceId);

    // Simulasi refresh: panggil getAntreanList berkali-kali
    const antrean1 = getAntreanList(activeCabangId).find((p) => p.transaksi_id === trxId);
    const antrean2 = getAntreanList(activeCabangId).find((p) => p.transaksi_id === trxId);

    assert.ok(antrean1 && antrean2, 'Pesanan harus tetap ada di setiap refresh');
    assert.equal(antrean1.nama_pelanggan, 'Dino', 'Nama tidak boleh berubah');
    assert.equal(antrean1.nomor_meja, '07', 'Nomor meja tidak boleh berubah');
    assert.equal(antrean1.jenis_pesanan, 'DINE_IN', 'Tipe pesanan tidak boleh berubah');
    assert.equal(antrean1.total, 33000, 'Harga item tidak boleh berubah');
    assert.equal(antrean1.nomor_antrean, antrean2.nomor_antrean, 'Nomor antrean harus identik');

    releaseMeja(activeCabangId, tableId);
  });

  it('TEST KASUS UJI E: Takeaway tanpa meja berfungsi dengan benar', async () => {
    const pesananRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'TAKEAWAY',
      nama_pelanggan: 'Dino Takeaway',
      items: [
        {
          produk_id: matchaLatteProd.id,
          jumlah: 1,
          options: { ukuran: 'Regular' },
          harga_satuan: 30000,
        },
      ],
    });

    assert.equal(pesananRes.success, true);
    assert.equal(pesananRes.jenis_pesanan, 'TAKEAWAY');
    assert.equal(pesananRes.nomor_meja, null);
    assert.equal(pesananRes.nama_pelanggan, 'Dino Takeaway');
    assert.equal(pesananRes.total, 30000);

    const itemInStore = getPesananByTransaksiId(pesananRes.transaksi_id!);
    assert.ok(itemInStore);
    assert.equal(itemInStore.jenis_pesanan, 'TAKEAWAY');
    assert.equal(itemInStore.nomor_meja, null);
    assert.equal(itemInStore.nama_pelanggan, 'Dino Takeaway');
  });

  it('TEST KASUS UJI F: Pembayaran tunai mempertahankan harga Large Cup & Meja 07', async () => {
    const tableId = '07';
    releaseMeja(activeCabangId, tableId);

    const { simpanTransaksiAction } = await import('../src/app/actions/transaksi.ts');
    const result = await simpanTransaksiAction({
      shift_id: activeShiftId,
      metode_bayar: 'tunai',
      uang_diterima: 70000,
      diskon: 0,
      jenis_pesanan: 'DINE_IN',
      nomor_meja: tableId,
      nama_pelanggan: 'Dino',
      catatan_pesanan: 'Tunai Large Cup',
      items: [
        {
          produk_id: caffeLatteProd.id,
          jumlah: 1,
          options: { ukuran: 'Large' },
          harga_satuan: 33000,
        },
        {
          produk_id: matchaLatteProd.id,
          jumlah: 1,
          options: { ukuran: 'Large' },
          harga_satuan: 35000,
        },
      ],
    });

    assert.equal(result.success, true, `simpanTransaksiAction tunai harus berhasil: ${result.error}`);
    assert.equal(result.total, 68000, 'Total belanja tunai 2 Large Cups harus Rp68.000');
    assert.equal(result.kembalian, 2000, 'Kembalian uang Rp70.000 - Rp68.000 harus Rp2.000');
    assert.equal(result.jenis_pesanan, 'DINE_IN', 'Tipe pesanan harus DINE_IN');
    assert.equal(result.nomor_meja, '07', 'Nomor meja harus 07');
    assert.equal(result.nama_pelanggan, 'Dino', 'Nama pelanggan harus Dino');

    const orderInKds = getPesananByTransaksiId(result.transaksi_id!);
    assert.ok(orderInKds, 'Pesanan tunai harus masuk KDS');
    assert.equal(orderInKds.total, 68000, 'Total di KDS harus Rp68.000');
    assert.equal(orderInKds.jenis_pesanan, 'DINE_IN');
    assert.equal(orderInKds.nomor_meja, '07');
    assert.equal(orderInKds.nama_pelanggan, 'Dino');

    releaseMeja(activeCabangId, tableId);
  });

  it('TEST KASUS UJI REPRODUKSI TBT-20261026-0060: Diwani, Dine In Meja M-02, 2 Large Drinks Rp68.000, Mismatched Amount Rejection, Idempotensi & KDS Konsisten', async () => {
    const tableId = 'M-02';
    releaseMeja(activeCabangId, tableId);
    assert.equal(isMejaAvailable(activeCabangId, tableId), true, 'Meja M-02 harus tersedia sebelum transaksi');

    const customerName = 'Diwani';
    const mockInvoiceId = `inv_test_diwani_${Date.now()}`;

    // 1. Pesan Transaksi Mayar: Matcha Latte Large (35.000) + Caffe Latte Large (33.000)
    const pesananRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'DINE_IN',
      nomor_meja: tableId,
      nama_pelanggan: customerName,
      catatan_pesanan: 'Meja M-02 Diwani',
      items: [
        {
          produk_id: matchaLatteProd.id,
          jumlah: 1,
          options: { ukuran: 'Large' },
          harga_satuan: 35000,
        },
        {
          produk_id: caffeLatteProd.id,
          jumlah: 1,
          options: { ukuran: 'Large' },
          harga_satuan: 33000,
        },
      ],
    });

    assert.equal(pesananRes.success, true, 'pesanTransaksiMayarDb harus sukses');
    const trxId = pesananRes.transaksi_id!;
    const nomorStruk = pesananRes.nomor_struk!;
    assert.ok(nomorStruk, 'Nomor struk harus terbit');

    // Pastikan perhitungan harga konsisten: subtotal Rp68.000 dan total Rp68.000
    assert.equal(pesananRes.subtotal, 68000, 'Subtotal harus Rp68.000');
    assert.equal(pesananRes.total, 68000, 'Total transaksi harus Rp68.000 (bukan Rp58.000)');
    assert.equal(pesananRes.nama_pelanggan, 'Diwani', 'Nama pelanggan tersimpan harus Diwani');
    assert.equal(pesananRes.nomor_meja, 'M-02', 'Nomor meja tersimpan harus M-02');
    assert.equal(pesananRes.jenis_pesanan, 'DINE_IN', 'Tipe pesanan harus DINE_IN');

    // 2. Hubungkan invoice Mayar
    const { updateMayarInvoiceIdDb } = await import('../src/lib/mayar/service');
    await updateMayarInvoiceIdDb(trxId, mockInvoiceId);

    // 3. UJI INTEGRITAS: Pembayaran dengan nominal TIDAK COCOK (Rp58.000 vs seharusnya Rp68.000) WAJIB DITOLAK
    const rejectRes = await selesaikanTransaksiMayarDb(mockInvoiceId, undefined, 58000);
    assert.equal(rejectRes.success, false, 'Pembayaran nominal tidak cocok harus ditolak');
    assert.equal(rejectRes.error_code, 'AMOUNT_MISMATCH', 'Error code harus AMOUNT_MISMATCH');

    // Verifikasi bahwa status transaksi di database belum lunas
    const { data: trxCheck } = await adminClient
      .from('transaksi')
      .select('status')
      .eq('id', trxId)
      .single();
    assert.equal(trxCheck?.status, 'menunggu_bayar', 'Status transaksi harus tetap menunggu_bayar');

    // 4. Pembayaran dengan nominal COCOK (Rp68.000) HARUS DITERIMA
    const settleRes = await selesaikanTransaksiMayarDb(mockInvoiceId, undefined, 68000);
    assert.equal(settleRes.success, true, 'Pelunasan dengan nominal cocok harus sukses');
    assert.equal(settleRes.total, 68000, 'Total pelunasan harus Rp68.000');

    // 5. UJI IDEMPOTENSI: Panggilan ulang pelunasan (webhook/polling ganda) tidak menduplikasi antrean
    const duplicateSettle = await selesaikanTransaksiMayarDb(mockInvoiceId, undefined, 68000);
    assert.equal(duplicateSettle.success, true, 'Pelunasan kedua harus sukses secara idempoten');
    assert.equal((duplicateSettle as unknown as { already_paid?: boolean }).already_paid, true, 'Pelunasan kedua harus menandai already_paid');

    // 6. Verifikasi Antrean KDS: Pesanan Diwani harus muncul TEPAT SATU KALI dengan DINE IN dan Meja M-02
    const allAntrean = getAntreanList(activeCabangId);
    const diwaniOrders = allAntrean.filter((p) => p.transaksi_id === trxId);
    assert.equal(diwaniOrders.length, 1, 'Pesanan Diwani harus muncul tepat satu kali di antrean KDS');

    const kdsOrder = diwaniOrders[0];
    assert.equal(kdsOrder.nama_pelanggan, 'Diwani', 'KDS harus menampilkan nama Diwani (bukan Pelanggan Umum)');
    assert.equal(kdsOrder.nomor_meja, 'M-02', 'KDS harus menampilkan meja M-02');
    assert.equal(kdsOrder.jenis_pesanan, 'DINE_IN', 'KDS harus menampilkan tipe DINE_IN (bukan Takeaway)');
    assert.equal(kdsOrder.total, 68000, 'KDS harus menampilkan total Rp68.000');
    assert.equal(kdsOrder.status_pembayaran, 'LUNAS', 'Status pembayaran KDS harus LUNAS');

    // 7. Cleanup
    releaseMeja(activeCabangId, tableId);
    assert.equal(isMejaAvailable(activeCabangId, tableId), true, 'Meja M-02 harus kembali tersedia');
  });
});
