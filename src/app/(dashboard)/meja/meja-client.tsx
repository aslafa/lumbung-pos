"use client";

import React, { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TableShape } from "@/components/meja/TableShape";
import { TableDetailDrawer } from "@/components/meja/TableDetailDrawer";
import { CountUp } from "@/components/ui/CountUp";
import { MejaItem, AreaMeja, BentukMeja } from "@/lib/orders/order-types";
import {
  getAntreanDataAction,
  bersihkanMejaAction,
  pindahkanMejaKePerluDibersihkanAction,
  tambahAtauUbahMejaAction,
} from "@/app/actions/antrean";
import {
  LayoutGrid,
  Search,
  Sparkles,
  RefreshCw,
  Plus,
  Users,
  CheckCircle2,
  Coffee,
  AlertCircle,
  Building2,
} from "lucide-react";

interface CabangOption {
  id: string;
  nama: string;
}

interface MejaClientProps {
  initialMejaList: MejaItem[];
  cabangList: CabangOption[];
  currentCabangId?: string;
  userCabangId?: string | null;
  userCabangNama?: string;
  userRole: string;
}

export function MejaClient({
  initialMejaList,
  cabangList,
  currentCabangId,
  userCabangId,
  userCabangNama,
  userRole,
}: MejaClientProps) {
  const router = useRouter();
  const effectiveCabangId =
    currentCabangId || userCabangId || cabangList[0]?.id || "";
  const [mejaList, setMejaList] = useState<MejaItem[]>(initialMejaList);
  const [selectedCabangId, setSelectedCabangId] =
    useState<string>(effectiveCabangId);
  const [selectedArea, setSelectedArea] = useState<string>("SEMUA");
  const [selectedStatus, setSelectedStatus] = useState<string>("SEMUA");
  const [capacityFilter, setCapacityFilter] = useState<string>("SEMUA");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedMeja, setSelectedMeja] = useState<MejaItem | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [notice, setNotice] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showNotice = (type: "success" | "error", message: string) => {
    setNotice({ type, message });
    setTimeout(() => {
      setNotice(null);
    }, 3500);
  };

  // Owner modal state for adding new table
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newNomorMeja, setNewNomorMeja] = useState<string>("");
  const [newKapasitas, setNewKapasitas] = useState<number>(4);
  const [newArea, setNewArea] = useState<AreaMeja>("Indoor");
  const [newBentuk, setNewBentuk] = useState<BentukMeja>("persegi");
  const [isSavingMeja, setIsSavingMeja] = useState<boolean>(false);

  // Sync meja list on interval (polling fallback)
  useEffect(() => {
    const fetchLatestData = async () => {
      try {
        const res = await getAntreanDataAction(selectedCabangId);
        if (res.success && res.mejaList) {
          setMejaList(res.mejaList);
          setLastRefreshed(new Date());

          // update currently selected table if still active
          if (selectedMeja) {
            const updated = res.mejaList.find(
              (m) =>
                m.id === selectedMeja.id ||
                m.nomor_meja === selectedMeja.nomor_meja,
            );
            if (updated) setSelectedMeja(updated);
          }
        }
      } catch {
        // silent fail for polling
      }
    };

    const interval = setInterval(fetchLatestData, 8000);
    return () => clearInterval(interval);
  }, [selectedCabangId, selectedMeja]);

  // Handle manual refresh
  const handleRefresh = async () => {
    startTransition(async () => {
      const res = await getAntreanDataAction(selectedCabangId);
      if (res.success && res.mejaList) {
        setMejaList(res.mejaList);
        setLastRefreshed(new Date());
        showNotice("success", "Denah meja berhasil disinkronkan");
      } else {
        showNotice("error", res.error || "Gagal menyinkronkan denah meja");
      }
    });
  };

  // Handle Clean Table (Konfirmasi Meja Bersih -> Tersedia)
  const handleBersihkanMeja = async (meja: MejaItem) => {
    startTransition(async () => {
      // Optimistic update status meja ke tersedia
      setMejaList((prev) =>
        prev.map((m) =>
          m.nomor_meja === meja.nomor_meja
            ? {
                ...m,
                status: "tersedia",
                transaksi_terkini_id: null,
                nomor_struk_terkini: null,
                waktu_terisi: null,
                pesanan_aktif: null,
              }
            : m
        )
      );
      const targetCabang = meja.cabang_id || selectedCabangId;
      const res = await bersihkanMejaAction(targetCabang, meja.nomor_meja);
      if (res.success) {
        showNotice(
          "success",
          `Meja ${meja.nomor_meja} selesai dibersihkan dan siap digunakan`,
        );
        const updateRes = await getAntreanDataAction(selectedCabangId);
        if (updateRes.success && updateRes.mejaList) {
          setMejaList(updateRes.mejaList);
        }
        setSelectedMeja(null);
      } else {
        showNotice("error", res.error || "Gagal membersihkan meja");
      }
    });
  };

  // Handle Pindahkan Meja ke Perlu Dibersihkan
  const handlePindahkanPerluBersih = async (meja: MejaItem) => {
    startTransition(async () => {
      const res = await pindahkanMejaKePerluDibersihkanAction(
        selectedCabangId,
        meja.nomor_meja,
      );
      if (res.success) {
        showNotice(
          "success",
          `Meja ${meja.nomor_meja} telah dipindahkan ke Perlu Dibersihkan`,
        );
        const updateRes = await getAntreanDataAction(selectedCabangId);
        if (updateRes.success && updateRes.mejaList) {
          setMejaList(updateRes.mejaList);
          const updated = updateRes.mejaList.find(
            (m) => m.nomor_meja === meja.nomor_meja,
          );
          if (updated) setSelectedMeja(updated);
        }
      } else {
        showNotice("error", res.error || "Gagal memindahkan status meja");
      }
    });
  };

  // Handle order from table
  const handlePesanSekarang = (meja: MejaItem) => {
    router.push(`/kasir?meja=${encodeURIComponent(meja.nomor_meja)}`);
  };

  // Owner: Add new table
  const handleSimpanMejaBaru = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNomorMeja.trim()) {
      showNotice("error", "Nomor meja wajib diisi");
      return;
    }

    setIsSavingMeja(true);
    try {
      const res = await tambahAtauUbahMejaAction(selectedCabangId, {
        nomor_meja: newNomorMeja.trim().toUpperCase(),
        kapasitas: Number(newKapasitas),
        area: newArea,
        bentuk: newBentuk,
      });

      if (res.success) {
        showNotice(
          "success",
          `Meja ${newNomorMeja.toUpperCase()} berhasil disimpan!`,
        );
        setShowAddModal(false);
        setNewNomorMeja("");
        const updateRes = await getAntreanDataAction(selectedCabangId);
        if (updateRes.success && updateRes.mejaList) {
          setMejaList(updateRes.mejaList);
        }
      } else {
        showNotice("error", res.error || "Gagal menyimpan meja");
      }
    } catch (err: unknown) {
      showNotice(
        "error",
        err instanceof Error ? err.message : "Terjadi kesalahan sistem",
      );
    } finally {
      setIsSavingMeja(false);
    }
  };

  // Statistics calculation
  const stats = useMemo(() => {
    const total = mejaList.length;
    const tersedia = mejaList.filter((m) => m.status === "tersedia").length;
    const terisi = mejaList.filter((m) => m.status === "terisi").length;
    const perluBersih = mejaList.filter(
      (m) => m.status === "menunggu_dibersihkan",
    ).length;
    return { total, tersedia, terisi, perluBersih };
  }, [mejaList]);

  // Filtered list
  const filteredMejaList = useMemo(() => {
    return mejaList.filter((m) => {
      // Area filter
      if (selectedArea !== "SEMUA" && m.area !== selectedArea) {
        return false;
      }
      // Status filter
      if (selectedStatus !== "SEMUA" && m.status !== selectedStatus) {
        return false;
      }
      // Capacity filter
      if (capacityFilter === "2" && m.kapasitas !== 2) return false;
      if (capacityFilter === "4" && m.kapasitas !== 4) return false;
      if (capacityFilter === "6+" && m.kapasitas < 6) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNomor = m.nomor_meja.toLowerCase().includes(q);
        const matchesStruk = (
          m.pesanan_aktif?.nomor_struk ||
          m.nomor_struk_terkini ||
          ""
        )
          .toLowerCase()
          .includes(q);
        if (!matchesNomor && !matchesStruk) return false;
      }
      return true;
    });
  }, [mejaList, selectedArea, selectedStatus, capacityFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Notice Feedback Banner */}
      {notice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center justify-between border animate-in fade-in ${
            notice.type === "success"
              ? "bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/50"
              : "bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-200 dark:border-rose-900/50"
          }`}
        >
          <span>{notice.message}</span>
          <button
            onClick={() => setNotice(null)}
            className="ml-2 font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E8DFD8] dark:border-[#382E2B] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-[#FAF0E6] dark:bg-[#2C221E] text-[#8C5E3C] border border-[#E8DFD8] dark:border-[#3E312B]">
              <LayoutGrid className="w-5 h-5 text-[#8C5E3C]" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#2D2422] dark:text-[#F5EBE6]">
                Denah & Status Meja
              </h1>
              <p className="text-xs text-[#8C7A70] dark:text-[#A8968D]">
                Visualisasi tata ruang dan kapasitas kursi coffee shop secara
                interaktif
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Cabang Switcher (Khusus Owner) atau Info Cabang Non-Owner */}
          {userRole === "owner" && cabangList.length > 1 ? (
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#231B18] px-3 py-1.5 rounded-xl border border-[#E8DFD8] dark:border-[#3E312B] shadow-sm">
              <Building2 className="w-4 h-4 text-[#8C5E3C]" />
              <select
                aria-label="Pilih Cabang"
                value={selectedCabangId}
                onChange={(e) => setSelectedCabangId(e.target.value)}
                className="text-xs font-semibold bg-transparent text-[#2D2422] dark:text-[#F5EBE6] outline-none cursor-pointer"
              >
                {cabangList.map((c) => (
                  <option key={c.id} value={c.id} className="dark:bg-[#231B18]">
                    {c.nama}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-white dark:bg-[#231B18] px-3 py-1.5 rounded-xl border border-[#E8DFD8] dark:border-[#3E312B] shadow-sm text-xs font-semibold text-[#2D2422] dark:text-[#F5EBE6]">
              <Building2 className="w-4 h-4 text-[#8C5E3C]" />
              <span>
                {userCabangNama ||
                  cabangList.find((c) => c.id === selectedCabangId)?.nama ||
                  "Cabang Aktif"}
              </span>
            </div>
          )}

          {/* Sync Button */}
          <button
            onClick={handleRefresh}
            disabled={isPending}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#231B18] text-[#5C4538] dark:text-[#D5C2B6] border border-[#E8DFD8] dark:border-[#3E312B] hover:bg-[#FAF7F2] dark:hover:bg-[#2A211D] transition-colors shadow-sm disabled:opacity-50"
            title={
              lastRefreshed
                ? `Terakhir diperbarui: ${lastRefreshed.toLocaleTimeString("id-ID")}`
                : "Sinkronisasi data meja"
            }
            suppressHydrationWarning
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isPending ? "animate-spin text-[#8C5E3C]" : ""}`}
            />
            <span>Sinkron</span>
          </button>

          {/* Owner Add Table Button */}
          {userRole === "owner" && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-[#8C5E3C] hover:bg-[#734A2E] text-white shadow-sm transition-all hover:shadow"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Meja</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards with CountUp */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#8C7A70] dark:text-[#A8968D]">
              Total Meja
            </span>
            <span className="p-1.5 rounded-lg bg-[#FAF0E6] dark:bg-[#2C221E] text-[#8C5E3C]">
              <LayoutGrid className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums tracking-tight text-[#2D2422] dark:text-[#F5EBE6]">
            <CountUp value={stats.total} />
            <span className="text-xs font-normal text-[#8C7A70] ml-1.5">
              unit
            </span>
          </div>
          <p className="text-[11px] text-[#8C7A70] dark:text-[#A8968D] mt-1">
            Kapasitas terdaftar di cabang
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#231B18] border border-emerald-200/80 dark:border-emerald-950/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-400">
              Meja Tersedia
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums tracking-tight text-emerald-700 dark:text-emerald-400">
            <CountUp value={stats.tersedia} />
            <span className="text-xs font-normal text-emerald-600/80 ml-1.5">
              kosong
            </span>
          </div>
          <p className="text-[11px] text-emerald-600/80 dark:text-emerald-400/70 mt-1">
            Siap ditempati pelanggan
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#231B18] border border-amber-200/80 dark:border-amber-950/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-400">
              Meja Terisi
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
              <Coffee className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums tracking-tight text-amber-700 dark:text-amber-400">
            <CountUp value={stats.terisi} />
            <span className="text-xs font-normal text-amber-600/80 ml-1.5">
              dine-in
            </span>
          </div>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-400/70 mt-1">
            Sedang menikmati pesanan
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#231B18] border border-amber-200/80 dark:border-amber-950/60 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 dark:text-amber-300">
              Perlu Dibersihkan
            </span>
            <span className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-300">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black tabular-nums tracking-tight text-amber-600 dark:text-amber-300">
            <CountUp value={stats.perluBersih} />
            <span className="text-xs font-normal text-amber-600/80 ml-1.5">
              meja
            </span>
          </div>
          <p className="text-[11px] text-amber-600/80 dark:text-amber-300/70 mt-1">
            Pelanggan telah checkout
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] shadow-sm space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Table */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C7A70]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor meja, nama pelanggan, antrean..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-[#FAF7F2] dark:bg-[#1E1715] border border-[#E8DFD8] dark:border-[#3E312B] text-[#2D2422] dark:text-[#F5EBE6] placeholder-[#A8968D] outline-none focus:border-[#8C5E3C] transition-colors"
            />
          </div>

          {/* 4 Status Filter Buttons (Sesuai Permintaan: Semua, Tersedia, Terisi, Perlu Dibersihkan) */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              {
                id: "SEMUA",
                label: "Semua",
                count: stats.total,
                badgeColor: "bg-[#E8DFD8] text-[#5C4538]",
              },
              {
                id: "tersedia",
                label: "Tersedia",
                count: stats.tersedia,
                badgeColor:
                  "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
              },
              {
                id: "terisi",
                label: "Terisi",
                count: stats.terisi,
                badgeColor:
                  "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
              },
              {
                id: "menunggu_dibersihkan",
                label: "Perlu Dibersihkan",
                count: stats.perluBersih,
                badgeColor:
                  "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
              },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-2 transition-all cursor-pointer ${
                  selectedStatus === st.id
                    ? "bg-[#8C5E3C] text-white shadow-sm"
                    : "bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE] dark:hover:bg-[#2D221E]"
                }`}
              >
                <span>{st.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold tabular-nums ${
                    selectedStatus === st.id
                      ? "bg-white/20 text-white"
                      : st.badgeColor
                  }`}
                >
                  {st.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Capacity & Area Filter Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F2ECE6] dark:border-[#2E2522]">
          <div className="flex flex-wrap items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#8C5E3C]" />
            <span className="text-xs font-medium text-[#8C7A70]">
              Kapasitas:
            </span>
            {(["SEMUA", "2", "4", "6+"] as const).map((cap) => (
              <button
                key={cap}
                onClick={() => setCapacityFilter(cap)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                  capacityFilter === cap
                    ? "bg-[#5C4538] text-white font-bold"
                    : "bg-[#FAF7F2] dark:bg-[#1E1715] text-[#8C7A70] hover:text-[#5C4538]"
                }`}
              >
                {cap === "SEMUA"
                  ? "Semua"
                  : cap === "6+"
                    ? "6+ Kursi"
                    : `${cap} Kursi`}
              </button>
            ))}

            <span className="text-xs font-medium text-[#8C7A70] ml-3">
              Area:
            </span>
            {(["SEMUA", "Indoor", "Outdoor", "Teras"] as const).map((ar) => (
              <button
                key={ar}
                onClick={() => setSelectedArea(ar)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                  selectedArea === ar
                    ? "bg-[#8C5E3C] text-white font-bold"
                    : "bg-[#FAF7F2] dark:bg-[#1E1715] text-[#8C7A70] hover:text-[#5C4538]"
                }`}
              >
                {ar}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-[#8C7A70] dark:text-[#A8968D]">
            Menampilkan{" "}
            <span className="font-bold text-[#2D2422] dark:text-[#F5EBE6]">
              {filteredMejaList.length}
            </span>{" "}
            dari {stats.total} meja
          </div>
        </div>
      </div>

      {/* Main Unified Floor Plan Grid */}
      {filteredMejaList.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#231B18] border border-dashed border-[#E8DFD8] dark:border-[#3E312B]">
          <AlertCircle className="w-10 h-10 mx-auto text-[#C2B2A3] dark:text-[#5C4538] mb-3" />
          <h3 className="text-sm font-bold text-[#2D2422] dark:text-[#F5EBE6]">
            Tidak ada meja yang sesuai filter
          </h3>
          <p className="text-xs text-[#8C7A70] dark:text-[#A8968D] mt-1 max-w-sm mx-auto">
            Coba sesuaikan filter status atau kapasitas di atas untuk
            menampilkan denah meja yang diinginkan.
          </p>
          <button
            onClick={() => {
              setSelectedStatus("SEMUA");
              setCapacityFilter("SEMUA");
              setSearchQuery("");
            }}
            className="mt-4 px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#FAF0E6] text-[#8C5E3C] hover:bg-[#EFE2D3] transition-colors cursor-pointer"
          >
            Reset Semua Filter
          </button>
        </div>
      ) : (
        <div className="p-5 md:p-6 rounded-3xl bg-white dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-[#F2ECE6] dark:border-[#2E2522] pb-3">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-5 rounded-full bg-[#8C5E3C]" />
              <h2 className="text-base font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                Denah Lantai Coffee Shop
              </h2>
              <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#FAF0E6] dark:bg-[#2C221E] text-[#8C5E3C]">
                {filteredMejaList.length} Meja
              </span>
            </div>
            <span className="text-xs text-[#8C7A70] dark:text-[#A8968D] hidden sm:inline">
              Klik meja untuk melihat detail pesanan &amp; kontrol siklus status
            </span>
          </div>

          {/* Grid of Tables */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6 justify-items-center py-6">
            {filteredMejaList.map((meja) => (
              <div key={meja.id} className="flex flex-col items-center">
                <TableShape
                  nomorMeja={meja.nomor_meja}
                  kapasitas={meja.kapasitas}
                  bentuk={meja.bentuk}
                  status={meja.status}
                  area={meja.area}
                  isSelected={selectedMeja?.id === meja.id}
                  onClick={() => setSelectedMeja(meja)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table Detail Drawer / Modal */}
      {selectedMeja && (
        <TableDetailDrawer
          meja={selectedMeja}
          onClose={() => setSelectedMeja(null)}
          onBersihkan={() => handleBersihkanMeja(selectedMeja)}
          onPindahkanPerluBersih={() =>
            handlePindahkanPerluBersih(selectedMeja)
          }
          onPesan={() => handlePesanSekarang(selectedMeja)}
          isPending={isPending}
        />
      )}

      {/* Owner: Add Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-[#F2ECE6] dark:border-[#2E2522] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-[#FAF0E6] text-[#8C5E3C]">
                  <Plus className="w-4 h-4" />
                </span>
                <h3 className="text-sm font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                  Tambah / Atur Meja Baru
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-[#8C7A70] hover:text-[#2D2422] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSimpanMejaBaru}
              className="p-5 space-y-4 text-xs"
            >
              <div>
                <label className="block font-semibold text-[#2D2422] dark:text-[#F5EBE6] mb-1">
                  Nomor / Label Meja
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: 01, 15, V-01"
                  value={newNomorMeja}
                  onChange={(e) => setNewNomorMeja(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1715] border border-[#E8DFD8] dark:border-[#3E312B] text-[#2D2422] dark:text-[#F5EBE6] uppercase font-bold outline-none focus:border-[#8C5E3C]"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2D2422] dark:text-[#F5EBE6] mb-1">
                  Kapasitas Kursi (2, 4, 6, 8)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[2, 4, 6, 8].map((k) => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => {
                        setNewKapasitas(k);
                        if (k <= 2) setNewBentuk("lingkaran");
                        else if (k <= 4) setNewBentuk("persegi");
                        else setNewBentuk("persegi_panjang");
                      }}
                      className={`py-2 rounded-xl border text-xs font-bold transition-all ${
                        newKapasitas === k
                          ? "bg-[#8C5E3C] text-white border-[#8C5E3C]"
                          : "bg-[#FAF7F2] dark:bg-[#1E1715] border-[#E8DFD8] dark:border-[#3E312B] text-[#5C4538]"
                      }`}
                    >
                      {k} Kursi
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#2D2422] dark:text-[#F5EBE6] mb-1">
                    Area Meja
                  </label>
                  <select
                    value={newArea}
                    onChange={(e) => setNewArea(e.target.value as AreaMeja)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1715] border border-[#E8DFD8] dark:border-[#3E312B] text-[#2D2422] dark:text-[#F5EBE6] font-medium outline-none focus:border-[#8C5E3C]"
                  >
                    <option value="Indoor">Indoor</option>
                    <option value="Outdoor">Outdoor</option>
                    <option value="Teras">Teras</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-[#2D2422] dark:text-[#F5EBE6] mb-1">
                    Bentuk Visual
                  </label>
                  <select
                    value={newBentuk}
                    onChange={(e) => setNewBentuk(e.target.value as BentukMeja)}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF7F2] dark:bg-[#1E1715] border border-[#E8DFD8] dark:border-[#3E312B] text-[#2D2422] dark:text-[#F5EBE6] font-medium outline-none focus:border-[#8C5E3C]"
                  >
                    <option value="lingkaran">Lingkaran (2 Kursi)</option>
                    <option value="persegi">Persegi (4 Kursi)</option>
                    <option value="persegi_panjang">
                      Persegi Panjang (6-8 Kursi)
                    </option>
                  </select>
                </div>
              </div>

              {/* Preview Box */}
              <div className="p-4 rounded-2xl bg-[#FAF7F2] dark:bg-[#1C1614] border border-dashed border-[#E8DFD8] dark:border-[#382E2B] flex flex-col items-center justify-center">
                <span className="text-[10px] text-[#8C7A70] uppercase font-bold mb-2">
                  Preview Denah
                </span>
                <TableShape
                  nomorMeja={newNomorMeja || "??"}
                  kapasitas={newKapasitas}
                  bentuk={newBentuk}
                  status="tersedia"
                  area={newArea}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-[#FAF7F2] text-[#8C7A70] font-semibold hover:text-[#2D2422]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingMeja}
                  className="px-4 py-2 rounded-xl bg-[#8C5E3C] hover:bg-[#734A2E] text-white font-bold shadow-sm transition-all disabled:opacity-50"
                >
                  {isSavingMeja ? "Menyimpan..." : "Simpan Meja"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
