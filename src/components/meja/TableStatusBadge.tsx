'use client';

import React from 'react';
import { StatusMeja } from '@/lib/orders/order-types';

interface TableStatusBadgeProps {
  status: StatusMeja | 'tidak_aktif' | 'dipesan';
  size?: 'sm' | 'md';
  className?: string;
}

export function TableStatusBadge({
  status,
  size = 'md',
  className = '',
}: TableStatusBadgeProps) {
  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[10px] gap-1'
      : 'px-2 py-0.5 text-[11px] gap-1.5';

  switch (status) {
    case 'tersedia':
      return (
        <span
          className={`inline-flex items-center font-bold rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/80 dark:border-emerald-800/80 ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Tersedia</span>
        </span>
      );

    case 'terisi':
      return (
        <span
          className={`inline-flex items-center font-bold rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800/80 ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#C67C4E]" />
          <span>Terisi</span>
        </span>
      );

    case 'menunggu_dibersihkan':
    case 'perlu_dibersihkan':
      return (
        <span
          className={`inline-flex items-center font-bold rounded-md bg-sky-50 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-300/80 dark:border-sky-800/80 ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span>Perlu Bersih</span>
        </span>
      );

    case 'dipesan':
      return (
        <span
          className={`inline-flex items-center font-bold rounded-md bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300/80 dark:border-purple-800/80 ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
          <span>Dipesan</span>
        </span>
      );

    case 'tidak_aktif':
    default:
      return (
        <span
          className={`inline-flex items-center font-bold rounded-md bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300 border border-stone-200 dark:border-stone-700 ${sizeClasses} ${className}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
          <span>Nonaktif</span>
        </span>
      );
  }
}
