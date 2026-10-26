'use client';

import React from 'react';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  Flame,
  Bell,
  CheckCheck,
  AlertCircle
} from 'lucide-react';
import { StatusPengerjaan } from '@/lib/orders/order-types';

export interface OrderTimelineStepperProps {
  statusPembayaran: string; // 'LUNAS' | 'MENUNGGU_BAYAR' | 'lunas' | 'menunggu_bayar' | 'batal' | 'void'
  statusPengerjaan: StatusPengerjaan | string; // 'MENUNGGU' | 'DIPROSES' | 'SIAP_DIAMBIL' | 'SELESAI'
  waktuDibuat?: string;
  waktuDibayar?: string | null;
  waktuSelesai?: string | null;
  metodeBayar?: string;
}

interface StepDefinition {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  timestamp?: string | null;
}

export function OrderTimelineStepper({
  statusPembayaran,
  statusPengerjaan,
  waktuDibuat,
  waktuDibayar,
  waktuSelesai,
  metodeBayar = 'tunai',
}: OrderTimelineStepperProps) {
  const normPembayaran = statusPembayaran.toLowerCase();
  const isBatal = normPembayaran === 'batal' || normPembayaran === 'void';
  const isPaid = normPembayaran === 'lunas';
  const isWaitingPayment = normPembayaran === 'menunggu_bayar' || normPembayaran === 'menunggu_pembayaran';

  if (isBatal) {
    return (
      <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-3 text-rose-800 dark:text-rose-300">
        <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider">Pesanan Dibatalkan</h4>
          <p className="text-[11px] opacity-90 mt-0.5">
            Transaksi ini telah dibatalkan/void dan tidak diteruskan ke proses peracikan dapur.
          </p>
        </div>
      </div>
    );
  }

  // 6 Tahapan Operasional
  const steps: StepDefinition[] = [
    {
      id: 'menunggu_bayar',
      title: 'Menunggu Pembayaran',
      subtitle: isWaitingPayment ? 'Menunggu konfirmasi QRIS' : 'Selesai diverifikasi',
      icon: CreditCard,
      timestamp: waktuDibuat,
    },
    {
      id: 'dibayar',
      title: 'Dibayar',
      subtitle: isPaid ? `Lunas (${metodeBayar.toUpperCase()})` : 'Belum dibayar',
      icon: CheckCircle2,
      timestamp: waktuDibayar || (isPaid ? waktuDibuat : null),
    },
    {
      id: 'menunggu_diproses',
      title: 'Menunggu Diproses',
      subtitle: 'Dalam antrean racik dapur',
      icon: Clock,
      timestamp: isPaid ? (waktuDibayar || waktuDibuat) : null,
    },
    {
      id: 'sedang_diproses',
      title: 'Sedang Diproses',
      subtitle: 'Barista meracik pesanan',
      icon: Flame,
    },
    {
      id: 'siap_diambil',
      title: 'Siap Diambil',
      subtitle: 'Pesanan siap di konter',
      icon: Bell,
    },
    {
      id: 'selesai',
      title: 'Selesai',
      subtitle: 'Diserahkan ke pelanggan',
      icon: CheckCheck,
      timestamp: waktuSelesai,
    },
  ];

  // Hitung status setiap step: 'completed' | 'active' | 'upcoming'
  const getStepState = (index: number): 'completed' | 'active' | 'upcoming' => {
    if (!isPaid) {
      if (index === 0) return 'active';
      return 'upcoming';
    }

    // Jika sudah lunas:
    // Step 0 (Menunggu Bayar) -> completed
    // Step 1 (Dibayar) -> completed
    if (index === 0 || index === 1) return 'completed';

    const pengerjaan = (statusPengerjaan || 'MENUNGGU').toUpperCase();

    if (pengerjaan === 'MENUNGGU') {
      if (index === 2) return 'active';
      return 'upcoming';
    }

    if (pengerjaan === 'DIPROSES') {
      if (index === 2) return 'completed';
      if (index === 3) return 'active';
      return 'upcoming';
    }

    if (pengerjaan === 'SIAP_DIAMBIL') {
      if (index >= 2 && index <= 3) return 'completed';
      if (index === 4) return 'active';
      return 'upcoming';
    }

    if (pengerjaan === 'SELESAI') {
      return 'completed';
    }

    return 'upcoming';
  };

  const formatStepTime = (iso?: string | null) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    } catch {
      return null;
    }
  };

  return (
    <div className="py-2">
      {/* Desktop & Tablet Stepper Horizontal View */}
      <div className="hidden sm:grid grid-cols-6 gap-2 relative">
        {steps.map((step, idx) => {
          const state = getStepState(idx);
          const Icon = step.icon;
          const timeStr = formatStepTime(step.timestamp);
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="relative flex flex-col items-center text-center">
              {/* Connector line between steps */}
              {!isLast && (
                <div
                  className={`absolute top-4 left-1/2 w-full h-0.5 -z-0 transition-all ${
                    state === 'completed'
                      ? 'bg-[#C67C4E]'
                      : 'bg-[#E8DFD3] dark:bg-[#382F28]'
                  }`}
                />
              )}

              {/* Step Circle */}
              <div
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  state === 'completed'
                    ? 'bg-[#C67C4E] text-white shadow-xs'
                    : state === 'active'
                    ? 'bg-amber-500 text-white ring-4 ring-amber-200 dark:ring-amber-950/60 shadow-md animate-pulse'
                    : 'bg-white dark:bg-[#28211B] text-[#A8A29E] dark:text-[#78716C] border border-[#E8DFD3] dark:border-[#382F28]'
                }`}
              >
                {state === 'completed' ? (
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                ) : (
                  <Icon className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Title & Subtitle */}
              <div className="mt-2 space-y-0.5">
                <span
                  className={`block text-[11px] font-bold leading-tight ${
                    state === 'active'
                      ? 'text-amber-800 dark:text-amber-300'
                      : state === 'completed'
                      ? 'text-[#2C1810] dark:text-[#FAF7F2]'
                      : 'text-[#A8A29E] dark:text-[#78716C]'
                  }`}
                >
                  {step.title}
                </span>
                <span className="block text-[9px] text-[#A8A29E] dark:text-[#78716C] leading-none">
                  {step.subtitle}
                </span>
                {timeStr && state !== 'upcoming' && (
                  <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded-md bg-[#FAF7F2] dark:bg-[#1E1916] text-[9px] font-mono font-semibold text-[#8C5E3C] dark:text-[#C67C4E]">
                    {timeStr}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Stepper Vertical View */}
      <div className="sm:hidden space-y-3 pl-2">
        {steps.map((step, idx) => {
          const state = getStepState(idx);
          const Icon = step.icon;
          const timeStr = formatStepTime(step.timestamp);
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="relative flex items-start gap-3">
              {/* Vertical connector line */}
              {!isLast && (
                <div
                  className={`absolute left-3.5 top-7 bottom-0 w-0.5 -z-0 ${
                    state === 'completed'
                      ? 'bg-[#C67C4E]'
                      : 'bg-[#E8DFD3] dark:bg-[#382F28]'
                  }`}
                />
              )}

              {/* Step Circle */}
              <div
                className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-all ${
                  state === 'completed'
                    ? 'bg-[#C67C4E] text-white shadow-xs'
                    : state === 'active'
                    ? 'bg-amber-500 text-white ring-3 ring-amber-200 dark:ring-amber-950/60 shadow-xs animate-pulse'
                    : 'bg-white dark:bg-[#28211B] text-[#A8A29E] dark:text-[#78716C] border border-[#E8DFD3] dark:border-[#382F28]'
                }`}
              >
                {state === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
                ) : (
                  <Icon className="w-3 h-3" />
                )}
              </div>

              {/* Content info */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-bold ${
                      state === 'active'
                        ? 'text-amber-800 dark:text-amber-300'
                        : state === 'completed'
                        ? 'text-[#2C1810] dark:text-[#FAF7F2]'
                        : 'text-[#A8A29E] dark:text-[#78716C]'
                    }`}
                  >
                    {step.title}
                  </span>
                  {timeStr && state !== 'upcoming' && (
                    <span className="text-[10px] font-mono text-[#8C5E3C] dark:text-[#C67C4E]">
                      {timeStr}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-[#A8A29E] dark:text-[#78716C]">
                  {step.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
