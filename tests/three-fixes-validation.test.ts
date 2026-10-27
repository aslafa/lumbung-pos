if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Abaikan jika .env.local tidak ada
  }
}

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  getDefaultMejaCabang,
  occupyMeja,
  updateStatusMeja,
  releaseMeja,
  isMejaAvailable,
  clearStoreForTesting,
  validatePembayaranTunai,
} from '../src/lib/orders/order-flow.ts';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

describe('Pengujian Validasi 3 Perbaikan Masalah Lumbung POS', () => {
  const CABANG_TEST = 'cabang-tebet-01';

  beforeEach(() => {
    clearStoreForTesting();
  });

  // ==========================================================================
  // MASALAH 1: Status Meja Setelah Dibersihkan
  // ==========================================================================
  describe('Masalah 1: Status Meja Berubah Menjadi Tersedia dan Tersimpan di State Sumber', () => {
    it('TC-FIX1-01: Status meja bertransisi dari perlu_dibersihkan / menunggu_dibersihkan menjadi tersedia', () => {
      const nomorMeja = 'M-07';

      // 1. Meja terisi oleh tamu
      const occRes = occupyMeja(CABANG_TEST, nomorMeja, 'TRX-TEST-001', 'STR-TEST-001', {
        nomor_struk: 'STR-TEST-001',
        total: 75000,
        items: [{ nama: 'Kopi Susu Gula Aren', jumlah: 2 }],
      });
      assert.strictEqual(occRes.success, true);
      assert.strictEqual(isMejaAvailable(CABANG_TEST, nomorMeja), false, 'Meja terisi tidak boleh tersedia');

      // 2. Tamu selesai -> status berubah ke perlu_dibersihkan / menunggu_dibersihkan
      const toCleaning = updateStatusMeja(CABANG_TEST, nomorMeja, 'menunggu_dibersihkan');
      assert.strictEqual(toCleaning.success, true);
      assert.strictEqual(isMejaAvailable(CABANG_TEST, nomorMeja), false, 'Meja yang perlu dibersihkan belum boleh dipakai');

      const tablesAfterCleaning = getDefaultMejaCabang(CABANG_TEST);
      const mAfterCleaning = tablesAfterCleaning.find((m) => m.nomor_meja === nomorMeja);
      assert.ok(mAfterCleaning);
      assert.strictEqual(mAfterCleaning.status, 'menunggu_dibersihkan');

      // 3. Crew / Barista membersihkan meja -> status berubah menjadi tersedia
      const cleanRes = updateStatusMeja(CABANG_TEST, nomorMeja, 'tersedia');
      assert.strictEqual(cleanRes.success, true, 'Update status meja ke tersedia harus sukses');
      assert.strictEqual(isMejaAvailable(CABANG_TEST, nomorMeja), true, 'Meja selesai dibersihkan harus berstatus tersedia');

      // 4. Verifikasi seluruh metadata pesanan aktif telah dikosongkan
      const tablesAfterDone = getDefaultMejaCabang(CABANG_TEST);
      const mDone = tablesAfterDone.find((m) => m.nomor_meja === nomorMeja);
      assert.ok(mDone);
      assert.strictEqual(mDone.status, 'tersedia', 'Status meja harus tersedia');
      assert.strictEqual(mDone.transaksi_terkini_id, null, 'ID transaksi harus null');
      assert.strictEqual(mDone.nomor_struk_terkini, null, 'Nomor struk harus null');
      assert.strictEqual(mDone.waktu_terisi, null, 'Waktu terisi harus null');
      assert.strictEqual(mDone.pesanan_aktif, null, 'Pesanan aktif harus null');
    });

    it('TC-FIX1-02: Status meja persisten di file storage dan konsisten saat dibaca ulang', () => {
      const nomorMeja = 'M-02';

      // Set meja ke perlu_dibersihkan lalu bersihkan
      occupyMeja(CABANG_TEST, nomorMeja, 'TRX-TEST-002', 'STR-TEST-002');
      updateStatusMeja(CABANG_TEST, nomorMeja, 'menunggu_dibersihkan');
      updateStatusMeja(CABANG_TEST, nomorMeja, 'tersedia');

      // Verifikasi file storage operasional store menyimpan status tersedia
      const storePath = path.join(process.cwd(), 'data', 'operational-store.json');
      assert.ok(fs.existsSync(storePath), 'File data/operational-store.json harus ada');

      const rawContent = fs.readFileSync(storePath, 'utf-8');
      const parsed = JSON.parse(rawContent);
      const tablesInFile = parsed.mejaByCabang[CABANG_TEST];
      assert.ok(Array.isArray(tablesInFile), 'Daftar meja harus tersimpan di file');

      const targetInFile = tablesInFile.find((m: { nomor_meja: string }) => m.nomor_meja === nomorMeja);
      assert.ok(targetInFile);
      assert.strictEqual(targetInFile.status, 'tersedia', 'Status meja di file persistence harus tersedia');
    });

    it('TC-FIX1-03: Mendukung status perlu_dibersihkan dan transisi releaseMeja secara idempoten', () => {
      const nomorMeja = 'M-03';
      updateStatusMeja(CABANG_TEST, nomorMeja, 'perlu_dibersihkan');

      const list = getDefaultMejaCabang(CABANG_TEST);
      const m = list.find((item) => item.nomor_meja === nomorMeja);
      assert.ok(m);
      assert.strictEqual(m.status, 'perlu_dibersihkan');

      // Bersihkan via releaseMeja
      const relRes = releaseMeja(CABANG_TEST, nomorMeja);
      assert.strictEqual(relRes.success, true);
      assert.strictEqual(isMejaAvailable(CABANG_TEST, nomorMeja), true);
    });
  });

  // ==========================================================================
  // MASALAH 2: Layout Modal Denah Meja & Kursi
  // ==========================================================================
  describe('Masalah 2: Layout Modal Denah Meja & Kursi Tetap Rapi di Desktop dan Laptop', () => {
    it('TC-FIX2-01: Verifikasi TableSelectorModal menggunakan layout flex-col dengan header & footer tetap', () => {
      const modalFilePath = path.join(process.cwd(), 'src', 'components', 'pos', 'TableSelectorModal.tsx');
      assert.ok(fs.existsSync(modalFilePath), 'File TableSelectorModal.tsx harus ada');

      const modalSource = fs.readFileSync(modalFilePath, 'utf-8');

      // 1. Flex kolom dengan pembatasan tinggi viewport laptop & desktop
      assert.ok(
        modalSource.includes('flex flex-col') && modalSource.includes('h-[90vh]'),
        'Modal harus menggunakan flex flex-col dengan pembatasan tinggi viewport (h-[90vh])'
      );
      assert.ok(
        modalSource.includes('overflow-hidden'),
        'Modal container harus memiliki overflow-hidden agar elemen tidak bocor keluar batas'
      );

      // 2. Fixed header
      assert.ok(
        modalSource.includes('flex-shrink-0') && modalSource.includes('border-b'),
        'Header modal harus berstatus fixed / flex-shrink-0'
      );

      // 3. Scrollable grid area dengan min-h-0
      assert.ok(
        modalSource.includes('flex-1') && modalSource.includes('min-h-0') && modalSource.includes('overflow-y-auto'),
        'Area denah meja harus flex-1 min-h-0 overflow-y-auto agar dapat di-scroll tanpa mendorong footer'
      );

      // 4. Fixed footer yang menjaga tombol Batal dan Gunakan Meja tetap di dalam modal
      assert.ok(
        modalSource.includes('flex-shrink-0') && modalSource.includes('border-t'),
        'Footer modal harus flex-shrink-0'
      );
      assert.ok(
        modalSource.includes('Batal') && modalSource.includes('Gunakan Meja'),
        'Tombol Batal dan Gunakan Meja harus ada di dalam footer'
      );

      // 5. Dukungan tombol Bersihkan pada meja yang perlu dibersihkan
      assert.ok(
        modalSource.includes('onCleanMeja') && modalSource.includes('Bersihkan'),
        'Modal harus menyediakan integrasi tombol Bersihkan untuk housekeeping cepat'
      );
    });
  });

  // ==========================================================================
  // MASALAH 3: Validasi Pembayaran Tunai Kurang
  // ==========================================================================
  describe('Masalah 3: Validasi Pembayaran Tunai Kurang Mencegah Transaksi & Pengurangan Stok', () => {
    it('TC-FIX3-01: validatePembayaranTunai menolak uang kurang dengan format pesan presisi', () => {
      // Uji kasus kekurangan Rp8.000 (total Rp28.000, uang Rp20.000)
      const res1 = validatePembayaranTunai(28000, 20000);
      assert.strictEqual(res1.valid, false);
      assert.strictEqual(res1.kekurangan, 8000);
      assert.strictEqual(res1.error, 'Pembayaran belum mencukupi. Kekurangan Rp8.000.');

      // Uji kasus kekurangan Rp15.000
      const res2 = validatePembayaranTunai(50000, 35000);
      assert.strictEqual(res2.valid, false);
      assert.strictEqual(res2.kekurangan, 15000);
      assert.strictEqual(res2.error, 'Pembayaran belum mencukupi. Kekurangan Rp15.000.');

      // Uji kasus pas (lunas)
      const res3 = validatePembayaranTunai(28000, 28000);
      assert.strictEqual(res3.valid, true);
      assert.strictEqual(res3.kekurangan, 0);
      assert.strictEqual(res3.kembalian, 0);
      assert.strictEqual(res3.error, undefined);

      // Uji kasus lebih (ada kembalian)
      const res4 = validatePembayaranTunai(28000, 50000);
      assert.strictEqual(res4.valid, true);
      assert.strictEqual(res4.kekurangan, 0);
      assert.strictEqual(res4.kembalian, 22000);
    });

    it('TC-FIX3-02: Verifikasi simpanTransaksiAction di server memvalidasi uang tunai sebelum potong stok', () => {
      const actionFilePath = path.join(process.cwd(), 'src', 'app', 'actions', 'transaksi.ts');
      assert.ok(fs.existsSync(actionFilePath));

      const actionSource = fs.readFileSync(actionFilePath, 'utf-8');

      // Verifikasi validasi uang diterima pada pembayaran tunai
      assert.ok(
        actionSource.includes("params.metode_bayar === 'tunai' && uangBayar < total"),
        'transaksi.ts harus memvalidasi uangBayar < total untuk metode tunai'
      );
      assert.ok(
        actionSource.includes('Pembayaran belum mencukupi. Kekurangan ${formatRupiah(kekurangan)}.'),
        'transaksi.ts harus menghasilkan pesan "Pembayaran belum mencukupi. Kekurangan Rp..."'
      );

      // Verifikasi urutan eksekusi: validasi pembayaran (Step 3) HARUS mendahului potong stok (Step 4)
      const idxValidasiPembayaran = actionSource.indexOf('Validasi pembayaran');
      const idxPotongStok = actionSource.indexOf('Cek & Potong Stok Cabang');
      assert.ok(idxValidasiPembayaran > 0, 'Harus ada step validasi pembayaran');
      assert.ok(idxPotongStok > 0, 'Harus ada step potong stok');
      assert.ok(
        idxValidasiPembayaran < idxPotongStok,
        'Validasi pembayaran harus dieksekusi SEBELUM cek & potong stok'
      );
    });

    it('TC-FIX3-03: Database schema check constraint menolak uang tunai kurang', async () => {
      if (!SUPABASE_URL || !SERVICE_KEY) return;
      const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      // Ambil shift yang berstatus 'buka' agar tidak terblokir trigger validasi status shift
      const { data: openShift } = await adminClient
        .from('shift_kasir')
        .select('id, cabang_id, kasir_id')
        .eq('status', 'buka')
        .limit(1)
        .maybeSingle();

      let cabangId: string;
      let shiftId: string;
      let kasirId: string;

      if (openShift) {
        cabangId = openShift.cabang_id;
        shiftId = openShift.id;
        kasirId = openShift.kasir_id;
      } else {
        const { data: trxSample } = await adminClient
          .from('transaksi')
          .select('cabang_id, shift_id, kasir_id')
          .limit(1)
          .maybeSingle();
        if (!trxSample) return;
        cabangId = trxSample.cabang_id;
        shiftId = trxSample.shift_id;
        kasirId = trxSample.kasir_id;
      }

      // Coba insert transaksi tunai dengan uang_diterima < total langsung ke database
      const dummyStruk = `TEST-FAIL-${Date.now()}`;
      const { error } = await adminClient.from('transaksi').insert({
        nomor_struk: dummyStruk,
        cabang_id: cabangId,
        shift_id: shiftId,
        kasir_id: kasirId,
        status: 'lunas',
        subtotal: 30000,
        diskon: 0,
        total: 30000,
        metode_bayar: 'tunai',
        uang_diterima: 22000, // Kurang Rp8.000!
        kembalian: 22000 - 30000, // -8000 agar memenuhi chk_transaksi_kembalian dan membuktikan chk_transaksi_metode_bayar memblokirnya
      });

      assert.ok(error, 'Database harus menolak insert transaksi tunai dengan uang kurang');
      assert.ok(
        error.message.includes('chk_transaksi_metode_bayar') || error.code === '23514',
        'Penolakan database harus karena check constraint chk_transaksi_metode_bayar'
      );
    });

    it('TC-FIX3-04: Verifikasi kasir-client.tsx memiliki pencegahan pembayaran tunai kurang dan notifikasi kekurangan', () => {
      const kasirClientPath = path.join(process.cwd(), 'src', 'app', '(dashboard)', 'kasir', 'kasir-client.tsx');
      assert.ok(fs.existsSync(kasirClientPath));

      const kasirSource = fs.readFileSync(kasirClientPath, 'utf-8');

      // Cek validasi pembayaran tunai di kasir-client
      assert.ok(
        kasirSource.includes('nominalDiterima < totalBayar'),
        'kasir-client harus memeriksa apakah nominal uang diterima kurang dari total bayar'
      );
      assert.ok(
        kasirSource.includes('Pembayaran belum mencukupi. Kekurangan'),
        'kasir-client harus menampilkan notifikasi "Pembayaran belum mencukupi. Kekurangan ..."'
      );
      assert.ok(
        kasirSource.includes('Kurang ${formatRupiah(totalBayar - nominalDiterima)}'),
        'kasir-client harus mempertahankan indikator kekurangan uang di kotak kembalian'
      );
      assert.ok(
        kasirSource.includes('onCleanMeja={handleCleanMeja}'),
        'kasir-client harus meneruskan onCleanMeja ke TableSelectorModal'
      );
    });
  });
});
