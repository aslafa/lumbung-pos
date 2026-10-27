'use client';

import React, { useState, useEffect } from 'react';
import { Chair } from './Chair';
import { TableStatusBadge } from './TableStatusBadge';
import { StatusMeja, BentukMeja, AreaMeja } from '@/lib/orders/order-types';
import { Users, Clock, Check } from 'lucide-react';

export interface TableShapeProps {
  nomorMeja: string;
  kapasitas: number;
  status: StatusMeja | 'tidak_aktif' | 'dipesan';
  bentuk?: BentukMeja;
  area?: AreaMeja;
  pesananAktif?: {
    nomor_struk: string;
    total: number;
    items?: Array<{ nama: string; jumlah: number }>;
  } | null;
  waktuTerisi?: string | null;
  isSelected?: boolean;
  onSelect?: () => void;
  onClick?: () => void;
  showBadge?: boolean;
  interactive?: boolean;
  size?: 'normal' | 'compact';
}

/**
 * Komponen Denah Meja Interaktif Reusable (TableShape)
 * Menggambarkan bentuk meja dan kursi secara realistis sesuai kapasitas fisik aktual (2, 4, 6, 8 kursi).
 */
export function TableShape({
  nomorMeja,
  kapasitas,
  status,
  bentuk,
  area,
  pesananAktif,
  waktuTerisi,
  isSelected = false,
  onSelect,
  onClick,
  showBadge = true,
  interactive = true,
  size = 'normal',
}: TableShapeProps) {
  const handleClick = onClick || onSelect;
  const isAvailable = status === 'tersedia';
  const isOccupied = status === 'terisi';
  const isCleaning = status === 'menunggu_dibersihkan' || (status as string) === 'perlu_dibersihkan';
  const isInactive = status === 'tidak_aktif';

  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!waktuTerisi || !isOccupied) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [waktuTerisi, isOccupied]);

  // Otomatisasi bentuk jika tidak ditentukan
  const effectiveBentuk: BentukMeja =
    bentuk || (kapasitas <= 2 ? 'lingkaran' : kapasitas <= 4 ? 'persegi' : 'persegi_panjang');

  // Surface and Border Styling
  let surfaceStyle =
    'bg-gradient-to-br from-[#FFFDF9] to-[#F5ECE1] dark:from-[#26201B] dark:to-[#1C1713] border-[#D8C7B5] dark:border-[#3D332A] text-[#2C1810] dark:text-[#F5EBE1]';
  if (isSelected) {
    surfaceStyle =
      'bg-amber-50/90 dark:bg-amber-950/40 border-[#C67C4E] dark:border-[#C67C4E] ring-3 ring-[#C67C4E]/40 text-[#2C1810] dark:text-[#F5EBE1] shadow-lg scale-[1.02]';
  } else if (isOccupied) {
    surfaceStyle =
      'bg-gradient-to-br from-[#FEF7EE] to-[#FCE8D3] dark:from-[#2F1D13] dark:to-[#20130C] border-amber-300 dark:border-amber-800 text-[#451A03] dark:text-amber-100 shadow-xs';
  } else if (isCleaning) {
    surfaceStyle =
      'bg-gradient-to-br from-[#F0F9FF] to-[#E0F2FE] dark:from-[#082F49]/40 dark:to-[#0C4A6E]/30 border-sky-300 dark:border-sky-800 text-sky-950 dark:text-sky-200 shadow-xs';
  } else if (isInactive) {
    surfaceStyle = 'bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800 opacity-60 text-stone-500';
  }

  // Hitung durasi terisi jika ada waktu_terisi
  let durationStr = '';
  if (waktuTerisi && isOccupied) {
    const diffMin = Math.max(0, Math.floor((now - new Date(waktuTerisi).getTime()) / 60000));
    durationStr = `${diffMin}m`;
  }

  // Render Kursi sesuai kapasitas aktual (2, 4, 6, 8)
  const renderChairs = () => {
    if (kapasitas <= 2) {
      // 2 Kursi: 1 atas dan 1 bawah saling berhadapan
      return (
        <>
          <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2">
            <Chair orientation="top" status={status} />
          </div>
          <div className="absolute -bottom-3 sm:-bottom-3.5 left-1/2 -translate-x-1/2">
            <Chair orientation="bottom" status={status} />
          </div>
        </>
      );
    }

    if (kapasitas <= 4) {
      // 4 Kursi: 4 sisi (atas, bawah, kiri, kanan)
      return (
        <>
          <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2">
            <Chair orientation="top" status={status} />
          </div>
          <div className="absolute -bottom-3 sm:-bottom-3.5 left-1/2 -translate-x-1/2">
            <Chair orientation="bottom" status={status} />
          </div>
          <div className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2">
            <Chair orientation="left" status={status} />
          </div>
          <div className="absolute -right-3 sm:-right-3.5 top-1/2 -translate-y-1/2">
            <Chair orientation="right" status={status} />
          </div>
        </>
      );
    }

    if (kapasitas <= 6) {
      // 6 Kursi: 2 atas, 2 bawah, 1 kiri, 1 kanan
      return (
        <>
          <div className="absolute -top-3 sm:-top-3.5 left-1/4 -translate-x-1/2">
            <Chair orientation="top" status={status} />
          </div>
          <div className="absolute -top-3 sm:-top-3.5 left-3/4 -translate-x-1/2">
            <Chair orientation="top" status={status} />
          </div>
          <div className="absolute -bottom-3 sm:-bottom-3.5 left-1/4 -translate-x-1/2">
            <Chair orientation="bottom" status={status} />
          </div>
          <div className="absolute -bottom-3 sm:-bottom-3.5 left-3/4 -translate-x-1/2">
            <Chair orientation="bottom" status={status} />
          </div>
          <div className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2">
            <Chair orientation="left" status={status} />
          </div>
          <div className="absolute -right-3 sm:-right-3.5 top-1/2 -translate-y-1/2">
            <Chair orientation="right" status={status} />
          </div>
        </>
      );
    }

    // 8 Kursi atau lebih: 3 atas, 3 bawah, 1 kiri, 1 kanan
    return (
      <>
        <div className="absolute -top-3 sm:-top-3.5 left-1/6 -translate-x-1/2">
          <Chair orientation="top" status={status} />
        </div>
        <div className="absolute -top-3 sm:-top-3.5 left-1/2 -translate-x-1/2">
          <Chair orientation="top" status={status} />
        </div>
        <div className="absolute -top-3 sm:-top-3.5 left-5/6 -translate-x-1/2">
          <Chair orientation="top" status={status} />
        </div>
        <div className="absolute -bottom-3 sm:-bottom-3.5 left-1/6 -translate-x-1/2">
          <Chair orientation="bottom" status={status} />
        </div>
        <div className="absolute -bottom-3 sm:-bottom-3.5 left-1/2 -translate-x-1/2">
          <Chair orientation="bottom" status={status} />
        </div>
        <div className="absolute -bottom-3 sm:-bottom-3.5 left-5/6 -translate-x-1/2">
          <Chair orientation="bottom" status={status} />
        </div>
        <div className="absolute -left-3 sm:-left-3.5 top-1/2 -translate-y-1/2">
          <Chair orientation="left" status={status} />
        </div>
        <div className="absolute -right-3 sm:-right-3.5 top-1/2 -translate-y-1/2">
          <Chair orientation="right" status={status} />
        </div>
      </>
    );
  };

  // Dimensi fisik meja berdasarkan bentuk & ukuran
  let dimensionClasses = '';
  if (effectiveBentuk === 'lingkaran') {
    dimensionClasses =
      size === 'compact'
        ? 'w-20 h-20 rounded-full'
        : 'w-24 h-24 sm:w-26 sm:h-26 rounded-full';
  } else if (effectiveBentuk === 'persegi') {
    dimensionClasses =
      size === 'compact'
        ? 'w-20 h-20 rounded-2xl'
        : 'w-24 h-24 sm:w-26 sm:h-26 rounded-2xl';
  } else {
    // Persegi Panjang (6 atau 8 kursi)
    dimensionClasses =
      kapasitas >= 8
        ? size === 'compact'
          ? 'w-34 h-20 rounded-2xl'
          : 'w-40 sm:w-44 h-24 sm:h-26 rounded-2xl'
        : size === 'compact'
        ? 'w-28 h-20 rounded-2xl'
        : 'w-34 sm:w-38 h-24 sm:h-26 rounded-2xl';
  }

  const cursorClass =
    !interactive
      ? ''
      : isAvailable
      ? 'cursor-pointer hover:shadow-md active:scale-95'
      : 'cursor-pointer hover:opacity-90';

  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={(e) => {
        if (interactive && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          handleClick?.();
        }
      }}
      aria-label={`Meja ${nomorMeja}, Kapasitas ${kapasitas} orang, Status ${status}`}
      className={`relative inline-flex items-center justify-center m-3 sm:m-3.5 select-none transition-all duration-200 outline-hidden ${cursorClass}`}
    >
      {/* Visual Kursi-kursi Fisik */}
      {renderChairs()}

      {/* Permukaan Meja (Table Surface) */}
      <div
        className={`relative z-10 flex flex-col items-center justify-center p-2 border-2 shadow-xs transition-all duration-200 ${surfaceStyle} ${dimensionClasses}`}
      >
        {/* Indikator Terpilih */}
        {isSelected && (
          <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[#C67C4E] text-white flex items-center justify-center shadow-xs">
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </div>
        )}

        {/* Nomor Meja Besar (Tabular Nums) */}
        <span className="font-extrabold text-base sm:text-lg tabular-nums tracking-tight leading-none font-mono">
          {nomorMeja}
        </span>

        {/* Kapasitas Kursi */}
        <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold opacity-75 mt-0.5 tabular-nums">
          <Users className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-[#C67C4E]" />
          <span>{kapasitas}p</span>
          {area && <span className="opacity-60 hidden sm:inline">· {area}</span>}
        </div>

        {/* Info Durasi Terisi jika sedang terisi */}
        {isOccupied && durationStr && (
          <div className="flex items-center gap-0.5 text-[9px] text-amber-800 dark:text-amber-300 font-mono mt-0.5 font-bold">
            <Clock className="w-2.5 h-2.5" />
            <span>{durationStr}</span>
          </div>
        )}

        {/* Nomor Struk jika ada */}
        {isOccupied && pesananAktif?.nomor_struk && (
          <div className="text-[9px] font-mono text-amber-900/80 dark:text-amber-300/80 truncate max-w-[80%] text-center mt-0.5">
            {pesananAktif.nomor_struk.split('-').pop()}
          </div>
        )}

        {/* Badge Status Ringkas jika diminta */}
        {showBadge && (
          <div className="mt-1">
            <TableStatusBadge status={status} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}
