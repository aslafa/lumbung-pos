'use client';

import React, { useState, useEffect } from 'react';
import { MejaItem } from '@/lib/orders/order-types';
import { TableStatusBadge } from './TableStatusBadge';
import { formatRupiah } from '@/lib/utils/format';
import { X, Users, MapPin, Clock, Receipt, Sparkles, CheckCircle2 } from 'lucide-react';

interface TableDetailDrawerProps {
  meja: MejaItem | null;
  isOpen?: boolean;
  onClose: () => void;
  onCleanMeja?: (nomorMeja: string) => void;
  onBersihkan?: () => void | Promise<void>;
  onPindahkanPerluBersih?: () => void | Promise<void>;
  onPesan?: () => void;
  isPending?: boolean;
}

export function TableDetailDrawer({
  meja,
  isOpen = true,
  onClose,
  onCleanMeja,
  onBersihkan,
  onPindahkanPerluBersih,
  onPesan,
  isPending = false,
}: TableDetailDrawerProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (!isOpen || !meja) return null;

  const isOccupied = meja.status === 'terisi';
  const isCleaning = meja.status === 'menunggu_dibersihkan';
  const isAvailable = meja.status === 'tersedia';

  // Hitung durasi terisi
  let durasiMenit = 0;
  if (meja.waktu_terisi) {
    durasiMenit = Math.max(0, Math.floor((now - new Date(meja.waktu_terisi).getTime()) / 60000));
  }

  const pesanan = meja.pesanan_aktif;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-5 animate-in zoom-in-95 duration-200">
        {/* Header Drawer */}
        <div className="flex items-start justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h3 className="text-2xl font-extrabold font-mono text-[#2C1810] dark:text-[#F5EBE1] tabular-nums">
                {meja.nomor_meja}
              </h3>
              <TableStatusBadge status={meja.status} size="md" />
            </div>
            <div className="flex items-center gap-2 text-xs text-[#78716C] dark:text-[#A8A29E]">
              <span className="flex items-center gap-1">
                <Users className="w-3.5 h-3.5 text-[#C67C4E]" />
                <span className="font-semibold">{meja.kapasitas} Kursi</span>
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#C67C4E]" />
                <span className="font-semibold">{meja.area || 'Indoor'}</span>
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#28211B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="space-y-4 text-xs">
          {/* Detail Penggunaan Meja */}
          {isOccupied && (
            <div className="p-4 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5 font-medium">
                  <Receipt className="w-4 h-4 text-[#C67C4E]" />
                  <span>Nomor Struk:</span>
                </span>
                <span className="font-mono font-bold whitespace-nowrap text-sm text-[#2C1810] dark:text-[#F5EBE1]">
                  {meja.nomor_struk_terkini || pesanan?.nomor_struk || '-'}
                </span>
              </div>

              {pesanan?.nomor_antrean && (
                <div className="flex items-center justify-between">
                  <span className="text-[#78716C] dark:text-[#A8A29E] font-medium">Nomor Antrean:</span>
                  <span className="px-2 py-0.5 rounded-lg bg-[#C67C4E]/15 text-[#8C5E3C] dark:text-[#E0A96D] font-mono font-bold">
                    {pesanan.nomor_antrean}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-[#78716C] dark:text-[#A8A29E] font-medium">Status Pembayaran:</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {pesanan?.status_pembayaran || 'LUNAS'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#78716C] dark:text-[#A8A29E] font-medium">Status Pengerjaan:</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  {pesanan?.status_pengerjaan || 'SEDANG DISAJIKAN'}
                </span>
              </div>

              {meja.waktu_terisi && (
                <div className="flex items-center justify-between">
                  <span className="text-[#78716C] dark:text-[#A8A29E] flex items-center gap-1.5 font-medium">
                    <Clock className="w-4 h-4 text-[#C67C4E]" />
                    <span>Durasi Penggunaan:</span>
                  </span>
                  <span className="font-bold text-amber-800 dark:text-amber-300 font-mono tabular-nums">
                    {durasiMenit} Menit
                  </span>
                </div>
              )}

              {/* Items Pesanan Terkini */}
              {pesanan?.items && pesanan.items.length > 0 && (
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/60 space-y-1.5">
                  <span className="text-[11px] font-bold text-[#78716C] dark:text-[#A8A29E] uppercase tracking-wider block mb-1">
                    Item Dipesan:
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {pesanan.items.map((it, idx) => (
                      <div key={idx} className="flex flex-col text-[#2C1810] dark:text-[#F5EBE1] pb-1 border-b border-amber-100 dark:border-amber-900/30 last:border-b-0">
                        <div className="flex justify-between items-center font-medium">
                          <span>
                            <span className="font-mono font-bold text-[#C67C4E] mr-1.5">{it.jumlah}x</span>
                            {it.nama}
                          </span>
                        </div>
                        {it.catatan && (
                          <span className="text-[10px] text-[#8C7A70] dark:text-[#A8968D] italic pl-4">
                            ↳ {it.catatan}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                  {pesanan.total > 0 && (
                    <div className="flex justify-between items-center pt-2 font-bold text-[#2C1810] dark:text-[#F5EBE1] border-t border-amber-200/40 dark:border-amber-900/40 mt-2">
                      <span>Total Pesanan:</span>
                      <span className="font-mono tabular-nums text-[#C67C4E]">
                        {formatRupiah(pesanan.total)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {isCleaning && (
            <div className="p-4 bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/50 rounded-2xl flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-sky-600 dark:text-sky-400 shrink-0" />
              <div className="space-y-0.5">
                <span className="font-bold text-sky-900 dark:text-sky-200 block text-xs">
                  Meja Perlu Dibersihkan
                </span>
                <p className="text-[11px] text-sky-700 dark:text-sky-300">
                  Pelanggan telah selesai. Bersihkan dan rapikan meja sebelum mengonfirmasi siap untuk tamu berikutnya.
                </p>
              </div>
            </div>
          )}

          {isAvailable && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-2xl flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="space-y-0.5">
                <span className="font-bold text-emerald-900 dark:text-emerald-200 block text-xs">
                  Meja Bersih &amp; Siap Digunakan
                </span>
                <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                  Meja ini siap dipilih kasir untuk pesanan Dine In pelanggan baru.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="border-t border-[#E8DFD3] dark:border-[#2C2420] pt-4 flex items-center justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#E8DFD3] dark:border-[#2C2420] font-semibold text-xs text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#28211B] transition-colors cursor-pointer"
          >
            Tutup
          </button>

          {isOccupied && onPindahkanPerluBersih && (
            <button
              onClick={onPindahkanPerluBersih}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Tandai Selesai &amp; Perlu Bersih</span>
            </button>
          )}

          {isCleaning && (onCleanMeja || onBersihkan) && (
            <button
              onClick={() => {
                if (onBersihkan) {
                  onBersihkan();
                } else if (onCleanMeja) {
                  onCleanMeja(meja.nomor_meja);
                  onClose();
                }
              }}
              disabled={isPending}
              className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Konfirmasi Meja Bersih</span>
            </button>
          )}

          {isAvailable && onPesan && (
            <button
              onClick={() => {
                onPesan();
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl bg-[#8C5E3C] hover:bg-[#734A2E] text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <span>Buat Pesanan Dine In</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
