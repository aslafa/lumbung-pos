/**
 * Mayar API V2 Client (Server-side Only)
 *
 * Modul ini menangani komunikasi dengan Mayar Headless API V2.
 * Semua kredensial dibaca dari environment variables server-side.
 */

export interface MayarInvoiceItem {
  description: string;
  quantity: number;
  rate: number;
}

export interface CreateInvoicePayload {
  name: string;
  email: string;
  mobile: string;
  description: string;
  redirectUrl?: string;
  expiredAt: string; // ISO 8601 string
  items: MayarInvoiceItem[];
}

export interface MayarInvoiceData {
  id: string;
  transactionId?: string;
  link?: string;
  paymentUrl?: string;
  amount?: number;
  status?: string;
  expiredAt?: string | number;
}

export interface MayarApiResponse<T = unknown> {
  statusCode: number;
  messages: string;
  data: T;
}

function getMayarConfig() {
  const rawKey = process.env.MAYAR_API_KEY;
  const rawUrl = process.env.MAYAR_API_BASE_URL || 'https://api.mayar.io/hl/v2';

  if (!rawKey || !rawKey.trim()) {
    throw new Error('Konfigurasi MAYAR_API_KEY belum disetel di environment variable server.');
  }

  const apiKey = rawKey.trim().replace(/^["']|["']$/g, '');
  const baseUrl = rawUrl.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');

  return { apiKey, baseUrl };
}

export interface MayarMerchantIdentity {
  accountId?: string;
  role?: string;
  name?: string;
  merchantSlug?: string;
  maskedEmail?: string;
}

/**
 * Membaca identitas merchant dari claims JWT Mayar secara aman tanpa mengekspos signature atau secret key.
 */
export function getMayarMerchantIdentity(): MayarMerchantIdentity | null {
  const apiKey = process.env.MAYAR_API_KEY;
  if (!apiKey) return null;
  const parts = apiKey.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    const maskedEmail = payload.sub
      ? payload.sub.replace(/^(.)(.*)(@.*)$/, (_: string, a: string, b: string, c: string) => a + '***' + c)
      : undefined;
    return {
      accountId: payload.accountId,
      role: payload.role,
      name: payload.name,
      merchantSlug: payload.link,
      maskedEmail,
    };
  } catch {
    return null;
  }
}

function logMayarDiagnostic(context: string, info: { status?: number; host: string; message: string }) {
  // Hanya log host, status HTTP, dan pesan error tersanitasi — TIDAK PERNAH mencetak API key atau secret
  if (process.env.NODE_ENV !== 'production' || process.env.MAYAR_DEBUG === 'true') {
    console.warn(
      `[Mayar Gateway Diagnostic - ${context}] Host: ${info.host} | Status: ${info.status ?? 'N/A'} | Info: ${info.message}`
    );
  }
}

/**
 * Membuat Invoice / Tagihan QRIS Dinamis baru di Mayar
 */
export async function createMayarInvoice(
  payload: CreateInvoicePayload
): Promise<MayarApiResponse<MayarInvoiceData>> {
  const { apiKey, baseUrl } = getMayarConfig();

  let host = 'gateway Mayar';
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    // ignore
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 detik timeout

  try {
    const res = await fetch(`${baseUrl}/invoices/create`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      let errorDetail = '';
      if (Array.isArray(data?.data) && data.data.length > 0) {
        errorDetail = data.data
          .map((d: { field?: string; message?: string }) => d.message || d.field)
          .filter(Boolean)
          .join(', ');
      }

      let errorMsg = errorDetail || data?.messages || data?.message;
      if (typeof errorMsg !== 'string') {
        errorMsg = JSON.stringify(errorMsg) || '';
      }

      logMayarDiagnostic('createMayarInvoice', {
        status: res.status,
        host,
        message: errorMsg || res.statusText,
      });

      if (res.status === 401) {
        errorMsg = `Autentikasi Mayar gagal (HTTP 401 Unauthorized) pada host "${host}". Base URL aktif tidak cocok dengan environment API key. Jika API key berasal dari dashboard Sandbox (web.mayar.io), pastikan MAYAR_API_BASE_URL=https://api.mayar.io/hl/v2. Jika berasal dari Production (web.mayar.id), gunakan https://api.mayar.id/hl/v2.`;
      } else if (res.status === 400) {
        errorMsg = `Validasi data tagihan ditolak gateway Mayar (HTTP 400): ${errorMsg || 'Payload tidak sesuai format'}`;
      } else if (!errorMsg) {
        errorMsg = `Gagal membuat tagihan di gateway Mayar (HTTP ${res.status})`;
      }
      throw new Error(errorMsg);
    }

    return data as MayarApiResponse<MayarInvoiceData>;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        logMayarDiagnostic('createMayarInvoice', {
          host,
          message: 'Timeout 15 detik tercapai saat menghubungi gateway',
        });
        throw new Error('Koneksi ke gateway pembayaran Mayar melebihi batas waktu (timeout 15 detik).');
      }
      throw error;
    }
    throw new Error('Terjadi kesalahan yang tidak terduga saat menghubungi Mayar API.');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Memeriksa status dan rincian Invoice dari gateway Mayar secara independen
 */
export async function getMayarInvoiceDetail(
  invoiceId: string
): Promise<MayarApiResponse<MayarInvoiceData>> {
  const { apiKey, baseUrl } = getMayarConfig();

  if (!invoiceId) {
    throw new Error('Invoice ID Mayar wajib diisi.');
  }

  let host = 'gateway Mayar';
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    // ignore
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(`${baseUrl}/invoices/${encodeURIComponent(invoiceId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      let errorMsg = data?.messages || data?.message;
      if (typeof errorMsg !== 'string') {
        errorMsg = JSON.stringify(errorMsg) || '';
      }

      logMayarDiagnostic('getMayarInvoiceDetail', {
        status: res.status,
        host,
        message: errorMsg || res.statusText,
      });

      if (res.status === 401) {
        errorMsg = `Autentikasi Mayar gagal (HTTP 401 Unauthorized) pada host "${host}". Base URL aktif tidak cocok dengan environment API key.`;
      } else if (!errorMsg) {
        errorMsg = `Gagal memverifikasi status tagihan di Mayar (HTTP ${res.status})`;
      }
      throw new Error(errorMsg);
    }

    return data as MayarApiResponse<MayarInvoiceData>;
  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        logMayarDiagnostic('getMayarInvoiceDetail', {
          host,
          message: 'Timeout 15 detik tercapai saat menghubungi gateway',
        });
        throw new Error('Verifikasi tagihan Mayar melebihi batas waktu (timeout 15 detik).');
      }
      throw error;
    }
    throw new Error('Terjadi kesalahan saat memverifikasi tagihan Mayar.');
  } finally {
    clearTimeout(timeoutId);
  }
}
