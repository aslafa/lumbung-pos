'use client';

import React, { useState } from 'react';
import { PesananAntreanItem, StatusPengerjaan } from '@/lib/orders/order-types';
import { ChefHat, Clock, Utensils, ShoppingBag, X, RefreshCw, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { OrderTrackingModal } from '@/components/orders/OrderTrackingModal';

interface KasirAntreanModalProps {
  isOpen: boolean;
  onClose: () => void;
  antreanList: PesananAntreanItem[];
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function KasirAntreanModal({
  isOpen,
  onClose,
  antreanList,
  onRefresh,
  isRefreshing = false,
}: KasirAntreanModalProps) {
  const router = useRouter();
  const [selectedOrder, setSelectedOrder] = useState<PesananAntreanItem | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  if (!isOpen) return null;

  const countMenunggu = antreanList.filter((p) => p.status_pengerjaan === 'MENUNGGU').length;
  const countDiproses = antreanList.filter((p) => p.status_pengerjaan === 'DIPROSES').length;
  const countSiap = antreanList.filter((p) => p.status_pengerjaan === 'SIAP_DIAMBIL').length;

  const getStatusBadge = (status: StatusPengerjaan) => {
    switch (status) {
      case 'MENUNGGU':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300">
            Menunggu
          </span>
        );
      case 'DIPROSES':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-300 animate-pulse">
            Diproses Barista
          </span>
        );
      case 'SIAP_DIAMBIL':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300">
            Siap Diambil
          </span>
        );
      case 'SELESAI':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400">
            Selesai
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FAF7F2] dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative space-y-4 max-h-[90vh] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-2">
              <ChefHat className="w-5 h-5 text-[#C67C4E]" />
              <span>Daftar Antrean &amp; Status KDS</span>
            </h3>
            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
              Pantau antrean yang sedang menunggu, diproses, atau siap diserahkan
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                title="Segarkan data antrean"
                className="p-1.5 text-[#78716C] hover:text-[#C67C4E] rounded-xl hover:bg-white dark:hover:bg-[#28211B] transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[#C67C4E]' : ''}`} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Counter Summary Pills */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-xl p-2.5">
            <span className="block text-[11px] font-bold text-amber-900 dark:text-amber-300">Menunggu</span>
            <span className="text-lg font-black text-amber-800 dark:text-amber-400 tabular-nums">{countMenunggu}</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 rounded-xl p-2.5">
            <span className="block text-[11px] font-bold text-blue-900 dark:text-blue-300">Diproses</span>
            <span className="text-lg font-black text-blue-800 dark:text-blue-400 tabular-nums">{countDiproses}</span>
          </div>
          <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 rounded-xl p-2.5">
            <span className="block text-[11px] font-bold text-emerald-900 dark:text-emerald-300">Siap Diambil</span>
            <span className="text-lg font-black text-emerald-800 dark:text-emerald-400 tabular-nums">{countSiap}</span>
          </div>
        </div>

        {/* List Pesanan Antrean */}
        <div className="overflow-y-auto max-h-[50vh] space-y-2.5 pr-1 flex-1">
          {antreanList.length === 0 ? (
            <div className="py-12 text-center text-[#A8A29E] dark:text-[#78716C] space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500/50 stroke-[1.5]" />
              <p className="text-xs font-semibold">Tidak ada antrean pesanan aktif saat ini.</p>
              <p className="text-[11px] text-[#A8A29E]">Seluruh pesanan telah selesai dikerjakan.</p>
            </div>
          ) : (
            antreanList.map((item) => (
              <div
                key={item.transaksi_id}
                onClick={() => setSelectedOrder(item)}
                className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-3.5 space-y-2.5 shadow-2xs hover:border-[#C67C4E] hover:shadow-md transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between border-b border-[#F2ECE6] dark:border-[#2E2522] pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-ticket font-bold text-base text-[#4A2E18] dark:text-[#F5EBE1] bg-[#FAF0E6] dark:bg-[#2C221E] px-2.5 py-0.5 rounded-lg border border-[#E8DFD8] group-hover:scale-105 transition-transform">
                      {item.nomor_antrean}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-[#2C1810] dark:text-[#F5EBE1] group-hover:text-[#C67C4E] transition-colors">
                        {item.nama_pelanggan || (item.nomor_meja ? `Meja ${item.nomor_meja}` : 'Pelanggan')}
                      </p>
                      <p className="text-[10px] text-[#78716C] font-mono">{item.nomor_struk}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#78716C]">
                      {item.jenis_pesanan === 'DINE_IN' ? (
                        <>
                          <Utensils className="w-3.5 h-3.5 text-[#C67C4E]" />
                          <span>Meja {item.nomor_meja || '-'}</span>
                        </>
                      ) : (
                        <>
                          <ShoppingBag className="w-3.5 h-3.5 text-blue-600" />
                          <span>Takeaway</span>
                        </>
                      )}
                    </span>
                    {getStatusBadge(item.status_pengerjaan)}
                  </div>
                </div>

                {/* Items & Custom Notes */}
                <div className="space-y-1 text-xs">
                  {item.items.map((it, idx) => (
                    <div key={idx} className="flex items-baseline justify-between text-[#4A2E18] dark:text-[#EAE0D5]">
                      <span>
                        <strong className="text-[#C67C4E]">{it.jumlah}x</strong> {it.nama}
                        {it.catatan && (
                          <span className="ml-1 text-[11px] text-[#A8968D] italic font-normal">
                            ({it.catatan})
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                  {item.catatan_pesanan && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded-md font-medium">
                      Catatan: {item.catatan_pesanan}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between text-[10px] text-[#A8A29E] pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Dipesan: {new Date(item.dibuat_pada).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</span>
                  </span>
                  <span className="font-semibold text-emerald-600">
                    {item.status_pembayaran === 'lunas' ? 'Lunas' : 'Menunggu Bayar'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-[#E8DFD3] dark:border-[#2C2420] pt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push('/antrean');
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C5E3C] hover:text-[#4A2E18] transition-colors cursor-pointer"
          >
            <span>Buka Layar Penuh KDS Barista</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#8C5E3C] hover:bg-[#734A2E] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Modal Detail Tracking Pesanan */}
      {selectedOrder && (
        <OrderTrackingModal
          isOpen={!!selectedOrder}
          onClose={() => setSelectedOrder(null)}
          order={selectedOrder}
          userRole="kasir"
          isPendingAction={isUpdatingStatus}
          onUpdateStatus={async (transaksiId, nextStatus) => {
            setIsUpdatingStatus(true);
            try {
              const { updateStatusPengerjaanAction } = await import('@/app/actions/antrean');
              const res = await updateStatusPengerjaanAction(transaksiId, nextStatus);
              if (res.success) {
                if (res.pesanan) {
                  setSelectedOrder(res.pesanan);
                } else {
                  setSelectedOrder((prev) => (prev ? { ...prev, status_pengerjaan: nextStatus } : null));
                }
              }
              if (onRefresh) onRefresh();
            } finally {
              setIsUpdatingStatus(false);
            }
          }}
        />
      )}
    </div>
  );
}
