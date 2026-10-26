import crypto from 'crypto';

/**
 * Membandingkan token secara aman (timing-safe) untuk mencegah timing attack
 */
export function isTokenValid(providedToken: string | null, expectedToken: string): boolean {
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

export type WebhookValidationResult =
  | {
      isValid: false;
      statusCode: number;
      error: string;
      eventName?: undefined;
      invoiceId?: undefined;
      eventId?: undefined;
      paymentStatus?: undefined;
    }
  | {
      isValid: true;
      statusCode: 200;
      error?: undefined;
      eventName: string;
      invoiceId: string;
      eventId: string;
      paymentStatus: string;
    };

/**
 * Memvalidasi token dan payload dasar webhook Mayar
 */
export function validateMayarWebhookRequest(
  providedToken: string | null,
  expectedToken: string,
  body: Record<string, unknown> | null
): WebhookValidationResult {
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
