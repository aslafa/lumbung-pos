import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateNomorAntrean,
  occupyMeja,
  updateStatusMeja,
  registerPesananAntrean,
  getAntreanList,
  transitionStatusPengerjaan,
  getDefaultMejaCabang,
  clearStoreForTesting,
} from '../src/lib/orders/order-flow.ts';
import type { PesananAntreanItem } from '../src/lib/orders/order-flow.ts';

describe('Pengujian Alur Antrean Modern & Manajemen Meja Coffee Shop (Lumbung POS)', () => {
  const dummyCabangId = 'cabang-tebet-01';

  beforeEach(() => {
    // Reset global operational store for clean test isolation
    clearStoreForTesting();
  });

  it('TC-ORD-01 [Penomoran Antrean Otomatis & Unik]: Antrean memiliki format prefix cabang dan berurutan', () => {
    // Cabang TBT -> prefix 'A', BTR -> 'B', DPK -> 'C'
    const q1 = generateNomorAntrean('TBT');
    const q2 = generateNomorAntrean('TBT');
    const q3 = generateNomorAntrean('TBT');

    assert.equal(q1, 'A-001', 'Nomor pertama Tebet harus A-001');
    assert.equal(q2, 'A-002', 'Nomor kedua Tebet harus A-002');
    assert.equal(q3, 'A-003', 'Nomor ketiga Tebet harus A-003');

    // Cabang Bintaro harus independen
    const qBtr = generateNomorAntrean('BTR');
    assert.equal(qBtr, 'B-001', 'Nomor pertama Bintaro harus B-001');

    // Cabang Depok
    const qDpk = generateNomorAntrean('DPK');
    assert.equal(qDpk, 'C-001', 'Nomor pertama Depok harus C-001');
  });

  it('TC-ORD-02 [Siklus Hidup Meja DINE_IN]: Transisi status meja dari tersedia -> terisi -> menunggu_dibersihkan -> tersedia', () => {
    const nomorMeja = 'M-01';
    const transaksiId = 'trx-test-001';
    const nomorStruk = 'TRX-TBT-20261023-0001';

    // 1. Awalnya meja tersedia
    const mejas = getDefaultMejaCabang(dummyCabangId);
    const initialM1 = mejas.find((m) => m.nomor_meja === nomorMeja);
    assert.equal(initialM1?.status, 'tersedia', 'Meja awal harus tersedia');

    // 2. Checkout Dine In -> Meja Terisi
    const resOccupy = occupyMeja(dummyCabangId, nomorMeja, transaksiId, nomorStruk);
    assert.equal(resOccupy.success, true);

    const occupiedMejas = getDefaultMejaCabang(dummyCabangId);
    const occupiedM1 = occupiedMejas.find((m) => m.nomor_meja === nomorMeja);
    assert.equal(occupiedM1?.status, 'terisi', 'Status meja harus terisi');
    assert.equal(occupiedM1?.nomor_struk_terkini, nomorStruk);

    // 3. Pesanan selesai / Pelanggan selesai makan -> Meja Menunggu Dibersihkan
    const resCleaning = updateStatusMeja(dummyCabangId, nomorMeja, 'menunggu_dibersihkan');
    assert.equal(resCleaning.success, true);

    const cleaningMejas = getDefaultMejaCabang(dummyCabangId);
    const cleaningM1 = cleaningMejas.find((m) => m.nomor_meja === nomorMeja);
    assert.equal(cleaningM1?.status, 'menunggu_dibersihkan', 'Meja harus menunggu dibersihkan');

    // 4. Barista/Crew membersihkan meja -> Meja Tersedia kembali
    const resClean = updateStatusMeja(dummyCabangId, nomorMeja, 'tersedia');
    assert.equal(resClean.success, true);

    const freeMejas = getDefaultMejaCabang(dummyCabangId);
    const freeM1 = freeMejas.find((m) => m.nomor_meja === nomorMeja);
    assert.equal(freeM1?.status, 'tersedia', 'Meja harus kembali tersedia');
    assert.equal(freeM1?.transaksi_terkini_id, null, 'Transaksi terkait harus di-reset');
  });

  it('TC-ORD-03 [Pencegahan Konflik Meja]: Dua pesanan aktif tidak boleh menempati meja yang sama secara bersamaan', () => {
    const nomorMeja = 'M-02';
    const trx1 = 'trx-order-1';
    const struk1 = 'TRX-TBT-20261023-0010';
    const trx2 = 'trx-order-2';
    const struk2 = 'TRX-TBT-20261023-0011';

    // Pesanan 1 menempati M-02
    const res1 = occupyMeja(dummyCabangId, nomorMeja, trx1, struk1);
    assert.equal(res1.success, true);

    // Pesanan 2 mencoba menempati M-02 yang sedang terisi
    const res2 = occupyMeja(dummyCabangId, nomorMeja, trx2, struk2);
    assert.equal(res2.success, false, 'Pesanan kedua harus ditolak karena meja terisi');
    assert.match(res2.error || '', /sedang terisi/);
  });

  it('TC-ORD-04 [Mesin Status Pengerjaan KDS]: Validasi transisi MENUNGGU -> DIPROSES -> SIAP_DIAMBIL -> SELESAI', async () => {
    const orderPayload: PesananAntreanItem = {
      transaksi_id: 'trx-kds-01',
      nomor_struk: 'TRX-TBT-20261023-0020',
      nomor_antrean: 'A-010',
      cabang_id: dummyCabangId,
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'DINE_IN',
      nomor_meja: 'M-03',
      status_pengerjaan: 'MENUNGGU',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Kopi Susu Gula Aren', jumlah: 2, subtotal: 36000 }],
      total: 36000,
      metode_bayar: 'tunai',
      status_pembayaran: 'lunas',
    };

    registerPesananAntrean(orderPayload);
    const listInitial = getAntreanList(dummyCabangId);
    assert.equal(listInitial.length, 1);
    assert.equal(listInitial[0].status_pengerjaan, 'MENUNGGU');

    // 1. Valid: MENUNGGU -> DIPROSES
    const step1 = await transitionStatusPengerjaan('trx-kds-01', 'DIPROSES');
    assert.equal(step1.success, true);
    assert.equal(step1.item?.status_pengerjaan, 'DIPROSES');

    // 2. Valid: DIPROSES -> SIAP_DIAMBIL
    const step2 = await transitionStatusPengerjaan('trx-kds-01', 'SIAP_DIAMBIL');
    assert.equal(step2.success, true);
    assert.equal(step2.item?.status_pengerjaan, 'SIAP_DIAMBIL');

    // 3. Valid: SIAP_DIAMBIL -> SELESAI
    const step3 = await transitionStatusPengerjaan('trx-kds-01', 'SELESAI');
    assert.equal(step3.success, true);
    assert.equal(step3.item?.status_pengerjaan, 'SELESAI');
    assert.ok(step3.item?.diselesaikan_pada);
  });

  it('TC-ORD-05 [Pencegahan Transisi Ilegal]: Transisi mundur atau lompat status harus ditolak', async () => {
    const orderPayload: PesananAntreanItem = {
      transaksi_id: 'trx-kds-illegal',
      nomor_struk: 'TRX-TBT-20261023-0025',
      nomor_antrean: 'A-015',
      cabang_id: dummyCabangId,
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'TAKEAWAY',
      nomor_meja: null,
      status_pengerjaan: 'MENUNGGU',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Roti Srikaya Panggang', jumlah: 1, subtotal: 15000 }],
      total: 15000,
      metode_bayar: 'tunai',
      status_pembayaran: 'lunas',
    };

    registerPesananAntrean(orderPayload);

    // Coba lompat langsung dari MENUNGGU ke SELESAI tanpa diproses
    const illegalJump = await transitionStatusPengerjaan('trx-kds-illegal', 'SELESAI');
    assert.equal(illegalJump.success, false, 'Lompat langsung ke SELESAI harus ditolak');
    assert.match(illegalJump.error || '', /Transisi tidak valid/);

    // Proses pesanan
    await transitionStatusPengerjaan('trx-kds-illegal', 'DIPROSES');

    // Coba mundur dari DIPROSES kembali ke MENUNGGU
    const illegalReverse = await transitionStatusPengerjaan('trx-kds-illegal', 'MENUNGGU');
    assert.equal(illegalReverse.success, false, 'Mundur ke MENUNGGU harus ditolak');
  });

  it('TC-ORD-06 [Pemisahan Status Pengerjaan & Pembayaran]: Status pengerjaan tidak mengubah status pembayaran', async () => {
    const orderPayload: PesananAntreanItem = {
      transaksi_id: 'trx-payment-sep',
      nomor_struk: 'TRX-TBT-20261023-0030',
      nomor_antrean: 'A-020',
      cabang_id: dummyCabangId,
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'DINE_IN',
      nomor_meja: 'M-04',
      status_pengerjaan: 'MENUNGGU',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Manual Brew V60', jumlah: 1, subtotal: 25000 }],
      total: 25000,
      metode_bayar: 'qris',
      status_pembayaran: 'lunas',
    };

    registerPesananAntrean(orderPayload);
    const transitionRes = await transitionStatusPengerjaan('trx-payment-sep', 'DIPROSES');

    assert.equal(transitionRes.success, true);
    assert.equal(transitionRes.item?.status_pengerjaan, 'DIPROSES');
    assert.equal(transitionRes.item?.status_pembayaran, 'lunas', 'Status pembayaran tidak boleh terpengaruh');
  });

  it('TC-ORD-07 [Isolasi Data Cabang]: Antrean cabang A tidak bercampur dengan antrean cabang B', () => {
    const cabangTebet = 'cabang-tebet';
    const cabangBintaro = 'cabang-bintaro';

    registerPesananAntrean({
      transaksi_id: 'trx-tbt-01',
      nomor_struk: 'TRX-TBT-01',
      nomor_antrean: 'A-001',
      cabang_id: cabangTebet,
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'TAKEAWAY',
      nomor_meja: null,
      status_pengerjaan: 'MENUNGGU',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Americano', jumlah: 1, subtotal: 18000 }],
      total: 18000,
      metode_bayar: 'tunai',
      status_pembayaran: 'lunas',
    });

    registerPesananAntrean({
      transaksi_id: 'trx-btr-01',
      nomor_struk: 'TRX-BTR-01',
      nomor_antrean: 'B-001',
      cabang_id: cabangBintaro,
      cabang_nama: 'Lumbung Bintaro',
      jenis_pesanan: 'DINE_IN',
      nomor_meja: 'M-01',
      status_pengerjaan: 'MENUNGGU',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Latte', jumlah: 1, subtotal: 22000 }],
      total: 22000,
      metode_bayar: 'tunai',
      status_pembayaran: 'lunas',
    });

    const tebetList = getAntreanList(cabangTebet);
    const bintaroList = getAntreanList(cabangBintaro);

    assert.equal(tebetList.length, 1);
    assert.equal(tebetList[0].nomor_antrean, 'A-001');

    assert.equal(bintaroList.length, 1);
    assert.equal(bintaroList[0].nomor_antrean, 'B-001');
  });

  it('TC-ORD-08 [Idempotensi Pembersihan Meja]: Meja yang sudah tersedia tidak error jika dibersihkan ulang', () => {
    const nomorMeja = 'M-05';
    // Meja M-05 awalnya tersedia
    const res1 = updateStatusMeja(dummyCabangId, nomorMeja, 'tersedia');
    assert.equal(res1.success, true);

    // Eksekusi ulang pembersihan meja yang sudah bersih
    const res2 = updateStatusMeja(dummyCabangId, nomorMeja, 'tersedia');
    assert.equal(res2.success, true);
  });
});
