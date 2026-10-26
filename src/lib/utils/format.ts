/**
 * Utility Format Lumbung POS
 * Standardisasi format mata uang (Rupiah), angka, persentase, tanggal, dan waktu (WIB)
 */

/**
 * Format nominal Rupiah sesuai standar PRD: Rp15.000 (tanpa spasi antara Rp dan angka)
 * @param amount Nilai angka nominal
 * @param options Opsi tanda plus/minus, absolut, atau fallback
 */
export function formatRupiah(
  amount: number | null | undefined,
  options?: {
    showSign?: boolean; // Tampilkan tanda + untuk angka positif
    absolute?: boolean; // Ambil nilai mutlak
    fallback?: string; // Teks fallback jika null/undefined/NaN (default: 'Rp0')
  }
): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return options?.fallback ?? 'Rp0';
  }

  const val = options?.absolute ? Math.abs(amount) : amount;
  const isNegative = val < 0;
  const absFormatted = Math.abs(val).toLocaleString('id-ID');

  if (isNegative) {
    return `-Rp${absFormatted}`;
  }

  if (options?.showSign && val > 0) {
    return `+Rp${absFormatted}`;
  }

  return `Rp${absFormatted}`;
}

/**
 * Format angka umum (misal kuantitas, stok, counter) dengan pemisah ribuan titik Indonesia
 */
export function formatAngka(value: number | null | undefined, fallback: string = '0'): string {
  if (value === null || value === undefined || isNaN(value)) {
    return fallback;
  }
  return value.toLocaleString('id-ID');
}

/**
 * Format persentase (misal margin, diskon)
 */
export function formatPersen(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value)) {
    return '0%';
  }
  const formatted = decimals > 0
    ? value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
    : Math.round(value).toLocaleString('id-ID');
  return `${formatted}%`;
}

/**
 * Format tanggal Indonesia (WIB)
 * Contoh: 15 Okt 2026 atau 15 Oktober 2026
 */
export function formatTanggal(
  dateInput: string | Date | null | undefined,
  options?: {
    format?: 'pendek' | 'panjang' | 'angka';
    fallback?: string;
  }
): string {
  if (!dateInput) return options?.fallback ?? '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return options?.fallback ?? '-';

    if (options?.format === 'angka') {
      return d.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }

    return d.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: options?.format === 'panjang' ? 'long' : 'short',
      day: 'numeric',
    });
  } catch {
    return options?.fallback ?? '-';
  }
}

/**
 * Format waktu Indonesia (WIB)
 * Contoh: 14:30 WIB
 */
export function formatWaktu(
  dateInput: string | Date | null | undefined,
  withTz: boolean = true
): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '-';
    const timeStr = d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    return withTz ? `${timeStr} WIB` : timeStr;
  } catch {
    return '-';
  }
}

/**
 * Format tanggal dan waktu lengkap Indonesia (WIB)
 * Contoh: 15 Okt 2026, 14:30 WIB
 */
export function formatTanggalWaktu(
  dateInput: string | Date | null | undefined,
  options?: {
    short?: boolean;
    withSeconds?: boolean;
    fallback?: string;
  }
): string {
  if (!dateInput) return options?.fallback ?? '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return options?.fallback ?? '-';

    const tgl = d.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: options?.short ? 'short' : 'long',
      year: 'numeric',
    });

    const wkt = d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      second: options?.withSeconds ? '2-digit' : undefined,
    });

    return `${tgl}, ${wkt} WIB`;
  } catch {
    return options?.fallback ?? '-';
  }
}

/**
 * Format rentang waktu operasional shift (WIB) selaras dengan format Transaksi
 * Contoh: 26 Okt 2026, 15.00 – Buka WIB atau 26 Okt 2026, 08.00 – 16.00 WIB
 */
export function formatRentangWaktuShift(
  dibukaPada: string | Date | null | undefined,
  ditutupPada?: string | Date | null
): string {
  if (!dibukaPada) return '-';
  try {
    const bukaDate = new Date(dibukaPada);
    if (isNaN(bukaDate.getTime())) return '-';

    const tglStr = bukaDate.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    const rawBukaJam = bukaDate.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    // Standarisasi pemisah jam menggunakan titik (contoh: 15.00) selaras dengan Transaksi
    const bukaJam = rawBukaJam.replace(':', '.');

    let tutupJam = 'Buka';
    if (ditutupPada) {
      const tutupDate = new Date(ditutupPada);
      if (!isNaN(tutupDate.getTime())) {
        const rawTutupJam = tutupDate.toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });
        tutupJam = rawTutupJam.replace(':', '.');
      }
    }

    return `${tglStr}, ${bukaJam} – ${tutupJam} WIB`;
  } catch {
    return '-';
  }
}
