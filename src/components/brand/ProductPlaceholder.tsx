'use client';

import React from 'react';
import { Coffee, CupSoda, Croissant, Cookie, Package } from 'lucide-react';

interface ProductPlaceholderProps {
  kategori: string;
  nama?: string;
  className?: string;
}

export function ProductPlaceholder({
  kategori,
  className = '',
}: ProductPlaceholderProps) {
  const normalized = (kategori || '').toLowerCase().trim();

  // Color schemes and icons per category matching warm coffee shop aesthetics
  const configs: Record<
    string,
    {
      gradient: string;
      iconColor: string;
      badgeText: string;
      Icon: React.ElementType;
    }
  > = {
    kopi: {
      gradient: 'from-[#4A2E18] to-[#2B170B] border-[#6B4423]/40',
      iconColor: 'text-[#F59E0B]',
      badgeText: 'Kopi',
      Icon: Coffee,
    },
    non_kopi: {
      gradient: 'from-[#0D5C75] to-[#083344] border-[#155E75]/40',
      iconColor: 'text-[#38BDF8]',
      badgeText: 'Non-Kopi',
      Icon: CupSoda,
    },
    roti: {
      gradient: 'from-[#B45309] to-[#78350F] border-[#D97706]/40',
      iconColor: 'text-[#FDE68A]',
      badgeText: 'Roti Fresh',
      Icon: Croissant,
    },
    snack: {
      gradient: 'from-[#9A3412] to-[#7C2D12] border-[#EA580C]/40',
      iconColor: 'text-[#FDBA74]',
      badgeText: 'Camilan',
      Icon: Cookie,
    },
    kemasan: {
      gradient: 'from-[#374151] to-[#1F2937] border-[#4B5563]/40',
      iconColor: 'text-[#E5E7EB]',
      badgeText: 'Retail / Beans',
      Icon: Package,
    },
  };

  const c = configs[normalized] || {
    gradient: 'from-[#4A2E18] to-[#2B170B] border-[#6B4423]/40',
    iconColor: 'text-[#F59E0B]',
    badgeText: kategori || 'Menu',
    Icon: Coffee,
  };

  const IconComponent = c.Icon;

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${c.gradient} border flex flex-col items-center justify-center p-3 shadow-sm select-none ${className}`}
    >
      {/* Subtle background glow */}
      <div className="absolute -right-3 -top-3 w-16 h-16 rounded-full bg-white/10 blur-md pointer-events-none" />

      {/* Main Category Icon */}
      <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-xs flex items-center justify-center mb-2 shadow-inner">
        <IconComponent className={`w-6 h-6 ${c.iconColor}`} />
      </div>

      {/* Category Pill */}
      <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-black/30 text-white/90 border border-white/10">
        {c.badgeText}
      </span>
    </div>
  );
}
