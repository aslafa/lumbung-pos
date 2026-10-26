'use client';

import { useState, useTransition } from 'react';
import {
  Search,
  ArrowUpDown,
  AlertTriangle,
  PackageX,
  CheckCircle2,
  Package,
  X,
  Loader2,
  Boxes,
  Store,
  Plus
} from 'lucide-react';
import { sesuaikanStokAction, SesuaikanStokResult } from '@/app/actions/supervisi';

export interface StokItem {
  id: string;
  cabang_id: string;
  cabang_nama: string;
  produk_id: string;
  sku: string;
  nama: string;
  kategori: string;
  jumlah: number;
  stok_minimum: number;
  status: 'habis' | 'kritis' | 'menipis' | 'aman';
}

interface CabangOption {
  id: string;
  nama: string;
  kode: string;
}

interface StokClientProps {
  initialStok: StokItem[];
  cabangList: CabangOption[];
  userRole: string;
  userCabangId?: string | null;
  userCabangNama?: string;
}

export function StokClient({
  initialStok,
  cabangList,
  userRole,
  userCabangId,
  userCabangNama,
}: StokClientProps) {
  const [stokList, setStokList] = useState<StokItem[]>(initialStok);
  const [search, setSearch] = useState('');
  const [selectedKategori, setSelectedKategori] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCabang, setSelectedCabang] = useState<string>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalItem, setModalItem] = useState<StokItem | null>(null);
  const [modalCabangId, setModalCabangId] = useState<string>(userCabangId || (cabangList[0]?.id || ''));
  const [modalProdukId, setModalProdukId] = useState<string>('');
  const [modalJumlahBaru, setModalJumlahBaru] = useState<number>(0);
  const [modalJenis, setModalJenis] = useState<'barang_masuk' | 'barang_rusak' | 'stock_opname'>('barang_masuk');
  const [modalAlasan, setModalAlasan] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwner = userRole === 'owner';

  // Stats
  const totalItem = stokList.length;
  const habisCount = stokList.filter((s) => s.status === 'habis').length;
  const kritisCount = stokList.filter((s) => s.status === 'kritis').length;
  const amanCount = stokList.filter((s) => s.status === 'aman').length;

  // Filter
  const filteredStok = stokList.filter((item) => {
    const matchSearch =
      item.nama.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());

    const matchKategori = selectedKategori === 'all' || item.kategori.toLowerCase() === selectedKategori.toLowerCase();
    const matchStatus = selectedStatus === 'all' || item.status === selectedStatus;
    const matchCabang = selectedCabang === 'all' || item.cabang_id === selectedCabang;

    return matchSearch && matchKategori && matchStatus && matchCabang;
  });

  const openModal = (
    item?: StokItem,
    initialJenis: 'barang_masuk' | 'barang_rusak' | 'stock_opname' = 'barang_masuk'
  ) => {
    setModalError(null);
    setModalSuccess(null);
    if (item) {
      setModalItem(item);
      setModalCabangId(item.cabang_id);
      setModalProdukId(item.produk_id);
      setModalJumlahBaru(item.jumlah);
    } else {
      setModalItem(null);
      setModalCabangId(userCabangId || (cabangList[0]?.id || ''));
      setModalProdukId(stokList[0]?.produk_id || '');
      setModalJumlahBaru(stokList[0]?.jumlah || 0);
    }
    setModalJenis(initialJenis);
    setModalAlasan('');
    setIsModalOpen(true);
  };

  const handleProductSelectChange = (pId: string) => {
    setModalProdukId(pId);
    const found = stokList.find((s) => s.produk_id === pId && (isOwner ? s.cabang_id === modalCabangId : true));
    if (found) {
      setModalJumlahBaru(found.jumlah);
    }
  };

  const handleSubmitPenyesuaian = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    if (!modalCabangId || !modalProdukId) {
      setModalError('Cabang dan produk wajib dipilih.');
      return;
    }

    if (modalAlasan.trim().length < 5) {
      setModalError('Alasan penyesuaian wajib diisi minimal 5 karakter.');
      return;
    }

    startTransition(async () => {
      const res: SesuaikanStokResult = await sesuaikanStokAction(
        modalCabangId,
        modalProdukId,
        modalJumlahBaru,
        modalJenis,
        modalAlasan
      );

      if (!res.success) {
        setModalError(res.error || 'Gagal menyesuaikan stok.');
      } else {
        setModalSuccess(res.pesan || 'Stok berhasil diperbarui.');
        // Update local state
        setStokList((prev) =>
          prev.map((s) => {
            if (s.cabang_id === modalCabangId && s.produk_id === modalProdukId) {
              const newQty = res.jumlah_baru ?? modalJumlahBaru;
              let newStatus: 'habis' | 'kritis' | 'menipis' | 'aman' = 'aman';
              if (newQty === 0) newStatus = 'habis';
              else if (newQty < s.stok_minimum) newStatus = 'kritis';
              else if (newQty === s.stok_minimum) newStatus = 'menipis';

              return { ...s, jumlah: newQty, status: newStatus };
            }
            return s;
          })
        );
        setTimeout(() => {
          setIsModalOpen(false);
          setModalSuccess(null);
        }, 1200);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E8DFD3] dark:border-[#2C2420] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#C67C4E]" />
            <span>Manajemen Stok Cabang</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E] mt-1">
            {isOwner
              ? 'Pengawasan stok fisik multi-cabang dan pencatatan penyesuaian opname.'
              : `Inventaris dan pencatatan stok fisik ${userCabangNama || 'Cabang'}.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openModal(undefined, 'barang_masuk')}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Barang Masuk (Restock)</span>
          </button>
          <button
            type="button"
            onClick={() => openModal()}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-[#4A2E18] hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <ArrowUpDown className="w-4 h-4 text-[#F59E0B] dark:text-white" />
            <span>Penyesuaian Stok</span>
          </button>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Total SKU Terlacak</span>
            <Package className="w-4 h-4 text-[#C67C4E]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#2C1810] dark:text-[#F5EBE1]">
            {totalItem}
          </div>
          <div className="text-[11px] text-[#A8A29E] mt-1">Item aktif berstok</div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Stok Aman</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
            {amanCount}
          </div>
          <div className="text-[11px] text-[#A8A29E] mt-1">Di atas batas minimum</div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Stok Kritis / Menipis</span>
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {kritisCount}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Perlu restock segera</div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Stok Habis (0)</span>
            <PackageX className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {habisCount}
          </div>
          <div className="text-[11px] text-rose-600 dark:text-rose-400 mt-1">Transaksi diblokir sistem</div>
        </div>
      </div>

      {/* Warning Box jika ada stok habis/kritis */}
      {(habisCount > 0 || kritisCount > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm">
            <p className="font-bold text-amber-900 dark:text-amber-300">Peringatan: Stok Rendah Terdeteksi</p>
            <p className="text-amber-800 dark:text-amber-400/90 mt-0.5 leading-relaxed">
              Terdapat <strong>{habisCount + kritisCount} produk</strong> dengan kuantitas di bawah batas minimum atau habis. Kasir tidak dapat menambahkan produk habis ke keranjang pesanan. Segera koordinasikan pengiriman bahan dari dapur pusat.
            </p>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
            <input
              type="text"
              placeholder="Cari SKU atau nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] placeholder-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
            />
          </div>

          {/* Cabang Filter (hanya untuk Owner) */}
          {isOwner && cabangList.length > 0 && (
            <div className="w-full md:w-56">
              <select
                value={selectedCabang}
                onChange={(e) => setSelectedCabang(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
              >
                <option value="all">Semua Cabang</option>
                {cabangList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama} ({c.kode})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Kategori Filter */}
          <div className="w-full md:w-44">
            <select
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value)}
              className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
            >
              <option value="all">Semua Kategori</option>
              <option value="kopi">Kopi</option>
              <option value="non_kopi">Non-Kopi</option>
              <option value="roti">Roti & Pastry</option>
              <option value="snack">Snack</option>
              <option value="kemasan">Kemasan / Retail</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-full md:w-44">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
            >
              <option value="all">Semua Status</option>
              <option value="aman">Aman</option>
              <option value="menipis">Menipis</option>
              <option value="kritis">Kritis</option>
              <option value="habis">Habis (0)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl shadow-xs overflow-hidden">
        {filteredStok.length === 0 ? (
          <div className="py-16 text-center text-[#78716C] dark:text-[#A8A29E] space-y-3">
            <PackageX className="w-10 h-10 mx-auto text-[#A8A29E] dark:text-[#78716C]" />
            <p className="text-sm font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
              Tidak ada data stok yang cocok
            </p>
            <p className="text-xs">Ubah kata kunci pencarian atau filter yang dipilih.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#FAF7F2] dark:bg-[#14110F] border-b border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[90px]">SKU</th>
                  <th className="px-4 py-3.5">Nama Produk</th>
                  {isOwner && <th className="px-4 py-3.5">Cabang</th>}
                  <th className="px-4 py-3.5">Kategori</th>
                  <th className="px-4 py-3.5 text-right">Stok Fisik</th>
                  <th className="px-4 py-3.5 text-right">Batas Min</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EDE2] dark:divide-[#2C2420] text-[#2C1810] dark:text-[#F5EBE1]">
                {filteredStok.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-[#FAF7F2]/70 dark:hover:bg-[#14110F]/50 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold whitespace-nowrap min-w-[90px] text-[#4A2E18] dark:text-[#C67C4E]">
                      {item.sku}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                      {item.nama}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3.5 text-[#78716C] dark:text-[#A8A29E]">
                        <span className="inline-flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-[#C67C4E]" />
                          <span>{item.cabang_nama}</span>
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3.5 capitalize text-[#78716C] dark:text-[#A8A29E]">
                      {item.kategori.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-sm">
                      <span
                        className={
                          item.status === 'habis'
                            ? 'text-rose-600 dark:text-rose-400'
                            : item.status === 'kritis'
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-[#2C1810] dark:text-[#F5EBE1]'
                        }
                      >
                        {item.jumlah} pcs
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-[#78716C] dark:text-[#A8A29E] font-mono">
                      {item.stok_minimum} pcs
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                          item.status === 'habis'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900'
                            : item.status === 'kritis' || item.status === 'menipis'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => openModal(item)}
                          className="px-3 py-1.5 text-xs font-semibold text-[#4A2E18] dark:text-[#C67C4E] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] rounded-xl border border-[#E8DFD3] dark:border-[#2C2420] transition-colors cursor-pointer shadow-2xs"
                        >
                          Sesuaikan
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Stock Adjustment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Penyesuaian Stok Fisik
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-xs">
                {modalSuccess}
              </div>
            )}

            <form onSubmit={handleSubmitPenyesuaian} className="space-y-4 text-xs sm:text-sm">
              {/* Pilih Cabang jika Owner */}
              {isOwner ? (
                <div>
                  <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                    Cabang
                  </label>
                  <select
                    value={modalCabangId}
                    onChange={(e) => setModalCabangId(e.target.value)}
                    disabled={Boolean(modalItem)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] disabled:opacity-60"
                  >
                    {cabangList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama} ({c.kode})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                    Cabang
                  </label>
                  <input
                    type="text"
                    disabled
                    value={userCabangNama || 'Cabang Saya'}
                    className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] opacity-70"
                  />
                </div>
              )}

              {/* Pilih Produk */}
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Produk
                </label>
                {modalItem ? (
                  <input
                    type="text"
                    disabled
                    value={`${modalItem.sku} - ${modalItem.nama}`}
                    className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] opacity-70"
                  />
                ) : (
                  <select
                    value={modalProdukId}
                    onChange={(e) => handleProductSelectChange(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1]"
                  >
                    {stokList.map((s) => (
                      <option key={`${s.cabang_id}-${s.produk_id}`} value={s.produk_id}>
                        {s.sku} - {s.nama} ({s.cabang_nama})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Jenis Penyesuaian */}
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Jenis Penyesuaian
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setModalJenis('barang_masuk')}
                    className={`py-2 px-3 text-center rounded-xl border font-semibold transition-colors cursor-pointer ${
                      modalJenis === 'barang_masuk'
                        ? 'bg-[#4A2E18] text-white border-[#4A2E18] dark:bg-[#C67C4E] dark:border-[#C67C4E]'
                        : 'bg-[#FAF7F2] dark:bg-[#14110F] border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E]'
                    }`}
                  >
                    Masuk
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalJenis('barang_rusak')}
                    className={`py-2 px-3 text-center rounded-xl border font-semibold transition-colors cursor-pointer ${
                      modalJenis === 'barang_rusak'
                        ? 'bg-[#4A2E18] text-white border-[#4A2E18] dark:bg-[#C67C4E] dark:border-[#C67C4E]'
                        : 'bg-[#FAF7F2] dark:bg-[#14110F] border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E]'
                    }`}
                  >
                    Rusak / Exp
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalJenis('stock_opname')}
                    className={`py-2 px-3 text-center rounded-xl border font-semibold transition-colors cursor-pointer ${
                      modalJenis === 'stock_opname'
                        ? 'bg-[#4A2E18] text-white border-[#4A2E18] dark:bg-[#C67C4E] dark:border-[#C67C4E]'
                        : 'bg-[#FAF7F2] dark:bg-[#14110F] border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E]'
                    }`}
                  >
                    Opname Fisik
                  </button>
                </div>
              </div>

              {/* Jumlah Stok Baru */}
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Jumlah Stok Fisik Akhir (pcs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={modalJumlahBaru}
                  onChange={(e) => setModalJumlahBaru(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] font-mono font-bold text-base"
                />
                <p className="text-[11px] text-[#A8A29E] mt-1">
                  Isikan angka stok aktual setelah penyesuaian/penerimaan barang.
                </p>
              </div>

              {/* Alasan / Catatan */}
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Alasan Penyesuaian (Wajib Min. 5 Karakter)
                </label>
                <textarea
                  rows={3}
                  required
                  value={modalAlasan}
                  onChange={(e) => setModalAlasan(e.target.value)}
                  placeholder="Contoh: Penerimaan 50 pack biji kopi arabika dari Dapur Pusat"
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isPending}
                  className="px-4 py-2 border border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#4A2E18] hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
