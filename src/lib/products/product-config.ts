/**
 * Product Customization & Variant Configuration System (Lumbung POS)
 *
 * Modul ini mengatur aturan varian, kustomisasi per kategori & SKU,
 * serta kalkulasi harga varian yang tervalidasi di sisi server (Server-side Trusted Price).
 */

export interface ProductSizeOption {
  id: 'Regular' | 'Large' | 'Single' | 'Double' | '250g' | '500g' | '1kg';
  label: string;
  priceDelta: number; // Tambahan harga dari harga dasar produk
  isDefault?: boolean;
}

export interface CustomOrderOptions {
  // Minuman (Kopi & Non-Kopi)
  suhu?: 'Panas' | 'Dingin';
  gula?: 'Normal' | 'Less Sugar' | 'No Sugar';
  es?: 'Normal Ice' | 'Less Ice' | 'No Ice';
  ukuran?: 'Regular' | 'Large' | 'Single' | 'Double';

  // Roti & Pastry
  penyajian?: 'Hangat' | 'Biasa';
  varianRasa?: string;

  // Snack & Makanan
  levelPedas?: 'Level 0 (Tidak Pedas)' | 'Level 1 (Pedas Sedang)' | 'Level 2 (Ekstra Pedas)';

  // Kemasan & Beans & Merchandise
  ukuranKemasan?: string;
  gilingan?: 'Biji Utuh' | 'Giling Kasar' | 'Giling Sedang' | 'Giling Halus';
  warna?: string;

  // Catatan umum
  catatanKhusus?: string;
}

export interface ProductCustomConfig {
  kategori: string;
  // Opsi minuman
  supportsTemp: boolean;
  defaultTemp?: 'Panas' | 'Dingin';
  supportsSugar: boolean;
  defaultSugar?: 'Normal' | 'Less Sugar' | 'No Sugar';
  supportsIce: boolean; // Hanya aktif jika suhu === 'Dingin'
  defaultIce?: 'Normal Ice' | 'Less Ice' | 'No Ice';
  sizes?: ProductSizeOption[];

  // Opsi makanan / roti
  supportsWarming: boolean;
  flavorVariants?: string[];

  // Opsi kepedasan
  supportsSpicy: boolean;

  // Opsi kemasan & merchandise
  grindOptions?: string[];
  packagingSizes?: ProductSizeOption[];
  colorVariants?: string[];
}

/**
 * Aturan konfigurasi per produk / SKU
 */
const SKU_CUSTOM_CONFIGS: Record<string, Partial<ProductCustomConfig>> = {
  // Espresso murni: Single / Double shot, suhu panas, tanpa es/gula default
  'kop-001': {
    supportsTemp: true,
    defaultTemp: 'Panas',
    supportsSugar: false,
    supportsIce: false,
    sizes: [
      { id: 'Regular', label: 'Single Shot', priceDelta: 0, isDefault: true },
      { id: 'Large', label: 'Double Shot (+Rp5.000)', priceDelta: 5000 },
    ],
  },
  // Biji Kopi Lumbung: Pilihan gilingan beans & berat
  'kms-002': {
    grindOptions: [
      'Biji Utuh',
      'Giling Kasar',
      'Giling Sedang',
      'Giling Halus',
    ],
    packagingSizes: [
      { id: '250g', label: '250 gram (Standar)', priceDelta: 0, isDefault: true },
    ],
  },
  // Kopi Susu Botol 1 L
  'kms-001': {
    supportsTemp: true,
    defaultTemp: 'Dingin',
    supportsSugar: false,
    supportsIce: false,
  },
  // Tumbler Lumbung 450 ml
  'kms-003': {
    colorVariants: ['Hitam Doff', 'Krem / Latte', 'Stainless Steel'],
  },
  // Roti Abon Pedas: Pilihan tingkat kepedasan
  'rot-005': {
    supportsWarming: true,
    supportsSpicy: true,
  },
  // Croissant Mentega
  'rot-001': {
    supportsWarming: true,
    flavorVariants: ['Mentega Klasik', 'Extra Butter'],
  },
  // Roti Sobek Keju
  'rot-003': {
    supportsWarming: true,
    flavorVariants: ['Keju Klasik', 'Keju Manis'],
  },
  // Roti Pisang Cokelat
  'rot-002': {
    supportsWarming: true,
    flavorVariants: ['Pisang Cokelat Original'],
  },
  // Donat Gula Halus
  'rot-004': {
    supportsWarming: false, // Donat gula tidak dipanaskan agar gula tidak meleleh
    flavorVariants: ['Gula Halus Salju', 'Gula Kayu Manis'],
  },
  // Cookies Oat Madu
  'snk-001': {
    supportsWarming: false,
    flavorVariants: ['Oat Madu Original'],
  },
  // Banana Cake Slice
  'snk-002': {
    supportsWarming: true,
    flavorVariants: ['Original Cinnamon', 'Choco Swirl'],
  },
};

