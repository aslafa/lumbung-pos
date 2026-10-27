'use client';

import { useState, useEffect, useTransition, useMemo, useCallback, useSyncExternalStore } from 'react';
import {
  ChefHat,
  Clock,
  Utensils,
  ShoppingBag,
  CheckCircle2,
  RefreshCw,
  Search,
  Sparkles,
  Coffee,
  ArrowRight,
  Eye,
  AlertTriangle,
  Trash2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { PesananAntreanItem, MejaItem, StatusPengerjaan } from '@/lib/orders/order-types';
import {
  getAntreanDataAction,
  updateStatusPengerjaanAction,
  bersihkanMejaAction,
  kosongkanAntreanAction,
} from '@/app/actions/antrean';
import { TableShape } from '@/components/meja/TableShape';
import { OrderTrackingModal } from '@/components/orders/OrderTrackingModal';

interface CabangOption {
  id: string;
  nama: string;
  kode: string;
}

interface AntreanClientProps {
  userRole: string;
  userCabangId: string | null;
  userCabangNama?: string;
  cabangList: CabangOption[];
  initialAntrean: PesananAntreanItem[];
  initialMejaList: MejaItem[];
}

export function AntreanClient({
  userRole,
  userCabangId,
  userCabangNama,
  cabangList,
  initialAntrean,
  initialMejaList,
}: AntreanClientProps) {
  const isOwner = userRole === 'owner';
  const [selectedCabang, setSelectedCabang] = useState<string>(
    isOwner ? (cabangList[0]?.id || 'all') : (userCabangId || '')
  );

  const [antreanList, setAntreanList] = useState<PesananAntreanItem[]>(initialAntrean);
  const [mejaList, setMejaList] = useState<MejaItem[]>(initialMejaList);
  const [filterStatus, setFilterStatus] = useState<StatusPengerjaan | 'SEMUA'>('SEMUA');
  const [filterPembayaran, setFilterPembayaran] = useState<'SEMUA' | 'lunas' | 'menunggu_bayar'>('SEMUA');
  const [filterLamaMenunggu, setFilterLamaMenunggu] = useState<boolean>(false);
  const [selectedTrackingOrder, setSelectedTrackingOrder] = useState<PesananAntreanItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'kds' | 'meja'>('kds');

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const isMounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  // Ticker waktu untuk kalkulasi durasi tunggu (menjaga kepatuhan aturan kemurnian render React)
  const [currentTime, setCurrentTime] = useState<number>(() => Date.now());

  useEffect(() => {
    const formatNow = () =>
      new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';

    const timer = setTimeout(() => {
      setLastUpdated(formatNow());
    }, 0);

    const ticker = setInterval(() => {
      setCurrentTime(Date.now());
      setLastUpdated(formatNow());
    }, 30000);

    return () => {
      clearTimeout(timer);
      clearInterval(ticker);
    };
  }, []);

  const fetchLatestData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsRefreshing(true);
      try {
        const res = await getAntreanDataAction(selectedCabang);
        if (res.success) {
          setAntreanList(res.antrean);
          setMejaList(res.mejaList);
          setLastUpdated(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB');
        }
      } catch {
        // Silently catch background poll error
      } finally {
        if (showLoading) setIsRefreshing(false);
      }
    },
    [selectedCabang]
  );

  // Auto-refresh interval (polling 8 detik) untuk memastikan layar barista selalu up-to-date
  useEffect(() => {
    const timer = setInterval(() => {
      fetchLatestData(false);
    }, 8000);

    return () => clearInterval(timer);
  }, [fetchLatestData]);

  const handleUpdateStatus = (transaksiId: string, nextStatus: StatusPengerjaan) => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await updateStatusPengerjaanAction(transaksiId, nextStatus);
      if (!res.success) {
        setActionError(res.error || 'Gagal mengubah status pengerjaan.');
      } else {
        setActionSuccess(`Pesanan berhasil diperbarui ke status "${nextStatus}".`);
        await fetchLatestData(false);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    });
  };

  const handleCleanMeja = (nomorMeja: string) => {
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await bersihkanMejaAction(selectedCabang, nomorMeja);
      if (!res.success) {
        setActionError(res.error || 'Gagal mengubah status meja.');
      } else {
        setActionSuccess(`Meja ${nomorMeja} sekarang siap digunakan kembali.`);
        await fetchLatestData(false);
        setTimeout(() => setActionSuccess(null), 3000);
      }
    });
  };

  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleOpenConfirm = () => {
    if (antreanList.length === 0 || isPending || isClearing) return;
    setIsConfirmModalOpen(true);
  };

  const handleCloseConfirm = () => {
    if (isClearing) return;
    setIsConfirmModalOpen(false);
  };

  const handleExecuteKosongkan = () => {
    if (antreanList.length === 0 || isClearing || isPending) return;

    setIsClearing(true);
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      try {
        const res = await kosongkanAntreanAction(selectedCabang);
        if (res.success) {
          setIsConfirmModalOpen(false);
          setAntreanList([]);
          const clearedCount = res.count ?? antreanList.length;
          setActionSuccess(
            `Layar antrean berhasil dikosongkan. ${clearedCount} pesanan telah ditandai selesai. Riwayat transaksi & audit tetap aman.`
          );
          await fetchLatestData(false);
          setTimeout(() => setActionSuccess(null), 5000);
        } else {
          setActionError(res.error || 'Gagal mengosongkan antrean.');
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Terjadi kesalahan sistem saat mengosongkan antrean.');
      } finally {
        setIsClearing(false);
      }
    });
  };

  // Hitung durasi tunggu dalam menit
  const getElapsedMinutes = useCallback((dateStr: string) => {
    const diff = Math.max(0, currentTime - new Date(dateStr).getTime());
    return Math.floor(diff / (1000 * 60));
  }, [currentTime]);

  // Filter antrean
  const filteredAntrean = useMemo(() => {
    return antreanList.filter((item) => {
      const matchStatus = filterStatus === 'SEMUA' ? true : item.status_pengerjaan === filterStatus;
      const matchPembayaran =
        filterPembayaran === 'SEMUA'
          ? true
          : (item.status_pembayaran || 'lunas').toLowerCase() === filterPembayaran;
      const elapsed = getElapsedMinutes(item.dibuat_pada);
      const matchLama = filterLamaMenunggu ? elapsed > 15 : true;

      const term = searchQuery.toLowerCase();
      const matchSearch =
        !term ||
        item.nomor_antrean.toLowerCase().includes(term) ||
        item.nomor_struk.toLowerCase().includes(term) ||
        (item.nama_pelanggan && item.nama_pelanggan.toLowerCase().includes(term)) ||
        (item.nomor_meja && item.nomor_meja.toLowerCase().includes(term));

      return matchStatus && matchPembayaran && matchLama && matchSearch;
    });
  }, [antreanList, filterStatus, filterPembayaran, filterLamaMenunggu, searchQuery, getElapsedMinutes]);

  // Statistik KDS
  const countMenunggu = antreanList.filter((p) => p.status_pengerjaan === 'MENUNGGU').length;
  const countDiproses = antreanList.filter((p) => p.status_pengerjaan === 'DIPROSES').length;
  const countSiap = antreanList.filter((p) => p.status_pengerjaan === 'SIAP_DIAMBIL').length;
  const countLamaMenunggu = antreanList.filter((p) => getElapsedMinutes(p.dibuat_pada) > 15).length;

  return (
    <div className="space-y-6">
      {/* Top Header Section: Satu Baris di Desktop */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3.5">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#FAF7F2] dark:bg-[#26201B] border border-[#E8DFD3] dark:border-[#382F28] flex items-center justify-center shrink-0">
            <ChefHat className="w-5 h-5 text-[#C67C4E]" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-[#2C1810] dark:text-[#F5EBE1] tracking-tight whitespace-nowrap">
              Layar Antrean &amp; Barista KDS
            </h1>
            <p className="text-[11px] text-[#78716C] dark:text-[#A8A29E]">
              {isOwner
                ? 'Monitoring antrean pesanan dapur & status meja multi-cabang'
                : `Antrean aktif cabang ${userCabangNama || ''} (Terhubung Real-time)`}
            </p>
          </div>
        </div>

        {/* Action Controls: 1 Baris Rapi */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0">
          {/* Cabang Selector if Owner, atau Badge Cabang jika Kasir / Kepala Toko */}
          {isOwner && cabangList.length > 0 ? (
            <select
              value={selectedCabang}
              onChange={(e) => {
                setSelectedCabang(e.target.value);
                fetchLatestData(true);
              }}
              className="px-2.5 py-1.5 bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E] whitespace-nowrap"
            >
              <option value="all">Semua Cabang</option>
              {cabangList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama} ({c.kode})
                </option>
              ))}
            </select>
          ) : (
            <span className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs font-semibold text-[#4A2E18] dark:text-[#C67C4E] whitespace-nowrap">
              {userCabangNama || 'Cabang Saya'}
            </span>
          )}

          {/* Manual Refresh */}
          <button
            type="button"
            onClick={() => fetchLatestData(true)}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl bg-white dark:bg-[#1E1915] text-xs font-semibold text-[#2C1810] dark:text-[#F5EBE1] hover:bg-[#FAF7F2] transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#C67C4E]' : ''}`} />
            <span>{isRefreshing ? 'Memuat...' : 'Segarkan'}</span>
          </button>

          {/* Kosongkan Antrean jika ada item */}
          {antreanList.length > 0 && (
            <button
              type="button"
              onClick={handleOpenConfirm}
              disabled={isPending || isClearing}
              title="Kosongkan seluruh daftar antrean aktif"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-rose-200 dark:border-rose-900/60 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearing ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-600 dark:text-rose-400" />
              ) : (
                <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              )}
              <span className="hidden md:inline">{isClearing ? 'Memproses...' : 'Kosongkan'}</span>
            </button>
          )}

          {/* Live Indicator & Last Updated: 1 Baris Utuh */}
          <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-medium whitespace-nowrap shrink-0">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Real-time</span>
            </span>
            {isMounted && lastUpdated && (
              <span
                suppressHydrationWarning
                className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300 border-l border-emerald-300 dark:border-emerald-800 pl-2"
              >
                {lastUpdated}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Action Feedback Banner */}
      {actionError && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-3.5 rounded-2xl text-xs sm:text-sm">
          {actionError}
        </div>
      )}
      {actionSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-3.5 rounded-2xl text-xs sm:text-sm">
          {actionSuccess}
        </div>
      )}

      {/* Main Tabs: KDS Antrean vs Manajemen Meja */}
      <div className="flex items-center gap-2 border-b border-[#E8DFD3] dark:border-[#2C2420] pb-2">
        <button
          onClick={() => setActiveTab('kds')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'kds'
              ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
              : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2]'
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>Antrean Pesanan Barista ({antreanList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('meja')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
            activeTab === 'meja'
              ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
              : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2]'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Status Meja Cabang ({mejaList.length})</span>
        </button>
      </div>

      {/* TAB 1: KDS ANTREN BARISTA */}
      {activeTab === 'kds' && (
        <div className="space-y-4">
          {/* Quick Filter & Search Bar */}
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <button
                onClick={() => setFilterStatus('SEMUA')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  filterStatus === 'SEMUA'
                    ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
                    : 'bg-[#FAF7F2] dark:bg-[#14110F] text-[#78716C] dark:text-[#A8A29E]'
                }`}
              >
                Semua ({antreanList.length})
              </button>
              <button
                onClick={() => setFilterStatus('MENUNGGU')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  filterStatus === 'MENUNGGU'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400'
                }`}
              >
                Menunggu ({countMenunggu})
              </button>
              <button
                onClick={() => setFilterStatus('DIPROSES')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  filterStatus === 'DIPROSES'
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400'
                }`}
              >
                Diproses ({countDiproses})
              </button>
              <button
                onClick={() => setFilterStatus('SIAP_DIAMBIL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
                  filterStatus === 'SIAP_DIAMBIL'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400'
                }`}
              >
                Siap ({countSiap})
              </button>

              {/* Filter Pesanan Lama Menunggu (> 15 menit) */}
              <button
                onClick={() => setFilterLamaMenunggu(!filterLamaMenunggu)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors flex items-center gap-1.5 ${
                  filterLamaMenunggu
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Lama Menunggu ({countLamaMenunggu})</span>
              </button>

              {/* Filter Pembayaran */}
              <select
                value={filterPembayaran}
                onChange={(e) => setFilterPembayaran(e.target.value as 'SEMUA' | 'lunas' | 'menunggu_bayar')}
                className="px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs font-bold text-[#2C1810] dark:text-[#F5EBE1]"
              >
                <option value="SEMUA">Semua Pembayaran</option>
                <option value="lunas">Lunas</option>
                <option value="menunggu_bayar">Menunggu Bayar</option>
              </select>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
              <input
                type="text"
                placeholder="Cari antrean, struk, meja..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] placeholder-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
              />
            </div>
          </div>

          {/* Cards Grid */}
          {filteredAntrean.length === 0 ? (
            <div className="py-20 text-center bg-white dark:bg-[#1E1915] border border-dashed border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl p-8 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h3 className="font-bold text-sm sm:text-base text-[#2C1810] dark:text-[#F5EBE1]">
                Semua Antrean Bersih!
              </h3>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                Tidak ada pesanan aktif yang menunggu saat ini pada cabang aktif.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAntrean.map((pesanan) => {
                const elapsedMin = getElapsedMinutes(pesanan.dibuat_pada);
                const isLate = elapsedMin > 10;
                const isDineIn = (pesanan.jenis_pesanan || '').toUpperCase() === 'DINE_IN' || !!pesanan.nomor_meja;

                return (
                  <div
                    key={pesanan.transaksi_id}
                    onClick={() => setSelectedTrackingOrder(pesanan)}
                    className={`bg-white dark:bg-[#1E1915] border rounded-3xl p-5 shadow-xs flex flex-col justify-between transition-all cursor-pointer hover:border-[#C67C4E] hover:shadow-md ${
                      pesanan.status_pengerjaan === 'SIAP_DIAMBIL'
                        ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/20'
                        : pesanan.status_pengerjaan === 'DIPROSES'
                        ? 'border-blue-300 dark:border-blue-800 bg-blue-50/20'
                        : 'border-[#E8DFD3] dark:border-[#2C2420]'
                    }`}
                  >
                    <div>
                      {/* Top Bar Card */}
                      <div className="flex items-start justify-between border-b border-[#E8DFD3]/60 dark:border-[#2C2420]/60 pb-3">
                        <div>
                          <div className="text-3xl font-extrabold font-ticket tracking-tight text-[#4A2E18] dark:text-[#C67C4E]">
                            {pesanan.nomor_antrean}
                          </div>
                          <div className="text-[11px] font-mono font-bold whitespace-nowrap text-[#78716C] dark:text-[#A8A29E] mt-0.5">
                            {pesanan.nomor_struk}
                          </div>
                          <div className="text-xs font-semibold text-[#8C5E3C] dark:text-[#E0A96D] mt-0.5 flex items-center gap-1">
                            <span>Pelanggan:</span>
                            <strong className="text-[#4A2E18] dark:text-[#FAF7F2]">
                              {pesanan.nama_pelanggan && pesanan.nama_pelanggan !== 'Pelanggan Umum'
                                ? pesanan.nama_pelanggan
                                : isDineIn && pesanan.nomor_meja
                                ? `Tamu Meja ${pesanan.nomor_meja}`
                                : (pesanan.nama_pelanggan || 'Pelanggan Umum')}
                            </strong>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-1">
                          {isDineIn ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-[#FAF7F2] dark:bg-[#14110F] text-[#4A2E18] dark:text-[#C67C4E] border border-[#E8DFD3] dark:border-[#2C2420]">
                              <Utensils className="w-3.5 h-3.5 text-[#C67C4E]" />
                              <span>Meja {pesanan.nomor_meja || '-'}</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200">
                              <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                              <span>Takeaway</span>
                            </span>
                          )}

                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-mono tabular-nums ${
                              isLate ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-[#A8A29E]'
                            }`}
                          >
                            <Clock className="w-3 h-3" />
                            <span>{elapsedMin} mnt lalu</span>
                          </span>
                        </div>
                      </div>

                      {/* Items List */}
                      <div className="my-3 space-y-1.5 text-xs">
                        {pesanan.items.map((it, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center text-[#2C1810] dark:text-[#F5EBE1]"
                          >
                            <span className="font-semibold">
                              <span className="inline-block w-5 font-mono text-[#C67C4E]">
                                {it.jumlah}x
                              </span>
                              <span>{it.nama}</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Catatan Pesanan Khusus jika ada */}
                      {pesanan.catatan_pesanan && (
                        <div className="p-2 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl text-[11px] text-amber-900 dark:text-amber-300 italic mb-3">
                          <strong>Catatan:</strong> {pesanan.catatan_pesanan}
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="pt-3 border-t border-[#E8DFD3]/60 dark:border-[#2C2420]/60 space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-[#A8A29E]">Status:</span>
                        <span className="font-bold text-xs uppercase text-[#C67C4E]">
                          {pesanan.status_pengerjaan.replace('_', ' ')}
                        </span>
                      </div>

                      {isOwner ? (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-[#A8A29E] italic">Monitoring Owner</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTrackingOrder(pesanan);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#FAF0E6] dark:bg-[#2C221E] text-[#8C5E3C] hover:text-[#4A2E18] text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Detail Tracking</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          {pesanan.status_pengerjaan === 'MENUNGGU' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateStatus(pesanan.transaksi_id, 'DIPROSES');
                              }}
                              disabled={isPending}
                              className="w-full py-2.5 bg-[#4A2E18] hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            >
                              <span>Mulai Diracik</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {pesanan.status_pengerjaan === 'DIPROSES' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateStatus(pesanan.transaksi_id, 'SIAP_DIAMBIL');
                              }}
                              disabled={isPending}
                              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            >
                              <span>Siap Diambil / Saji</span>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {pesanan.status_pengerjaan === 'SIAP_DIAMBIL' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateStatus(pesanan.transaksi_id, 'SELESAI');
                              }}
                              disabled={isPending}
                              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-xs"
                            >
                              <span>Selesaikan Pesanan</span>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STATUS MEJA CABANG DENGAN DENAH NYATA */}
      {activeTab === 'meja' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Coffee className="w-5 h-5 text-[#8C5E3C]" />
                <h3 className="text-sm sm:text-base font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Denah Tata Ruang & Status Meja
                </h3>
              </div>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
                Visualisasi kapasitas kursi operasional kopi &amp; teh cabang. Klik meja untuk membersihkan setelah checkout.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="/meja"
                className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-[#FAF0E6] dark:bg-[#2C221E] text-[#8C5E3C] border border-[#E8DFD8] hover:bg-[#EFE2D3] transition-colors"
              >
                Buka Denah Penuh ➔
              </a>
            </div>
          </div>

          <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] shadow-sm">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6 justify-items-center py-2">
              {mejaList.map((meja) => (
                <div key={meja.id} className="flex flex-col items-center">
                  <TableShape
                    nomorMeja={meja.nomor_meja}
                    kapasitas={meja.kapasitas}
                    bentuk={meja.bentuk}
                    status={meja.status}
                    area={meja.area}
                    onClick={() => {
                      if (meja.status === 'menunggu_dibersihkan') {
                        handleCleanMeja(meja.nomor_meja);
                      }
                    }}
                  />
                  {meja.status === 'menunggu_dibersihkan' && (
                    <button
                      onClick={() => handleCleanMeja(meja.nomor_meja)}
                      disabled={isPending}
                      className="mt-1 py-1 px-2.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors shadow-2xs"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Selesai Bersih</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Detail Tracking Pesanan Stepper Visual */}
      {selectedTrackingOrder && (
        <OrderTrackingModal
          isOpen={!!selectedTrackingOrder}
          onClose={() => setSelectedTrackingOrder(null)}
          order={selectedTrackingOrder}
          userRole={userRole}
          isPendingAction={isPending}
          onUpdateStatus={async (transaksiId, nextStatus) => {
            await handleUpdateStatus(transaksiId, nextStatus);
            setSelectedTrackingOrder((prev) =>
              prev ? { ...prev, status_pengerjaan: nextStatus } : null
            );
          }}
        />
      )}

      {/* Modal Dialog Konfirmasi Kosongkan Antrean */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            className="bg-[#FAF7F2] dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl relative space-y-4 animate-in zoom-in-95 duration-150"
          >
            {/* Header Modal */}
            <div className="flex items-start justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-900/60 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div>
                  <h3 id="confirm-modal-title" className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                    Kosongkan Seluruh Antrean?
                  </h3>
                  <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                    {selectedCabang === 'all'
                      ? 'Seluruh cabang toko (Mode Owner)'
                      : `Cabang: ${cabangList.find((c) => c.id === selectedCabang)?.nama || userCabangNama || 'Aktif'}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseConfirm}
                disabled={isClearing}
                className="p-1.5 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                aria-label="Tutup dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-3.5 text-xs sm:text-sm text-[#4A3B32] dark:text-[#D6C7BC]">
              <p>
                Tindakan ini akan menyelesaikan dan mengeluarkan{' '}
                <strong className="text-rose-700 dark:text-rose-400 font-bold">
                  {antreanList.length} pesanan antrean aktif
                </strong>{' '}
                dari layar KDS barista/dapur. Meja DINE IN yang terkait akan otomatis dialihkan ke status pembersihan.
              </p>

              {/* Daftar nomor antrean aktif */}
              {antreanList.length > 0 && (
                <div className="bg-white dark:bg-[#181310] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-3 space-y-1.5">
                  <span className="text-[11px] font-semibold text-[#78716C] dark:text-[#A8A29E] block">
                    Daftar antrean yang akan dikosongkan ({antreanList.length}):
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
                    {antreanList.map((item) => (
                      <span
                        key={item.transaksi_id}
                        className="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-stone-800 text-[11px] font-mono font-bold text-[#2C1810] dark:text-[#F5EBE1] border border-stone-200 dark:border-stone-700"
                      >
                        {item.nomor_antrean} ({item.nama_pelanggan || (item.nomor_meja ? `Meja ${item.nomor_meja}` : 'Takeaway')})
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Jaminan Keamanan Data & Transaksi (PRD Audit & Finance Protection) */}
              <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <span className="font-bold block">Integritas Riwayat Transaksi Terjamin</span>
                  <span>
                    Data penjualan, struk, metode pembayaran, kas shift, dan audit log tidak akan dihapus dan tetap aman tersimpan untuk pelaporan.
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E8DFD3] dark:border-[#2C2420]">
              <button
                type="button"
                onClick={handleCloseConfirm}
                disabled={isClearing}
                className="px-4 py-2 rounded-xl border border-[#E8DFD3] dark:border-[#2C2420] text-xs font-semibold text-[#4A3B32] dark:text-[#D6C7BC] hover:bg-[#FAF7F2] dark:hover:bg-[#28211B] transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteKosongkan}
                disabled={isClearing || isPending}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                {isClearing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengosongkan...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Ya, Kosongkan Antrean</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
