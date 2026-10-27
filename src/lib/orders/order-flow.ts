import fs from 'node:fs';
import path from 'node:path';
import { createAdminClient } from '../supabase/admin.ts';
export * from './order-types.ts';
import type {
  StatusMeja,
  StatusPengerjaan,
  BentukMeja,
  AreaMeja,
  MejaItem,
  PesananAntreanItem,
} from './order-types.ts';
import { createDefaultMejaList } from './order-types.ts';

// In-Memory & File-Backed Operational State synchronized with Supabase
interface OperationalStore {
  mejaByCabang: Map<string, MejaItem[]>;
  antreanByCabang: Map<string, PesananAntreanItem[]>;
  antreanCounter: Map<string, { tanggal: string; urut: number }>;
}

declare global {
  var __lumbungOperationalStore: OperationalStore | undefined;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const STORE_FILE = path.join(DATA_DIR, 'operational-store.json');

function saveStoreToFile(store: OperationalStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const serialized = {
      mejaByCabang: Object.fromEntries(store.mejaByCabang),
      antreanByCabang: Object.fromEntries(store.antreanByCabang),
      antreanCounter: Object.fromEntries(store.antreanCounter),
    };
    fs.writeFileSync(STORE_FILE, JSON.stringify(serialized, null, 2), 'utf-8');
  } catch (err) {
    // Graceful fallback for read-only environments
    console.warn('[OperationalStore] Could not persist to file:', err);
  }
}

function loadStoreFromFile(): OperationalStore | null {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const content = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      const store: OperationalStore = {
        mejaByCabang: new Map(Object.entries(parsed.mejaByCabang || {})),
        antreanByCabang: new Map(Object.entries(parsed.antreanByCabang || {})),
        antreanCounter: new Map(Object.entries(parsed.antreanCounter || {})),
      };
      return store;
    }
  } catch (err) {
    console.warn('[OperationalStore] Could not load from file:', err);
  }
  return null;
}

function getStore(): OperationalStore {
  if (!globalThis.__lumbungOperationalStore) {
    const fromFile = loadStoreFromFile();
    if (fromFile) {
      globalThis.__lumbungOperationalStore = fromFile;
    } else {
      globalThis.__lumbungOperationalStore = {
        mejaByCabang: new Map(),
        antreanByCabang: new Map(),
        antreanCounter: new Map(),
      };
    }
  }
  return globalThis.__lumbungOperationalStore;
}

/**
 * Membersihkan seluruh state operational store untuk keperluan unit testing yang terisolasi
 */
export function clearStoreForTesting(): void {
  const store: OperationalStore = {
    mejaByCabang: new Map(),
    antreanByCabang: new Map(),
    antreanCounter: new Map(),
  };
  globalThis.__lumbungOperationalStore = store;
  saveStoreToFile(store);
}

/**
 * Inisialisasi daftar meja standar untuk sebuah cabang (12 Meja dengan bentuk & area realistis)
 */
export function getDefaultMejaCabang(cabangId: string): MejaItem[] {
  const store = getStore();
  const existing = store.mejaByCabang.get(cabangId);
  if (existing && existing.length > 0) {
    return existing;
  }

  const defaultMeja = createDefaultMejaList(cabangId);
  store.mejaByCabang.set(cabangId, defaultMeja);
  saveStoreToFile(store);
  return defaultMeja;
}

/**
 * Helper untuk mencocokkan nomor meja secara fleksibel
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
 * Validasi ketersediaan meja sebelum transaksi (mencegah race condition kasir)
 */
export function isMejaAvailable(cabangId: string, nomorMeja: string): boolean {
  const list = getDefaultMejaCabang(cabangId);
  const target = list.find((m) => matchNomorMeja(m.nomor_meja, nomorMeja));
  if (target) {
    return target.status === 'tersedia';
  }
  // Jika nomor meja belum ada dalam daftar bawaan, nomor meja dianggap valid dan tersedia
  return true;
}

/**
 * Menghasilkan Nomor Antrean Takeaway / Dine In Unik per Hari & Cabang
 * Format: A-001, A-002, dst (independen dari nomor struk)
 */
