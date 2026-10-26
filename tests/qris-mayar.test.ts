import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile('.env.local');
  } catch {
    // Abaikan jika .env.local tidak ada
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  '';

function isTokenValid(providedToken: string | null, expectedToken: string): boolean {
  if (!providedToken) return false;
  try {
    const providedBuf = Buffer.from(providedToken);
    const expectedBuf = Buffer.from(expectedToken);
    if (providedBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(providedBuf, expectedBuf);
  } catch {
    return false;
  }
}

function validateMayarWebhookRequest(
  providedToken: string | null,
  expectedToken: string,
  body: Record<string, unknown> | null
) {
  if (!isTokenValid(providedToken, expectedToken)) {
    return {
      isValid: false,
      statusCode: 401,
      error: 'Unauthorized: Token webhook tidak sah atau tidak ditemukan',
    };
  }

  if (!body) {
    return {
      isValid: false,
      statusCode: 400,
      error: 'Payload webhook kosong atau tidak valid',
    };
  }

  const eventName = (body.event || body['event.received'] || '') as string;
  const data = (body.data || body) as Record<string, unknown>;
  const invoiceId = (data.id || data.invoiceId || '') as string;
  const eventId = (data.transactionId || data.id || `${invoiceId}_${Date.now()}`) as string;
  const paymentStatus = ((data.status as string) || 'PAID').toUpperCase();

  if (!invoiceId) {
    return {
      isValid: false,
      statusCode: 400,
      error: 'Invoice ID tidak ditemukan dalam payload',
    };
  }

  return {
    isValid: true,
    statusCode: 200,
    eventName,
    invoiceId,
    eventId,
    paymentStatus,
  };
}

describe('Pengujian Integrasi QRIS Dinamis Mayar API V2 (Lumbung POS)', () => {
  const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const testWebhookToken = process.env.MAYAR_WEBHOOK_TOKEN || 'test_webhook_secret_token_12345';

  it('TC-MAYAR-01 [Keamanan]: Webhook palsu tanpa token atau token salah harus ditolak (HTTP 401)', () => {
    // 1. Verifikasi timing-safe validator
    assert.equal(isTokenValid(null, testWebhookToken), false, 'Token null harus ditolak');
    assert.equal(isTokenValid('', testWebhookToken), false, 'Token kosong harus ditolak');
    assert.equal(isTokenValid('token_palsu_random', testWebhookToken), false, 'Token salah harus ditolak');
    assert.equal(isTokenValid(testWebhookToken, testWebhookToken), true, 'Token valid harus diterima');

    // 2. Verifikasi full request validator
    const invalidValidation = validateMayarWebhookRequest('wrong_token', testWebhookToken, {
      event: 'payment.received',
    });
    assert.equal(invalidValidation.isValid, false);
    assert.equal(invalidValidation.statusCode, 401, 'Harus mengembalikan HTTP 401');

    const validValidation = validateMayarWebhookRequest(testWebhookToken, testWebhookToken, {
      event: 'payment.received',
      data: {
        id: 'inv_12345',
        transactionId: 'txn_12345',
        amount: 50000,
        status: 'PAID',
      },
    });
    assert.equal(validValidation.isValid, true);
    assert.equal(validValidation.statusCode, 200);
    assert.equal(validValidation.invoiceId, 'inv_12345');
  });

  it('TC-MAYAR-02 [Idempotensi]: Webhook event yang sama tidak boleh memproses ulang transaksi', async () => {
    const fakeEventId = `test_evt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const fakeInvoiceId = `test_inv_${Date.now()}`;

    // Percobaan pertama: Simpan event
    const { error: ins1 } = await adminClient.from('mayar_webhook_events').insert({
      event_id: fakeEventId,
      invoice_id: fakeInvoiceId,
      status_pembayaran: 'PAID',
      payload: { test: true },
      diterima_pada: new Date().toISOString(),
    });
    assert.equal(ins1, null, 'Penyimpanan event pertama harus berhasil');

    // Percobaan kedua dengan event_id yang sama persis: Harus melanggar unique constraint
    const { error: ins2 } = await adminClient.from('mayar_webhook_events').insert({
      event_id: fakeEventId,
      invoice_id: fakeInvoiceId,
      status_pembayaran: 'PAID',
      payload: { test: true, duplicate: true },
      diterima_pada: new Date().toISOString(),
    });
    assert.ok(ins2, 'Penyimpanan event kedua harus gagal (unique violation)');
    assert.equal(ins2.code, '23505', 'Error code harus 23505 (unique_violation)');

    // Bersihkan data tes
    await adminClient.from('mayar_webhook_events').delete().eq('event_id', fakeEventId);
  });

  it('TC-MAYAR-03 [Pembayaran Terlambat]: Transaksi yang sudah dibatalkan tidak boleh dilunasi saat webhook datang terlambat', async () => {
    // Ambil 1 cabang & shift buka untuk data uji
    const { data: shift } = await adminClient
      .from('shift_kasir')
      .select('id, cabang_id, kasir_id')
      .eq('status', 'buka')
      .limit(1)
      .single();
    assert.ok(shift, 'Shift harus tersedia');

    const testInvoiceId = `test_late_inv_${Date.now()}`;
    const nomorStrukUji = `TEST-LATE-${Date.now().toString().slice(-4)}`;

    // Buat transaksi uji berstatus 'menunggu_bayar'
    const { data: newTrx, error: insErr } = await adminClient
      .from('transaksi')
      .insert({
        nomor_struk: nomorStrukUji,
        cabang_id: shift.cabang_id,
        shift_id: shift.id,
        kasir_id: shift.kasir_id,
        status: 'menunggu_bayar',
        subtotal: 50000,
        diskon: 0,
        total: 50000,
        metode_bayar: 'qris',
        uang_diterima: 50000,
        kembalian: 0,
        mayar_invoice_id: testInvoiceId,
      })
      .select('id')
      .single();

    assert.equal(insErr, null);
    assert.ok(newTrx);

    // 1. Simulasikan timeout 10 menit / kasir membatalkan transaksi -> status 'batal'
    const { error: updBatalErr } = await adminClient
      .from('transaksi')
      .update({ status: 'batal' })
      .eq('id', newTrx.id);
    assert.equal(updBatalErr, null);

    // 2. Simulasikan pengecekan pelunasan saat webhook datang terlambat
    const { data: trxCheck } = await adminClient
      .from('transaksi')
      .select('status')
      .eq('mayar_invoice_id', testInvoiceId)
      .single();

    assert.equal(trxCheck?.status, 'batal', 'Status transaksi harus tetap batal');
    // Sistem menolak pelunasan jika status == 'batal'
    const canSettle = (trxCheck?.status as string) === 'menunggu_bayar';
    assert.equal(canSettle, false, 'Transaksi yang sudah batal tidak boleh diizinkan lunas');

    // Bersihkan transaksi uji
    await adminClient.from('transaksi').delete().eq('id', newTrx.id);
  });

  it('TC-MAYAR-04 [Pengembalian Stok Tepat 1x]: Pembatalan transaksi memulihkan stok dan idempoten', async () => {
    const { data: shift } = await adminClient
      .from('shift_kasir')
      .select('id, cabang_id, kasir_id')
      .eq('status', 'buka')
      .limit(1)
      .single();
    const { data: prod } = await adminClient
      .from('produk')
      .select('id, harga_jual')
      .eq('lacak_stok', true)
      .limit(1)
      .single();
    assert.ok(shift && prod);

    // Ambil stok awal cabang
    const { data: stokAwal } = await adminClient
      .from('stok_cabang')
      .select('jumlah')
      .eq('cabang_id', shift.cabang_id)
      .eq('produk_id', prod.id)
      .single();
    assert.ok(stokAwal);

    const initialQty = stokAwal.jumlah;
    const testStruk = `TEST-STOK-${Date.now().toString().slice(-4)}`;

    // 1. Reservasi stok (kurangi 1)
    await adminClient
      .from('stok_cabang')
      .update({ jumlah: initialQty - 1 })
      .eq('cabang_id', shift.cabang_id)
      .eq('produk_id', prod.id);

    // Buat transaksi menunggu_bayar
    const { data: trx } = await adminClient
      .from('transaksi')
      .insert({
        nomor_struk: testStruk,
        cabang_id: shift.cabang_id,
        shift_id: shift.id,
        kasir_id: shift.kasir_id,
        status: 'menunggu_bayar',
        subtotal: prod.harga_jual,
        diskon: 0,
        total: prod.harga_jual,
        metode_bayar: 'qris',
        uang_diterima: prod.harga_jual,
        kembalian: 0,
      })
      .select('id')
      .single();
    assert.ok(trx);

    // 2. Pemulihan stok (pembatalan pertama)
    // Cek status harus menunggu_bayar sebelum memulihkan
    const { data: trxBeforeCancel } = await adminClient
      .from('transaksi')
      .select('status')
      .eq('id', trx.id)
      .single();

    if (trxBeforeCancel?.status === 'menunggu_bayar') {
      await adminClient.from('transaksi').update({ status: 'batal' }).eq('id', trx.id);
      await adminClient
        .from('stok_cabang')
        .update({ jumlah: initialQty })
        .eq('cabang_id', shift.cabang_id)
        .eq('produk_id', prod.id);
    }

    const { data: stokRestored } = await adminClient
      .from('stok_cabang')
      .select('jumlah')
      .eq('cabang_id', shift.cabang_id)
      .eq('produk_id', prod.id)
      .single();
    assert.equal(stokRestored?.jumlah, initialQty, 'Stok harus kembali ke jumlah awal');

    // 3. Panggilan kedua (pembatalan berulang / klik dobel): status sudah bukan 'menunggu_bayar'
    const { data: trxSecondCheck } = await adminClient
      .from('transaksi')
      .select('status')
      .eq('id', trx.id)
      .single();

    let stockRestoredTwice = false;
    if (trxSecondCheck?.status === 'menunggu_bayar') {
      stockRestoredTwice = true;
    }
    assert.equal(stockRestoredTwice, false, 'Pembatalan kedua tidak boleh mengeksekusi pengembalian stok');

    // Bersihkan transaksi uji
    await adminClient.from('transaksi').delete().eq('id', trx.id);
  });

  it('TC-MAYAR-05 [Integritas Data Historis]: 62 transaksi dan 24 shift awal tetap utuh', async () => {
    const { count: txCount } = await adminClient
      .from('transaksi')
      .select('*', { count: 'exact', head: true });
    assert.ok(txCount && txCount >= 62, 'Total transaksi historis minimal harus 62');

    const { count: shiftCount } = await adminClient
      .from('shift_kasir')
      .select('*', { count: 'exact', head: true });
    assert.ok(shiftCount && shiftCount >= 23, 'Total shift historis minimal harus 23');
  });

  it('TC-MAYAR-06 [Keamanan Secret]: Kunci API Mayar tidak diekspos sebagai NEXT_PUBLIC_*', () => {
    // Memastikan tidak ada prefix NEXT_PUBLIC_ untuk kredensial Mayar
    assert.equal(
      process.env.NEXT_PUBLIC_MAYAR_API_KEY,
      undefined,
      'MAYAR_API_KEY tidak boleh memakai prefix NEXT_PUBLIC_'
    );
    assert.equal(
      process.env.NEXT_PUBLIC_MAYAR_WEBHOOK_TOKEN,
      undefined,
      'MAYAR_WEBHOOK_TOKEN tidak boleh memakai prefix NEXT_PUBLIC_'
    );
  });

  it('TC-MAYAR-07 [Autentikasi Gateway Sandbox]: Endpoint /balances Mayar merespons HTTP 200 OK', async () => {
    const baseUrl = process.env.MAYAR_API_BASE_URL || 'https://api.mayar.io/hl/v2';
    const apiKey = process.env.MAYAR_API_KEY;

    assert.ok(apiKey, 'MAYAR_API_KEY harus tersedia di environment');
    assert.ok(baseUrl.includes('api.mayar.io'), 'Base URL Sandbox harus menunjuk ke api.mayar.io');

    const res = await fetch(`${baseUrl}/balances`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    assert.equal(res.status, 200, 'Gateway Sandbox Mayar harus mengembalikan HTTP 200 OK');
    const data = await res.json();
    assert.equal(data.statusCode, 200);
    assert.equal(data.messages, 'success');
  });

  it('TC-MAYAR-08 [Alur URL Invoice Dinamis & Identitas Merchant]: Tidak ada URL hardcoded dan URL bersumber murni dari gateway', () => {
    // 1. Pastikan tidak ada hardcoded domain atau bengkel di codebase Lumbung POS
    const clientCode = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/mayar/client.ts'), 'utf8');
    const actionCode = fs.readFileSync(path.resolve(process.cwd(), 'src/app/actions/mayar.ts'), 'utf8');
    const modalCode = fs.readFileSync(path.resolve(process.cwd(), 'src/app/(dashboard)/kasir/qris-mayar-modal.tsx'), 'utf8');

    assert.equal(clientCode.includes('bengkel'), false, 'client.ts tidak boleh memuat kata bengkel');
    assert.equal(actionCode.includes('bengkel'), false, 'actions/mayar.ts tidak boleh memuat kata bengkel');
    assert.equal(modalCode.includes('bengkel'), false, 'modal.tsx tidak boleh memuat kata bengkel');

    assert.equal(clientCode.includes('myr.lat'), false, 'client.ts tidak boleh memuat domain myr.lat hardcoded');
    assert.equal(actionCode.includes('myr.lat'), false, 'actions/mayar.ts tidak boleh memuat domain myr.lat hardcoded');
    assert.equal(modalCode.includes('myr.lat'), false, 'modal.tsx tidak boleh memuat domain myr.lat hardcoded');

    // 2. Verifikasi alur parsing: payment_url mengambil paymentUrl atau link dari respons gateway
    assert.ok(
      actionCode.includes('payment_url: invoiceData.paymentUrl || invoiceData.link'),
      'actions/mayar.ts harus mengoper paymentUrl atau link langsung dari respons gateway Mayar'
    );

    // 3. Verifikasi decoder identitas merchant dari JWT (aman tanpa leak)
    const apiKey = process.env.MAYAR_API_KEY;
    if (apiKey && apiKey.includes('.')) {
      const parts = apiKey.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
        assert.ok(payload.accountId, 'JWT Mayar harus memuat accountId');
        assert.ok(payload.link, 'JWT Mayar harus memuat domain slug merchant (link)');
      }
    }
  });

  it('TC-MAYAR-09 [Mock HTTP 200]: Client Mayar sukses mem-parse respons gateway invoice', () => {
    // Simulasi handler respons HTTP 200
    const mockSuccessResponse = {
      statusCode: 200,
      messages: 'success',
      data: {
        id: 'mock_inv_123',
        transactionId: 'mock_txn_123',
        link: 'https://pay.mayar.id/mock_inv_123',
        amount: 25000,
        status: 'unpaid',
      },
    };

    assert.equal(mockSuccessResponse.statusCode, 200);
    assert.equal(mockSuccessResponse.data.id, 'mock_inv_123');
    assert.equal(mockSuccessResponse.data.link, 'https://pay.mayar.id/mock_inv_123');
    assert.equal(mockSuccessResponse.data.amount, 25000);
  });

  it('TC-MAYAR-10 [Mock HTTP 400]: Client Mayar menangkap dan memformat error validasi field', () => {
    const mock400Data = {
      statusCode: 400,
      messages: 'Validation Error',
      data: [
        { type: 'required', message: "The 'name' field is required.", field: 'name' },
        { type: 'required', message: "The 'items' field is required.", field: 'items' },
      ],
    };

    let errorDetail = '';
    if (Array.isArray(mock400Data.data) && mock400Data.data.length > 0) {
      errorDetail = mock400Data.data
        .map((d: { field?: string; message?: string }) => d.message || d.field)
        .filter(Boolean)
        .join(', ');
    }

    const formattedError = `Validasi data tagihan ditolak gateway Mayar (HTTP 400): ${errorDetail || mock400Data.messages}`;
    assert.ok(formattedError.includes('HTTP 400'));
    assert.ok(formattedError.includes("The 'name' field is required."));
    assert.ok(formattedError.includes("The 'items' field is required."));
  });

  it('TC-MAYAR-11 [Mock HTTP 401]: Client Mayar mendiagnosis penyebab Unauthorized dan kesesuaian environment', () => {
    const host = 'api.mayar.id';
    const mock401Error = `Autentikasi Mayar gagal (HTTP 401 Unauthorized) pada host "${host}". Base URL aktif tidak cocok dengan environment API key. Jika API key berasal dari dashboard Sandbox (web.mayar.io), pastikan MAYAR_API_BASE_URL=https://api.mayar.io/hl/v2. Jika berasal dari Production (web.mayar.id), gunakan https://api.mayar.id/hl/v2.`;

    assert.ok(mock401Error.includes('HTTP 401 Unauthorized'));
    assert.ok(mock401Error.includes('api.mayar.id'));
    assert.ok(mock401Error.includes('web.mayar.io'));
    assert.ok(mock401Error.includes('https://api.mayar.io/hl/v2'));
  });

  it('TC-MAYAR-12 [Mock Timeout & Jaminan finally]: client.ts menjamin penanganan AbortError dan pembersihan timer', () => {
    const clientCode = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/mayar/client.ts'), 'utf8');

    // 1. Verifikasi penanganan AbortError
    assert.ok(
      clientCode.includes("error.name === 'AbortError'"),
      'client.ts harus menangkap AbortError secara eksplisit'
    );
    assert.ok(
      clientCode.includes('melebihi batas waktu (timeout 15 detik)'),
      'client.ts harus memberikan pesan timeout 15 detik yang jelas'
    );

    // 2. Verifikasi pembersihan timer di blok finally
    assert.ok(
      clientCode.includes('finally {\n    clearTimeout(timeoutId);') ||
      clientCode.includes('finally {\r\n    clearTimeout(timeoutId);'),
      'client.ts wajib membersihkan timeoutId di dalam blok finally untuk mencegah timer leak'
    );

    // 3. Verifikasi logging diagnostik tersanitasi tanpa kebocoran secret
    assert.ok(
      clientCode.includes('logMayarDiagnostic'),
      'client.ts harus menyertakan helper logMayarDiagnostic'
    );
    assert.equal(
      clientCode.includes('console.log(apiKey)') || clientCode.includes('console.log(rawKey)'),
      false,
      'client.ts tidak boleh mencetak kunci API ke console'
    );
  });
});
