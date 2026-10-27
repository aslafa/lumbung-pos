'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart,
  Search,
  Coffee,
  Clock,
  Plus,
  Minus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Banknote,
  QrCode,
  X,
  ChevronRight,
  Utensils,
  ShoppingBag,
  FileText,
  User,
  Edit3,
  ChefHat,
  LayoutGrid,
  Shield,
} from 'lucide-react';
import { simpanTransaksiAction, SimpanTransaksiResult } from '@/app/actions/transaksi';
import { buatTransaksiMayarAction, BuatTransaksiMayarResult } from '@/app/actions/mayar';
import { getAntreanDataAction, bersihkanMejaAction } from '@/app/actions/antrean';
import { MejaItem, JenisPesanan, PesananAntreanItem, createDefaultMejaList, StatusMeja, matchNomorMeja } from '@/lib/orders/order-types';
import { TableSelectorModal } from '@/components/pos/TableSelectorModal';
import { KasirAntreanModal } from '@/components/pos/KasirAntreanModal';
import { ProductCustomModal, CustomOrderOptions } from '@/components/pos/ProductCustomModal';
import { StrukModal } from './struk-modal';
import { QrisMayarModal } from './qris-mayar-modal';
import { ProductCardImage } from '@/components/brand/ProductCardImage';
import { formatRupiah } from '@/lib/utils/format';
import {
  getEffectiveItemPrice,
  formatItemCustomization,
  formatItemDisplayName,
} from '@/lib/products/product-config';

export interface ProdukPOS {
  id: string;
  sku: string;
  nama: string;
  kategori: string;
  harga_jual: number;
  lacak_stok: boolean;
  stok_tersedia: number | null; // null jika racikan (tidak lacak stok)
}

export interface ShiftAktifInfo {
  id: string;
  kasir_id: string;
  cabang_id: string;
  kas_awal: number;
  dibuka_pada: string;
}

export interface CartItem {
  cartItemId: string; // ID unik per konfigurasi pesanan
  produk: ProdukPOS;
  jumlah: number;
  options?: CustomOrderOptions;
  harga_satuan?: number;
}

interface KasirPOSClientProps {
  initialProducts: ProdukPOS[];
  initialMejaList?: MejaItem[];
  initialAntreanList?: PesananAntreanItem[];
  targetCabangId?: string;
  shiftAktif: ShiftAktifInfo | null;
  kasirNama: string;
  cabangNama: string;
  cabangAlamat?: string;
  userRole?: string;
}