export function generateNomorAntrean(cabangKode: string): string {
  const store = getStore();
  const todayWIB = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }); // YYYY-MM-DD
  const key = `${cabangKode}-${todayWIB}`;

  const current = store.antreanCounter.get(key);
  let nextUrut = 1;

  if (current && current.tanggal === todayWIB) {
    nextUrut = current.urut + 1;
  }

  store.antreanCounter.set(key, { tanggal: todayWIB, urut: nextUrut });
  saveStoreToFile(store);

  // Prefix alfabet sesuai cabang (TBT -> A, BTR -> B, DPK -> C, default Q)
  const prefix = cabangKode === 'TBT' ? 'A' : cabangKode === 'BTR' ? 'B' : cabangKode === 'DPK' ? 'C' : 'Q';
  return `${prefix}-${String(nextUrut).padStart(3, '0')}`;
}

/**
 * Menempati Meja saat Checkout DINE_IN Berhasil
 */
export function occupyMeja(
  cabangId: string,
  nomorMeja: string,
  transaksiId: string,
  nomorStruk: string,
  pesananAktif?: {
    nomor_struk: string;
    nomor_antrean?: string;
    total: number;
    status_pembayaran?: string;
    status_pengerjaan?: string;
    items: Array<{ nama: string; jumlah: number; catatan?: string }>;
  }
): { success: boolean; error?: string } {
  const store = getStore();
  const list = getDefaultMejaCabang(cabangId);
  let target = list.find((m) => matchNomorMeja(m.nomor_meja, nomorMeja));

  if (!target) {
    // Buat entri meja dinamis jika nomor meja kustom
    target = {
      id: `${cabangId}-${nomorMeja.toUpperCase()}`,
      cabang_id: cabangId,
      nomor_meja: nomorMeja,
      kapasitas: 4,
      bentuk: 'persegi',
      area: 'Indoor',
      status: 'tersedia',
      transaksi_terkini_id: null,
      nomor_struk_terkini: null,
      waktu_terisi: null,
    };
    list.push(target);
  }

  if (target.status === 'terisi' && target.transaksi_terkini_id !== transaksiId) {
    return { success: false, error: `Meja ${nomorMeja} sedang terisi oleh pesanan lain (${target.nomor_struk_terkini}).` };
  }

  target.status = 'terisi';
  target.transaksi_terkini_id = transaksiId;
  target.nomor_struk_terkini = nomorStruk;
  target.waktu_terisi = new Date().toISOString();
  if (pesananAktif) {
    target.pesanan_aktif = pesananAktif;
  }

  store.mejaByCabang.set(cabangId, [...list]);
  saveStoreToFile(store);
  return { success: true };
}

/**
 * Membebaskan meja secara eksplisit kembali ke 'tersedia'
 */
export function releaseMeja(cabangId: string, nomorMeja: string): { success: boolean; error?: string } {
  const store = getStore();
  const list = getDefaultMejaCabang(cabangId);
  const target = list.find((m) => matchNomorMeja(m.nomor_meja, nomorMeja));

  if (!target) {
    return { success: false, error: `Meja ${nomorMeja} tidak ditemukan.` };
  }

  target.status = 'tersedia';
  target.transaksi_terkini_id = null;
  target.nomor_struk_terkini = null;
  target.waktu_terisi = null;
  target.pesanan_aktif = null;

  store.mejaByCabang.set(cabangId, [...list]);
  saveStoreToFile(store);
  return { success: true };
}

/**
 * Membebaskan meja berdasarkan ID Transaksi (misal saat transaksi di-void atau dibatalkan)
 */
export function releaseMejaByTransaksi(transaksiId: string): { success: boolean; nomorMeja?: string } {
  const store = getStore();
  for (const [cId, list] of store.mejaByCabang.entries()) {
    const target = list.find((m) => m.transaksi_terkini_id === transaksiId);
    if (target) {
      const nomorMeja = target.nomor_meja;
      target.status = 'tersedia';
      target.transaksi_terkini_id = null;
      target.nomor_struk_terkini = null;
      target.waktu_terisi = null;
      target.pesanan_aktif = null;
      store.mejaByCabang.set(cId, [...list]);
      saveStoreToFile(store);
      return { success: true, nomorMeja };
    }
  }
  return { success: false };
}

