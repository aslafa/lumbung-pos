'use client';

import React, { useState, useMemo } from 'react';
import { MejaItem, StatusMeja, createDefaultMejaList, isTableCleaning, matchNomorMeja } from '@/lib/orders/order-types';
import { TableShape } from '@/components/meja/TableShape';
import { X, Check, AlertCircle, Sparkles, Coffee } from 'lucide-react';

interface TableSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  mejaList: MejaItem[];
  selectedMeja: string | null;
  onSelectMeja: (nomorMeja: string) => void;
  onCleanMeja?: (nomorMeja: string) => void | Promise<void>;
}

export function TableSelectorModal(props: TableSelectorModalProps) {
  if (!props.isOpen) return null;
  return <TableSelectorModalDialog {...props} />;
}

function TableSelectorModalDialog({
  onClose,
  mejaList,
  selectedMeja: initialSelectedMeja,
  onSelectMeja,
  onCleanMeja,
}: TableSelectorModalProps) {
  const [filterKapasitas, setFilterKapasitas] = useState<number | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<StatusMeja | 'all'>('all');
  const [tentativeMeja, setTentativeMeja] = useState<string | null>(initialSelectedMeja);
  const [cleaningMap, setCleaningMap] = useState<Record<string, boolean>>({});

  // Fallback: Jika mejaList belum terhidrasi, gunakan daftar denah meja standar cabang
  const effectiveMejaList = useMemo<MejaItem[]>(() => {
    if (mejaList && mejaList.length > 0) return mejaList;
    return createDefaultMejaList('default-pos');
  }, [mejaList]);

  // State lokal untuk menandai meja yang baru dibersihkan sebelum prop mejaList tersinkronisasi
  const [cleanedMejaSet, setCleanedMejaSet] = useState<Set<string>>(() => new Set<string>());

  // Daftar meja final dengan status optimistik diterapkan secara murni/deklaratif
  const displayMejaList = useMemo<MejaItem[]>(() => {
    return effectiveMejaList.map((m: MejaItem) => {
      const isCleaned = Array.from(cleanedMejaSet).some((num) => matchNomorMeja(num, m.nomor_meja));
      if (isCleaned) {
        return {
          ...m,
          status: 'tersedia' as StatusMeja,
          transaksi_terkini_id: null,
          nomor_struk_terkini: null,
          waktu_terisi: null,
          pesanan_aktif: null,
        };
      }
      return m;
    });
  }, [effectiveMejaList, cleanedMejaSet]);

  const filteredMeja = useMemo<MejaItem[]>(() => {
    return displayMejaList.filter((m: MejaItem) => {
      if (filterKapasitas !== 'all' && m.kapasitas !== filterKapasitas) return false;
      if (filterStatus !== 'all') {
        if (filterStatus === 'menunggu_dibersihkan' || filterStatus === 'perlu_dibersihkan') {
          if (!isTableCleaning(m.status)) return false;
        } else if (m.status !== filterStatus) {
          return false;
        }
      }
      return true;
    });
  }, [displayMejaList, filterKapasitas, filterStatus]);

  const activeMejaObj = displayMejaList.find((m: MejaItem) =>
    tentativeMeja ? matchNomorMeja(m.nomor_meja, tentativeMeja) : false
  );

  const stats = useMemo(() => {
    return {
      total: displayMejaList.length,
      tersedia: displayMejaList.filter((m: MejaItem) => m.status === 'tersedia').length,
      terisi: displayMejaList.filter((m: MejaItem) => m.status === 'terisi').length,
      perluBersih: displayMejaList.filter((m: MejaItem) => isTableCleaning(m.status)).length,
    };
  }, [displayMejaList]);

  const handleCleanTable = async (nomorMeja: string) => {
    setCleaningMap((prev) => ({ ...prev, [nomorMeja]: true }));
    // Optimistic UI: tandai meja sebagai sudah dibersihkan secara instan
    setCleanedMejaSet((prev) => new Set(prev).add(nomorMeja));

    try {
      if (onCleanMeja) {
        await onCleanMeja(nomorMeja);
      }
    } catch {
      // Rollback jika terjadi kegagalan
      setCleanedMejaSet((prev) => {
        const next = new Set(prev);
        next.delete(nomorMeja);
        return next;
      });
    } finally {
      setCleaningMap((prev) => ({ ...prev, [nomorMeja]: false }));
    }
  };

  const handleConfirm = () => {
    if (tentativeMeja) {
      onSelectMeja(tentativeMeja);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FAF7F2] dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-4xl w-full shadow-2xl flex flex-col h-[90vh] max-h-[820px] overflow-hidden">
        <div className="p-4 sm:p-6 flex flex-col h-full gap-3 sm:gap-4 overflow-hidden">
          {/* Header Tetap (Fixed Header) */}
          <div className="flex-shrink-0 flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-2">
                <Coffee className="w-5 h-5 text-[#8C5E3C]" />
                <span>Denah Meja &amp; Kursi (Dine In)</span>
              </h3>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
                Pilih meja kosong sesuai kapasitas tamu yang datang ({stats.tersedia} meja siap pakai)
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Tutup modal"
              className="p-1.5 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Kontrol Filter & Legenda Tetap (Fixed Controls) */}
          <div className="flex-shrink-0 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
              {/* Status Filters (Semua, Tersedia, Terisi, Perlu Dibersihkan) */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filterStatus === 'all'
                      ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E] dark:text-[#12100E] shadow-xs'
                      : 'bg-white dark:bg-[#1E1915] text-[#78716C] dark:text-[#A8A29E] border border-[#E8DFD3] dark:border-[#2C2420]'
                  }`}
                >
                  Semua ({stats.total})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('tersedia')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filterStatus === 'tersedia'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-white dark:bg-[#1E1915] text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60'
                  }`}
                >
                  Tersedia ({stats.tersedia})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('terisi')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filterStatus === 'terisi'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-white dark:bg-[#1E1915] text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60'
                  }`}
                >
                  Terisi ({stats.terisi})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterStatus('menunggu_dibersihkan')}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    filterStatus === 'menunggu_dibersihkan' || filterStatus === 'perlu_dibersihkan'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-white dark:bg-[#1E1915] text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60'
                  }`}
                >
                  Perlu Dibersihkan ({stats.perluBersih})
                </button>
              </div>

              {/* Capacity Filters */}
              <div className="flex items-center gap-1 bg-white dark:bg-[#14110F] p-1 rounded-xl border border-[#E8DFD3] dark:border-[#2C2420] shadow-2xs">
                <button
                  type="button"
                  onClick={() => setFilterKapasitas('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                    filterKapasitas === 'all'
                      ? 'bg-[#8C5E3C] text-white shadow-2xs'
                      : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#2C1810]'
                  }`}
                >
                  Semua Kursi
                </button>
                <button
                  type="button"
                  onClick={() => setFilterKapasitas(2)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                    filterKapasitas === 2
                      ? 'bg-[#8C5E3C] text-white shadow-2xs'
                      : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#2C1810]'
                  }`}
                >
                  2 Kursi
                </button>
                <button
                  type="button"
                  onClick={() => setFilterKapasitas(4)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                    filterKapasitas === 4
                      ? 'bg-[#8C5E3C] text-white shadow-2xs'
                      : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#2C1810]'
                  }`}
                >
                  4 Kursi
                </button>
                <button
                  type="button"
                  onClick={() => setFilterKapasitas(6)}
                  className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer transition-colors ${
                    filterKapasitas === 6
                      ? 'bg-[#8C5E3C] text-white shadow-2xs'
                      : 'text-[#78716C] dark:text-[#A8A29E] hover:text-[#2C1810]'
                  }`}
                >
                  6+ Kursi
                </button>
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-3 text-[11px] text-[#78716C] dark:text-[#A8A29E] px-1">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-2xs"></span> Tersedia
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-2xs"></span> Terisi
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-2xs"></span> Perlu Bersih
              </span>
            </div>
          </div>

          {/* Area Denah Meja Dapat Di-scroll (Scrollable Grid Area) */}
          <div className="flex-1 min-h-0 overflow-y-auto bg-white/60 dark:bg-[#161210]/60 rounded-2xl border border-[#E8DFD3]/80 dark:border-[#2C2420] p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 justify-items-center items-start">
              {filteredMeja.length === 0 ? (
                <div className="col-span-full py-12 text-center text-xs text-[#78716C]">
                  Tidak ada meja yang cocok dengan filter yang dipilih.
                </div>
              ) : (
                filteredMeja.map((meja: MejaItem) => {
                  const isSelected = tentativeMeja === meja.nomor_meja;
                  const isAvailable = meja.status === 'tersedia';
                  const isCleaning = isTableCleaning(meja.status);
                  const isProcessingClean = !!cleaningMap[meja.nomor_meja];

                  return (
                    <div key={meja.id} className="relative flex flex-col items-center justify-center p-1 w-full max-w-[160px]">
                      <TableShape
                        nomorMeja={meja.nomor_meja}
                        kapasitas={meja.kapasitas}
                        bentuk={meja.bentuk}
                        status={meja.status}
                        area={meja.area}
                        isSelected={isSelected}
                        onClick={() => {
                          if (isAvailable) {
                            setTentativeMeja(meja.nomor_meja);
                          }
                        }}
                      />

                      {/* Tombol Bersihkan Cepat untuk Crew / Kasir POS */}
                      {isCleaning && onCleanMeja && (
                        <button
                          type="button"
                          disabled={isProcessingClean}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCleanTable(meja.nomor_meja);
                          }}
                          className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-800 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="w-3 h-3 text-amber-700 dark:text-amber-400" />
                          <span>{isProcessingClean ? 'Membersihkan...' : 'Bersihkan'}</span>
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer Konfirmasi Tetap (Fixed Footer - Selalu di dalam modal) */}
          <div className="flex-shrink-0 border-t border-[#E8DFD3] dark:border-[#2C2420] pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs bg-[#FAF7F2] dark:bg-[#1E1915]">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {activeMejaObj ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF0E6] dark:bg-[#2C221E] border border-[#E8DFD8] text-[#2C1810] dark:text-[#F5EBE1]">
                  <span className="font-bold text-sm text-[#8C5E3C]">Meja {activeMejaObj.nomor_meja}</span>
                  <span className="text-[11px] text-[#78716C]">({activeMejaObj.kapasitas} Kursi • Area {activeMejaObj.area})</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[#78716C] dark:text-[#A8A29E]">
                  <AlertCircle className="w-4 h-4 text-[#8C5E3C]" />
                  <span>Pilih salah satu meja yang berstatus hijau (Tersedia).</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 sm:flex-none px-4 py-2 bg-transparent text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!tentativeMeja}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-[#8C5E3C] hover:bg-[#734A2E] text-white font-bold rounded-xl shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Gunakan Meja {tentativeMeja || ''}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