/**
 * Konfigurasi default berdasarkan kategori produk
 */
export function getProductCustomConfig(sku: string, kategori: string): ProductCustomConfig {
  const normSku = (sku || '').toLowerCase().trim();
  const normKategori = (kategori || '').toLowerCase().trim();
  const override = SKU_CUSTOM_CONFIGS[normSku] || {};

  // Default Standard Sizes untuk Minuman (Regular vs Large selisih Rp5.000)
  const defaultDrinkSizes: ProductSizeOption[] = [
    { id: 'Regular', label: 'Regular Cup', priceDelta: 0, isDefault: true },
    { id: 'Large', label: 'Large Cup (+Rp5.000)', priceDelta: 5000 },
  ];

  if (normKategori === 'kopi' || normKategori === 'non_kopi') {
    return {
      kategori: normKategori,
      supportsTemp: override.supportsTemp ?? true,
      defaultTemp: override.defaultTemp ?? 'Dingin',
      supportsSugar: override.supportsSugar ?? true,
      defaultSugar: override.defaultSugar ?? 'Normal',
      supportsIce: override.supportsIce ?? true,
      defaultIce: override.defaultIce ?? 'Normal Ice',
      sizes: override.sizes ?? defaultDrinkSizes,
      supportsWarming: false,
      supportsSpicy: false,
    };
  }

  if (normKategori === 'roti') {
    return {
      kategori: 'roti',
      supportsTemp: false,
      supportsSugar: false,
      supportsIce: false,
      supportsWarming: override.supportsWarming ?? true,
      flavorVariants: override.flavorVariants,
      supportsSpicy: override.supportsSpicy ?? false,
    };
  }

  if (normKategori === 'snack') {
    return {
      kategori: 'snack',
      supportsTemp: false,
      supportsSugar: false,
      supportsIce: false,
      supportsWarming: override.supportsWarming ?? false,
      flavorVariants: override.flavorVariants,
      supportsSpicy: override.supportsSpicy ?? false,
    };
  }

  if (normKategori === 'kemasan') {
    return {
      kategori: 'kemasan',
      supportsTemp: override.supportsTemp ?? false,
      defaultTemp: override.defaultTemp,
      supportsSugar: false,
      supportsIce: false,
      supportsWarming: false,
      supportsSpicy: false,
      grindOptions: override.grindOptions,
      packagingSizes: override.packagingSizes,
      colorVariants: override.colorVariants,
    };
  }

  // Fallback generik
  return {
    kategori: normKategori,
    supportsTemp: false,
    supportsSugar: false,
    supportsIce: false,
    supportsWarming: false,
    supportsSpicy: false,
  };
}

/**
 * Menghitung selisih harga varian (Trusted Server Calculation)
 * Berdasarkan ukuran (misal Large = +Rp5.000) atau atribut konfigurasi lainnya.
 */