/**
 * Mengubah Status Meja (misal selesai dibersihkan -> tersedia)
 */
export function updateStatusMeja(
  cabangId: string,
  nomorMeja: string,
  newStatus: StatusMeja
): { success: boolean; error?: string } {
  const store = getStore();
  const list = getDefaultMejaCabang(cabangId);
  const target = list.find((m) => matchNomorMeja(m.nomor_meja, nomorMeja));

  if (!target) {
    return { success: false, error: `Meja ${nomorMeja} tidak ditemukan.` };
  }

  target.status = newStatus;
  if (newStatus === 'tersedia') {
    target.transaksi_terkini_id = null;
    target.nomor_struk_terkini = null;
    target.waktu_terisi = null;
    target.pesanan_aktif = null;
  }

  store.mejaByCabang.set(cabangId, [...list]);
  saveStoreToFile(store);
  return { success: true };
}

/**
 * Menambahkan atau memperbarui meja (Khusus Owner)
 */
export function addOrUpdateMeja(
  cabangId: string,
  mejaData: { nomor_meja: string; kapasitas: number; area?: AreaMeja; bentuk?: BentukMeja }
): { success: boolean; error?: string; meja?: MejaItem } {
  const store = getStore();
  const list = getDefaultMejaCabang(cabangId);
  const existingIndex = list.findIndex((m) => m.nomor_meja.toLowerCase() === mejaData.nomor_meja.toLowerCase());

  const kapasitas = Math.min(20, Math.max(1, mejaData.kapasitas));
  const bentuk: BentukMeja =
    mejaData.bentuk || (kapasitas <= 2 ? 'lingkaran' : kapasitas <= 4 ? 'persegi' : 'persegi_panjang');
  const area: AreaMeja = mejaData.area || 'Indoor';

  if (existingIndex >= 0) {
    list[existingIndex] = {
      ...list[existingIndex],
      kapasitas,
      bentuk,
      area,
    };
    store.mejaByCabang.set(cabangId, [...list]);
    saveStoreToFile(store);
    return { success: true, meja: list[existingIndex] };
  }

  const newMeja: MejaItem = {
    id: `${cabangId}-${mejaData.nomor_meja.toUpperCase()}`,
    cabang_id: cabangId,
    nomor_meja: mejaData.nomor_meja.toUpperCase(),
    kapasitas,
    bentuk,
    area,
    status: 'tersedia',
  };

  list.push(newMeja);
  store.mejaByCabang.set(cabangId, [...list]);
  saveStoreToFile(store);
  return { success: true, meja: newMeja };
}

/**
 * Mendaftarkan Pesanan Baru ke Antrean KDS (Kitchen / Barista Display)
 */
export function registerPesananAntrean(pesanan: PesananAntreanItem): void {
  const store = getStore();
  const currentList = store.antreanByCabang.get(pesanan.cabang_id) || [];

  // Hindari duplikasi transaksi
  const filtered = currentList.filter((p) => p.transaksi_id !== pesanan.transaksi_id);
  store.antreanByCabang.set(pesanan.cabang_id, [pesanan, ...filtered]);

  // Jika DINE_IN atau memiliki nomor meja, otomatis set status meja ke terisi dengan detail item
  const isDineIn = (pesanan.jenis_pesanan || '').toUpperCase() === 'DINE_IN' || !!pesanan.nomor_meja;
  if (isDineIn && pesanan.nomor_meja) {
    occupyMeja(
      pesanan.cabang_id,
      pesanan.nomor_meja,
      pesanan.transaksi_id,
      pesanan.nomor_struk,
      {
        nomor_struk: pesanan.nomor_struk,
        total: pesanan.total,
        items: pesanan.items.map((it) => ({ nama: it.nama, jumlah: it.jumlah })),
      }
    );
  }

  saveStoreToFile(store);
}

/**
 * Mengambil Antrean Pesanan Aktif untuk KDS Display
 */
