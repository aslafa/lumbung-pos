'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ProductPlaceholder } from './ProductPlaceholder';

interface ProductCardImageProps {
  sku: string;
  nama: string;
  kategori: string;
  gambarUrl?: string | null;
  className?: string;
  showCategoryBadge?: boolean;
}

/**
 * Pemetaan cerdas fallback foto nyata berdasarkan kata kunci nama produk
 */
function getSmartFallbackImage(nama: string, kategori: string): string {
  const n = (nama || '').toLowerCase();
  const k = (kategori || '').toLowerCase();

  // Kopi & Minuman
  if (n.includes('spanish') || (n.includes('latte') && k === 'kopi')) {
    return '/images/products/kop-06.png';
  }
  if (n.includes('espresso')) return '/images/products/kop-001.png';
  if (n.includes('aren') || n.includes('susu')) return '/images/products/kop-002.png';
  if (n.includes('americano') || n.includes('black')) return '/images/products/kop-003.png';
  if (n.includes('cappuccino')) return '/images/products/kop-004.png';
  if (n.includes('caramel') || n.includes('macchiato')) return '/images/products/kop-005.png';

  // Non-Kopi
  if (n.includes('matcha') || n.includes('green tea')) return '/images/products/nkp-001.png';
  if (n.includes('earl') || n.includes('tea') || n.includes('teh')) return '/images/products/nkp-002.png';
  if (n.includes('choco') || n.includes('cokelat')) return '/images/products/nkp-003.png';

  // Roti & Pastry
  if (n.includes('croissant')) return '/images/products/rot-001.png';
  if (n.includes('chocolat')) return '/images/products/rot-002.png';
  if (n.includes('cinnamon')) return '/images/products/rot-003.png';
  if (n.includes('abon')) return '/images/products/rot-004.png';
  if (n.includes('garlic') || n.includes('cheese')) return '/images/products/rot-005.png';

  // Snack
  if (n.includes('kentang') || n.includes('fries')) return '/images/products/snk-001.png';
  if (n.includes('singkong')) return '/images/products/snk-002.png';

  // Kemasan & Beans
  if (n.includes('botol') || n.includes('liter')) return '/images/products/kms-001.png';
  if (n.includes('biji') || n.includes('beans')) return '/images/products/kms-002.png';
  if (n.includes('tumbler')) return '/images/products/kms-003.png';

  // Fallback Kategori Nyata
  switch (k) {
    case 'kopi':
      return '/images/products/fallback-kopi.png';
    case 'non_kopi':
      return '/images/products/fallback-non_kopi.png';
    case 'roti':
      return '/images/products/fallback-roti.png';
    case 'snack':
      return '/images/products/fallback-snack.png';
    case 'kemasan':
      return '/images/products/fallback-kemasan.png';
    default:
      return '/images/products/fallback-kopi.png';
  }
}

/**
 * Komponen gambar produk Lumbung POS.
 * Menampilkan foto produk nyata dengan resolusi bertingkat:
 * 1. gambarUrl kustom (jika ada)
 * 2. Foto spesifik SKU (/images/products/{sku}.png)
 * 3. Foto nyata cerdas berdasarkan nama produk
 * 4. Foto nyata representatif kategori (/images/products/fallback-{kategori}.png)
 * 5. Fallback ke ProductPlaceholder jika seluruh gambar gagal dimuat.
 */
export function ProductCardImage({
  sku,
  nama,
  kategori,
  gambarUrl,
  className = '',
  showCategoryBadge = true,
}: ProductCardImageProps) {
  const normalizedSku = (sku || '').toLowerCase().trim();
  const currentKey = `${sku}-${gambarUrl}-${nama}-${kategori}`;

  const [prevKey, setPrevKey] = useState(currentKey);
  const [errorStage, setErrorStage] = useState<number>(0);

  // Reset error stage saat props berubah (pola render-time state adjustment React)
  if (prevKey !== currentKey) {
    setPrevKey(currentKey);
    setErrorStage(0);
  }

  // Tentukan sumber gambar secara deklaratif berdasarkan errorStage
  let currentSrc = '';
  if (errorStage === 0) {
    currentSrc = gambarUrl
      ? gambarUrl
      : normalizedSku
      ? `/images/products/${normalizedSku}.png`
      : getSmartFallbackImage(nama, kategori);
  } else if (errorStage === 1) {
    currentSrc = normalizedSku
      ? `/images/products/${normalizedSku}.jpg`
      : getSmartFallbackImage(nama, kategori);
  } else {
    currentSrc = getSmartFallbackImage(nama, kategori);
  }

  const handleImageError = () => {
    setErrorStage((prev) => prev + 1);
  };

  if (errorStage >= 3) {
    return (
      <ProductPlaceholder
        kategori={kategori}
        nama={nama}
        className={className}
      />
    );
  }

  const containerClasses = className.includes('w-') && className.includes('h-')
    ? className
    : `w-full h-full ${className}`.trim();

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-[#F3EDE2] dark:bg-[#231C17] border border-[#E8DFD3] dark:border-[#382F28] flex items-center justify-center shadow-xs select-none group ${containerClasses}`}
    >
      <Image
        src={currentSrc}
        alt={nama || sku || 'Produk Lumbung'}
        fill
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
        className="object-cover object-center transition-transform duration-300 group-hover:scale-105"
        onError={handleImageError}
        priority={false}
      />

      {/* Subtle overlay gradient for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent pointer-events-none" />

      {/* Badge Kategori Kecil di pojok (opsional) */}
      {showCategoryBadge && (
        <span className="absolute bottom-2 left-2 text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-black/60 text-white/95 backdrop-blur-xs border border-white/20">
          {kategori.replace('_', ' ')}
        </span>
      )}
    </div>
  );
}
