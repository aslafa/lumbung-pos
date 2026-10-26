import { NextRequest, NextResponse } from 'next/server';
import { validateMayarWebhookRequest } from '@/lib/mayar/webhook-utils';
import { getMayarInvoiceDetail } from '@/lib/mayar/client';
import {
  catatMayarWebhookEventDb,
  selesaikanTransaksiMayarDb,
} from '@/lib/mayar/service';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Webhook Handler Mayar API V2
 * Endpoint: POST /api/webhooks/mayar?token=<MAYAR_WEBHOOK_TOKEN>
 */
export async function POST(req: NextRequest) {
  try {
    const expectedToken = process.env.MAYAR_WEBHOOK_TOKEN;
    if (!expectedToken) {
      return NextResponse.json(
        { error: 'Server webhook token configuration missing' },
        { status: 500 }
      );
    }

    // 1. Ekstrak token dari URL query string atau header
    const tokenFromQuery = req.nextUrl.searchParams.get('token');
    const tokenFromHeader = req.headers.get('x-mayar-token');
    const providedToken = tokenFromQuery || tokenFromHeader;

    const body = await req.json().catch(() => null);

    // 2. Validasi Token & Format Dasar Payload
    const validation = validateMayarWebhookRequest(providedToken, expectedToken, body);
    if (!validation.isValid) {
      return NextResponse.json({ error: validation.error }, { status: validation.statusCode });
    }

    const { invoiceId, eventId, eventName, paymentStatus } = validation;

    // 3. Pengecekan Idempotensi (Cegah proses ganda bila event yang sama dikirim berulang)
    const idempotency = await catatMayarWebhookEventDb(
      eventId,
      invoiceId,
      paymentStatus,
      body as Record<string, unknown>
    );

    if (!idempotency.isNew) {
      return NextResponse.json(
        { status: 'duplicate_ignored', message: 'Event webhook ini sudah pernah diproses.' },
        { status: 200 }
      );
    }

    // Hanya proses event pembayaran berhasil
    if (eventName && !['payment.received', 'payment.paid', 'payment.status'].includes(eventName)) {
      return NextResponse.json(
        { status: 'event_ignored', message: `Event ${eventName} diabaikan.` },
        { status: 200 }
      );
    }

    // 4. Verifikasi Independen ke Gateway Mayar (GET /invoices/{id})
    let verifiedInvoice;
    try {
      const verifyRes = await getMayarInvoiceDetail(invoiceId);
      verifiedInvoice = verifyRes.data;
    } catch (verifyErr: unknown) {
      // Jika gateway offline saat verifikasi, catat dan minta retry dari webhook engine
      const msg = verifyErr instanceof Error ? verifyErr.message : 'Gagal verifikasi gateway';
      return NextResponse.json(
        { error: `Gagal verifikasi status ke server Mayar: ${msg}` },
        { status: 502 }
      );
    }

    const verifiedStatus = (verifiedInvoice?.status || '').toLowerCase();
    if (verifiedStatus !== 'paid') {
      return NextResponse.json(
        {
          error: `Status invoice di gateway Mayar belum 'paid' (status: ${verifiedStatus})`,
        },
        { status: 400 }
      );
    }

    // Ambil data transaksi lokal untuk verifikasi nominal
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Database admin tidak tersedia' }, { status: 500 });
    }

    const { data: trxLocal } = await admin
      .from('transaksi')
      .select('id, total, status, nomor_struk')
      .eq('mayar_invoice_id', invoiceId)
      .maybeSingle();

    if (!trxLocal) {
      return NextResponse.json(
        { error: 'Transaksi lokal dengan invoice Mayar tidak ditemukan' },
        { status: 404 }
      );
    }

    // Verifikasi Nominal Pembayaran
    if (verifiedInvoice.amount && verifiedInvoice.amount !== trxLocal.total) {
      return NextResponse.json(
        {
          error: `Nominal tidak cocok! Gateway: Rp${verifiedInvoice.amount}, POS: Rp${trxLocal.total}`,
        },
        { status: 400 }
      );
    }

    // 5. Eksekusi Pelunasan Transaksi Atomik
    const settleRes = await selesaikanTransaksiMayarDb(invoiceId, eventId);

    if (!settleRes.success) {
      if (settleRes.error_code === 'LATE_PAYMENT') {
        // Kasus Pembayaran Terlambat: Transaksi sudah batal (misal lewat 10 menit & stok sudah kembali)
        return NextResponse.json(
          {
            status: 'late_payment_flagged',
            transaksi_id: settleRes.transaksi_id,
            nomor_struk: settleRes.nomor_struk,
            message: 'Pembayaran diterima setelah transaksi kedaluwarsa/dibatalkan. Dana dicatat untuk refund.',
          },
          { status: 200 }
        );
      }

      return NextResponse.json(
        { error: settleRes.error || settleRes.pesan || 'Gagal mengubah status transaksi.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        status: 'success',
        transaksi_id: settleRes.transaksi_id,
        nomor_struk: settleRes.nomor_struk,
        message: 'Transaksi QRIS Mayar berhasil dilunasi.',
      },
      { status: 200 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Terjadi kesalahan sistem di webhook handler.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