export function getVariantPriceDelta(
  sku: string,
  options?: CustomOrderOptions,
  kategori?: string
): number {
  if (!options) return 0;

  const normSku = (sku || '').toLowerCase().trim();
  const normKategori = (kategori || '').toLowerCase().trim();
  const config = SKU_CUSTOM_CONFIGS[normSku];

  // Cek selisih dari ukuran minuman (kecuali produk yang tidak memiliki ukuran)
  if (options.ukuran) {
    if (config?.sizes) {
      const match = config.sizes.find(
        (s) => s.id.toLowerCase() === options.ukuran?.toLowerCase()
      );
      if (match) return match.priceDelta;
    }
    // Default size delta policy: Large Cup = +Rp5.000 untuk minuman (kopi & non-kopi)
    const isDrink =
      normKategori === 'kopi' ||
      normKategori === 'non_kopi' ||
      normSku.startsWith('kop-') ||
      normSku.startsWith('nkp-') ||
      !normKategori; // Fallback jika kategori belum diisi tapi ada ukuran
    const normUkuran = (options.ukuran || '').toLowerCase();
    if (isDrink && (normUkuran === 'large' || normUkuran === 'double')) {
      return 5000;
    }
  }

  // Cek selisih dari ukuran kemasan (jika ada opsi kemasan dengan delta)
  if (options.ukuranKemasan && config?.packagingSizes) {
    const match = config.packagingSizes.find((s) => s.id === options.ukuranKemasan);
    if (match) return match.priceDelta;
  }

  return 0;
}

/**
 * Menghitung harga satuan efektif produk yang tervalidasi
 * unitPrice = harga_dasar + selisih_varian
 */
export function getEffectiveItemPrice(
  produk: { sku: string; harga_jual: number; kategori?: string },
  options?: CustomOrderOptions,
  providedUnitPrice?: number
): number {
  const delta = getVariantPriceDelta(produk.sku, options, produk.kategori);
  const calculated = Math.max(0, produk.harga_jual + delta);
  if (providedUnitPrice !== undefined && providedUnitPrice >= calculated) {
    return providedUnitPrice;
  }
  return calculated;
}

/**
 * Format ringkasan kustomisasi item untuk ditampilkan di kartu/struk
 * Contoh: "Large, Dingin, Less Sugar" atau "Hangat, Level 1"
 */
export function formatItemCustomization(options?: CustomOrderOptions): string {
  if (!options) return '';

  const parts: string[] = [];

  if (options.ukuran) {
    parts.push(options.ukuran);
  }
  if (options.suhu) {
    parts.push(options.suhu);
  }
  if (options.gula && options.gula !== 'Normal') {
    parts.push(options.gula);
  }
  if (options.es && options.suhu === 'Dingin' && options.es !== 'Normal Ice') {
    parts.push(options.es);
  }
  if (options.penyajian && options.penyajian === 'Hangat') {
    parts.push('Hangat');
  }
  if (options.varianRasa) {
    parts.push(options.varianRasa);
  }
  if (options.levelPedas) {
    parts.push(options.levelPedas);
  }
  if (options.gilingan) {
    parts.push(options.gilingan);
  }
  if (options.warna) {
    parts.push(`Warna: ${options.warna}`);
  }
  if (options.catatanKhusus) {
    parts.push(`Catatan: ${options.catatanKhusus}`);
  }

  return parts.join(', ');
}

/**
 * Format nama produk lengkap dengan varian utama (misal untuk Invoice Mayar & Struk)
 */
export function formatItemDisplayName(nama: string, options?: CustomOrderOptions): string {
  if (!options) return nama;
  const parts: string[] = [];
  if (options.ukuran && options.ukuran !== 'Regular') {
    parts.push(options.ukuran);
  }
  if (options.gilingan) {
    parts.push(options.gilingan);
  }
  if (options.penyajian === 'Hangat') {
    parts.push('Hangat');
  }

  if (parts.length > 0) {
    return `${nama} (${parts.join(', ')})`;
  }
  return nama;
}
