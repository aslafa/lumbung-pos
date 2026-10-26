'use client';

import { useState, useMemo } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  Receipt,
  Lock,
  Store,
  Award,
  AlertTriangle,
  ArrowUpRight,
  PieChart,
  Ban,
  Clock,
  Calculator
} from 'lucide-react';
import { formatRupiah, formatAngka, formatPersen, formatTanggalWaktu } from '@/lib/utils/format';
import { CountUp } from '@/components/ui/CountUp';

export interface LaporanTxItem {
  id: string;
  total: number;
  metode_bayar: string;
  dibuat_pada: string;
  cabang_id: string;
  cabang_nama: string;
}

export interface TopProductItem {
  nama: string;
  kategori: string;
  total_qty: number;
  total_omzet: number;
}

export interface CabangOption {
  id: string;
  nama: string;
  kode: string;
}

export interface LaporanShiftItem {
  id: string;
  cabang_id: string;
  cabang_nama: string;
  cabang_kode: string;
  kasir_nama: string;
  dibuka_pada: string;
  ditutup_pada: string | null;
  status: string;
  kas_awal: number;
  kas_seharusnya: number;
  uang_fisik: number | null;
  selisih: number | null;
  catatan_tutup: string | null;
}

interface LaporanClientProps {
  transaksiList: LaporanTxItem[];
  topProducts: TopProductItem[];
  cabangList: CabangOption[];
  userRole: string;
  userCabangNama?: string;
  totalModalOwner?: number;
  lowStockCount: number;
  voidCount?: number;
  shiftSelisihList?: LaporanShiftItem[];
}

