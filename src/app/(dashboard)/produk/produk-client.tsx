'use client';

import { useState, useTransition } from 'react';
import {
  Package,
  Search,
  Plus,
  LayoutGrid,
  List,
  Edit3,
  CheckCircle2,
  X,
  Loader2,
  Coffee,
  Croissant,
  Layers,
  Lock
} from 'lucide-react';
import { ProductCardImage } from '@/components/brand/ProductCardImage';
import { formatRupiah } from '@/lib/utils/format';
import { tambahProdukAction, ubahProdukAction, ActionResult } from '@/app/actions/pengaturan';

export interface ProdukItem {
  id: string;
  sku: string;
  nama: string;
  kategori: string;
  harga_jual: number;
  lacak_stok: boolean;
  aktif: boolean;
  harga_modal?: number | null;
}

interface ProdukClientProps {
  initialProduk: ProdukItem[];
  userRole: string;
}

export function ProdukClient({ initialProduk, userRole }: ProdukClientProps) {
  const [produkList, setProdukList] = useState<ProdukItem[]>(initialProduk);
  const [search, setSearch] = useState('');
  const [selectedKategori, setSelectedKategori] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  // Modal Tambah Produk State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newSku, setNewSku] = useState('');
  const [newNama, setNewNama] = useState('');
  const [newKategori, setNewKategori] = useState<'kopi' | 'non_kopi' | 'roti' | 'snack' | 'kemasan'>('kopi');
  const [newHargaJual, setNewHargaJual] = useState<number>(20000);
  const [newHargaModal, setNewHargaModal] = useState<number>(10000);
  const [newLacakStok, setNewLacakStok] = useState(true);

  // Modal Edit Produk State
  const [editingItem, setEditingItem] = useState<ProdukItem | null>(null);
  const [editHargaJual, setEditHargaJual] = useState<number>(0);
  const [editAktif, setEditAktif] = useState<boolean>(true);

  // Feedback State
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwner = userRole === 'owner';

  // Stats
  const totalProduk = produkList.length;
  const minumanCount = produkList.filter((p) => p.kategori === 'kopi' || p.kategori === 'non_kopi').length;
  const makananCount = produkList.filter((p) => p.kategori === 'roti' || p.kategori === 'snack').length;
  const lacakStokCount = produkList.filter((p) => p.lacak_stok).length;

  const filteredProduk = produkList.filter((p) => {
    const matchSearch =
      p.nama.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase());

    const matchKategori = selectedKategori === 'all' || p.kategori === selectedKategori;
    const matchStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'aktif'
        ? p.aktif
        : !p.aktif;

    return matchSearch && matchKategori && matchStatus;
  });

  const handleOpenAddModal = () => {
    setNewSku('');
    setNewNama('');
    setNewKategori('kopi');
    setNewHargaJual(25000);
    setNewHargaModal(12000);
    setNewLacakStok(true);
    setModalError(null);
    setModalSuccess(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (p: ProdukItem) => {
    setEditingItem(p);
    setEditHargaJual(p.harga_jual);
    setEditAktif(p.aktif);
    setModalError(null);
    setModalSuccess(null);
  };

  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    setModalSuccess(null);

    startTransition(async () => {
      const res: ActionResult = await tambahProdukAction({
        sku: newSku,
        nama: newNama,
        kategori: newKategori,
        hargaJual: newHargaJual,
        hargaModal: newHargaModal,
        lacakStok: newLacakStok,
      });

      if (!res.success) {
        setModalError(res.error || 'Gagal menambahkan produk baru.');
      } else {
        setModalSuccess(res.pesan || 'Produk berhasil ditambahkan.');
        // Add item to local state
        const newItem: ProdukItem = {
          id: `temp-${Date.now()}`,
          sku: newSku.toUpperCase(),
          nama: newNama,
          kategori: newKategori,
          harga_jual: newHargaJual,
          harga_modal: isOwner ? newHargaModal : undefined,
          lacak_stok: newLacakStok,
          aktif: true,
        };
        setProdukList((prev) => [newItem, ...prev]);
        setTimeout(() => {
          setIsAddModalOpen(false);
          setModalSuccess(null);
        }, 1200);
      }
    });
  };

  const handleUpdateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setModalError(null);
    setModalSuccess(null);

    startTransition(async () => {
      const res: ActionResult = await ubahProdukAction({
        produkId: editingItem.id,
        hargaJualBaru: editHargaJual,
        aktifBaru: editAktif,
      });

      if (!res.success) {
        setModalError(res.error || 'Gagal memperbarui produk.');
      } else {
        setModalSuccess(res.pesan || 'Produk berhasil diperbarui.');
        setProdukList((prev) =>
          prev.map((p) =>
            p.id === editingItem.id
              ? { ...p, harga_jual: editHargaJual, aktif: editAktif }
              : p
          )
        );
        setTimeout(() => {
          setEditingItem(null);
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
            <Package className="w-6 h-6 text-[#C67C4E]" />
            <span>Katalog Master Produk</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E] mt-1">
            {isOwner
              ? 'Kelola master produk, penetapan harga jual, dan pengawasan modal rahasia.'
              : 'Daftar katalog produk aktif Lumbung Kopi dan Roti (Hanya Lihat)'}
          </p>
        </div>

        {isOwner ? (
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#4A2E18] hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#F59E0B] dark:text-white" />
            <span>Tambah Produk Baru</span>
          </button>
        ) : (
          <a
            href="/stok"
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Penerimaan Barang Masuk</span>
          </a>
        )}
      </div>

      {!isOwner && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3 text-xs">
          <Lock className="w-4 h-4 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-bold text-amber-900 dark:text-amber-300">
              Hak Akses Master Katalog
            </span>
            <p className="text-amber-800/90 dark:text-amber-400/90 leading-relaxed">
              Kepala Toko memiliki hak akses untuk memantau katalog produk tanpa harga modal rahasia. Penambahan produk katalog baru dan penetapan harga jual/modal merupakan wewenang eksklusif Owner. Untuk mencatat penerimaan stok fisik cabang, gunakan menu <a href="/stok" className="font-bold underline text-[#4A2E18] dark:text-[#C67C4E]">Stok Cabang -&gt; Barang Masuk</a>.
            </p>
          </div>
        </div>
      )}

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Total Produk</span>
            <Layers className="w-4 h-4 text-[#C67C4E]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#2C1810] dark:text-[#F5EBE1]">
            {totalProduk}
          </div>
          <div className="text-[11px] text-[#A8A29E] mt-1">SKU terdaftar</div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Minuman (Kopi & Non)</span>
            <Coffee className="w-4 h-4 text-[#C67C4E]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#4A2E18] dark:text-[#C67C4E]">
            {minumanCount}
          </div>
          <div className="text-[11px] text-[#A8A29E] mt-1">Racikan barista</div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Roti & Makanan</span>
            <Croissant className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#F59E0B]">
            {makananCount}
          </div>
          <div className="text-[11px] text-[#A8A29E] mt-1">Dapur roti & pastry</div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Lacak Stok Cabang</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {lacakStokCount}
          </div>
          <div className="text-[11px] text-[#A8A29E] mt-1">Item berstok fisik</div>
        </div>
      </div>

      {/* Filter, Search & View Toggle Bar */}
      <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
            <input
              type="text"
              placeholder="Cari SKU atau nama produk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] placeholder-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value)}
              className="w-full md:w-44 px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
            >
              <option value="all">Semua Kategori</option>
              <option value="kopi">Kopi</option>
              <option value="non_kopi">Non-Kopi</option>
              <option value="roti">Roti & Pastry</option>
              <option value="snack">Snack</option>
              <option value="kemasan">Kemasan / Retail</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full md:w-36 px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
            >
              <option value="all">Semua Status</option>
              <option value="aktif">Aktif</option>
              <option value="nonaktif">Nonaktif</option>
            </select>

            <div className="flex items-center bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl p-1 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-[#1E1915] text-[#4A2E18] dark:text-[#C67C4E] shadow-xs'
                    : 'text-[#78716C] dark:text-[#A8A29E]'
                }`}
                title="Tampilan Tabel"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white dark:bg-[#1E1915] text-[#4A2E18] dark:text-[#C67C4E] shadow-xs'
                    : 'text-[#78716C] dark:text-[#A8A29E]'
                }`}
                title="Tampilan Kartu Grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Product Presentation */}
      {filteredProduk.length === 0 ? (
        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl py-16 text-center text-[#78716C] dark:text-[#A8A29E] space-y-3">
          <Package className="w-10 h-10 mx-auto text-[#A8A29E] dark:text-[#78716C]" />
          <p className="text-sm font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
            Tidak ada produk yang cocok
          </p>
          <p className="text-xs">Ubah kata kunci pencarian atau filter yang dipilih.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Cards View */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredProduk.map((prod) => (
            <div
              key={prod.id}
              className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between group hover:border-[#C67C4E] transition-all"
            >
              <div className="relative aspect-4/3 w-full bg-[#FAF7F2] dark:bg-[#14110F] overflow-hidden">
                <ProductCardImage
                  sku={prod.sku}
                  nama={prod.nama}
                  kategori={prod.kategori}
                  className="w-full h-full"
                />
                <span
                  className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    prod.aktif
                      ? 'bg-emerald-100/90 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                      : 'bg-stone-200/90 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                  }`}
                >
                  {prod.aktif ? 'AKTIF' : 'NONAKTIF'}
                </span>
              </div>

              <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-bold text-[#A8A29E] whitespace-nowrap min-w-[70px]">
                      {prod.sku}
                    </span>
                    <span className="text-[10px] capitalize text-[#C67C4E] font-medium">
                      {prod.kategori.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] line-clamp-1 mt-0.5">
                    {prod.nama}
                  </h3>
                </div>

                <div className="pt-2 border-t border-[#F3EDE2] dark:border-[#2C2420] flex items-end justify-between">
                  <div>
                    <span className="text-[10px] text-[#78716C] dark:text-[#A8A29E] block">
                      Harga Jual
                    </span>
                    <span className="font-mono font-bold text-sm text-[#4A2E18] dark:text-[#C67C4E] tabular-nums">
                      {formatRupiah(prod.harga_jual)}
                    </span>
                  </div>

                  {isOwner && (
                    <button
                      onClick={() => handleOpenEditModal(prod)}
                      className="p-1.5 rounded-lg border border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] hover:text-[#4A2E18] dark:hover:text-[#F5EBE1] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] transition-colors cursor-pointer"
                      title="Edit Produk"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Table List View */
        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#FAF7F2] dark:bg-[#14110F] border-b border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] uppercase font-semibold text-[11px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5 whitespace-nowrap min-w-[90px]">SKU</th>
                  <th className="px-4 py-3.5">Nama Produk</th>
                  <th className="px-4 py-3.5">Kategori</th>
                  <th className="px-4 py-3.5 text-right">Harga Jual</th>
                  {isOwner && (
                    <th className="px-4 py-3.5 text-right bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-300">
                      Modal (Rahasia)
                    </th>
                  )}
                  <th className="px-4 py-3.5 text-center">Pelacakan Stok</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  {isOwner && <th className="px-4 py-3.5 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EDE2] dark:divide-[#2C2420] text-[#2C1810] dark:text-[#F5EBE1]">
                {filteredProduk.map((prod) => (
                  <tr
                    key={prod.id}
                    className="hover:bg-[#FAF7F2]/70 dark:hover:bg-[#14110F]/50 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold whitespace-nowrap min-w-[90px] text-[#4A2E18] dark:text-[#C67C4E]">
                      {prod.sku}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                      {prod.nama}
                    </td>
                    <td className="px-4 py-3.5 capitalize text-[#78716C] dark:text-[#A8A29E]">
                      {prod.kategori.replace('_', ' ')}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-sm text-[#4A2E18] dark:text-[#C67C4E] tabular-nums">
                      {formatRupiah(prod.harga_jual)}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3.5 text-right font-mono text-xs bg-amber-50/30 dark:bg-amber-950/10 text-amber-800 dark:text-amber-400 tabular-nums">
                        {prod.harga_modal !== null && prod.harga_modal !== undefined
                          ? formatRupiah(prod.harga_modal)
                          : '-'}
                      </td>
                    )}
                    <td className="px-4 py-3.5 text-center">
                      {prod.lacak_stok ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          Stok Cabang
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-stone-400"></span>
                          Racikan (Non-Stok)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                          prod.aktif
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                            : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700'
                        }`}
                      >
                        {prod.aktif ? 'AKTIF' : 'NONAKTIF'}
                      </span>
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleOpenEditModal(prod)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#4A2E18] dark:text-[#C67C4E] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] rounded-lg border border-[#E8DFD3] dark:border-[#2C2420] transition-colors cursor-pointer"
                        >
                          Ubah
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Tambah Produk Baru */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Tambah Master Produk Baru
                </h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
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

            <form onSubmit={handleCreateProduct} className="space-y-4 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                    SKU / Kode Produk
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: KOP-011"
                    value={newSku}
                    onChange={(e) => setNewSku(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                    Kategori
                  </label>
                  <select
                    value={newKategori}
                    onChange={(e) => setNewKategori(e.target.value as 'kopi' | 'non_kopi' | 'roti' | 'snack' | 'kemasan')}
                    className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1]"
                  >
                    <option value="kopi">Kopi</option>
                    <option value="non_kopi">Non-Kopi</option>
                    <option value="roti">Roti & Pastry</option>
                    <option value="snack">Snack</option>
                    <option value="kemasan">Kemasan / Retail</option>
                  </select>
                </div>
              </div>

              {/* Live Preview Foto Produk */}
              <div className="p-3 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-[#E8DFD3] dark:border-[#2C2420] bg-white dark:bg-[#1E1915]">
                  <ProductCardImage
                    sku={newSku || 'PREVIEW'}
                    nama={newNama || (newKategori === 'kopi' ? 'Kopi Spesial' : newKategori === 'roti' ? 'Pastry Segar' : 'Produk')}
                    kategori={newKategori}
                    className="w-full h-full"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                    <span>Preview Foto Produk Nyata</span>
                  </div>
                  <p className="text-[10px] text-[#78716C] dark:text-[#A8A29E] mt-0.5 leading-tight">
                    Foto produk nyata otomatis dipadankan berdasarkan SKU, nama produk, atau kategori ({newKategori.replace('_', ' ')}).
                  </p>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Nama Produk
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Caramel Macchiato Iced"
                  value={newNama}
                  onChange={(e) => setNewNama(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                    Harga Jual (Rp)
                  </label>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    required
                    value={newHargaJual}
                    onChange={(e) => setNewHargaJual(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-[#C67C4E]" />
                    <span>Harga Modal (Rp)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="500"
                    required
                    value={newHargaModal}
                    onChange={(e) => setNewHargaModal(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-amber-50/50 dark:bg-[#14110F] border border-amber-200 dark:border-amber-900 rounded-xl text-amber-950 dark:text-amber-200 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="lacakStok"
                  checked={newLacakStok}
                  onChange={(e) => setNewLacakStok(e.target.checked)}
                  className="w-4 h-4 rounded text-[#4A2E18] focus:ring-[#C67C4E]"
                />
                <label htmlFor="lacakStok" className="text-xs text-[#2C1810] dark:text-[#F5EBE1] font-medium">
                  Lacak kuantitas stok fisik di setiap cabang toko
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
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
                    <span>Simpan Master Produk</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Produk */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Ubah Harga & Status Produk
                </h3>
              </div>
              <button
                onClick={() => setEditingItem(null)}
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

            <div className="bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-3.5 text-xs space-y-1">
              <div className="font-mono font-bold text-[#4A2E18] dark:text-[#C67C4E]">
                {editingItem.sku}
              </div>
              <div className="font-semibold text-sm text-[#2C1810] dark:text-[#F5EBE1]">
                {editingItem.nama}
              </div>
              <div className="text-[#78716C] dark:text-[#A8A29E] capitalize">
                Kategori: {editingItem.kategori.replace('_', ' ')}
              </div>
            </div>

            <form onSubmit={handleUpdateProduct} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Harga Jual Baru (Rp)
                </label>
                <input
                  type="number"
                  min="500"
                  step="500"
                  required
                  value={editHargaJual}
                  onChange={(e) => setEditHargaJual(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] font-mono font-bold text-base"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Status Produk
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditAktif(true)}
                    className={`py-2 px-3 text-center rounded-xl border font-semibold transition-colors cursor-pointer ${
                      editAktif
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-[#FAF7F2] dark:bg-[#14110F] border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E]'
                    }`}
                  >
                    Aktif Dijual
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditAktif(false)}
                    className={`py-2 px-3 text-center rounded-xl border font-semibold transition-colors cursor-pointer ${
                      !editAktif
                        ? 'bg-rose-700 text-white border-rose-700'
                        : 'bg-[#FAF7F2] dark:bg-[#14110F] border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E]'
                    }`}
                  >
                    Nonaktif
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
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