export function getAntreanList(cabangId?: string): PesananAntreanItem[] {
  const store = getStore();
  if (cabangId && cabangId !== 'all') {
    return store.antreanByCabang.get(cabangId) || [];
  }

  // Gabungkan semua cabang untuk Owner
  const all: PesananAntreanItem[] = [];
  store.antreanByCabang.forEach((list) => {
    all.push(...list);
  });

  return all.sort((a, b) => new Date(b.dibuat_pada).getTime() - new Date(a.dibuat_pada).getTime());
}

/**
 * Transisi Status Pengerjaan Pesanan (MENUNGGU -> DIPROSES -> SIAP_DIAMBIL -> SELESAI)
 * Tervalidasi di level server, mencegah loncat status tidak sah
 */
export async function transitionStatusPengerjaan(
  transaksiId: string,
  nextStatus: StatusPengerjaan,
  userProfile?: { id: string; nama_lengkap: string; peran: string; cabang_id: string | null }
): Promise<{ success: boolean; error?: string; pesanan?: PesananAntreanItem; item?: PesananAntreanItem }> {
  const store = getStore();

  let targetPesanan: PesananAntreanItem | null = null;
  let targetCabangId = '';

  for (const [cId, list] of store.antreanByCabang.entries()) {
    const found = list.find((p) => p.transaksi_id === transaksiId);
    if (found) {
      targetPesanan = found;
      targetCabangId = cId;
      break;
    }
  }

  if (!targetPesanan) {
    return { success: false, error: 'Pesanan tidak ditemukan dalam antrean aktif.' };
  }

  const effectiveProfile = userProfile || {
    id: 'system',
    nama_lengkap: 'Staff Barista',
    peran: 'owner',
    cabang_id: null,
  };

  // Validasi Otorisasi Cabang
  if (effectiveProfile.peran !== 'owner' && effectiveProfile.cabang_id !== targetCabangId) {
    return { success: false, error: 'Anda tidak memiliki hak otorisasi pada cabang pesanan ini.' };
  }

  const currentStatus = targetPesanan.status_pengerjaan;

  // Validasi urutan status pengerjaan yang sah:
  // MENUNGGU -> DIPROSES
  // DIPROSES -> SIAP_DIAMBIL atau SELESAI
  // SIAP_DIAMBIL -> SELESAI
  const validTransitions: Record<StatusPengerjaan, StatusPengerjaan[]> = {
    MENUNGGU: ['DIPROSES'],
    DIPROSES: ['SIAP_DIAMBIL', 'SELESAI'],
    SIAP_DIAMBIL: ['SELESAI'],
    SELESAI: [],
  };

  if (!validTransitions[currentStatus]?.includes(nextStatus)) {
    return {
      success: false,
      error: `Transisi tidak valid dari "${currentStatus}" ke "${nextStatus}".`,
    };
  }

  // Update status
  targetPesanan.status_pengerjaan = nextStatus;
  if (nextStatus === 'SELESAI') {
    targetPesanan.diselesaikan_pada = new Date().toISOString();
  }

  // Jika pesanan selesai, dan menggunakan meja, ubah status meja jadi 'menunggu_dibersihkan'
  if (nextStatus === 'SELESAI' && targetPesanan.jenis_pesanan === 'DINE_IN' && targetPesanan.nomor_meja) {
    updateStatusMeja(targetCabangId, targetPesanan.nomor_meja, 'menunggu_dibersihkan');
  }

  saveStoreToFile(store);

  // Simpan perubahan ke database Supabase dan catat audit trail (BR-12)
  try {
    const adminClient = createAdminClient();
    if (adminClient) {
      const updatePayload: Record<string, string | null> = {
        status_pengerjaan: nextStatus,
      };
      if (nextStatus === 'SELESAI') {
        updatePayload.diselesaikan_pada = targetPesanan.diselesaikan_pada || new Date().toISOString();
      }
      await adminClient.from('transaksi').update(updatePayload).eq('id', transaksiId);

      await adminClient.from('audit_log').insert({
        pelaku_id: effectiveProfile.id,
        aksi: 'ubah_status_pengerjaan',
        tabel: 'transaksi',
        data_id: transaksiId,
        nilai_sebelum: { status_pengerjaan: currentStatus },
        nilai_sesudah: { status_pengerjaan: nextStatus, nomor_antrean: targetPesanan.nomor_antrean },
      });
    }
  } catch (err) {
    console.error('Update status pengerjaan warning:', err);
  }

  return { success: true, pesanan: targetPesanan, item: targetPesanan };
}

