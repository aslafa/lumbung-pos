'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Utensils,
  ShoppingBag,
  Clock,
  MapPin,
  Coffee,
  CheckCircle2,
  Flame,
  Bell,
  Receipt,
  AlertTriangle
} from 'lucide-react';
import { PesananAntreanItem, StatusPengerjaan } from '@/lib/orders/order-types';
import { OrderTimelineStepper } from './OrderTimelineStepper';
import { formatRupiah } from '@/lib/utils/format';

export interface OrderTrackingModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: PesananAntreanItem | null;
  userRole?: string;
  onUpdateStatus?: (transaksiId: string, nextStatus: StatusPengerjaan) => void;
  isPendingAction?: boolean;
}

export function OrderTrackingModal({
  isOpen,
  onClose,
  order,
  userRole = 'kasir',
  onUpdateStatus,
  isPendingAction = false,
}: OrderTrackingModalProps) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!isOpen || !order) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const isDineIn = (order.jenis_pesanan || '').toUpperCase() === 'DINE_IN' || !!order.nomor_meja;
  const isOwner = userRole === 'owner';

  // Kalkulasi durasi tunggu
  const diffMinutes = Math.max(
    0,
    Math.floor((now - new Date(order.dibuat_pada).getTime()) / 60000)
  );
  const isLate = diffMinutes > 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-[#FAF7F2] dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative space-y-5 max-h-[92vh] flex flex-col">
        {/* Header Modal */}
        <div className="flex items-start justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#FAF0E6] dark:bg-[#2C221E] text-[#8C5E3C]">
                <Coffee className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Tracking Progres Pesanan
                </h3>
                <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
                  Pantau alur pembayaran hingga peracikan dapur secara real-time
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#28211B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Order Details & Stepper */}
        <div className="space-y-5 overflow-y-auto pr-1 flex-1">
          {/* Main Hero Card: Nomor Antrean & Info Kunci */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-2.5 rounded-2xl bg-[#FAF0E6] dark:bg-[#2C221E] border border-[#E8DFD8] dark:border-[#3E312B]">
                <span className="text-[10px] uppercase font-bold tracking-widest text-[#8C5E3C] block">
                  NOMOR ANTREAN
                </span>
                <span className="font-ticket text-3xl font-black text-[#2D2422] dark:text-[#F5EBE6]">
                  {order.nomor_antrean}
                </span>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#8C5E3C] dark:text-[#C67C4E]">
                  <Receipt className="w-3.5 h-3.5" />
                  <span className="font-mono font-bold whitespace-nowrap">{order.nomor_struk}</span>
                </div>
                <h4 className="text-sm font-bold text-[#2D2422] dark:text-[#F5EBE6] mt-0.5">
                  {order.nama_pelanggan && order.nama_pelanggan !== 'Pelanggan Umum'
                    ? order.nama_pelanggan
                    : isDineIn && order.nomor_meja
                    ? `Tamu Meja ${order.nomor_meja}`
                    : (order.nama_pelanggan || 'Pelanggan Umum')}
                </h4>
                <div className="flex items-center gap-1 text-[11px] text-[#8C7A70] dark:text-[#A8968D]">
                  <MapPin className="w-3 h-3 text-[#D97706]" />
                  <span>{order.cabang_nama}</span>
                </div>
              </div>
            </div>

            <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-1.5 border-t sm:border-t-0 pt-2 sm:pt-0 border-[#F2ECE6] dark:border-[#2E2522]">
              {/* Jenis Pesanan Badge */}
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                  isDineIn
                    ? 'bg-[#FAF0E6] dark:bg-[#2C221E] text-[#8C5E3C] border border-[#E8DFD8]'
                    : 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200'
                }`}
              >
                {isDineIn ? (
                  <>
                    <Utensils className="w-3.5 h-3.5" />
                    <span>Dine In (Meja {order.nomor_meja || '-'})</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span>Takeaway / Bungkus</span>
                  </>
                )}
              </span>

              {/* Lama Menunggu */}
              <span
                className={`inline-flex items-center gap-1 text-xs font-mono font-semibold tabular-nums ${
                  isLate
                    ? 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg border border-rose-200'
                    : 'text-[#8C7A70] dark:text-[#A8968D]'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Menunggu: {diffMinutes} menit</span>
                {isLate && <AlertTriangle className="w-3 h-3 text-rose-500" />}
              </span>
            </div>
          </div>

          {/* Stepper Visual Timeline (6 Tahap Sesuai Spesifikasi) */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] shadow-xs space-y-2">
            <div className="flex items-center justify-between border-b border-[#F2ECE6] dark:border-[#2E2522] pb-2">
              <span className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                Progres Tahapan Operasional
              </span>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-semibold text-[#8C7A70]">Bayar:</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-full text-[10px] uppercase ${
                    order.status_pembayaran.toLowerCase() === 'lunas'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}
                >
                  {order.status_pembayaran}
                </span>
                <span className="font-semibold text-[#8C7A70] ml-1">KDS:</span>
                <span className="font-bold px-2 py-0.5 rounded-full text-[10px] uppercase bg-[#FAF0E6] text-[#8C5E3C] dark:bg-[#2C221E] dark:text-[#C67C4E]">
                  {order.status_pengerjaan}
                </span>
              </div>
            </div>

            <OrderTimelineStepper
              statusPembayaran={order.status_pembayaran}
              statusPengerjaan={order.status_pengerjaan}
              waktuDibuat={order.dibuat_pada}
              waktuDibayar={order.status_pembayaran.toLowerCase() === 'lunas' ? order.dibuat_pada : null}
              waktuSelesai={order.diselesaikan_pada}
              metodeBayar={order.metode_bayar}
            />
          </div>

          {/* Detail Menu & Kustomisasi Racikan */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] shadow-xs space-y-3">
            <span className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6] block border-b border-[#F2ECE6] dark:border-[#2E2522] pb-2">
              Daftar Menu &amp; Kuantitas
            </span>

            <div className="divide-y divide-[#F2ECE6] dark:divide-[#2E2522] space-y-2">
              {order.items.map((it, idx) => (
                <div key={idx} className="pt-2 first:pt-0 flex items-start justify-between text-xs">
                  <div>
                    <span className="font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                      <span className="text-[#8C5E3C] font-mono mr-1.5">{it.jumlah}x</span>
                      {it.nama}
                    </span>
                    {it.catatan && (
                      <p className="text-[11px] text-[#8C7A70] dark:text-[#A8968D] italic mt-0.5">
                        Opsi: {it.catatan}
                      </p>
                    )}
                  </div>
                  <span className="font-bold font-mono tabular-nums text-[#2D2422] dark:text-[#F5EBE6]">
                    {formatRupiah(it.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Catatan Khusus Keseluruhan */}
            {order.catatan_pesanan && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-900 dark:text-amber-300">
                <span className="font-bold block text-[10px] uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  Catatan Khusus Pesanan:
                </span>
                <p className="mt-0.5">{order.catatan_pesanan}</p>
              </div>
            )}

            {/* Total Pembayaran */}
            <div className="flex items-center justify-between border-t border-[#F2ECE6] dark:border-[#2E2522] pt-2 text-xs">
              <span className="font-medium text-[#8C7A70]">Total Tagihan:</span>
              <span className="text-base font-black font-mono tabular-nums text-[#8C5E3C]">
                {formatRupiah(order.total)}
              </span>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-[#E8DFD3] dark:border-[#2C2420] pt-3 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          {/* Owner Notice or Kasir Operational Controls */}
          {isOwner ? (
            <div className="text-[11px] text-[#8C7A70] dark:text-[#A8968D] italic">
              Mode Monitoring Owner: Tindakan operasional dapur dilakukan oleh staf cabang.
            </div>
          ) : onUpdateStatus ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {order.status_pengerjaan === 'MENUNGGU' && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.transaksi_id, 'DIPROSES')}
                  disabled={isPendingAction || order.status_pembayaran.toLowerCase() !== 'lunas'}
                  className="w-full sm:w-auto px-4 py-2 bg-[#8C5E3C] hover:bg-[#734A2E] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Mulai Diracik</span>
                </button>
              )}

              {order.status_pengerjaan === 'DIPROSES' && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.transaksi_id, 'SIAP_DIAMBIL')}
                  disabled={isPendingAction}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Tandai Siap Diambil</span>
                </button>
              )}

              {order.status_pengerjaan === 'SIAP_DIAMBIL' && (
                <button
                  type="button"
                  onClick={() => onUpdateStatus(order.transaksi_id, 'SELESAI')}
                  disabled={isPendingAction}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Selesaikan Pesanan</span>
                </button>
              )}
            </div>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 bg-white dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] text-xs font-bold text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#FAF7F2] rounded-xl transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}
