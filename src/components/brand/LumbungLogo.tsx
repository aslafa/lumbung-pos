'use client';

import React from 'react';

interface LumbungLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  iconOnly?: boolean;
  className?: string;
  variant?: 'light' | 'dark' | 'auto';
}

export function LumbungLogo({
  size = 'md',
  iconOnly = false,
  className = '',
  variant = 'auto',
}: LumbungLogoProps) {
  const sizeMap = {
    sm: { icon: 32, box: 'w-8 h-8', text: 'text-base', sub: 'text-[10px]' },
    md: { icon: 40, box: 'w-10 h-10', text: 'text-lg', sub: 'text-xs' },
    lg: { icon: 48, box: 'w-12 h-12', text: 'text-xl', sub: 'text-xs' },
    xl: { icon: 64, box: 'w-16 h-16', text: 'text-2xl', sub: 'text-sm' },
  };

  const s = sizeMap[size];

  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* SVG Icon Mark */}
      <div
        className={`${s.box} rounded-2xl bg-gradient-to-br from-[#4A2E18] to-[#2E180C] shadow-md flex items-center justify-center border border-[#6B4423]/30 shrink-0 p-1.5 transition-transform hover:scale-105`}
      >
        <svg
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Coffee Cup Base */}
          <path
            d="M8 18C8 18 9 34 24 34C39 34 40 18 40 18H8Z"
            fill="#F5EFE6"
            className="dark:fill-[#FAF7F2]"
          />
          {/* Cup Rim */}
          <path
            d="M6 16C6 14.8954 6.89543 14 8 14H40C41.1046 14 42 14.8954 42 16C42 17.1046 41.1046 18 40 18H8C6.89543 18 6 17.1046 6 16Z"
            fill="#D97706"
          />
          {/* Cup Handle */}
          <path
            d="M38 20C42 20 44 24 44 26C44 28 42 31 38 31"
            stroke="#D97706"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* Coffee Surface / Liquid */}
          <ellipse cx="24" cy="18" rx="14" ry="2.5" fill="#6B4423" />
          {/* Steam / Wheat Sheaf Motif (Lumbung Roti & Kopi) */}
          <path
            d="M18 12C18 12 16 8 20 5C23 3 22 1 22 1"
            stroke="#F59E0B"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M24 12C24 12 23 7 27 4C29 2 28 0.5 28 0.5"
            stroke="#D97706"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <path
            d="M30 12C30 12 30 8 32 6"
            stroke="#F59E0B"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Grain / Wheat Seed Accent on Cup */}
          <path
            d="M24 23C22 25 22 28 24 29C26 28 26 25 24 23Z"
            fill="#D97706"
          />
          <line x1="24" y1="23" x2="24" y2="29" stroke="#4A2E18" strokeWidth="0.8" />
          <path
            d="M21 24.5C20 25.5 20.5 27 21.5 27.5C22 26.5 22 25 21 24.5Z"
            fill="#C67C4E"
          />
          <path
            d="M27 24.5C28 25.5 27.5 27 26.5 27.5C26 26.5 26 25 27 24.5Z"
            fill="#C67C4E"
          />
        </svg>
      </div>

      {/* Typography Lockup */}
      {!iconOnly && (
        <div className="flex flex-col text-left">
          <span
            className={`font-black ${s.text} tracking-tight leading-none ${
              variant === 'light'
                ? 'text-[#2C1810]'
                : variant === 'dark'
                ? 'text-[#FAF7F2]'
                : 'text-[#2C1810] dark:text-[#FAF7F2]'
            }`}
          >
            LUMBUNG
          </span>
          <span
            className={`font-medium ${s.sub} tracking-wide mt-0.5 ${
              variant === 'light'
                ? 'text-[#8C6D58]'
                : variant === 'dark'
                ? 'text-[#D6C7B2]'
                : 'text-[#8C6D58] dark:text-[#CBBDB0]'
            }`}
          >
            Kopi &bull; Roti &bull; Multi-Cabang
          </span>
        </div>
      )}
    </div>
  );
}