export function KasirPOSClient({
  initialProducts,
  initialMejaList = [],
  initialAntreanList = [],
  targetCabangId = '',
  shiftAktif,
  kasirNama,
  cabangNama,
  cabangAlamat,
  userRole,
}: KasirPOSClientProps) {
  const isOwner = userRole === 'owner';
  const effectiveCabangId = shiftAktif?.cabang_id || targetCabangId || 'cabang-utama';

  // State Filter & Pencarian
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('semua');

  // State Keranjang Belanja
  const [cart, setCart] = useState<CartItem[]>([]);
  const [diskonNominal, setDiskonNominal] = useState<number>(0);
  const [alasanDiskon, setAlasanDiskon] = useState<string>('');
  const [uangDiterima, setUangDiterima] = useState<string>('');
  const [metodeBayar, setMetodeBayar] = useState<'tunai' | 'qris_manual' | 'qris_mayar'>('tunai');

  // State Jenis Pesanan & Meja (PRD Coffee Shop Alur Modern)
  const [jenisPesanan, setJenisPesanan] = useState<JenisPesanan>('DINE_IN');
  const [selectedMeja, setSelectedMeja] = useState<string | null>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [namaPelanggan, setNamaPelanggan] = useState('');
  const [catatanPesanan, setCatatanPesanan] = useState('');

  // State Meja & Antrean (Terhidrasi sejak awal render sehingga denah dan antrean selalu muncul isinya)
  const [mejaList, setMejaList] = useState<MejaItem[]>(() => {
    if (initialMejaList && initialMejaList.length > 0) return initialMejaList;
    return createDefaultMejaList(effectiveCabangId);
  });
  const [antreanList, setAntreanList] = useState<PesananAntreanItem[]>(initialAntreanList);
  const [isAntreanModalOpen, setIsAntreanModalOpen] = useState(false);
  const [isRefreshingAntrean, setIsRefreshingAntrean] = useState(false);

  // State Mobile Cart Drawer
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // State Status Aksi & Transaksi
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [strukResult, setStrukResult] = useState<SimpanTransaksiResult | null>(null);
  const [mayarModalData, setMayarModalData] = useState<BuatTransaksiMayarResult | null>(null);

  // State Notifikasi Popup Pembayaran Tunai Kurang
  const [paymentShortageToast, setPaymentShortageToast] = useState<{
    isOpen: boolean;
    message: string;
    kekurangan: number;
  } | null>(null);

  // Auto-hide popup toast setelah 3.5 detik (3-4 detik)
  useEffect(() => {
    if (!paymentShortageToast?.isOpen) return;
    const timer = setTimeout(() => {
      setPaymentShortageToast((prev) => (prev ? { ...prev, isOpen: false } : null));
    }, 3500);
    return () => clearTimeout(timer);
  }, [paymentShortageToast]);

  // Fungsi sinkronisasi data antrean & meja dari server
  const refreshAntreanDanMeja = useCallback(async () => {
    try {
      const res = await getAntreanDataAction(effectiveCabangId);
      if (res.success) {
        if (res.mejaList && res.mejaList.length > 0) {
          setMejaList(res.mejaList);
        }
        setAntreanList(res.antrean);
      }
    } catch {
      // Background catch
    }
  }, [effectiveCabangId]);

  const handleRefreshAntrean = async () => {
    setIsRefreshingAntrean(true);
    await refreshAntreanDanMeja();
    setIsRefreshingAntrean(false);
  };

  // Muat status meja & antrean cabang saat shift aktif tersedia atau cabang berganti
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        const res = await getAntreanDataAction(effectiveCabangId);
        if (active && res.success) {
          if (res.mejaList && res.mejaList.length > 0) {
            setMejaList(res.mejaList);
          }
          setAntreanList(res.antrean);
        }
      } catch {
        // silent
      }
    };
    run();
    const interval = setInterval(run, 8000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [effectiveCabangId]);

  // Filter Produk Berdasarkan Kategori & Pencarian
  const filteredProducts = initialProducts.filter((p) => {
    const matchCategory =
      selectedCategory === 'semua' || p.kategori === selectedCategory;
    const matchQuery =
      p.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchQuery;
  });

  // Helper generate key unik per konfigurasi racikan produk
  const generateCartItemId = (prodId: string, options?: CustomOrderOptions) => {
    if (!options) return prodId;
    const parts = [
      prodId,
      options.ukuran || '',
      options.suhu || '',
      options.gula || '',
      options.es || '',
      options.penyajian || '',
      options.varianRasa || '',
      options.levelPedas || '',
      options.ukuranKemasan || '',
      options.gilingan || '',
      options.warna || '',
      (options.catatanKhusus || '').trim(),
    ];
    return parts.join('__');
  };

  // State Modal Kustomisasi Produk
  const [customModal, setCustomModal] = useState<{
    isOpen: boolean;
    produk: ProdukPOS | null;
    initialOptions?: CustomOrderOptions;
    initialJumlah?: number;
    editingCartItemId?: string | null;
  }>({
    isOpen: false,
    produk: null,
    editingCartItemId: null,
  });

  // Handler klik produk dari catalog / grid: Berlaku untuk SEMUA kategori produk
  const handleProductSelect = (prod: ProdukPOS) => {
    setCustomModal({
      isOpen: true,
      produk: prod,
      initialOptions: undefined,
      initialJumlah: 1,
      editingCartItemId: null,
    });
  };

  // Konfirmasi dari modal kustomisasi
  const handleConfirmCustomOrder = (
    prod: ProdukPOS,
    qty: number,
    options: CustomOrderOptions,
    unitPrice?: number
  ) => {
    setErrorMessage(null);
    const finalUnitPrice = unitPrice ?? getEffectiveItemPrice(prod, options);
    const newCartItemId = generateCartItemId(prod.id, options);

    setCart((prev) => {
      // Jika mode EDIT
      if (customModal.editingCartItemId) {
        const duplicateIndex = prev.findIndex(
          (it) => it.cartItemId === newCartItemId && it.cartItemId !== customModal.editingCartItemId
        );

        if (duplicateIndex >= 0) {
          return prev
            .map((it, idx) =>
              idx === duplicateIndex
                ? { ...it, jumlah: Math.min(99, it.jumlah + qty), harga_satuan: finalUnitPrice }
                : it
            )
            .filter((it) => it.cartItemId !== customModal.editingCartItemId);
        } else {
          return prev.map((it) =>
            it.cartItemId === customModal.editingCartItemId
              ? { ...it, cartItemId: newCartItemId, jumlah: qty, options, harga_satuan: finalUnitPrice }
              : it
          );
        }
      }

      // Mode TAMBAH BARU
      const existing = prev.find((it) => it.cartItemId === newCartItemId);
      if (existing) {
        if (prod.lacak_stok && prod.stok_tersedia !== null) {
          if (existing.jumlah + qty > prod.stok_tersedia) {
            setErrorMessage(`Stok untuk "${prod.nama}" hanya tersisa ${prod.stok_tersedia} pcs.`);
            return prev;
          }
        }
        return prev.map((it) =>
          it.cartItemId === newCartItemId
            ? { ...it, jumlah: Math.min(99, it.jumlah + qty), harga_satuan: finalUnitPrice }
            : it
        );
      } else {
        if (prod.lacak_stok && prod.stok_tersedia !== null && prod.stok_tersedia < qty) {
          setErrorMessage(`Stok untuk "${prod.nama}" hanya tersisa ${prod.stok_tersedia} pcs.`);
          return prev;
        }
        return [
          ...prev,
          { cartItemId: newCartItemId, produk: prod, jumlah: qty, options, harga_satuan: finalUnitPrice },
        ];
      }
    });
  };

  // Edit kustomisasi item keranjang
  const handleEditCartItem = (item: CartItem) => {
    setCustomModal({
      isOpen: true,
      produk: item.produk,
      initialOptions: item.options,
      initialJumlah: item.jumlah,
      editingCartItemId: item.cartItemId,
    });
  };

  // Kurangi kuantitas item keranjang
  const decreaseQty = (cartItemId: string) => {
    setErrorMessage(null);
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.cartItemId === cartItemId) {
            return { ...item, jumlah: item.jumlah - 1 };
          }
          return item;
        })
        .filter((item) => item.jumlah > 0)
    );
  };

  // Tambah kuantitas item keranjang
  const increaseQty = (cartItemId: string) => {
    setErrorMessage(null);
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartItemId === cartItemId) {
          if (item.produk.lacak_stok && item.produk.stok_tersedia !== null) {
            if (item.jumlah + 1 > item.produk.stok_tersedia) {
              setErrorMessage(`Stok "${item.produk.nama}" hanya tersisa ${item.produk.stok_tersedia} pcs.`);
              return item;
            }
          }
          if (item.jumlah >= 99) return item;
          return { ...item, jumlah: item.jumlah + 1 };
        }
        return item;
      })
    );
  };

  // Hapus item dari keranjang
  const removeFromCart = (cartItemId: string) => {
    setErrorMessage(null);
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  // Kalkulasi Ringkasan Transaksi dengan harga varian terpercaya
  const subtotal = cart.reduce(
    (sum, item) => sum + (item.harga_satuan ?? getEffectiveItemPrice(item.produk, item.options)) * item.jumlah,
    0
  );

  // BR-06: Diskon maksimal 10% dari subtotal
  const maxDiskon = Math.floor((subtotal * 10) / 100);
  const effectiveDiskon = Math.min(diskonNominal || 0, maxDiskon);
  const totalBayar = Math.max(0, subtotal - effectiveDiskon);

  const nominalDiterima = parseInt(uangDiterima || '0', 10);
  const kembalian = nominalDiterima >= totalBayar ? nominalDiterima - totalBayar : 0;

  // Buka modal denah meja dengan sinkronisasi data terkini terlebih dahulu
  const handleOpenTableModal = async () => {
    await refreshAntreanDanMeja();
    setIsTableModalOpen(true);
  };

  // Handle pembersihan meja langsung dari modal denah kasir
  const handleCleanMeja = async (nomorMeja: string) => {
    try {
      // 1. Optimistic update di kasir state
      setMejaList((prev) =>
        prev.map((m) =>
          matchNomorMeja(m.nomor_meja, nomorMeja)
            ? {
                ...m,
                status: 'tersedia' as StatusMeja,
                transaksi_terkini_id: null,
                nomor_struk_terkini: null,
                waktu_terisi: null,
                pesanan_aktif: null,
              }
            : m
        )
      );

      // 2. Simpan status meja ke database / state sumber
      const res = await bersihkanMejaAction(effectiveCabangId, nomorMeja);
      if (res.success) {
        await refreshAntreanDanMeja();
      } else {
        await refreshAntreanDanMeja();
        setErrorMessage(res.error || 'Gagal mengubah status meja.');
      }
    } catch (err) {
      console.error('Error saat membersihkan meja:', err);
      await refreshAntreanDanMeja();
      setErrorMessage('Terjadi kesalahan saat membersihkan meja.');
    }
  };

  // Cek Kelayakan Tombol Simpan
  const isShiftOpen = !!shiftAktif;
  const isCartValid = cart.length > 0 && subtotal > 0;
  const isDiskonValid = effectiveDiskon === 0 || alasanDiskon.trim().length >= 3;
  const isTableValid = jenisPesanan === 'TAKEAWAY' || (jenisPesanan === 'DINE_IN' && !!selectedMeja);

  // Tombol checkout dapat diklik jika cart, shift, diskon, dan meja valid
  const canSubmit =
    !isOwner &&
    isShiftOpen &&
    isCartValid &&
    isDiskonValid &&
    isTableValid &&
    !isSubmitting;

  // Eksekusi Simpan Transaksi (Tunai, QRIS Manual, atau QRIS Mayar)
  const handleSimpanTransaksi = async () => {
    if (!canSubmit || !shiftAktif) return;

    // Validasi Pembayaran Tunai Kurang
    if (metodeBayar === 'tunai' && nominalDiterima < totalBayar) {
      const kekurangan = totalBayar - nominalDiterima;
      setPaymentShortageToast({
        isOpen: true,
        message: `Pembayaran belum mencukupi. Kekurangan ${formatRupiah(kekurangan)}.`,
        kekurangan,
      });
      // Pastikan banner lama dinonaktifkan / tidak muncul ganda
      setErrorMessage(null);
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setPaymentShortageToast(null);

    // Siapkan items lengkap dengan opsi kustomisasi & harga varian terpercaya
    const itemsPayload = cart.map((it) => {
      const effPrice = it.harga_satuan ?? getEffectiveItemPrice(it.produk, it.options);
      return {
        produk_id: it.produk.id,
        jumlah: it.jumlah,
        options: it.options,
        harga_satuan: effPrice,
        nama_kustom: formatItemDisplayName(it.produk.nama, it.options),
      };
    });

    // Kumpulkan rincian kustomisasi untuk disimpan ke catatan_pesanan
    const customSummaries: string[] = [];
    for (const item of cart) {
      const optStr = formatItemCustomization(item.options);
      if (optStr) {
        customSummaries.push(`${item.jumlah}x ${item.produk.nama} [${optStr}]`);
      }
    }

    const compiledCatatan = [
      catatanPesanan.trim(),
      customSummaries.length > 0 ? `[Detail: ${customSummaries.join('; ')}]` : ''
    ].filter(Boolean).join(' | ');

    const finalNamaPelanggan =
      namaPelanggan.trim() ||
      (jenisPesanan === 'DINE_IN' && selectedMeja
        ? `Tamu Meja ${selectedMeja}`
        : 'Pelanggan Umum');

    if (metodeBayar === 'qris_mayar') {
      const result = await buatTransaksiMayarAction({
        shift_id: shiftAktif.id,
        diskon: effectiveDiskon,
        alasan_diskon: effectiveDiskon > 0 ? alasanDiskon.trim() : undefined,
        items: itemsPayload,
        jenis_pesanan: jenisPesanan,
        nomor_meja: jenisPesanan === 'DINE_IN' ? selectedMeja || undefined : undefined,
        nama_pelanggan: finalNamaPelanggan,
        catatan_pesanan: compiledCatatan || undefined,
      });

      setIsSubmitting(false);

      if (!result.success) {
        setErrorMessage(result.error || 'Gagal memproses QRIS Mayar.');
        return;
      }

      setMayarModalData(result);
      setIsMobileCartOpen(false);
    } else {
      const uangBayar = metodeBayar === 'tunai' ? nominalDiterima : totalBayar;
      const metodePos = metodeBayar === 'tunai' ? 'tunai' : 'qris';

      const result = await simpanTransaksiAction({
        shift_id: shiftAktif.id,
        diskon: effectiveDiskon,
        alasan_diskon: effectiveDiskon > 0 ? alasanDiskon.trim() : undefined,
        metode_bayar: metodePos,
        uang_diterima: uangBayar,
        items: itemsPayload,
        jenis_pesanan: jenisPesanan,
        nomor_meja: jenisPesanan === 'DINE_IN' ? selectedMeja : null,
        nama_pelanggan: finalNamaPelanggan,
        catatan_pesanan: compiledCatatan || undefined,
      });

      setIsSubmitting(false);

      if (!result.success) {
        setErrorMessage(result.error || 'Gagal menyimpan transaksi.');
        return;
      }

      setStrukResult(result);
      setCart([]);
      setDiskonNominal(0);
      setAlasanDiskon('');
      setUangDiterima('');
      setSelectedMeja(null);
      setNamaPelanggan('');
      setCatatanPesanan('');
      setIsMobileCartOpen(false);

      // Refresh meja list
      if (shiftAktif.cabang_id) {
        getAntreanDataAction(shiftAktif.cabang_id).then((res) => {
          if (res.success && res.mejaList) setMejaList(res.mejaList);
        });
      }
    }
  };

  const totalCartCount = cart.reduce((sum, it) => sum + it.jumlah, 0);

  // Konten Keranjang Checkout (dirender di desktop sidebar dan mobile drawer)
  const cartCheckoutContent = (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-[#F3EDE2] dark:border-[#382F28] pb-3">
        <h2 className="text-sm font-bold text-[#2C1810] dark:text-[#FAF7F2] flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-[#D97706]" />
          <span>Keranjang Kasir</span>
        </h2>
        <span className="text-xs bg-[#FAF7F2] dark:bg-[#28211B] text-[#78716C] dark:text-[#CBBDB0] px-2.5 py-0.5 rounded-full border border-[#E8DFD3] dark:border-[#382F28] font-bold">
          {totalCartCount} Item
        </span>
      </div>

      {/* Selector Jenis Pesanan: Dine In vs Takeaway (Alur Coffee Shop Modern) */}
      <div className="space-y-2 p-3 bg-[#FAF7F2] dark:bg-[#26201B] rounded-2xl border border-[#E8DFD3] dark:border-[#382F28]">
        <label className="block text-[11px] font-bold text-[#78716C] dark:text-[#A89F91] uppercase tracking-wider">
          Tipe Pesanan
        </label>
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-[#1E1916] rounded-xl border border-[#E8DFD3] dark:border-[#382F28]">
          <button
            type="button"
            onClick={() => setJenisPesanan('DINE_IN')}
            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              jenisPesanan === 'DINE_IN'
                ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E] dark:text-[#12100E] shadow-xs'
                : 'text-[#78716C] dark:text-[#A89F91] hover:text-[#2C1810] dark:hover:text-[#FAF7F2]'
            }`}
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Dine In</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setJenisPesanan('TAKEAWAY');
              setSelectedMeja(null);
            }}
            className={`py-2 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              jenisPesanan === 'TAKEAWAY'
                ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E] dark:text-[#12100E] shadow-xs'
                : 'text-[#78716C] dark:text-[#A89F91] hover:text-[#2C1810] dark:hover:text-[#FAF7F2]'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Takeaway</span>
          </button>
        </div>

        {/* Pemilihan Meja (DINE IN Wajib) dan Nama Pelanggan */}
        {jenisPesanan === 'DINE_IN' ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleOpenTableModal}
              className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                selectedMeja
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-[#4A2E18] dark:text-amber-200 shadow-xs'
                  : 'bg-white dark:bg-[#1E1916] border-dashed border-amber-400 dark:border-amber-600 text-amber-700 dark:text-amber-400 hover:bg-amber-50/50'
              }`}
            >
              <span className="flex items-center gap-2">
                <Utensils className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{selectedMeja ? `Meja ${selectedMeja}` : 'Pilih Nomor Meja (Wajib)'}</span>
              </span>
              <span className="text-[10px] uppercase underline tracking-wider font-semibold">
                {selectedMeja ? 'Ganti Meja' : 'Buka Grid Meja'}
              </span>
            </button>
            {!selectedMeja && cart.length > 0 && (
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-medium italic">
                * Kasir wajib memilih meja sebelum checkout Dine In.
              </p>
            )}
            <div className="relative">
              <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
              <input
                type="text"
                value={namaPelanggan}
                onChange={(e) => setNamaPelanggan(e.target.value)}
                placeholder={selectedMeja ? `Nama Tamu (opsional, default: Tamu Meja ${selectedMeja})...` : "Nama Tamu / Pemesan (opsional)..."}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-xs font-semibold text-[#2C1810] dark:text-[#FAF7F2] focus:outline-none focus:ring-1 focus:ring-[#C67C4E]"
              />
            </div>
          </div>
        ) : (
          <div className="relative">
            <User className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#78716C]" />
            <input
              type="text"
              value={namaPelanggan}
              onChange={(e) => setNamaPelanggan(e.target.value)}
              placeholder="Nama Pelanggan (opsional, default: Pelanggan Umum)..."
              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-xs font-semibold text-[#2C1810] dark:text-[#FAF7F2] focus:outline-none focus:ring-1 focus:ring-[#C67C4E]"
            />
          </div>
        )}

        {/* Catatan Pesanan Khusus (Gula, Es, Permintaan) */}
        <div className="relative">
          <FileText className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#78716C]" />
          <input
            type="text"
            value={catatanPesanan}
            onChange={(e) => setCatatanPesanan(e.target.value)}
            placeholder="Catatan pesanan (mis: less sugar, es pisah)..."
            className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-xs text-[#2C1810] dark:text-[#FAF7F2] focus:outline-none focus:ring-1 focus:ring-[#C67C4E]"
          />
        </div>
      </div>

      {/* List Item Keranjang */}
      {cart.length === 0 ? (
        <div className="py-10 text-center text-[#A8A29E] dark:text-[#78716C]">
          <Coffee className="w-8 h-8 mx-auto mb-2 text-[#D97706]/60 stroke-[1.5]" />
          <p className="text-xs font-semibold">Keranjang masih kosong</p>
          <p className="text-[11px] text-[#A8A29E] dark:text-[#78716C] mt-0.5">
            Pilih menu di samping untuk menambahkan pesanan
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
          {cart.map((item) => {
            const opt = item.options;
            const itemEffectivePrice = item.harga_satuan ?? getEffectiveItemPrice(item.produk, opt);
            const customSummary = formatItemCustomization(opt);
            const optionTags = customSummary ? customSummary.split(', ') : [];

            return (
              <div
                key={item.cartItemId}
                className="flex items-start justify-between bg-[#FAF7F2] dark:bg-[#26201B] p-2.5 rounded-xl border border-[#E8DFD3] dark:border-[#382F28] text-xs transition-all gap-2"
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <p className="font-bold text-[#2C1810] dark:text-[#FAF7F2] truncate">
                      {item.produk.nama}
                    </p>
                    {/* Tombol Edit Kustomisasi untuk SEMUA produk */}
                    <button
                      type="button"
                      onClick={() => handleEditCartItem(item)}
                      className="text-[#8C5E3C] hover:text-[#734A2E] dark:text-[#C67C4E] p-0.5 rounded cursor-pointer transition-colors"
                      title="Ubah opsi racikan / varian"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Badges Opsi Kustomisasi */}
                  {optionTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {optionTags.map((tag, tIdx) => (
                        <span
                          key={tIdx}
                          className="px-1.5 py-0.2 rounded-md bg-[#FAF0E6] dark:bg-[#342721] text-[#8C5E3C] dark:text-[#E0A96D] text-[10px] font-semibold"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Catatan Khusus Barista */}
                  {opt?.catatanKhusus && (
                    <p className="text-[10px] text-[#78716C] dark:text-[#A89F91] italic">
                      ↳ {opt.catatanKhusus}
                    </p>
                  )}

                  <p className="text-[11px] text-[#78716C] dark:text-[#A89F91]">
                    <span className="tabular-nums">{formatRupiah(itemEffectivePrice)}</span> &times; {item.jumlah} ={' '}
                    <strong className="text-[#4A2E18] dark:text-[#F59E0B] tabular-nums">
                      {formatRupiah(itemEffectivePrice * item.jumlah)}
                    </strong>
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  <button
                    type="button"
                    onClick={() => decreaseQty(item.cartItemId)}
                    className="p-1 bg-white dark:bg-[#1E1916] hover:bg-[#F3EDE2] dark:hover:bg-[#2E2824] text-[#78716C] dark:text-[#FAF7F2] rounded-lg border border-[#E8DFD3] dark:border-[#382F28] cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-5 text-center font-bold text-xs dark:text-[#FAF7F2] tabular-nums">
                    {item.jumlah}
                  </span>
                  <button
                    type="button"
                    onClick={() => increaseQty(item.cartItemId)}
                    className="p-1 bg-white dark:bg-[#1E1916] hover:bg-[#F3EDE2] dark:hover:bg-[#2E2824] text-[#78716C] dark:text-[#FAF7F2] rounded-lg border border-[#E8DFD3] dark:border-[#382F28] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.cartItemId)}
                    className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg ml-0.5 cursor-pointer"
                    title="Hapus item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Diskon (BR-06) */}
      {cart.length > 0 && (
        <div className="p-3 bg-[#FAF7F2] dark:bg-[#26201B] rounded-xl border border-[#E8DFD3] dark:border-[#382F28] space-y-2 text-xs">
          <div className="flex justify-between items-center text-[#78716C] dark:text-[#A89F91]">
            <span className="font-semibold text-[#4A2E18] dark:text-[#D6C7B2]">
              Diskon Struk (Maks 10%)
            </span>
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-bold">
              Maks: Rp{maxDiskon.toLocaleString('id-ID')}
            </span>
          </div>
          <input
            type="number"
            min="0"
            max={maxDiskon}
            value={diskonNominal || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value || '0', 10);
              setDiskonNominal(isNaN(val) ? 0 : Math.min(val, maxDiskon));
            }}
            placeholder="Nominal diskon (Rp)..."
            className="w-full px-3 py-1.5 bg-white dark:bg-[#1E1916] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#C67C4E]"
          />
          {effectiveDiskon > 0 && (
            <input
              type="text"
              value={alasanDiskon}
              onChange={(e) => setAlasanDiskon(e.target.value)}
              placeholder="Alasan diskon (wajib min 3 karakter)..."
              className="w-full px-3 py-1.5 bg-white dark:bg-[#1E1916] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-[#C67C4E]"
            />
          )}
        </div>
      )}

      {/* Pilihan Metode Pembayaran */}
      {cart.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[#F3EDE2] dark:border-[#382F28]">
          <label className="block text-xs font-bold text-[#4A2E18] dark:text-[#FAF7F2]">
            Metode Pembayaran
          </label>
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#FAF7F2] dark:bg-[#26201B] rounded-xl border border-[#E8DFD3] dark:border-[#382F28]">
            <button
              type="button"
              onClick={() => setMetodeBayar('tunai')}
              className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                metodeBayar === 'tunai'
                  ? 'bg-white dark:bg-[#1E1916] text-[#4A2E18] dark:text-[#FAF7F2] shadow-xs border border-[#E8DFD3] dark:border-[#4A3E35]'
                  : 'text-[#78716C] dark:text-[#A89F91] hover:text-[#2C1810] dark:hover:text-[#FAF7F2]'
              }`}
            >
              <Banknote className="w-4 h-4 text-[#10B981]" />
              <span>Tunai</span>
            </button>
            <button
              type="button"
              onClick={() => setMetodeBayar('qris_manual')}
              className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                metodeBayar === 'qris_manual'
                  ? 'bg-white dark:bg-[#1E1916] text-[#4A2E18] dark:text-[#FAF7F2] shadow-xs border border-[#E8DFD3] dark:border-[#4A3E35]'
                  : 'text-[#78716C] dark:text-[#A89F91] hover:text-[#2C1810] dark:hover:text-[#FAF7F2]'
              }`}
            >
              <QrCode className="w-4 h-4 text-[#3B82F6]" />
              <span>QRIS Manual</span>
            </button>
            <button
              type="button"
              onClick={() => setMetodeBayar('qris_mayar')}
              className={`py-2 px-1 rounded-lg text-xs font-bold flex flex-col items-center justify-center gap-1 transition-all relative cursor-pointer ${
                metodeBayar === 'qris_mayar'
                  ? 'bg-[#4A2E18] dark:bg-[#C67C4E] text-white dark:text-[#12100E] shadow-sm'
                  : 'text-[#78716C] dark:text-[#A89F91] hover:text-[#2C1810] dark:hover:text-[#FAF7F2]'
              }`}
            >
              <span className="absolute -top-1.5 -right-1 text-[8px] px-1 bg-amber-500 text-white font-black rounded-full">
                AUTO
              </span>
              <QrCode className="w-4 h-4 text-amber-400" />
              <span>QRIS Mayar</span>
            </button>
          </div>
        </div>
      )}

      {/* Kalkulasi Ringkasan Biaya */}
      <div className="space-y-1.5 pt-2 border-t border-[#F3EDE2] dark:border-[#382F28] text-xs text-[#78716C] dark:text-[#A89F91]">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-semibold text-[#2C1810] dark:text-[#FAF7F2] tabular-nums">
            {formatRupiah(subtotal)}
          </span>
        </div>
        {effectiveDiskon > 0 && (
          <div className="flex justify-between text-amber-700 dark:text-amber-400 font-semibold">
            <span>Diskon</span>
            <span className="tabular-nums">-{formatRupiah(effectiveDiskon)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-black text-[#4A2E18] dark:text-[#F59E0B] pt-2 border-t border-[#F3EDE2] dark:border-[#382F28]">
          <span>Total Tagihan</span>
          <span className="tabular-nums">{formatRupiah(totalBayar)}</span>
        </div>
      </div>

      {/* Input Spesifik per Metode Bayar */}
      {cart.length > 0 && (
        <>
          {metodeBayar === 'tunai' && (
            <div className="space-y-2 pt-2 border-t border-[#F3EDE2] dark:border-[#382F28]">
              <label className="block text-xs font-bold text-[#4A2E18] dark:text-[#FAF7F2]">
                Uang Tunai Diterima (Rp)
              </label>
              <div className="relative">
                <Banknote className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="number"
                  min={totalBayar}
                  value={uangDiterima}
                  onChange={(e) => setUangDiterima(e.target.value)}
                  placeholder={`Contoh: ${totalBayar || 50000}`}
                  className="w-full pl-9 pr-3 py-2 bg-[#FAF7F2] dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-sm font-bold text-[#2C1810] dark:text-[#FAF7F2] focus:outline-none focus:ring-1 focus:ring-[#C67C4E]"
                />
              </div>

              {/* Shortcut Uang Pas & Pecahan */}
              <div className="flex gap-1.5 overflow-x-auto text-[11px] pt-1">
                <button
                  type="button"
                  onClick={() => setUangDiterima(totalBayar.toString())}
                  className="px-2.5 py-1 bg-[#FAF7F2] dark:bg-[#26201B] hover:bg-[#F3EDE2] dark:hover:bg-[#342C25] text-[#4A2E18] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-lg font-bold shrink-0 cursor-pointer"
                >
                  Uang Pas
                </button>
                {[50000, 100000, 200000].map((nominal) => (
                  <button
                    key={nominal}
                    type="button"
                    onClick={() => setUangDiterima(nominal.toString())}
                    className="px-2.5 py-1 bg-[#FAF7F2] dark:bg-[#26201B] hover:bg-[#F3EDE2] dark:hover:bg-[#342C25] text-[#4A2E18] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-lg shrink-0 cursor-pointer tabular-nums"
                  >
                    {formatRupiah(nominal)}
                  </button>
                ))}
              </div>

              {/* Status Kembalian */}
              <div className="flex justify-between items-center p-2.5 bg-[#FAF7F2] dark:bg-[#26201B] rounded-xl border border-[#E8DFD3] dark:border-[#382F28] text-xs">
                <span className="font-semibold text-[#78716C] dark:text-[#A89F91]">Kembalian:</span>
                <span
                  className={`font-mono text-sm font-bold tabular-nums ${
                    nominalDiterima < totalBayar
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {nominalDiterima < totalBayar
                    ? `Kurang ${formatRupiah(totalBayar - nominalDiterima)}`
                    : formatRupiah(kembalian)}
                </span>
              </div>
            </div>
          )}

          {metodeBayar === 'qris_manual' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>QRIS Statis Cabang</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                Kasir memverifikasi dana masuk <strong className="tabular-nums">{formatRupiah(totalBayar)}</strong> pada mutasi rekening bank/EDC cabang sebelum menyimpan.
              </p>
            </div>
          )}

          {metodeBayar === 'qris_mayar' && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>QRIS Dinamis Mayar API V2</span>
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                Invoice QRIS dibuat otomatis sebesar <strong className="tabular-nums">{formatRupiah(totalBayar)}</strong>. Stok di-reserve seketika dan transaksi otomatis lunas saat pelanggan membayar.
              </p>
            </div>
          )}
        </>
      )}

      {/* Tombol Eksekusi Checkout */}
      <button
        type="button"
        onClick={handleSimpanTransaksi}
        disabled={!canSubmit}
        className={`w-full py-3.5 text-white text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 transition-all ${
          canSubmit
            ? 'bg-[#4A2E18] hover:bg-[#382312] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] dark:text-[#12100E] cursor-pointer'
            : 'bg-neutral-300 dark:bg-[#2C241E] text-neutral-500 dark:text-[#5E554D] cursor-not-allowed shadow-none'
        }`}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />
            <span>
              {metodeBayar === 'qris_mayar' ? 'Membuat Tagihan Mayar...' : 'Menyimpan Transaksi...'}
            </span>
          </>
        ) : isOwner ? (
          <span>Mode Pratinjau Owner (Shift Khusus Kasir)</span>
        ) : !isTableValid && cart.length > 0 ? (
          <span>Pilih Nomor Meja (Dine In)</span>
        ) : (
          <span>
            {metodeBayar === 'qris_mayar'
              ? 'Buat Tagihan QRIS Mayar'
              : metodeBayar === 'qris_manual'
              ? 'Konfirmasi & Cetak Struk (QRIS)'
              : 'Bayar Tunai & Cetak Struk'}
          </span>
        )}
      </button>
    </div>
  );

  return (
    <div className="space-y-6 pb-20 lg:pb-0">
      {/* Top Banner: Status Shift Kasir Real-time */}
      {isOwner ? (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 rounded-xl">
              <Shield className="w-5 h-5 text-amber-700 dark:text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-amber-950 dark:text-amber-200 flex items-center gap-2">
                <span>Mode Pratinjau Kasir POS (Owner)</span>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200">
                  Manajerial
                </span>
              </h2>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                Owner tidak terikat shift kasir. Anda dapat meninjau katalog produk, tata letak meja, dan konfigurasi pesanan. Transaksi kasir diproses oleh Kasir dengan shift aktif.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/laporan"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#4A2E18] hover:bg-[#382312] text-white text-xs font-semibold rounded-xl shadow-xs transition-all"
            >
              <span>Laporan Bisnis &rarr;</span>
            </a>
          </div>
        </div>
      ) : !isShiftOpen ? (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-red-900 dark:text-red-200">
                Shift Belum Dibuka
              </h2>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                Buka shift dengan mengisi kas awal sebelum mulai melayani dan memproses transaksi penjualan.
              </p>
            </div>
          </div>
          <a
            href="/shift-saya"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all shrink-0 cursor-pointer"
          >
            <span>Buka Shift Sekarang</span>
          </a>
        </div>
      ) : (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-emerald-950 dark:text-emerald-200 flex items-center gap-2">
                <span>Shift Aktif: {cabangNama}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </h2>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-300">
                Kasir: <strong>{kasirNama}</strong> &bull; Kas Awal: <span className="tabular-nums font-semibold">{formatRupiah(shiftAktif.kas_awal)}</span>
              </p>
            </div>
          </div>
          <a
            href="/shift-saya"
            className="text-xs text-emerald-900 dark:text-emerald-300 font-bold hover:underline shrink-0"
          >
            Lihat Rekonsiliasi &rarr;
          </a>
        </div>
      )}

      {/* Toast Popup Validasi Pembayaran Tunai Kurang */}
      {paymentShortageToast?.isOpen && (
        <div
          role="alert"
          aria-live="assertive"
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-4 duration-200"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-50 dark:bg-[#2A1715] border border-red-200 dark:border-red-800/80 rounded-2xl shadow-lg text-red-700 dark:text-red-300">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400" />
              <span className="text-xs sm:text-sm font-semibold">{paymentShortageToast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setPaymentShortageToast((prev) => (prev ? { ...prev, isOpen: false } : null))}
              className="p-1 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors cursor-pointer"
              aria-label="Tutup notifikasi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Pesan Error Sistem */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* POS Grid: Katalog Produk (Kiri) & Keranjang Checkout (Kanan) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Kolom Kiri: Katalog Produk */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Quick Action Bar: Denah Kursi/Meja & Antrean Pesanan KDS */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white dark:bg-[#1E1916] p-3 rounded-2xl border border-[#E8DFD3] dark:border-[#382F28] shadow-xs">
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleOpenTableModal}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF7F2] dark:bg-[#28211B] text-[#4A2E18] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] hover:bg-[#EAE0D5] transition-all cursor-pointer shadow-2xs flex-1 sm:flex-initial"
              >
                <LayoutGrid className="w-4 h-4 text-[#C67C4E]" />
                <span>Denah Meja</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
                  {mejaList.filter((m) => m.status === 'tersedia').length} Kosong
                </span>
              </button>

              <button
                type="button"
                onClick={() => setIsAntreanModalOpen(true)}
                className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-[#FAF7F2] dark:bg-[#28211B] text-[#4A2E18] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] hover:bg-[#EAE0D5] transition-all cursor-pointer shadow-2xs flex-1 sm:flex-initial"
              >
                <ChefHat className="w-4 h-4 text-[#C67C4E]" />
                <span>Antrean</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
                  {antreanList.length} Order
                </span>
              </button>
            </div>

            <div className="text-[11px] text-[#78716C] dark:text-[#A89F91] hidden sm:block">
              Multi-Cabang POS &bull; <strong>{cabangNama}</strong>
            </div>
          </div>

          {/* Search & Kategori Bar */}
          <div className="bg-white dark:bg-[#1E1916] p-4 rounded-2xl border border-[#E8DFD3] dark:border-[#382F28] shadow-xs space-y-3 transition-colors">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#78716C]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari kopi, roti, pastry, snack (SKU atau Nama)..."
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] dark:bg-[#14110F] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#C67C4E] placeholder:text-[#A8A29E] dark:placeholder:text-[#665D54]"
              />
            </div>

            {/* Filter Kategori */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              {[
                { id: 'semua', label: 'Semua Menu' },
                { id: 'kopi', label: 'Kopi' },
                { id: 'non_kopi', label: 'Non-Kopi' },
                { id: 'roti', label: 'Roti & Pastry' },
                { id: 'snack', label: 'Snack' },
                { id: 'kemasan', label: 'Kemasan / Beans' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1.5 rounded-xl shrink-0 font-bold transition-all cursor-pointer ${
                    selectedCategory === cat.id
                      ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E] dark:text-[#12100E] shadow-xs'
                      : 'bg-[#FAF7F2] dark:bg-[#14110F] text-[#78716C] dark:text-[#A89F91] border border-[#E8DFD3] dark:border-[#382F28] hover:bg-[#F3EDE2] dark:hover:bg-[#28211B]'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid Kartu Produk dengan Placeholder Lokal Berdasarkan Kategori */}
          {filteredProducts.length === 0 ? (
            <div className="bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-2xl p-10 text-center text-[#78716C] dark:text-[#A89F91] space-y-2">
              <Coffee className="w-8 h-8 mx-auto text-[#A8A29E] dark:text-[#78716C]" />
              <p className="text-xs font-semibold">Tidak ada produk yang cocok dengan pencarian.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[360px]:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-3.5">
              {filteredProducts.map((prod) => {
                const isOutOfStock =
                  prod.lacak_stok && (prod.stok_tersedia === null || prod.stok_tersedia <= 0);
                const isCriticalStock =
                  prod.lacak_stok && prod.stok_tersedia !== null && prod.stok_tersedia > 0 && prod.stok_tersedia <= 3;
                const cartQty = cart
                  .filter((it) => it.produk.id === prod.id)
                  .reduce((sum, it) => sum + it.jumlah, 0);

                return (
                  <div
                    key={prod.id}
                    onClick={() => {
                      if (!isOutOfStock && isShiftOpen) {
                        handleProductSelect(prod);
                      }
                    }}
                    className={`bg-white dark:bg-[#1E1916] border rounded-2xl p-3 flex flex-col justify-between shadow-xs transition-all hover:shadow-md cursor-pointer min-w-0 box-border overflow-hidden ${
                      isOutOfStock
                        ? 'border-neutral-200 dark:border-neutral-800 opacity-60 bg-neutral-50 dark:bg-neutral-900/30 cursor-not-allowed'
                        : 'border-[#E8DFD3] dark:border-[#382F28] hover:border-[#C67C4E]'
                    }`}
                  >
                    <div className="min-w-0">
                      {/* Product Visual Card with Distinct PNG */}
                      <ProductCardImage
                        sku={prod.sku}
                        kategori={prod.kategori}
                        nama={prod.nama}
                        className="h-28 sm:h-32 mb-2.5 w-full rounded-xl overflow-hidden"
                        showCategoryBadge={false}
                      />

                      {/* Header SKU, Kategori, & Stock Badge */}
                      <div className="flex flex-wrap items-center justify-between gap-1.5 mb-1.5 min-w-0 w-full">
                        <div className="flex items-center gap-1 min-w-0 flex-wrap">
                          <span className="text-[10px] font-mono text-[#78716C] dark:text-[#A89F91] font-bold tracking-tight shrink-0">
                            {prod.sku}
                          </span>
                          <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#28211B] text-[#78716C] dark:text-[#A89F91] border border-[#E8DFD3] dark:border-[#382F28] shrink-0">
                            {prod.kategori.replace('_', ' ')}
                          </span>
                        </div>

                        {prod.lacak_stok ? (
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold uppercase tabular-nums shrink-0 ml-auto ${
                              isOutOfStock
                                ? 'bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900'
                                : isCriticalStock
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                            }`}
                          >
                            Stok: {prod.stok_tersedia ?? 0}
                          </span>
                        ) : (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md font-bold bg-[#FAF7F2] dark:bg-[#28211B] text-[#78716C] dark:text-[#A89F91] border border-[#E8DFD3] dark:border-[#382F28] shrink-0 ml-auto">
                            Racikan
                          </span>
                        )}
                      </div>

                      {/* Nama Produk dengan tinggi area konsisten */}
                      <h3 className="text-xs sm:text-sm font-bold text-[#2C1810] dark:text-[#FAF7F2] line-clamp-2 leading-snug min-h-[2.25rem] sm:min-h-[2.5rem]">
                        {prod.nama}
                      </h3>
                    </div>

                    {/* Harga & Tombol Aksi */}
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-[#F3EDE2] dark:border-[#2C241E] min-w-0">
                      <span className="text-xs sm:text-sm font-extrabold text-[#4A2E18] dark:text-[#F59E0B] tabular-nums shrink-0">
                        {formatRupiah(prod.harga_jual)}
                      </span>

                      {cartQty > 0 ? (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1 bg-[#FAF7F2] dark:bg-[#26201B] px-1.5 py-0.5 rounded-lg border border-[#E8DFD3] dark:border-[#382F28] shrink-0 ml-auto"
                        >
                          <span className="text-center font-bold text-xs text-[#4A2E18] dark:text-[#F59E0B] tabular-nums">
                            {cartQty}x
                          </span>
                          <button
                            type="button"
                            onClick={() => handleProductSelect(prod)}
                            disabled={isOutOfStock}
                            title="Tambah racikan baru / kustomisasi"
                            className="p-1 hover:bg-white dark:hover:bg-[#1E1916] text-[#78716C] dark:text-[#FAF7F2] rounded cursor-pointer disabled:opacity-30"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductSelect(prod);
                          }}
                          disabled={isOutOfStock || !isShiftOpen}
                          title={
                            !isShiftOpen
                              ? 'Buka shift terlebih dahulu'
                              : isOutOfStock
                              ? 'Stok habis'
                              : 'Kustomisasi & tambah ke keranjang'
                          }
                          className="p-1.5 sm:p-2 rounded-xl bg-[#FAF7F2] dark:bg-[#26201B] hover:bg-[#4A2E18] hover:text-white dark:hover:bg-[#C67C4E] dark:hover:text-[#12100E] text-[#4A2E18] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0 ml-auto"
                        >
                          <ShoppingCart className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Kolom Kanan (Desktop lg+): Keranjang & Checkout Panel */}
        <div className="hidden lg:block lg:col-span-5 xl:col-span-4 bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-3xl p-5 shadow-sm lg:sticky lg:top-20 transition-colors">
          {cartCheckoutContent}
        </div>
      </div>

      {/* Floating Bottom Bar (Mobile & Tablet < lg) */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-4 inset-x-4 z-40">
          <button
            type="button"
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-[#4A2E18] dark:bg-[#C67C4E] text-white dark:text-[#12100E] p-3.5 rounded-2xl shadow-xl border border-[#6B4423]/50 flex items-center justify-between cursor-pointer animate-in fade-in slide-in-from-bottom-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 dark:bg-black/20 flex items-center justify-center font-bold text-sm">
                {totalCartCount}
              </div>
              <div className="text-left">
                <p className="text-[11px] opacity-80 uppercase tracking-wider font-semibold">
                  Keranjang Kasir
                </p>
                <p className="text-sm font-extrabold">
                  Rp{totalBayar.toLocaleString('id-ID')}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 font-bold text-xs bg-white/20 dark:bg-black/20 px-3 py-1.5 rounded-xl">
              <span>Checkout</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </button>
        </div>
      )}

      {/* Mobile Drawer Slide-over Keranjang (Mobile & Tablet < lg) */}
      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setIsMobileCartOpen(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-md w-full bg-white dark:bg-[#1E1916] shadow-2xl p-5 flex flex-col z-50 border-l border-[#E8DFD3] dark:border-[#382F28] overflow-y-auto">
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setIsMobileCartOpen(false)}
                className="p-2 rounded-xl text-[#78716C] dark:text-[#A89F91] hover:bg-[#FAF7F2] dark:hover:bg-[#28211B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {cartCheckoutContent}
          </div>
        </div>
      )}

      {/* Modal QRIS Dinamis Mayar */}
      {mayarModalData && (
        <QrisMayarModal
          transaksiId={mayarModalData.transaksi_id!}
          nomorStruk={mayarModalData.nomor_struk!}
          nomorAntrean={mayarModalData.nomor_antrean}
          jenisPesanan={mayarModalData.jenis_pesanan || jenisPesanan}
          nomorMeja={mayarModalData.nomor_meja ?? selectedMeja}
          namaPelanggan={mayarModalData.nama_pelanggan || namaPelanggan.trim() || undefined}
          total={mayarModalData.total || totalBayar}
          paymentUrl={mayarModalData.payment_url || ''}
          expiredAt={mayarModalData.expired_at || ''}
          onViewTracking={() => {
            setIsAntreanModalOpen(true);
            refreshAntreanDanMeja();
          }}
          onSuccess={(verifiedData) => {
            const isDineIn =
              (verifiedData?.jenis_pesanan || '').toUpperCase() === 'DINE_IN' ||
              (mayarModalData.jenis_pesanan || '').toUpperCase() === 'DINE_IN' ||
              jenisPesanan === 'DINE_IN' ||
              !!(verifiedData?.nomor_meja ?? mayarModalData.nomor_meja ?? selectedMeja);
            const finalJenis: JenisPesanan = isDineIn ? 'DINE_IN' : 'TAKEAWAY';
            const finalMeja = isDineIn
              ? (verifiedData?.nomor_meja ?? mayarModalData.nomor_meja ?? selectedMeja)
              : null;
            const finalAntrean = (verifiedData?.nomor_antrean && verifiedData.nomor_antrean !== '-')
              ? verifiedData.nomor_antrean
              : (mayarModalData.nomor_antrean && mayarModalData.nomor_antrean !== '-')
              ? mayarModalData.nomor_antrean
              : 'A-001';
            const finalPelanggan =
              (verifiedData?.nama_pelanggan && verifiedData.nama_pelanggan !== 'Pelanggan Umum')
                ? verifiedData.nama_pelanggan
                : (mayarModalData.nama_pelanggan && mayarModalData.nama_pelanggan !== 'Pelanggan Umum')
                ? mayarModalData.nama_pelanggan
                : (namaPelanggan.trim() || verifiedData?.nama_pelanggan || mayarModalData.nama_pelanggan || 'Pelanggan Umum');

            const finalStruk: SimpanTransaksiResult = {
              success: true,
              transaksi_id: mayarModalData.transaksi_id,
              nomor_struk: mayarModalData.nomor_struk,
              nomor_antrean: finalAntrean,
              jenis_pesanan: finalJenis,
              nomor_meja: finalMeja,
              nama_pelanggan: finalPelanggan,
              catatan_pesanan: catatanPesanan.trim() || undefined,
              cabang_nama: mayarModalData.cabang_nama || cabangNama,
              cabang_alamat: cabangAlamat,
              waktu_wib: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
              subtotal: mayarModalData.subtotal || subtotal,
              diskon: effectiveDiskon,
              alasan_diskon: alasanDiskon,
              total: mayarModalData.total || totalBayar,
              metode_bayar: 'qris',
              uang_diterima: mayarModalData.total || totalBayar,
              kembalian: 0,
              items: (mayarModalData.items && mayarModalData.items.length > 0)
                ? mayarModalData.items
                : cart.map((it) => ({
                    nama: formatItemDisplayName(it.produk.nama, it.options),
                    harga: it.harga_satuan ?? getEffectiveItemPrice(it.produk, it.options),
                    jumlah: it.jumlah,
                    subtotal: (it.harga_satuan ?? getEffectiveItemPrice(it.produk, it.options)) * it.jumlah,
                  })),
            };
            setMayarModalData(null);
            setStrukResult(finalStruk);
            setCart([]);
            setDiskonNominal(0);
            setAlasanDiskon('');
            setUangDiterima('');
            setSelectedMeja(null);
            setNamaPelanggan('');
            setCatatanPesanan('');
            refreshAntreanDanMeja();
          }}
          onCancel={() => {
            setMayarModalData(null);
          }}
        />
      )}

      {/* Modal Pemilihan Meja Touchscreen */}
      <TableSelectorModal
        isOpen={isTableModalOpen}
        onClose={() => setIsTableModalOpen(false)}
        mejaList={mejaList}
        selectedMeja={selectedMeja}
        onSelectMeja={(nomorMeja: string) => setSelectedMeja(nomorMeja)}
        onCleanMeja={handleCleanMeja}
      />

      {/* Modal Ringkasan Antrean Pesanan Kasir POS */}
      <KasirAntreanModal
        isOpen={isAntreanModalOpen}
        onClose={() => setIsAntreanModalOpen(false)}
        antreanList={antreanList}
        onRefresh={handleRefreshAntrean}
        isRefreshing={isRefreshingAntrean}
      />

      {/* Modal Thermal Struk (58mm) dengan Nomor Antrean & Tipe Pesanan */}
      {strukResult && strukResult.nomor_struk && (
        <StrukModal
          nomorStruk={strukResult.nomor_struk}
          nomorAntrean={strukResult.nomor_antrean}
          jenisPesanan={strukResult.jenis_pesanan}
          nomorMeja={strukResult.nomor_meja}
          namaPelanggan={strukResult.nama_pelanggan}
          catatanPesanan={strukResult.catatan_pesanan}
          cabangNama={strukResult.cabang_nama || cabangNama}
          cabangAlamat={strukResult.cabang_alamat || cabangAlamat}
          waktuWib={strukResult.waktu_wib || ''}
          kasirNama={kasirNama}
          items={strukResult.items || []}
          subtotal={strukResult.subtotal || 0}
          diskon={strukResult.diskon || 0}
          alasanDiskon={strukResult.alasan_diskon}
          total={strukResult.total || 0}
          metodeBayar={strukResult.metode_bayar || 'tunai'}
          uangDiterima={strukResult.uang_diterima || 0}
          kembalian={strukResult.kembalian || 0}
          onClose={() => setStrukResult(null)}
        />
      )}

      {/* Modal Kustomisasi Pesanan (Minuman Panas/Dingin, Sugar, Ice, Penyajian, Catatan) */}
      {customModal.isOpen && customModal.produk && (
        <ProductCustomModal
          key={customModal.editingCartItemId || customModal.produk.id}
          produk={customModal.produk}
          isOpen={customModal.isOpen}
          initialOptions={customModal.initialOptions}
          initialJumlah={customModal.initialJumlah}
          customerName={namaPelanggan}
          onCustomerNameChange={(name) => setNamaPelanggan(name)}
          isEditing={!!customModal.editingCartItemId}
          onClose={() =>
            setCustomModal((prev) => ({ ...prev, isOpen: false, editingCartItemId: null }))
          }
          onConfirm={handleConfirmCustomOrder}
        />
      )}
    </div>
  );
}