export function LaporanClient({
  transaksiList,
  topProducts,
  cabangList,
  userRole,
  userCabangNama,
  totalModalOwner = 0,
  lowStockCount,
  voidCount = 0,
  shiftSelisihList = [],
}: LaporanClientProps) {
  const [periode, setPeriode] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [selectedCabang, setSelectedCabang] = useState<string>('all');
  const [hoveredPoint, setHoveredPoint] = useState<{ label: string; value: number; x: number; y: number } | null>(null);

  const isOwner = userRole === 'owner';

  // Filter Transactions by Periode and Branch
  const filteredTx = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return transaksiList.filter((tx) => {
      const txTime = new Date(tx.dibuat_pada).getTime();

      let matchPeriod = true;
      if (periode === 'today') {
        matchPeriod = txTime >= todayStart;
      } else if (periode === '7days') {
        matchPeriod = txTime >= sevenDaysAgo;
      } else if (periode === '30days') {
        matchPeriod = txTime >= thirtyDaysAgo;
      }

      const matchCabang = selectedCabang === 'all' || tx.cabang_id === selectedCabang;

      return matchPeriod && matchCabang;
    });
  }, [transaksiList, periode, selectedCabang]);

  // Key Aggregations
  const totalOmzet = useMemo(
    () => filteredTx.reduce((sum, t) => sum + (t.total || 0), 0),
    [filteredTx]
  );
  const totalTransaksi = filteredTx.length;
  const rataRata = totalTransaksi > 0 ? Math.round(totalOmzet / totalTransaksi) : 0;
  const totalProdukTerjual = useMemo(
    () => topProducts.reduce((sum, p) => sum + (p.total_qty || 0), 0),
    [topProducts]
  );

  // Laba Kotor Khusus Owner
  const labaKotor = isOwner ? Math.max(0, totalOmzet - totalModalOwner) : 0;
  const marginPersen =
    isOwner && totalOmzet > 0
      ? Math.round((labaKotor / totalOmzet) * 1000) / 10
      : 0;

  // Payment Breakdown
  const totalTunai = useMemo(
    () => filteredTx.filter((t) => t.metode_bayar === 'tunai').length,
    [filteredTx]
  );
  const totalQris = useMemo(
    () => filteredTx.filter((t) => t.metode_bayar === 'qris').length,
    [filteredTx]
  );
  const omzetTunai = useMemo(
    () => filteredTx.filter((t) => t.metode_bayar === 'tunai').reduce((s, t) => s + t.total, 0),
    [filteredTx]
  );
  const omzetQris = useMemo(
    () => filteredTx.filter((t) => t.metode_bayar === 'qris').reduce((s, t) => s + t.total, 0),
    [filteredTx]
  );

  // Group by Date for Trend Line Chart
  const dailyData = useMemo(() => {
    const map = new Map<string, number>();

    // Sort chronologically
    const sorted = [...filteredTx].sort(
      (a, b) => new Date(a.dibuat_pada).getTime() - new Date(b.dibuat_pada).getTime()
    );

    sorted.forEach((t) => {
      const d = new Date(t.dibuat_pada);
      const key = d.toLocaleDateString('id-ID', {
        timeZone: 'Asia/Jakarta',
        day: 'numeric',
        month: 'short',
      });
      map.set(key, (map.get(key) || 0) + t.total);
    });

    return Array.from(map.entries()).map(([label, total]) => ({ label, total }));
  }, [filteredTx]);

  // Group by Branch for Comparison Chart
  const branchData = useMemo(() => {
    const map = new Map<string, number>();
    filteredTx.forEach((t) => {
      map.set(t.cabang_nama, (map.get(t.cabang_nama) || 0) + t.total);
    });
    return Array.from(map.entries()).map(([nama, total]) => ({ nama, total }));
  }, [filteredTx]);

  // Max calculations for charts
  const maxDaily = Math.max(1, ...dailyData.map((d) => d.total));
  const maxBranch = Math.max(1, ...branchData.map((b) => b.total));
  const maxProductQty = Math.max(1, ...topProducts.map((p) => p.total_qty));

  // Donut SVG parameters
  const totalPaymentTx = totalTunai + totalQris;
  const tunaiPercent = totalPaymentTx > 0 ? (totalTunai / totalPaymentTx) * 100 : 50;
  const qrisPercent = totalPaymentTx > 0 ? (totalQris / totalPaymentTx) * 100 : 50;
  const circumference = 2 * Math.PI * 40; // r = 40
  const tunaiStroke = (tunaiPercent / 100) * circumference;
  const qrisStroke = (qrisPercent / 100) * circumference;

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E8DFD3] dark:border-[#2C2420] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#C67C4E]" />
            <span>Laporan &amp; Analitik Penjualan</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E] mt-1">
            {isOwner
              ? 'Ringkasan komprehensif omzet, metode bayar, dan margin laba multi-cabang.'
              : `Statistik penjualan lunas cabang ${userCabangNama || ''} (Real-time Supabase)`}
          </p>
        </div>

        {/* Global Filter Bar */}
        <div className="flex items-center gap-2">
          {/* Cabang Filter if Owner */}
          {isOwner && cabangList.length > 0 && (
            <select
              value={selectedCabang}
              onChange={(e) => setSelectedCabang(e.target.value)}
              className="px-3 py-2 bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
            >
              <option value="all">Semua Cabang</option>
              {cabangList.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          )}

          {/* Periode Tabs */}
          <div className="flex items-center bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl p-1">
            <button
              onClick={() => setPeriode('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                periode === 'all'
                  ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
                  : 'text-[#78716C] dark:text-[#A8A29E]'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setPeriode('30days')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                periode === '30days'
                  ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
                  : 'text-[#78716C] dark:text-[#A8A29E]'
              }`}
            >
              30 Hari
            </button>
            <button
              onClick={() => setPeriode('7days')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                periode === '7days'
                  ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
                  : 'text-[#78716C] dark:text-[#A8A29E]'
              }`}
            >
              7 Hari
            </button>
          </div>
        </div>
      </div>

      {/* Metric Stat Cards (PRD Bagian 9 & Animated Count-Up) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-1">
            <span className="text-xs font-medium">Total Omzet</span>
            <DollarSign className="w-4 h-4 text-[#C67C4E]" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#2C1810] dark:text-[#F5EBE1]">
            <CountUp value={totalOmzet} formatter={formatRupiah} />
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span className="tabular-nums">
              <CountUp value={totalTransaksi} formatter={formatAngka} /> Transaksi Lunas
            </span>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-1">
            <span className="text-xs font-medium">Rata-Rata per Struk</span>
            <Receipt className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#2C1810] dark:text-[#F5EBE1]">
            <CountUp value={rataRata} formatter={formatRupiah} />
          </div>
          <div className="text-[11px] text-[#A8A29E] mt-1">
            Basket size rata-rata
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-1">
            <span className="text-xs font-medium">Jumlah Transaksi</span>
            <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
            <CountUp value={totalTransaksi} formatter={formatAngka} />
          </div>
          <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1">
            Struk berhasil diproses
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-1">
            <span className="text-xs font-medium">Produk Terjual</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#2C1810] dark:text-[#F5EBE1]">
            <CountUp value={totalProdukTerjual} formatter={formatAngka} />
          </div>
          <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1">
            Pcs minuman &amp; makanan
          </div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-1">
            <span className="text-xs font-medium">Transaksi Void</span>
            <Ban className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-rose-600 dark:text-rose-400">
            <CountUp value={voidCount} formatter={formatAngka} />
          </div>
          <div className="text-[11px] text-rose-600 dark:text-rose-400 font-medium mt-1">
            {voidCount > 0 ? 'Dibatalkan oleh supervisor' : 'Nihil pembatalan'}
          </div>
        </div>
      </div>

      {/* Row Khusus Owner: Laba Kotor & Margin (BR-11 & RLS Security) */}
      {isOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-amber-900 dark:text-amber-300 mb-1">
              <span className="text-xs font-semibold">Laba Kotor (Owner Only)</span>
              <TrendingUp className="w-4 h-4 text-[#C67C4E]" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#4A2E18] dark:text-[#F5EBE1]">
              <CountUp value={labaKotor} formatter={formatRupiah} />
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1">
              Omzet dikurangi modal historis produk lunas
            </div>
          </div>

          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/60 rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-amber-900 dark:text-amber-300 mb-1">
              <span className="text-xs font-semibold">Margin Laba Kotor</span>
              <Lock className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono tabular-nums text-[#4A2E18] dark:text-[#F5EBE1]">
              <CountUp value={marginPersen} formatter={formatPersen} />
            </div>
            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium mt-1">
              Kerahasiaan data modal terlindungi dengan aman
            </div>
          </div>
        </div>
      )}

      {/* Warning Alert if Low Stock Exists */}
      {lowStockCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0" />
            <p className="text-xs sm:text-sm text-amber-900 dark:text-amber-300 font-medium">
              Terdapat <strong>{lowStockCount} SKU produk</strong> dalam status kritis atau habis pada cabang Anda.
            </p>
          </div>
          <a
            href="/stok"
            className="text-xs font-bold text-amber-800 dark:text-amber-300 hover:underline shrink-0"
          >
            Lihat Stok &rarr;
          </a>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Trend Penjualan Dinamis SVG Chart (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                Tren Penjualan Harian
              </h3>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                Total transaksi lunas per hari pada periode aktif
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-[#4A2E18] dark:text-[#C67C4E]">
              Puncak: Rp{maxDaily.toLocaleString('id-ID')}
            </span>
          </div>

          {dailyData.length === 0 ? (
            <div className="py-20 text-center text-xs text-[#78716C] dark:text-[#A8A29E]">
              Belum ada data transaksi lunas pada filter ini.
            </div>
          ) : (
            <div className="relative w-full h-56 sm:h-64 pt-4">
              {/* SVG Line / Area Chart */}
              <svg className="w-full h-full overflow-visible" viewBox="0 0 500 200" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C67C4E" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="#C67C4E" stopOpacity="0.0" />
                  </linearGradient>
                </defs>

                {/* Horizontal Guide Lines */}
                <line x1="0" y1="40" x2="500" y2="40" stroke="#E8DFD3" strokeDasharray="3 3" opacity="0.5" />
                <line x1="0" y1="100" x2="500" y2="100" stroke="#E8DFD3" strokeDasharray="3 3" opacity="0.5" />
                <line x1="0" y1="160" x2="500" y2="160" stroke="#E8DFD3" strokeDasharray="3 3" opacity="0.5" />

                {/* Closed Area */}
                {dailyData.length > 1 && (
                  <polygon
                    fill="url(#areaGradient)"
                    points={`
                      0,190
                      ${dailyData
                        .map((d, i) => {
                          const x = (i / (dailyData.length - 1)) * 500;
                          const y = 190 - (d.total / maxDaily) * 160;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                      500,190
                    `}
                  />
                )}

                {/* Line Path */}
                {dailyData.length > 1 ? (
                  <polyline
                    fill="none"
                    stroke="#C67C4E"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={dailyData
                      .map((d, i) => {
                        const x = (i / (dailyData.length - 1)) * 500;
                        const y = 190 - (d.total / maxDaily) * 160;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                ) : (
                  <circle cx="250" cy="100" r="6" fill="#C67C4E" />
                )}

                {/* Interactive Points */}
                {dailyData.map((d, i) => {
                  const x = dailyData.length === 1 ? 250 : (i / (dailyData.length - 1)) * 500;
                  const y = 190 - (d.total / maxDaily) * 160;
                  return (
                    <circle
                      key={d.label}
                      cx={x}
                      cy={y}
                      r="4"
                      className="fill-[#4A2E18] dark:fill-[#C67C4E] hover:r-6 cursor-pointer transition-all"
                      onMouseEnter={() => setHoveredPoint({ label: d.label, value: d.total, x, y })}
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  );
                })}
              </svg>

              {/* Tooltip */}
              {hoveredPoint && (
                <div
                  className="absolute z-10 px-2.5 py-1.5 bg-[#2C1810] text-white text-[11px] rounded-lg shadow-lg pointer-events-none -translate-x-1/2 -translate-y-full font-mono"
                  style={{ left: `${(hoveredPoint.x / 500) * 100}%`, top: `${(hoveredPoint.y / 200) * 100}%` }}
                >
                  <div className="font-sans font-semibold text-[#F5EBE1]">{hoveredPoint.label}</div>
                  <div>Rp{hoveredPoint.value.toLocaleString('id-ID')}</div>
                </div>
              )}

              {/* X-Axis Labels */}
              <div className="flex justify-between text-[10px] text-[#A8A29E] mt-3">
                {dailyData.map((d) => (
                  <span key={d.label} className="truncate max-w-16">
                    {d.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Komposisi Metode Bayar Donut SVG (1 Col) */}
        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-2">
              <PieChart className="w-4 h-4 text-[#C67C4E]" />
              <span>Metode Pembayaran</span>
            </h3>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              Komposisi Kas Tunai vs QRIS Mayar
            </p>
          </div>

          <div className="my-6 flex flex-col items-center justify-center">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#E8DFD3"
                  strokeWidth="12"
                  className="dark:stroke-[#2C2420]"
                />
                {/* Tunai segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#4A2E18"
                  strokeWidth="12"
                  strokeDasharray={`${tunaiStroke} ${circumference}`}
                  strokeDashoffset="0"
                  className="dark:stroke-[#C67C4E] transition-all duration-500"
                />
                {/* QRIS segment */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  stroke="#F59E0B"
                  strokeWidth="12"
                  strokeDasharray={`${qrisStroke} ${circumference}`}
                  strokeDashoffset={`-${tunaiStroke}`}
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-lg font-bold font-mono text-[#2C1810] dark:text-[#F5EBE1]">
                  {totalPaymentTx}
                </span>
                <span className="text-[10px] text-[#A8A29E]">Struk</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs pt-2 border-t border-[#E8DFD3] dark:border-[#2C2420]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#4A2E18] dark:bg-[#C67C4E]"></span>
                <span className="text-[#78716C] dark:text-[#A8A29E]">Tunai ({totalTunai})</span>
              </div>
              <span className="font-mono font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                Rp{omzetTunai.toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-[#F59E0B]"></span>
                <span className="text-[#78716C] dark:text-[#A8A29E]">QRIS ({totalQris})</span>
              </div>
              <span className="font-mono font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                Rp{omzetQris.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Top 10 Products & Branch Comparison (PRD Bagian 9) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Best Selling Products (Horizontal Bar) */}
        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-[#F59E0B]" />
              <h3 className="text-sm sm:text-base font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                10 Produk Terlaris (Top Sales)
              </h3>
            </div>
            <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">Kuantitas Terjual</span>
          </div>

          {topProducts.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#78716C] dark:text-[#A8A29E]">
              Belum ada transaksi produk tercatat.
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[420px] overflow-y-auto pr-1">
              {topProducts.slice(0, 10).map((prod, idx) => (
                <div key={prod.nama} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                    <span className="flex items-center gap-1.5 truncate max-w-[220px]">
                      <span className="w-4 h-4 rounded-full bg-[#FAF7F2] dark:bg-[#14110F] text-[#C67C4E] font-mono text-[10px] flex items-center justify-center font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <span className="truncate">{prod.nama}</span>
                    </span>
                    <span className="font-mono tabular-nums text-[#4A2E18] dark:text-[#C67C4E] text-right shrink-0">
                      {formatAngka(prod.total_qty)} terjual ({formatRupiah(prod.total_omzet)})
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-[#FAF7F2] dark:bg-[#14110F] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-[#4A2E18] to-[#C67C4E] rounded-full transition-all duration-500"
                      style={{ width: `${(prod.total_qty / maxProductQty) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Branch Revenue Comparison (if Owner) or Shift Summary */}
        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="text-sm sm:text-base font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  {isOwner ? 'Perbandingan Omzet Antar-Cabang' : 'Distribusi Penjualan Cabang'}
                </h3>
              </div>
              <span className="text-xs text-[#78716C] dark:text-[#A8A29E]">Realisasi Lunas</span>
            </div>

            {branchData.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#78716C] dark:text-[#A8A29E]">
                Belum ada data omzet cabang.
              </div>
            ) : (
              <div className="space-y-4">
                {branchData.map((branch) => (
                  <div key={branch.nama} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                      <span>{branch.nama}</span>
                      <span className="font-mono tabular-nums text-[#4A2E18] dark:text-[#C67C4E]">
                        {formatRupiah(branch.total)}
                      </span>
                    </div>
                    <div className="w-full h-3 bg-[#FAF7F2] dark:bg-[#14110F] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#C67C4E] rounded-full transition-all duration-500"
                        style={{ width: `${(branch.total / maxBranch) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 p-3 bg-[#FAF7F2] dark:bg-[#14110F] rounded-xl text-xs text-[#78716C] dark:text-[#A8A29E] flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#C67C4E] shrink-0" />
            <span>Semua data dihitung secara real-time dari transaksi Supabase dengan filter periode aktif.</span>
          </div>
        </div>
      </div>

      {/* Row 3: Tabel Rekonsiliasi & Selisih Kas per Shift (BR-09 & PRD Bagian 9) */}
      <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-[#C67C4E]" />
            <div>
              <h3 className="text-sm sm:text-base font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                Tabel Selisih Kas per Shift
              </h3>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                Audit rekonsiliasi kas fisik vs sistem per shift dengan penanda selisih di luar batas toleransi.
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            Batas Toleransi: Rp20.000
          </span>
        </div>

        {shiftSelisihList.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#78716C] dark:text-[#A8A29E]">
            Belum ada data shift yang ditutup untuk ditampilkan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E]">
                  <th className="py-2.5 px-3 font-semibold">Cabang</th>
                  <th className="py-2.5 px-3 font-semibold">Kasir</th>
                  <th className="py-2.5 px-3 font-semibold">Waktu Buka / Tutup</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Kas Sistem</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Uang Fisik</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Selisih Kas</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Status Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8DFD3]/60 dark:divide-[#2C2420]/60 text-[#2C1810] dark:text-[#F5EBE1]">
                {shiftSelisihList.map((shift) => {
                  const selisih = shift.selisih ?? 0;
                  const isExceedTolerance = Math.abs(selisih) > 20000;
                  const isMatch = selisih === 0;

                  return (
                    <tr
                      key={shift.id}
                      className={
                        isExceedTolerance
                          ? 'bg-rose-50/40 dark:bg-rose-950/20'
                          : 'hover:bg-[#FAF7F2] dark:hover:bg-[#14110F]'
                      }
                    >
                      <td className="py-3 px-3 font-medium">
                        <div>{shift.cabang_nama}</div>
                        <span className="text-[10px] text-[#A8A29E] font-mono">{shift.cabang_kode}</span>
                      </td>
                      <td className="py-3 px-3 font-medium">{shift.kasir_nama}</td>
                      <td className="py-3 px-3 text-[#78716C] dark:text-[#A8A29E] whitespace-nowrap">
                        <div className="font-medium">{formatTanggalWaktu(shift.dibuka_pada, { short: true })}</div>
                        {shift.ditutup_pada && (
                          <div className="text-[10px] text-[#A8A29E]">
                            Tutup: {formatTanggalWaktu(shift.ditutup_pada, { short: true })}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {formatRupiah(shift.kas_seharusnya)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        {shift.uang_fisik !== null ? formatRupiah(shift.uang_fisik) : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold">
                        <span
                          className={
                            isMatch
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : selisih < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }
                        >
                          {selisih > 0 ? `+${formatRupiah(selisih)}` : formatRupiah(selisih)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {isExceedTolerance ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                            <AlertTriangle className="w-3 h-3" />
                            Selisih &gt; Rp20.000
                          </span>
                        ) : isMatch ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            Sesuai (Rp0)
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
                            Dalam Toleransi
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
