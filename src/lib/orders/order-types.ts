import { formatRupiah } from '../utils/format.ts';

export type JenisPesanan = 'DINE_IN' | 'TAKEAWAY';
export type StatusMeja = 'tersedia' | 'terisi' | 'menunggu_dibersihkan' | 'perlu_dibersihkan';
export type StatusPengerjaan = 'MENUNGGU' | 'DIPROSES' | 'SIAP_DIAMBIL' | 'SELESAI';
export type BentukMeja = 'lingkaran' | 'persegi' | 'persegi_panjang';
export type AreaMeja = 'Indoor' | 'Outdoor' | 'Teras';

// Runtime export constants for compatibility with node --experimental-strip-types
export const AreaMeja = { Indoor: 'Indoor', Outdoor: 'Outdoor', Teras: 'Teras' } as const;
export const StatusMeja = { tersedia: 'tersedia', terisi: 'terisi', menunggu_dibersihkan: 'menunggu_dibersihkan', perlu_dibersihkan: 'perlu_dibersihkan' } as const;
export const StatusPengerjaan = { MENUNGGU: 'MENUNGGU', DIPROSES: 'DIPROSES', SIAP_DIAMBIL: 'SIAP_DIAMBIL', SELESAI: 'SELESAI' } as const;
export const BentukMeja = { lingkaran: 'lingkaran', persegi: 'persegi', persegi_panjang: 'persegi_panjang' } as const;
export const JenisPesanan = { DINE_IN: 'DINE_IN', TAKEAWAY: 'TAKEAWAY' } as const;


export interface MejaItem {
  id: string;
  cabang_id: string;
  nomor_meja: string;
  kapasitas: number;
  status: StatusMeja;
  bentuk: BentukMeja;
  area: AreaMeja;
  transaksi_terkini_id?: string | null;
  nomor_struk_terkini?: string | null;
  waktu_terisi?: string | null;
  pesanan_aktif?: {
    nomor_struk: string;
    nomor_antrean?: string;
    total: number;
    status_pembayaran?: string;
    status_pengerjaan?: string;
    items: Array<{ nama: string; jumlah: number; catatan?: string }>;
  } | null;
}

export interface PesananAntreanItem {
  transaksi_id: string;
  nomor_struk: string;
  nomor_antrean: string;
  cabang_id: string;
  cabang_nama: string;
  jenis_pesanan: JenisPesanan;
  nomor_meja?: string | null;
  nama_pelanggan?: string | null;
  catatan_pesanan?: string | null;
  status_pengerjaan: StatusPengerjaan;
  dibuat_pada: string;
  items: Array<{ nama: string; jumlah: number; subtotal: number; catatan?: string }>;
  total: number;
  metode_bayar: string;
  status_pembayaran: string;
  diselesaikan_pada?: string | null;
}

/**
 * Membuat daftar 12 denah meja standar coffee shop (Client & Server Safe, tanpa node:fs)
 */
export function createDefaultMejaList(cabangId: string): MejaItem[] {
  return [
    // Kapasitas 2 (Bundar)
    { id: `${cabangId}-M01`, cabang_id: cabangId, nomor_meja: 'M-01', kapasitas: 2, bentuk: 'lingkaran', area: 'Indoor', status: 'tersedia' },
    { id: `${cabangId}-M02`, cabang_id: cabangId, nomor_meja: 'M-02', kapasitas: 2, bentuk: 'lingkaran', area: 'Indoor', status: 'tersedia' },
    // Kapasitas 4 (Persegi)
    { id: `${cabangId}-M03`, cabang_id: cabangId, nomor_meja: 'M-03', kapasitas: 4, bentuk: 'persegi', area: 'Indoor', status: 'tersedia' },
    { id: `${cabangId}-M04`, cabang_id: cabangId, nomor_meja: 'M-04', kapasitas: 4, bentuk: 'persegi', area: 'Indoor', status: 'tersedia' },
    { id: `${cabangId}-M05`, cabang_id: cabangId, nomor_meja: 'M-05', kapasitas: 4, bentuk: 'persegi', area: 'Indoor', status: 'tersedia' },
    // Kapasitas 6 (Persegi Panjang)
    { id: `${cabangId}-M06`, cabang_id: cabangId, nomor_meja: 'M-06', kapasitas: 6, bentuk: 'persegi_panjang', area: 'Indoor', status: 'tersedia' },

    // Area Luar / Semi-Outdoor
    { id: `${cabangId}-M07`, cabang_id: cabangId, nomor_meja: 'M-07', kapasitas: 2, bentuk: 'lingkaran', area: 'Outdoor', status: 'tersedia' },
    { id: `${cabangId}-M08`, cabang_id: cabangId, nomor_meja: 'M-08', kapasitas: 4, bentuk: 'persegi', area: 'Outdoor', status: 'tersedia' },
    { id: `${cabangId}-M09`, cabang_id: cabangId, nomor_meja: 'M-09', kapasitas: 4, bentuk: 'persegi', area: 'Outdoor', status: 'tersedia' },
    { id: `${cabangId}-M10`, cabang_id: cabangId, nomor_meja: 'M-10', kapasitas: 6, bentuk: 'persegi_panjang', area: 'Outdoor', status: 'tersedia' },
    { id: `${cabangId}-M11`, cabang_id: cabangId, nomor_meja: 'M-11', kapasitas: 4, bentuk: 'persegi', area: 'Teras', status: 'tersedia' },
    // Kapasitas 8 (Persegi Panjang Besar)
    { id: `${cabangId}-M12`, cabang_id: cabangId, nomor_meja: 'M-12', kapasitas: 8, bentuk: 'persegi_panjang', area: 'Teras', status: 'tersedia' },
  ];
}

/**
 * Helper untuk mengecek apakah status meja sedang memerlukan pembersihan
 * Menyatukan 'perlu_dibersihkan' dan 'menunggu_dibersihkan' secara konsisten (Client & Server safe)
 */
export function isTableCleaning(status: StatusMeja | string | undefined | null): boolean {
  return status === 'menunggu_dibersihkan' || status === 'perlu_dibersihkan';
}

/**
 * Helper untuk mencocokkan nomor meja secara fleksibel (Client & Server safe)
 * Contoh: '07' cocok dengan 'M-07', 'M07', 'Meja 07', '7'
 */
export function matchNomorMeja(a: string, b: string): boolean {
  if (!a || !b) return false;
  const cleanA = a.toLowerCase().trim();
  const cleanB = b.toLowerCase().trim();
  if (cleanA === cleanB) return true;
  const numA = cleanA.replace(/^meja\s*/, '').replace(/^m-?0*/, '').replace(/^0+/, '');
  const numB = cleanB.replace(/^meja\s*/, '').replace(/^m-?0*/, '').replace(/^0+/, '');
  return numA !== '' && numA === numB;
}

/**
 * Validasi pembayaran tunai POS (BR-07) (Client & Server safe)
 * Memastikan uang diterima mencukupi total tagihan dan menghitung kekurangan/kembalian secara akurat.
 */
export function validatePembayaranTunai(
  total: number,
  uangDiterima: number
): { valid: boolean; error?: string; kekurangan: number; kembalian: number } {
  const uangBayar = Math.round(uangDiterima);
  if (uangBayar < total) {
    const kekurangan = total - uangBayar;
    return {
      valid: false,
      error: `Pembayaran belum mencukupi. Kekurangan ${formatRupiah(kekurangan)}.`,
      kekurangan,
      kembalian: 0,
    };
  }
  return {
    valid: true,
    kekurangan: 0,
    kembalian: uangBayar - total,
  };
}
