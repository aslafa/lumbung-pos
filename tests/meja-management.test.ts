import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  getDefaultMejaCabang,
  isMejaAvailable,
  occupyMeja,
  releaseMeja,
  releaseMejaByTransaksi,
  addOrUpdateMeja,
  updateStatusMeja,
  registerPesananAntrean,
  generateNomorAntrean,
  getAntreanList,
  transitionStatusPengerjaan,
  clearStoreForTesting,
} from '../src/lib/orders/order-flow.ts';
import { formatRupiah, formatAngka, formatPersen } from '../src/lib/utils/format.ts';

test('Suite Pengujian Manajemen Denah Meja, Kapasitas Fisik, dan Integritas KDS (Lumbung POS)', async (t) => {
  const CABANG_A = 'cabang-tbt-001';
  const CABANG_B = 'cabang-btr-002';

  // Setup: Bersihkan state operational store sebelum setiap pengujian
  beforeEach(() => {
    clearStoreForTesting();
  });
  clearStoreForTesting();

  await t.test('TC-MEJA-01 [Kapasitas & Bentuk Meja Fisik]: Memvalidasi kesesuaian kursi dan bentuk meja', () => {
    const list = getDefaultMejaCabang(CABANG_A);
    assert.ok(list.length >= 10, 'Cabang harus memiliki minimal 10 meja terdaftar');

    // Cek meja 2 kursi (lingkaran)
    const meja2 = list.find((m) => m.kapasitas === 2);
    assert.ok(meja2, 'Harus ada meja dengan kapasitas 2 kursi');
    assert.strictEqual(meja2.bentuk, 'lingkaran', 'Meja 2 orang harus berbentuk lingkaran');

    // Cek meja 4 kursi (persegi)
    const meja4 = list.find((m) => m.kapasitas === 4);
    assert.ok(meja4, 'Harus ada meja dengan kapasitas 4 kursi');
    assert.strictEqual(meja4.bentuk, 'persegi', 'Meja 4 orang harus berbentuk persegi');

    // Cek meja 6+ kursi (persegi panjang)
    const meja6 = list.find((m) => m.kapasitas >= 6);
    assert.ok(meja6, 'Harus ada meja dengan kapasitas 6 kursi atau lebih');
    assert.strictEqual(meja6.bentuk, 'persegi_panjang', 'Meja 6+ orang harus berbentuk persegi panjang');
  });

  await t.test('TC-MEJA-02 [Filter Area & Kapasitas]: Memfilter meja berdasarkan zonasi dan kapasitas', () => {
    const list = getDefaultMejaCabang(CABANG_A);

    const indoorTables = list.filter((m) => m.area === 'Indoor');
    const outdoorTables = list.filter((m) => m.area === 'Outdoor');
    const terasTables = list.filter((m) => m.area === 'Teras');

    assert.ok(indoorTables.length > 0, 'Harus memiliki meja Indoor');
    assert.ok(outdoorTables.length > 0, 'Harus memiliki meja Outdoor');
    assert.ok(terasTables.length > 0, 'Harus memiliki meja Teras');

    // Filter kapasitas
    const cap2 = list.filter((m) => m.kapasitas === 2);
    const cap4 = list.filter((m) => m.kapasitas === 4);
    const cap6Plus = list.filter((m) => m.kapasitas >= 6);

    assert.strictEqual(
      list.length,
      cap2.length + cap4.length + cap6Plus.length,
      'Total meja harus terbagi habis ke dalam kategori kapasitas'
    );
  });

  await t.test('TC-MEJA-03 [Pencegahan Race Condition]: Dua kasir tidak dapat memilih meja yang sama bersamaan', () => {
    const nomorMeja = 'M-01';
    assert.strictEqual(isMejaAvailable(CABANG_A, nomorMeja), true, 'Meja M-01 harus tersedia pada awalnya');

    // Kasir 1 menempati meja
    const occupied = occupyMeja(
      CABANG_A,
      nomorMeja,
      'TRX-KASIR-001',
      'STR-20261024-001',
      {
        nomor_struk: 'STR-20261024-001',
        total: 75000,
        items: [{ nama: 'Kopi Susu Gula Aren', jumlah: 2 }],
      }
    );
    assert.strictEqual(occupied.success, true, 'Kasir 1 berhasil memesan meja');

    // Kasir 2 mencoba memilih meja yang sama
    const isAvailForKasir2 = isMejaAvailable(CABANG_A, nomorMeja);
    assert.strictEqual(isAvailForKasir2, false, 'Kasir 2 harus ditolak karena meja sudah terisi');

    const doubleOccupy = occupyMeja(
      CABANG_A,
      nomorMeja,
      'TRX-KASIR-002',
      'STR-20261024-002',
      {
        nomor_struk: 'STR-20261024-002',
        total: 50000,
        items: [{ nama: 'Americano', jumlah: 1 }],
      }
    );
    assert.strictEqual(doubleOccupy.success, false, 'Occupy kedua kali harus ditolak');
  });

  await t.test('TC-MEJA-04 [Checkout Gagal / Void]: Meja terbebaskan kembali saat transaksi dibatalkan', () => {
    const nomorMeja = 'M-02';
    const occRes = occupyMeja(
      CABANG_A,
      nomorMeja,
      'TRX-VOID-001',
      'STR-VOID-001',
      {
        nomor_struk: 'STR-VOID-001',
        total: 45000,
        items: [{ nama: 'Croissant', jumlah: 1 }],
      }
    );
    assert.strictEqual(occRes.success, true, 'Meja M-02 berhasil di-occupy');
    assert.strictEqual(isMejaAvailable(CABANG_A, nomorMeja), false, 'Meja harus terisi');

    // Simulasi pembatalan/void transaksi dengan releaseMejaByTransaksi
    const resVoid = releaseMejaByTransaksi('TRX-VOID-001');
    assert.strictEqual(resVoid.success, true, 'Meja harus berhasil dibebaskan');
    assert.strictEqual(isMejaAvailable(CABANG_A, nomorMeja), true, 'Meja harus kembali berstatus tersedia');
  });

  await t.test('TC-MEJA-05 [Pembersihan Meja Setelah Selesai Makan]: Transisi ke menunggu_dibersihkan lalu tersedia', () => {
    const nomorMeja = 'M-03';
    const occRes = occupyMeja(
      CABANG_A,
      nomorMeja,
      'TRX-DINE-003',
      'STR-DINE-003',
      {
        nomor_struk: 'STR-DINE-003',
        total: 120000,
        items: [{ nama: 'Cappuccino', jumlah: 2 }],
      }
    );
    assert.strictEqual(occRes.success, true, 'Meja M-03 berhasil di-occupy');

    // Tamu selesai makan -> ubah ke menunggu_dibersihkan
    const toCleaning = updateStatusMeja(CABANG_A, nomorMeja, 'menunggu_dibersihkan');
    assert.strictEqual(toCleaning.success, true);
    assert.strictEqual(isMejaAvailable(CABANG_A, nomorMeja), false, 'Meja yang belum dibersihkan tidak boleh dipakai');

    // Housekeeping selesai bersih -> ubah kembali ke tersedia via releaseMeja
    const toAvailable = releaseMeja(CABANG_A, nomorMeja);
    assert.strictEqual(toAvailable.success, true);
    assert.strictEqual(isMejaAvailable(CABANG_A, nomorMeja), true, 'Meja bersih siap digunakan kembali');
  });

  await t.test('TC-MEJA-06 [Isolasi Cabang]: Meja cabang A tidak memengaruhi cabang B', () => {
    const nomorMeja = 'M-04';

    // Cabang A menempati meja M-04
    const occA = occupyMeja(CABANG_A, nomorMeja, 'TRX-A-004', 'STR-A-004', {
      nomor_struk: 'STR-A-004',
      total: 30000,
      items: [],
    });
    assert.strictEqual(occA.success, true);

    assert.strictEqual(isMejaAvailable(CABANG_A, nomorMeja), false, 'Meja M-04 di Cabang A harus terisi');
    assert.strictEqual(isMejaAvailable(CABANG_B, nomorMeja), true, 'Meja M-04 di Cabang B harus tetap tersedia');
  });

  await t.test('TC-MEJA-07 [Owner Config]: Owner dapat menambah atau memperbarui meja', () => {
    const res = addOrUpdateMeja(CABANG_A, {
      nomor_meja: 'VIP-01',
      kapasitas: 8,
      area: 'Indoor',
      bentuk: 'persegi_panjang',
    });

    assert.strictEqual(res.success, true);
    assert.ok(res.meja);
    assert.strictEqual(res.meja.nomor_meja, 'VIP-01');
    assert.strictEqual(res.meja.kapasitas, 8);
    assert.strictEqual(res.meja.area, 'Indoor');
    assert.strictEqual(res.meja.bentuk, 'persegi_panjang');

    // Cek apakah ada di daftar cabang
    const list = getDefaultMejaCabang(CABANG_A);
    const found = list.find((m) => m.nomor_meja === 'VIP-01');
    assert.ok(found, 'Meja VIP-01 harus terdaftar di cabang');
  });

  await t.test('TC-MEJA-08 [Integritas KDS & Siklus Pengerjaan]: Pesanan antrean melalui alur pengerjaan lengkap', async () => {
    const antreanNum = generateNomorAntrean('TBT');
    registerPesananAntrean({
      transaksi_id: 'TRX-KDS-TEST-001',
      cabang_id: CABANG_A,
      cabang_nama: 'Lumbung Tebet',
      nomor_antrean: antreanNum,
      nomor_struk: 'STR-KDS-001',
      nomor_meja: 'M-05',
      jenis_pesanan: 'DINE_IN',
      items: [{ nama: 'Espresso Single', jumlah: 1, subtotal: 25000, catatan: 'Extra hot' }],
      total: 25000,
      metode_bayar: 'qris',
      status_pengerjaan: 'MENUNGGU',
      status_pembayaran: 'lunas',
      dibuat_pada: new Date().toISOString(),
    });

    // Transisi 1: MENUNGGU -> DIPROSES (Barista mulai meracik)
    const t1 = await transitionStatusPengerjaan('TRX-KDS-TEST-001', 'DIPROSES');
    assert.strictEqual(t1.success, true);

    // Transisi 2: DIPROSES -> SIAP_DIAMBIL (Kopi selesai dibuat)
    const t2 = await transitionStatusPengerjaan('TRX-KDS-TEST-001', 'SIAP_DIAMBIL');
    assert.strictEqual(t2.success, true);

    // Transisi 3: SIAP_DIAMBIL -> SELESAI (Tamu mengambil kopi)
    const t3 = await transitionStatusPengerjaan('TRX-KDS-TEST-001', 'SELESAI');
    assert.strictEqual(t3.success, true);

    // Cek KDS aktif
    const allList = getAntreanList(CABANG_A);
    const completedItem = allList.find((p) => p.transaksi_id === 'TRX-KDS-TEST-001');
    assert.ok(completedItem, 'Pesanan harus ada dalam riwayat KDS');
    assert.strictEqual(completedItem.status_pengerjaan, 'SELESAI', 'Status pengerjaan harus SELESAI');
    assert.strictEqual(completedItem.status_pembayaran, 'lunas', 'Status pembayaran tetap lunas');
  });

  await t.test('TC-MEJA-09 [Standarisasi Format Angka & Tabular Nums]: Pengujian formatter Rupiah, integer, dan persen', () => {
    assert.strictEqual(formatRupiah(0), 'Rp0');
    assert.strictEqual(formatRupiah(2450000), 'Rp2.450.000');
    assert.strictEqual(formatRupiah(150000000), 'Rp150.000.000');

    assert.strictEqual(formatAngka(0), '0');
    assert.strictEqual(formatAngka(1450), '1.450');

    assert.strictEqual(formatPersen(0), '0%');
    assert.strictEqual(formatPersen(25.5), '25,5%');
  });
});
