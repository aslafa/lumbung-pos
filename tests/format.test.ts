import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatRupiah,
  formatAngka,
  formatPersen,
  formatTanggal,
  formatWaktu,
  formatTanggalWaktu,
  formatRentangWaktuShift,
} from '../src/lib/utils/format.ts';

describe('Pengujian Standarisasi Format Rupiah, Angka, dan Waktu (Lumbung POS)', () => {
  it('TC-FMT-01 [Format Rupiah Standar]: Menghasilkan Rp15.000 tanpa spasi dan tanda titik', () => {
    assert.equal(formatRupiah(15000), 'Rp15.000');
    assert.equal(formatRupiah(2500), 'Rp2.500');
    assert.equal(formatRupiah(500), 'Rp500');
  });

  it('TC-FMT-02 [Format Rupiah Batas]: Nilai 0, null, undefined, dan NaN menghasilkan Rp0', () => {
    assert.equal(formatRupiah(0), 'Rp0');
    assert.equal(formatRupiah(null), 'Rp0');
    assert.equal(formatRupiah(undefined), 'Rp0');
    assert.equal(formatRupiah(NaN), 'Rp0');
    assert.equal(formatRupiah(null, { fallback: '-' }), '-');
  });

  it('TC-FMT-03 [Format Rupiah Negatif & Diskon]: Menghasilkan -Rp10.000 untuk nilai negatif', () => {
    assert.equal(formatRupiah(-10000), '-Rp10.000');
    assert.equal(formatRupiah(-500), '-Rp500');
    assert.equal(formatRupiah(-10000, { absolute: true }), 'Rp10.000');
  });

  it('TC-FMT-04 [Format Rupiah Tanda Plus]: Opsi showSign menghasilkan +Rp20.000', () => {
    assert.equal(formatRupiah(20000, { showSign: true }), '+Rp20.000');
    assert.equal(formatRupiah(-20000, { showSign: true }), '-Rp20.000');
    assert.equal(formatRupiah(0, { showSign: true }), 'Rp0');
  });

  it('TC-FMT-05 [Format Rupiah Nominal Besar]: Menangani angka ratusan juta dan miliaran', () => {
    assert.equal(formatRupiah(125000000), 'Rp125.000.000');
    assert.equal(formatRupiah(2500000000), 'Rp2.500.000.000');
  });

  it('TC-FMT-06 [Format Angka]: Format bilangan bulat dengan pemisah titik', () => {
    assert.equal(formatAngka(10), '10');
    assert.equal(formatAngka(1250), '1.250');
    assert.equal(formatAngka(0), '0');
    assert.equal(formatAngka(null), '0');
  });

  it('TC-FMT-07 [Format Persentase]: Format persen bilangan bulat dan desimal', () => {
    assert.equal(formatPersen(10), '10%');
    assert.equal(formatPersen(12.5), '12,5%');
    assert.equal(formatPersen(0), '0%');
    assert.equal(formatPersen(null), '0%');
  });

  it('TC-FMT-08 [Format Tanggal & Waktu WIB]: Mengonversi ISO UTC ke zona waktu WIB', () => {
    // 2026-10-15T03:00:00Z = 2026-10-15 10:00:00 WIB
    const isoUtc = '2026-10-15T03:00:00.000Z';
    const tgl = formatTanggal(isoUtc, { format: 'panjang' });
    assert.ok(tgl.includes('15') && tgl.includes('Oktober') && tgl.includes('2026'));

    const wkt = formatWaktu(isoUtc);
    assert.ok(wkt.includes('10.00') || wkt.includes('10:00'));
    assert.ok(wkt.includes('WIB'));

    const lengkap = formatTanggalWaktu(isoUtc, { short: true });
    assert.ok(lengkap.includes('15') && lengkap.includes('2026') && lengkap.includes('WIB'));
  });

  it('TC-FMT-09 [Format Rentang Waktu Shift]: Menghasilkan format tanggal dan jam konsisten dengan Transaksi', () => {
    // 2026-10-26T08:00:00Z = 15.00 WIB
    const bukaIso = '2026-10-26T08:00:00.000Z';
    const tutupIso = '2026-10-26T15:00:00.000Z'; // 22.00 WIB

    const shiftBuka = formatRentangWaktuShift(bukaIso, null);
    assert.ok(shiftBuka.includes('26 Okt 2026'));
    assert.ok(shiftBuka.includes('15.00 – Buka WIB'));

    const shiftTutup = formatRentangWaktuShift(bukaIso, tutupIso);
    assert.ok(shiftTutup.includes('26 Okt 2026'));
    assert.ok(shiftTutup.includes('15.00 – 22.00 WIB'));
  });
});
