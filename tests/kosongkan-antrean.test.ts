import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  registerPesananAntrean,
  getAntreanList,
  occupyMeja,
  getDefaultMejaCabang,
  clearAntreanList,
  clearStoreForTesting,
  PesananAntreanItem,
} from '../src/lib/orders/order-flow.ts';
import { kosongkanAntreanAction } from '../src/app/actions/antrean.ts';

describe('Pengujian Komprehensif Perbaikan Tombol Kosongkan Antrean & KDS', () => {
  const cabangTebet = 'cabang-tebet-01';
  const cabangBintaro = 'cabang-bintaro-02';

  beforeEach(() => {
    clearStoreForTesting();
  });

  it('TC-CLEAR-01 [Operasi Pengosongan]: clearAntreanList menandai pesanan aktif menjadi SELESAI dan mencatat diselesaikan_pada', () => {
    const orders: PesananAntreanItem[] = [
      {
        transaksi_id: 'trx-a006',
        nomor_struk: 'TRX-TBT-20261027-0006',
        nomor_antrean: 'A-006',
        cabang_id: cabangTebet,
        cabang_nama: 'Lumbung Tebet',
        jenis_pesanan: 'TAKEAWAY',
        status_pengerjaan: 'MENUNGGU',
        status_pembayaran: 'LUNAS',
        metode_bayar: 'tunai',
        dibuat_pada: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
        items: [{ nama: 'Es Kopi Susu Aren', jumlah: 2, subtotal: 44000 }],
        total: 44000,
      },
      {
        transaksi_id: 'trx-a005',
        nomor_struk: 'TRX-TBT-20261027-0005',
        nomor_antrean: 'A-005',
        cabang_id: cabangTebet,
        cabang_nama: 'Lumbung Tebet',
        jenis_pesanan: 'TAKEAWAY',
        status_pengerjaan: 'DIPROSES',
        status_pembayaran: 'LUNAS',
        metode_bayar: 'tunai',
        dibuat_pada: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
        items: [{ nama: 'Cappuccino Warm', jumlah: 1, subtotal: 28000 }],
        total: 28000,
      },
      {
        transaksi_id: 'trx-a003',
        nomor_struk: 'TRX-TBT-20261027-0003',
        nomor_antrean: 'A-003',
        cabang_id: cabangTebet,
        cabang_nama: 'Lumbung Tebet',
        jenis_pesanan: 'DINE_IN',
        nomor_meja: 'M-01',
        status_pengerjaan: 'SIAP_DIAMBIL',
        status_pembayaran: 'LUNAS',
        metode_bayar: 'tunai',
        dibuat_pada: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
        items: [{ nama: 'Roti Srikaya', jumlah: 2, subtotal: 30000 }],
        total: 30000,
      },
    ];

    // Daftarkan ke operational store
    orders.forEach((o) => registerPesananAntrean(o));

    const initialList = getAntreanList(cabangTebet);
    assert.equal(initialList.length, 3, 'Harus ada 3 antrean aktif');

    // Kosongkan antrean cabang Tebet
    const result = clearAntreanList(cabangTebet);
    assert.equal(result.clearedCount, 3, 'Harus ada 3 antrean yang dikosongkan');
    assert.deepEqual(result.clearedIds.sort(), ['trx-a003', 'trx-a005', 'trx-a006'].sort());

    // Verifikasi setiap item kini berstatus SELESAI dan memiliki timestamp diselesaikan_pada
    const updatedList = getAntreanList(cabangTebet);
    for (const item of updatedList) {
      assert.equal(item.status_pengerjaan, 'SELESAI', `Status ${item.nomor_antrean} harus SELESAI`);
      assert.ok(item.diselesaikan_pada, `Pesanan ${item.nomor_antrean} harus memiliki diselesaikan_pada`);
      assert.equal(item.status_pembayaran, 'LUNAS', 'Status pembayaran tetap LUNAS');
    }
  });

  it('TC-CLEAR-02 [Transisi Meja DINE_IN]: Pengosongan antrean mengubah meja terisi menjadi menunggu_dibersihkan', () => {
    const nomorMeja = 'M-03';
    const trxId = 'trx-dinein-meja3';

    // Isi meja M-03
    occupyMeja(cabangTebet, nomorMeja, trxId, 'TRX-TBT-20261027-0008');
    const mejasBefore = getDefaultMejaCabang(cabangTebet);
    const m3Before = mejasBefore.find((m) => m.nomor_meja === nomorMeja);
    assert.equal(m3Before?.status, 'terisi', 'Meja M-03 harus terisi');

    registerPesananAntrean({
      transaksi_id: trxId,
      nomor_struk: 'TRX-TBT-20261027-0008',
      nomor_antrean: 'A-008',
      cabang_id: cabangTebet,
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'DINE_IN',
      nomor_meja: nomorMeja,
      status_pengerjaan: 'MENUNGGU',
      status_pembayaran: 'LUNAS',
      metode_bayar: 'tunai',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Americano', jumlah: 1, subtotal: 20000 }],
      total: 20000,
    });

    // Kosongkan antrean
    clearAntreanList(cabangTebet);

    // Verifikasi meja M-03 berpindah ke status menunggu_dibersihkan
    const mejasAfter = getDefaultMejaCabang(cabangTebet);
    const m3After = mejasAfter.find((m) => m.nomor_meja === nomorMeja);
    assert.equal(m3After?.status, 'menunggu_dibersihkan', 'Meja M-03 harus dialihkan ke status menunggu_dibersihkan');
  });

  it('TC-CLEAR-03 [Isolasi Cabang BR-01]: Pengosongan antrean cabang A tidak mengosongkan antrean cabang B', () => {
    // Pesanan di Tebet
    registerPesananAntrean({
      transaksi_id: 'trx-tbt-01',
      nomor_struk: 'TRX-TBT-20261027-0010',
      nomor_antrean: 'A-010',
      cabang_id: cabangTebet,
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'TAKEAWAY',
      status_pengerjaan: 'MENUNGGU',
      status_pembayaran: 'LUNAS',
      metode_bayar: 'tunai',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Kopi', jumlah: 1, subtotal: 18000 }],
      total: 18000,
    });

    // Pesanan di Bintaro
    registerPesananAntrean({
      transaksi_id: 'trx-btr-01',
      nomor_struk: 'TRX-BTR-20261027-0011',
      nomor_antrean: 'B-001',
      cabang_id: cabangBintaro,
      cabang_nama: 'Lumbung Bintaro',
      jenis_pesanan: 'TAKEAWAY',
      status_pengerjaan: 'MENUNGGU',
      status_pembayaran: 'LUNAS',
      metode_bayar: 'tunai',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Latte', jumlah: 1, subtotal: 25000 }],
      total: 25000,
    });

    // Kosongkan HANYA cabang Tebet
    const res = clearAntreanList(cabangTebet);
    assert.equal(res.clearedCount, 1);

    // Verifikasi Tebet sudah SELESAI
    const tbtList = getAntreanList(cabangTebet);
    assert.equal(tbtList[0].status_pengerjaan, 'SELESAI');

    // Verifikasi Bintaro tetap MENUNGGU (tidak tersentuh)
    const btrList = getAntreanList(cabangBintaro);
    assert.equal(btrList[0].status_pengerjaan, 'MENUNGGU');
    assert.equal(btrList[0].nomor_antrean, 'B-001');
  });

  it('TC-CLEAR-04 [Simulasi Refresh & Polling]: Pesanan yang telah dikosongkan tidak muncul kembali di antrean aktif', () => {
    const trxId = 'trx-test-no-resurrect';
    registerPesananAntrean({
      transaksi_id: trxId,
      nomor_struk: 'TRX-TBT-20261027-0099',
      nomor_antrean: 'A-099',
      cabang_id: cabangTebet,
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'TAKEAWAY',
      status_pengerjaan: 'MENUNGGU',
      status_pembayaran: 'LUNAS',
      metode_bayar: 'tunai',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Espresso Single', jumlah: 1, subtotal: 15000 }],
      total: 15000,
    });

    // Sebelum dikosongkan: ada 1 antrean aktif
    const beforeClear = getAntreanList(cabangTebet).filter((a) => a.status_pengerjaan !== 'SELESAI');
    assert.equal(beforeClear.length, 1);

    // Kosongkan antrean
    clearAntreanList(cabangTebet);

    // Simulasi refresh atau polling interval: filter antrean aktif
    const afterClear = getAntreanList(cabangTebet).filter((a) => a.status_pengerjaan !== 'SELESAI');
    assert.equal(afterClear.length, 0, 'Antrean aktif harus kosong');

    // Simulasi pemanggilan ulang berulang (polling 8s)
    const poll1 = getAntreanList(cabangTebet).filter((a) => a.status_pengerjaan !== 'SELESAI');
    const poll2 = getAntreanList(cabangTebet).filter((a) => a.status_pengerjaan !== 'SELESAI');
    assert.equal(poll1.length, 0, 'Polling pertama tidak boleh memunculkan antrean kembali');
    assert.equal(poll2.length, 0, 'Polling kedua tidak boleh memunculkan antrean kembali');
  });

  it('TC-CLEAR-05 [Integritas Data Keuangan]: Pengosongan antrean menjaga nilai total, nomor struk, dan item penjualan', () => {
    const trxId = 'trx-finance-check';
    const originalItem = {
      transaksi_id: trxId,
      nomor_struk: 'TRX-TBT-20261027-0100',
      nomor_antrean: 'A-100',
      cabang_id: cabangTebet,
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'TAKEAWAY' as const,
      status_pengerjaan: 'MENUNGGU' as const,
      status_pembayaran: 'LUNAS',
      dibuat_pada: new Date().toISOString(),
      items: [
        { nama: 'V60 Gayo', jumlah: 1, subtotal: 35000 },
        { nama: 'Croissant Butter', jumlah: 2, subtotal: 50000 },
      ],
      total: 85000,
      metode_bayar: 'qris_mayar',
    };

    registerPesananAntrean(originalItem);
    clearAntreanList(cabangTebet);

    const checkList = getAntreanList(cabangTebet);
    const item = checkList.find((p) => p.transaksi_id === trxId);
    assert.ok(item, 'Item harus tetap ada di operational store sebagai riwayat');
    assert.equal(item.total, 85000, 'Total transaksi tidak boleh berubah');
    assert.equal(item.metode_bayar, 'qris_mayar', 'Metode bayar tidak boleh berubah');
    assert.equal(item.items.length, 2, 'Jumlah item struk tidak boleh berkurang');
    assert.equal(item.nomor_struk, 'TRX-TBT-20261027-0100', 'Nomor struk tidak boleh berubah');
  });

  it('TC-CLEAR-06 [Validasi Sesi & Error Handling Server Action]: Gagal dengan pesan yang tepat jika sesi tidak ada', async () => {
    // Tanpa login / mocking profile kosong, server action harus menolak dengan pesan error yang ramah
    const res = await kosongkanAntreanAction(cabangTebet);
    // Jika tidak ada user profile aktif dalam environment tes, harus merespons success: false
    assert.equal(res.success, false);
    assert.ok(res.error, 'Pesan error harus disediakan saat operasi gagal');
    assert.ok(res.error.length > 0, 'Pesan error tidak boleh string kosong');
  });
});
