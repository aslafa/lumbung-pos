import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  getProductCustomConfig,
  getVariantPriceDelta,
  getEffectiveItemPrice,
  formatItemCustomization,
  formatItemDisplayName,
} from '../src/lib/products/product-config.ts';
import {
  generateNomorAntrean,
  registerPesananAntrean,
  getPesananByTransaksiId,
  updatePesananPaymentStatus,
  removePesananFromAntrean,
  clearAntreanList,
} from '../src/lib/orders/order-flow.ts';

describe('TC-VAR-01 s/d TC-VAR-08: Kustomisasi Produk, Varian Harga, dan Sinkronisasi Antrean Modern', () => {
  test('TC-VAR-01 [Kustomisasi Kategori Kopi]: Kopi mendukung Suhu, Gula, Es, dan Ukuran (Large +Rp5.000)', () => {
    const config = getProductCustomConfig('kop-002', 'kopi');
    assert.equal(config.kategori, 'kopi');
    assert.equal(config.supportsTemp, true);
    assert.equal(config.supportsSugar, true);
    assert.equal(config.supportsIce, true);
    assert.equal(config.supportsWarming, false);

    assert.ok(config.sizes && config.sizes.length >= 2);
    const largeOption = config.sizes.find((s) => s.id === 'Large');
    assert.ok(largeOption);
    assert.equal(largeOption.priceDelta, 5000);
  });

  test('TC-VAR-02 [Kustomisasi Kategori Roti]: Roti mendukung Opsi Hangat & Varian Rasa, TANPA es/suhu minuman', () => {
    const config = getProductCustomConfig('rot-001', 'roti');
    assert.equal(config.kategori, 'roti');
    assert.equal(config.supportsWarming, true);
    assert.equal(config.supportsTemp, false);
    assert.equal(config.supportsIce, false);
    assert.equal(config.supportsSugar, false);
    assert.ok(config.flavorVariants && config.flavorVariants.includes('Mentega Klasik'));
  });

  test('TC-VAR-03 [Kustomisasi Kategori Kemasan / Beans]: Biji Kopi mendukung Tingkat Gilingan & Ukuran Berat', () => {
    const config = getProductCustomConfig('kms-002', 'kemasan');
    assert.equal(config.kategori, 'kemasan');
    assert.ok(config.grindOptions && config.grindOptions.includes('Giling Kasar'));
    assert.ok(config.grindOptions && config.grindOptions.includes('Giling Sedang'));
    assert.ok(config.packagingSizes && config.packagingSizes.length > 0);
  });

  test('TC-VAR-04 [Perhitungan Harga Varian Terpercaya]: Regular = Rp22.000, Large = Rp27.000 (+Rp5.000)', () => {
    const americano = { sku: 'kop-002', harga_jual: 22000 };

    const regularPrice = getEffectiveItemPrice(americano, { ukuran: 'Regular' });
    assert.equal(regularPrice, 22000);

    const largePrice = getEffectiveItemPrice(americano, { ukuran: 'Large' });
    assert.equal(largePrice, 27000);

    const delta = getVariantPriceDelta('kop-002', { ukuran: 'Large' });
    assert.equal(delta, 5000);
  });

  test('TC-VAR-05 [Format Kustomisasi & Display Name]: Format label pesanan rapi dan informatif', () => {
    const optMinuman = {
      ukuran: 'Large' as const,
      suhu: 'Dingin' as const,
      gula: 'Less Sugar' as const,
      es: 'Less Ice' as const,
    };
    const summary = formatItemCustomization(optMinuman);
    assert.ok(summary.includes('Large'));
    assert.ok(summary.includes('Dingin'));
    assert.ok(summary.includes('Less Sugar'));
    assert.ok(summary.includes('Less Ice'));

    const displayName = formatItemDisplayName('Americano', optMinuman);
    assert.equal(displayName, 'Americano (Large)');

    const optRoti = {
      penyajian: 'Hangat' as const,
      varianRasa: 'Keju Klasik',
    };
    const rotiSummary = formatItemCustomization(optRoti);
    assert.ok(rotiSummary.includes('Hangat'));
    assert.ok(rotiSummary.includes('Keju Klasik'));
  });

  test('TC-VAR-06 [Registrasi Pesanan & Pencarian Transaksi]: getPesananByTransaksiId menemukan pesanan via UUID atau Struk', () => {
    const dummyTrxId = 'trx-test-var-' + Date.now();
    const dummyStruk = 'STRUK-TEST-' + Date.now();
    const noAntrean = generateNomorAntrean('TBT');

    registerPesananAntrean({
      transaksi_id: dummyTrxId,
      nomor_struk: dummyStruk,
      nomor_antrean: noAntrean,
      cabang_id: 'cabang-tebet',
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'DINE_IN',
      nomor_meja: '05',
      nama_pelanggan: 'Budi Santoso',
      catatan_pesanan: 'Espresso double shot',
      status_pengerjaan: 'MENUNGGU',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Americano (Large)', jumlah: 2, subtotal: 54000 }],
      total: 54000,
      metode_bayar: 'qris_mayar',
      status_pembayaran: 'MENUNGGU_BAYAR',
    });

    const foundById = getPesananByTransaksiId(dummyTrxId);
    assert.ok(foundById);
    assert.equal(foundById.nomor_struk, dummyStruk);
    assert.equal(foundById.nama_pelanggan, 'Budi Santoso');
    assert.equal(foundById.nomor_meja, '05');
    assert.equal(foundById.status_pembayaran, 'MENUNGGU_BAYAR');

    const foundByStruk = getPesananByTransaksiId(dummyStruk);
    assert.ok(foundByStruk);
    assert.equal(foundByStruk.transaksi_id, dummyTrxId);
  });

  test('TC-VAR-07 [Pembaruan Status Pembayaran QRIS]: updatePesananPaymentStatus memperbarui status menjadi LUNAS', () => {
    const dummyTrxId = 'trx-pay-update-' + Date.now();
    const dummyStruk = 'STRUK-PAY-' + Date.now();

    registerPesananAntrean({
      transaksi_id: dummyTrxId,
      nomor_struk: dummyStruk,
      nomor_antrean: 'A-999',
      cabang_id: 'cabang-tebet',
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'TAKEAWAY',
      nomor_meja: null,
      nama_pelanggan: 'Rina Wijaya',
      status_pengerjaan: 'MENUNGGU',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Croissant Mentega', jumlah: 1, subtotal: 25000 }],
      total: 25000,
      metode_bayar: 'qris_mayar',
      status_pembayaran: 'MENUNGGU_BAYAR',
    });

    const updated = updatePesananPaymentStatus(dummyTrxId, 'LUNAS');
    assert.equal(updated, true);

    const checked = getPesananByTransaksiId(dummyTrxId);
    assert.ok(checked);
    assert.equal(checked.status_pembayaran, 'LUNAS');
  });

  test('TC-VAR-08 [Pembatalan Transaksi Mengeluarkan dari Antrean]: removePesananFromAntrean membersihkan pesanan yang dibatalkan', () => {
    const dummyTrxId = 'trx-cancel-' + Date.now();

    registerPesananAntrean({
      transaksi_id: dummyTrxId,
      nomor_struk: 'STRUK-CANCEL',
      nomor_antrean: 'A-888',
      cabang_id: 'cabang-tebet',
      cabang_nama: 'Lumbung Tebet',
      jenis_pesanan: 'TAKEAWAY',
      nomor_meja: null,
      nama_pelanggan: 'Test Cancel',
      status_pengerjaan: 'MENUNGGU',
      dibuat_pada: new Date().toISOString(),
      items: [{ nama: 'Es Kopi Susu', jumlah: 1, subtotal: 20000 }],
      total: 20000,
      metode_bayar: 'qris_mayar',
      status_pembayaran: 'MENUNGGU_BAYAR',
    });

    assert.ok(getPesananByTransaksiId(dummyTrxId));

    removePesananFromAntrean(dummyTrxId);
    assert.ok(!getPesananByTransaksiId(dummyTrxId));
  });

  after(() => {
    clearAntreanList();
  });
});
