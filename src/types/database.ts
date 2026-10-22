export type UserRole = 'kasir' | 'kepala_toko' | 'owner';

export type ShiftStatus = 'buka' | 'ditutup' | 'diverifikasi';

export type TransaksiStatus = 'lunas' | 'void' | 'menunggu_bayar' | 'batal';

export type MetodeBayar = 'tunai' | 'qris';

export type KategoriProduk = 'kopi' | 'non_kopi' | 'roti' | 'snack' | 'kemasan';

export interface Profile {
  id: string;
  nama_lengkap: string;
  email: string;
  peran: UserRole;
  cabang_id: string | null;
  aktif: boolean;
  dibuat_pada: string;
  // joined fields
  cabang?: Cabang | null;
}

export interface Cabang {
  id: string;
  kode: string; // TBT, BTR, DPK
  nama: string;
  alamat: string | null;
  aktif: boolean;
  urut_struk_tanggal: string | null;
  urut_struk_terakhir: number;
}

export interface Produk {
  id: string;
  sku: string;
  nama: string;
  kategori: KategoriProduk;
  harga_jual: number;
  lacak_stok: boolean;
  aktif: boolean;
  dibuat_pada: string;
  diubah_pada: string;
}

export interface RiwayatHargaModal {
  id: string;
  produk_id: string;
  harga_modal: number;
  berlaku_mulai: string;
  dibuat_oleh: string | null;
  dibuat_pada: string;
}

export interface StokCabang {
  id: string;
  cabang_id: string;
  produk_id: string;
  jumlah: number;
  stok_minimum: number;
  diubah_pada: string;
  produk?: Produk;
}

export interface ShiftKasir {
  id: string;
  cabang_id: string;
  kasir_id: string;
  status: ShiftStatus;
  dibuka_pada: string;
  kas_awal: number;
  ditutup_pada: string | null;
  total_tunai: number;
  total_qris: number;
  kas_seharusnya: number;
  uang_fisik: number | null;
  selisih: number | null;
  catatan_tutup: string | null;
  diverifikasi_oleh: string | null;
  diverifikasi_pada: string | null;
  catatan_verifikasi: string | null;
  kasir?: Profile;
  cabang?: Cabang;
}

export interface Transaksi {
  id: string;
  nomor_struk: string;
  cabang_id: string;
  shift_id: string;
  kasir_id: string;
  status: TransaksiStatus;
  subtotal: number;
  diskon: number;
  alasan_diskon: string | null;
  total: number;
  metode_bayar: MetodeBayar;
  uang_diterima: number;
  kembalian: number;
  dibuat_pada: string;
  dibayar_pada: string | null;
  void_oleh: string | null;
  void_pada: string | null;
  alasan_void: string | null;
  mayar_invoice_id: string | null;
}

export interface TransaksiItem {
  id: string;
  transaksi_id: string;
  produk_id: string;
  nama_produk: string;
  harga_satuan: number;
  jumlah: number;
  subtotal: number;
}

export interface AuditLog {
  id: number;
  pelaku_id: string | null;
  aksi: string;
  tabel: string;
  data_id: string | null;
  nilai_sebelum: Record<string, unknown> | null;
  nilai_sesudah: Record<string, unknown> | null;
  dibuat_pada: string;
  pelaku?: Profile;
}
