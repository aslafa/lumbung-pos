'use client';

import type { StatusMeja } from '@/lib/orders/order-types';

interface ChairProps {
  orientation: 'top' | 'bottom' | 'left' | 'right';
  status?: StatusMeja | 'tidak_aktif' | 'dipesan';
  className?: string;
}

/**
 * Komponen Kursi Fisik Realistis
 * - Menampilkan kursi dengan lengkungan ergonomis (cushion & backrest)
 * - Warna dan aksen selaras dengan status meja
 * - Dimensi proporsional: horizontal untuk top/bottom, vertikal untuk left/right
 */
export function Chair({ orientation, status = 'tersedia', className = '' }: ChairProps) {
  const isHorizontal = orientation === 'top' || orientation === 'bottom';

  // Penentuan styling berdasarkan status meja
  let chairColors = 'bg-[#EDE4D8] border-[#D4C3B3] dark:bg-[#2A231E] dark:border-[#3D332C] shadow-xs';
  if (status === 'terisi') {
    chairColors = 'bg-[#C67C4E] border-[#A25E33] dark:bg-[#C67C4E] dark:border-[#8E4D25] shadow-xs';
  } else if (status === 'menunggu_dibersihkan' || (status as string) === 'perlu_dibersihkan') {
    chairColors = 'bg-[#7DD3FC]/40 border-[#38BDF8] dark:bg-[#0284C7]/30 dark:border-[#0369A1] shadow-xs';
  } else if (status === 'dipesan') {
    chairColors = 'bg-[#C7D2FE] border-[#818CF8] dark:bg-[#312E81]/50 dark:border-[#4F46E5] shadow-xs';
  } else if (status === 'tidak_aktif') {
    chairColors = 'bg-[#E7E5E4] border-[#D6D3D1] dark:bg-[#292524] dark:border-[#44403C] opacity-50';
  }

  // Rounded curves: sisi luar sedikit lebih melengkung dari sisi meja
  const radiusClasses = {
    top: 'rounded-t-lg rounded-b-xs',
    bottom: 'rounded-b-lg rounded-t-xs',
    left: 'rounded-l-lg rounded-r-xs',
    right: 'rounded-r-lg rounded-l-xs',
  }[orientation];

  return (
    <div
      aria-hidden="true"
      className={`shrink-0 border transition-all duration-200 pointer-events-none select-none relative ${chairColors} ${radiusClasses} ${
        isHorizontal ? 'w-6 sm:w-7 h-2.5 sm:h-3' : 'w-2.5 sm:w-3 h-6 sm:h-7'
      } ${className}`}
    >
      {/* Garis aksen cushion/sandaran kecil */}
      <span
        className={`absolute inset-0.5 rounded-xs opacity-40 ${
          status === 'terisi' ? 'bg-amber-100' : 'bg-white dark:bg-black/20'
        }`}
      />
    </div>
  );
}
