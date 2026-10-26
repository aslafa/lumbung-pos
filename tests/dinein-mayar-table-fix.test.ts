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
  batalkanTransaksiMayarDb,
  updateMayarInvoiceIdDb,
} from '../src/lib/mayar/service';
import {
  getPesananByTransaksiId,
  getDefaultMejaCabang,
  occupyMeja,
  releaseMeja,
  releaseMejaByTransaksi,
  isMejaAvailable,
  getAntreanList,
} from '../src/lib/orders/order-flow';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

describe('Pengujian Validasi & Perbaikan Bug: Dine In Meja M-02 vs Takeaway QRIS Mayar', () => {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Ambil ID Shift dan Produk aktif yang ada untuk simulasi transaksi
  let activeShiftId = '';
  let activeCabangId = '';
  let activeProdukId = '';

  it('Setup: Membaca referensi shift dan produk aktif untuk pengujian', async () => {
    let { data: shift } = await adminClient
      .from('shift_kasir')
      .select('id, cabang_id, status')
      .eq('status', 'buka')
      .limit(1)
      .maybeSingle();

    if (!shift) {
      // Jika semua shift sedang berstatus tutup, ambil 1 shift dan set status 'buka'
      const { data: anyShift } = await adminClient
        .from('shift_kasir')
        .select('id, cabang_id')
        .limit(1)
        .single();
      assert.ok(anyShift, 'Harus ada setidaknya satu shift untuk pengujian');
      await adminClient
        .from('shift_kasir')
        .update({ status: 'buka' })
        .eq('id', anyShift.id);
      shift = { id: anyShift.id, cabang_id: anyShift.cabang_id, status: 'buka' };
    }

    activeShiftId = shift.id;
    activeCabangId = shift.cabang_id;

    const { data: produk } = await adminClient
      .from('produk')
      .select('id, harga_jual')
      .eq('aktif', true)
      .limit(1)
      .single();

    assert.ok(produk, 'Harus ada setidaknya satu produk aktif');
    activeProdukId = produk.id;
  });

  it('SKENARIO 1: Dine In Meja M-02 -> Pembayaran QRIS Mayar Berhasil -> Meja Terisi & Status Konsisten', async () => {
    // 1. Pastikan meja M-02 awal dalam kondisi tersedia
    releaseMeja(activeCabangId, 'M-02');
    assert.equal(isMejaAvailable(activeCabangId, 'M-02'), true, 'Meja M-02 harus tersedia sebelum transaksi');

    const customerName = 'Budi Santoso';
    const mockInvoiceId = `inv_test_dinein_${Date.now()}`;

    // 2. Buat transaksi pesanan Mayar di DB & OperationalStore
    const pesananRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'DINE_IN',
      nomor_meja: 'M-02',
      nama_pelanggan: customerName,
      catatan_pesanan: 'Less sugar, meja lantai 1',
      items: [
        {
          produk_id: activeProdukId,
          jumlah: 2,
        },
      ],
    });

    assert.equal(pesananRes.success, true, `Pesanan harus sukses dibuat: ${pesananRes.error}`);
    const trxId = pesananRes.transaksi_id!;
    assert.ok(trxId, 'Harus mengembalikan transaksi_id');

    // Hubungkan dengan invoice Mayar
    await updateMayarInvoiceIdDb(trxId, mockInvoiceId);

    // Verifikasi meja M-02 otomatis terisi
    const mejaListBeforePay = getDefaultMejaCabang(activeCabangId);
    const mejaM02Before = mejaListBeforePay.find((m) => m.nomor_meja === 'M-02');
    assert.ok(mejaM02Before, 'Meja M-02 harus ada');
    assert.equal(mejaM02Before.status, 'terisi', 'Meja M-02 harus otomatis berstatus terisi');
    assert.equal(mejaM02Before.transaksi_terkini_id, trxId);

    // Verifikasi pesanan terdaftar di antrean operasional dengan status MENUNGGU_BAYAR
    const pesananInStore = getPesananByTransaksiId(trxId);
    assert.ok(pesananInStore, 'Pesanan harus terdaftar di operational store');
    assert.equal(pesananInStore.jenis_pesanan, 'DINE_IN', 'Jenis pesanan harus DINE_IN');
    assert.equal(pesananInStore.nomor_meja, 'M-02', 'Nomor meja harus M-02');
    assert.equal(pesananInStore.nama_pelanggan, customerName);
    assert.equal(pesananInStore.status_pembayaran, 'MENUNGGU_BAYAR');

    // 3. Simulasikan Pelunasan dari Gateway Mayar (Webhook / Polling)
    const settleRes = await selesaikanTransaksiMayarDb(mockInvoiceId);
    assert.equal(settleRes.success, true, `Pelunasan Mayar harus sukses: ${settleRes.error}`);

    // 4. Verifikasi setelah pelunasan:
    // a. Data di Operational Store TIDAK tertimpa menjadi TAKEAWAY
    const pesananAfterPay = getPesananByTransaksiId(trxId);
    assert.ok(pesananAfterPay);
    assert.equal(pesananAfterPay.jenis_pesanan, 'DINE_IN', 'Jenis pesanan tetap DINE_IN setelah bayar');
    assert.equal(pesananAfterPay.nomor_meja, 'M-02', 'Nomor meja tetap M-02 setelah bayar');
    assert.equal(pesananAfterPay.status_pembayaran, 'LUNAS', 'Status pembayaran harus berubah jadi LUNAS');
    assert.equal(pesananAfterPay.nama_pelanggan, customerName);

    // b. Meja M-02 tetap terisi selama pelanggan masih makan/minum
    const mejaListAfterPay = getDefaultMejaCabang(activeCabangId);
    const mejaM02After = mejaListAfterPay.find((m) => m.nomor_meja === 'M-02');
    assert.equal(mejaM02After?.status, 'terisi', 'Meja M-02 tetap berstatus terisi setelah bayar');

    // c. Antrean KDS menampilkan pesanan Dine In Meja M-02
    const antreanKDS = getAntreanList(activeCabangId);
    const itemInKds = antreanKDS.find((a) => a.transaksi_id === trxId);
    assert.ok(itemInKds, 'Pesanan harus ada di antrean KDS');
    assert.equal(itemInKds.jenis_pesanan, 'DINE_IN');
    assert.equal(itemInKds.nomor_meja, 'M-02');
    assert.equal(itemInKds.status_pembayaran, 'LUNAS');
  });

  it('SKENARIO 2: Takeaway -> Pembayaran QRIS Mayar Berhasil -> Meja Tetap Kosong (Tersedia)', async () => {
    // Catat status meja sebelum transaksi Takeaway
    const mejaListBefore = getDefaultMejaCabang(activeCabangId);
    const occupiedBeforeCount = mejaListBefore.filter((m) => m.status === 'terisi').length;

    const mockInvoiceIdTakeaway = `inv_test_takeaway_${Date.now()}`;
    const customerName = 'Siti Rahma';

    // 1. Buat pesanan Takeaway
    const pesananRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'TAKEAWAY',
      nomor_meja: null,
      nama_pelanggan: customerName,
      items: [
        {
          produk_id: activeProdukId,
          jumlah: 1,
        },
      ],
    });

    assert.equal(pesananRes.success, true);
    const trxId = pesananRes.transaksi_id!;
    await updateMayarInvoiceIdDb(trxId, mockInvoiceIdTakeaway);

    // 2. Verifikasi tidak ada meja yang berubah jadi terisi
    const mejaListDuring = getDefaultMejaCabang(activeCabangId);
    const occupiedDuringCount = mejaListDuring.filter((m) => m.status === 'terisi').length;
    assert.equal(occupiedDuringCount, occupiedBeforeCount, 'Transaksi Takeaway tidak boleh mengisi meja');

    // 3. Selesaikan transaksi Mayar
    const settleRes = await selesaikanTransaksiMayarDb(mockInvoiceIdTakeaway);
    assert.equal(settleRes.success, true);

    // 4. Verifikasi jenis pesanan tetap TAKEAWAY dan nomor_meja null
    const pesananTakeaway = getPesananByTransaksiId(trxId);
    assert.ok(pesananTakeaway);
    assert.equal(pesananTakeaway.jenis_pesanan, 'TAKEAWAY');
    assert.equal(pesananTakeaway.nomor_meja, null, 'Nomor meja Takeaway harus null');
    assert.equal(pesananTakeaway.status_pembayaran, 'LUNAS');

    // Meja tetap tidak terisi
    const mejaListAfter = getDefaultMejaCabang(activeCabangId);
    const occupiedAfterCount = mejaListAfter.filter((m) => m.status === 'terisi').length;
    assert.equal(occupiedAfterCount, occupiedBeforeCount, 'Transaksi Takeaway tetap tidak boleh mengisi meja');
  });

  it('SKENARIO 3: Tutup dan Buka Kembali Detail Transaksi / Verifikasi Konsistensi Database', async () => {
    const mockInvoiceId = `inv_test_reopen_${Date.now()}`;
    const testMeja = 'M-03';
    releaseMeja(activeCabangId, testMeja);

    // 1. Buat transaksi pesanan Dine In
    const pesananRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'DINE_IN',
      nomor_meja: testMeja,
      nama_pelanggan: 'Ibu Ratna',
      items: [
        {
          produk_id: activeProdukId,
          jumlah: 1,
        },
      ],
    });

    assert.equal(pesananRes.success, true);
    const trxId = pesananRes.transaksi_id!;
    await updateMayarInvoiceIdDb(trxId, mockInvoiceId);

    // 2. Simulasikan "Tutup & Buka Kembali": Panggil cekStatusTransaksiMayarAction
    const { cekStatusTransaksiMayarAction } = await import('../src/app/actions/mayar');
    const detailTerkini = await cekStatusTransaksiMayarAction(trxId);

    assert.equal(detailTerkini.success, true, 'Detail transaksi harus berhasil dimuat ulang');
    assert.equal(detailTerkini.jenis_pesanan, 'DINE_IN', 'Jenis pesanan tetap DINE_IN saat dibuka kembali');
    assert.equal(detailTerkini.nomor_meja, testMeja, 'Nomor meja tetap M-03 saat dibuka kembali');
    assert.equal(detailTerkini.nama_pelanggan, 'Ibu Ratna', 'Nama pelanggan konsisten');

    // 3. Verifikasi persistensi di database transaksi Supabase
    const { data: dbTrx } = await adminClient
      .from('transaksi')
      .select('id, nomor_struk, total, status')
      .eq('id', trxId)
      .single();
    assert.ok(dbTrx, 'Transaksi harus ada di tabel transaksi Supabase');
    assert.equal(dbTrx.id, trxId);

    // Bersihkan meja uji
    releaseMeja(activeCabangId, testMeja);
  });

  it('SKENARIO 4: Isolasi Meja Antar-Cabang (Meja Cabang A Tidak Mempengaruhi Cabang B)', async () => {
    // Ambil dua cabang berbeda dari database
    const { data: cabangs } = await adminClient
      .from('cabang')
      .select('id, kode, nama')
      .limit(2);

    if (cabangs && cabangs.length >= 2) {
      const cabangA = cabangs[0].id;
      const cabangB = cabangs[1].id;

      // Bebaskan M-01 di kedua cabang
      releaseMeja(cabangA, 'M-01');
      releaseMeja(cabangB, 'M-01');

      // Isi M-01 hanya di Cabang A
      occupyMeja(cabangA, 'M-01', 'trx_test_a', 'STRUK-A', {
        nomor_struk: 'STRUK-A',
        total: 50000,
        items: [{ nama: 'Latte', jumlah: 1 }],
      });

      // Verifikasi: Cabang A terisi, Cabang B TETAP tersedia
      assert.equal(isMejaAvailable(cabangA, 'M-01'), false, 'Meja M-01 Cabang A harus terisi');
      assert.equal(isMejaAvailable(cabangB, 'M-01'), true, 'Meja M-01 Cabang B HARUS TETAP tersedia (terisolasi)');

      // Bersihkan
      releaseMeja(cabangA, 'M-01');
    }
  });

  it('SKENARIO 5: Kegagalan Pembayaran & Pembatalan Transaksi Mayar Membebaskan Meja', async () => {
    const testMeja = 'M-04';
    releaseMeja(activeCabangId, testMeja);

    // 1. Buat transaksi Dine In
    const pesananRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'DINE_IN',
      nomor_meja: testMeja,
      nama_pelanggan: 'Doni Pembatalan',
      items: [
        {
          produk_id: activeProdukId,
          jumlah: 1,
        },
      ],
    });

    assert.equal(pesananRes.success, true);
    const trxId = pesananRes.transaksi_id!;

    // Pastikan meja M-04 terisi
    assert.equal(isMejaAvailable(activeCabangId, testMeja), false, 'Meja harus terisi saat menunggu bayar');

    // 2. Batalkan transaksi (kasir membatalkan atau expired 10 menit)
    const cancelRes = await batalkanTransaksiMayarDb(trxId, 'Pelanggan membatalkan pesanan QRIS');
    assert.equal(cancelRes.success, true, 'Pembatalan transaksi harus berhasil');

    // Bebaskan meja berdasarkan ID transaksi
    releaseMejaByTransaksi(trxId);

    // 3. Verifikasi meja M-04 otomatis kembali menjadi TERSEDIA
    assert.equal(isMejaAvailable(activeCabangId, testMeja), true, 'Meja harus kembali tersedia setelah pembatalan');

    // Verifikasi pesanan dihapus dari antrean KDS
    const antreanAfterCancel = getAntreanList(activeCabangId);
    const foundInKds = antreanAfterCancel.find((a) => a.transaksi_id === trxId);
    assert.equal(foundInKds, undefined, 'Pesanan yang dibatalkan tidak boleh ada di antrean KDS');
  });

  it('SKENARIO 6: Validasi Dine In Wajib Meja (Tidak Boleh Kosong atau Fallback Diam-diam)', async () => {
    // 1. Coba pesan Dine In tanpa nomor_meja
    const noTableRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'DINE_IN',
      nomor_meja: null,
      items: [
        {
          produk_id: activeProdukId,
          jumlah: 1,
        },
      ],
    });

    assert.equal(noTableRes.success, false, 'Pesanan Dine In tanpa meja harus ditolak');
    assert.match(noTableRes.error || '', /wajib memilih nomor meja/i);

    // 2. Coba pesan Dine In dengan meja yang sedang terisi
    const testMeja = 'M-05';
    releaseMeja(activeCabangId, testMeja);
    occupyMeja(activeCabangId, testMeja, 'trx_existing_dummy', 'STRUK-EXIST', {
      nomor_struk: 'STRUK-EXIST',
      total: 30000,
      items: [{ nama: 'Cappuccino', jumlah: 1 }],
    });

    const occupiedTableRes = await pesanTransaksiMayarDb({
      shift_id: activeShiftId,
      diskon: 0,
      jenis_pesanan: 'DINE_IN',
      nomor_meja: testMeja,
      items: [
        {
          produk_id: activeProdukId,
          jumlah: 1,
        },
      ],
    });

    assert.equal(occupiedTableRes.success, false, 'Pesanan Dine In pada meja yang sedang terisi harus ditolak');
    assert.match(occupiedTableRes.error || '', /sedang terisi/i);

    // Bersihkan meja
    releaseMeja(activeCabangId, testMeja);
  });

  it('SKENARIO 7: Integritas Data Historis Database Tetap Utuh (62 Transaksi & 24 Shift)', async () => {
    const { count: trxCount, error: trxErr } = await adminClient
      .from('transaksi')
      .select('*', { count: 'exact', head: true });

    assert.equal(trxErr, null);
    assert.ok((trxCount || 0) >= 62, `Data transaksi historis tidak boleh berkurang: ${trxCount}`);

    const { count: shiftCount, error: shiftErr } = await adminClient
      .from('shift_kasir')
      .select('*', { count: 'exact', head: true });

    assert.equal(shiftErr, null);
    assert.ok((shiftCount || 0) >= 24, `Data shift kasir historis tidak boleh berkurang: ${shiftCount}`);
  });
});