/**
 * Mencari pesanan antrean berdasarkan transaksi_id atau nomor_struk
 */
export function getPesananByTransaksiId(transaksiIdOrStruk: string): PesananAntreanItem | undefined {
  const store = getStore();
  const searchKey = transaksiIdOrStruk.toLowerCase().trim();

  for (const [, list] of store.antreanByCabang.entries()) {
    const found = list.find(
      (p) =>
        p.transaksi_id.toLowerCase() === searchKey ||
        p.nomor_struk.toLowerCase() === searchKey
    );
    if (found) return found;
  }
  return undefined;
}

/**
 * Memperbarui status pembayaran pesanan di operational store secara idempoten
 */
export function updatePesananPaymentStatus(
  transaksiId: string,
  newPaymentStatus: string
): boolean {
  const store = getStore();
  for (const [, list] of store.antreanByCabang.entries()) {
    const target = list.find((p) => p.transaksi_id === transaksiId);
    if (target) {
      target.status_pembayaran = newPaymentStatus.toUpperCase();
      saveStoreToFile(store);
      return true;
    }
  }
  return false;
}

/**
 * Menghapus pesanan dari antrean aktif (misal saat transaksi dibatalkan)
 */
export function removePesananFromAntrean(transaksiId: string): boolean {
  const store = getStore();
  let changed = false;
  for (const [cId, list] of store.antreanByCabang.entries()) {
    const initialLen = list.length;
    const filtered = list.filter((p) => p.transaksi_id !== transaksiId);
    if (filtered.length !== initialLen) {
      store.antreanByCabang.set(cId, filtered);
      changed = true;
    }
  }
  if (changed) {
    saveStoreToFile(store);
  }
  return changed;
}

/**
 * Mengosongkan daftar antrean pesanan untuk cabang tertentu atau seluruh cabang
 * Menandai seluruh antrean aktif menjadi 'SELESAI', memperbarui waktu penyelesaian,
 * dan memindahkan meja DINE_IN terkait ke status 'menunggu_dibersihkan'.
 */
export function clearAntreanList(
  cabangId?: string,
  extraTransaksiIds?: string[]
): { clearedCount: number; clearedIds: string[] } {
  const store = getStore();
  const clearedIds: string[] = [];
  const now = new Date().toISOString();

  const targetCabangs = cabangId && cabangId !== 'all'
    ? [cabangId]
    : Array.from(store.antreanByCabang.keys());

  for (const cId of targetCabangs) {
    const list = store.antreanByCabang.get(cId) || [];
    for (const item of list) {
      if (item.status_pengerjaan !== 'SELESAI') {
        item.status_pengerjaan = 'SELESAI';
        item.diselesaikan_pada = item.diselesaikan_pada || now;
        clearedIds.push(item.transaksi_id);

        // Jika pesanan DINE_IN dan memiliki nomor meja, ubah status meja jadi 'menunggu_dibersihkan'
        if (item.jenis_pesanan === 'DINE_IN' && item.nomor_meja) {
          updateStatusMeja(cId, item.nomor_meja, 'menunggu_dibersihkan');
        }
      }
    }
  }

  // Jika ada extraTransaksiIds dari transaksi database yang belum tercatat atau belum SELESAI di store
  if (extraTransaksiIds && extraTransaksiIds.length > 0) {
    for (const txId of extraTransaksiIds) {
      if (!clearedIds.includes(txId)) {
        clearedIds.push(txId);
      }
      for (const [cId, list] of store.antreanByCabang.entries()) {
        const found = list.find((p) => p.transaksi_id === txId);
        if (found && found.status_pengerjaan !== 'SELESAI') {
          found.status_pengerjaan = 'SELESAI';
          found.diselesaikan_pada = found.diselesaikan_pada || now;
          if (found.jenis_pesanan === 'DINE_IN' && found.nomor_meja) {
            updateStatusMeja(cId, found.nomor_meja, 'menunggu_dibersihkan');
          }
        }
      }
    }
  }

  saveStoreToFile(store);
  return { clearedCount: clearedIds.length, clearedIds };
}
