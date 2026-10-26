'use client';

import React, { useState, useMemo } from 'react';
import { ProdukPOS } from '@/app/(dashboard)/kasir/kasir-client';
import { ProductCardImage } from '@/components/brand/ProductCardImage';
import { formatRupiah } from '@/lib/utils/format';
import {
  getProductCustomConfig,
  getEffectiveItemPrice,
  getVariantPriceDelta,
  CustomOrderOptions,
} from '@/lib/products/product-config';
import {
  X,
  Plus,
  Minus,
  Coffee,
  Flame,
  Snowflake,
  ShoppingBag,
  User,
  Package,
  Layers,
} from 'lucide-react';

export type { CustomOrderOptions };
export type UkuranMinuman = NonNullable<CustomOrderOptions['ukuran']>;
export type JenisGilingan = NonNullable<CustomOrderOptions['gilingan']>;

export interface ProductCustomModalProps {
  produk: ProdukPOS | null;
  isOpen: boolean;
  initialOptions?: CustomOrderOptions;
  initialJumlah?: number;
  customerName?: string;
  onCustomerNameChange?: (name: string) => void;
  isEditing?: boolean;
  onClose: () => void;
  onConfirm: (
    produk: ProdukPOS,
    jumlah: number,
    options: CustomOrderOptions,
    hargaSatuan: number
  ) => void;
}

export function ProductCustomModal(props: ProductCustomModalProps) {
  if (!props.isOpen || !props.produk) return null;
  return <ProductCustomModalDialog {...props} produk={props.produk} />;
}

interface ProductCustomModalDialogProps extends Omit<ProductCustomModalProps, 'isOpen' | 'produk'> {
  produk: ProdukPOS;
}

function ProductCustomModalDialog({
  produk,
  initialOptions,
  initialJumlah = 1,
  customerName = '',
  onCustomerNameChange,
  isEditing = false,
  onClose,
  onConfirm,
}: ProductCustomModalDialogProps) {
  const config = useMemo(
    () => getProductCustomConfig(produk.sku, produk.kategori),
    [produk.sku, produk.kategori]
  );

  // State kuantitas
  const [jumlah, setJumlah] = useState<number>(initialJumlah || 1);

  // State opsi minuman
  const [suhu, setSuhu] = useState<'Panas' | 'Dingin'>(
    initialOptions?.suhu || config.defaultTemp || 'Dingin'
  );
  const [gula, setGula] = useState<'Normal' | 'Less Sugar' | 'No Sugar'>(
    initialOptions?.gula || config.defaultSugar || 'Normal'
  );
  const [es, setEs] = useState<'Normal Ice' | 'Less Ice' | 'No Ice'>(
    initialOptions?.es || config.defaultIce || 'Normal Ice'
  );

  const [ukuran, setUkuran] = useState<UkuranMinuman>(
    (initialOptions?.ukuran as UkuranMinuman) ||
      (config.sizes && (config.sizes[0]?.id as UkuranMinuman)) ||
      'Regular'
  );

  // State opsi roti & makanan
  const [penyajian, setPenyajian] = useState<'Hangat' | 'Biasa'>(
    initialOptions?.penyajian || (config.supportsWarming ? 'Hangat' : 'Biasa')
  );
  const [varianRasa, setVarianRasa] = useState<string>(
    initialOptions?.varianRasa || (config.flavorVariants && config.flavorVariants[0]) || ''
  );
  const [levelPedas, setLevelPedas] = useState<
    'Level 0 (Tidak Pedas)' | 'Level 1 (Pedas Sedang)' | 'Level 2 (Ekstra Pedas)'
  >(initialOptions?.levelPedas || 'Level 0 (Tidak Pedas)');

  // State opsi kemasan & beans
  const [ukuranKemasan, setUkuranKemasan] = useState<string>(
    initialOptions?.ukuranKemasan || (config.packagingSizes && config.packagingSizes[0]?.id) || ''
  );
  const [gilingan, setGilingan] = useState<JenisGilingan>(
    (initialOptions?.gilingan as JenisGilingan) ||
      (config.grindOptions && (config.grindOptions[0] as JenisGilingan)) ||
      'Biji Utuh'
  );
  const [warna, setWarna] = useState<string>(
    initialOptions?.warna || (config.colorVariants && config.colorVariants[0]) || ''
  );

  // State nama pemesan lokal
  const [localCustomerName, setLocalCustomerName] = useState<string>(customerName);

  // State catatan khusus
  const [catatanKhusus, setCatatanKhusus] = useState<string>(
    initialOptions?.catatanKhusus || ''
  );

  // Siapkan objek options terkini untuk kalkulasi harga
  const currentOptions: CustomOrderOptions = useMemo(() => {
    const opts: CustomOrderOptions = {};

    if (config.supportsTemp) opts.suhu = suhu;
    if (config.supportsSugar) opts.gula = gula;
    if (config.supportsIce && suhu === 'Dingin') opts.es = es;
    if (config.sizes && config.sizes.length > 0) opts.ukuran = ukuran;

    if (config.supportsWarming) opts.penyajian = penyajian;
    if (config.flavorVariants && config.flavorVariants.length > 0 && varianRasa) {
      opts.varianRasa = varianRasa;
    }
    if (config.supportsSpicy) opts.levelPedas = levelPedas;

    if (config.packagingSizes && config.packagingSizes.length > 0 && ukuranKemasan) {
      opts.ukuranKemasan = ukuranKemasan;
    }
    if (config.grindOptions && config.grindOptions.length > 0 && gilingan) {
      opts.gilingan = gilingan;
    }
    if (config.colorVariants && config.colorVariants.length > 0 && warna) {
      opts.warna = warna;
    }

    if (catatanKhusus.trim()) {
      opts.catatanKhusus = catatanKhusus.trim();
    }

    return opts;
  }, [
    config,
    suhu,
    gula,
    es,
    ukuran,
    penyajian,
    varianRasa,
    levelPedas,
    ukuranKemasan,
    gilingan,
    warna,
    catatanKhusus,
  ]);

  // Kalkulasi harga satuan efektif & subtotal secara langsung
  const unitPrice = useMemo(
    () => getEffectiveItemPrice(produk, currentOptions),
    [produk, currentOptions]
  );
  const sizeDelta = useMemo(
    () => getVariantPriceDelta(produk.sku, currentOptions),
    [produk.sku, currentOptions]
  );
  const subtotal = unitPrice * jumlah;

  const maxStok =
    produk.lacak_stok && produk.stok_tersedia !== null ? Math.max(0, produk.stok_tersedia) : 99;

  const handleIncrement = () => {
    if (jumlah < maxStok && jumlah < 99) {
      setJumlah((prev) => prev + 1);
    }
  };

  const handleDecrement = () => {
    if (jumlah > 1) {
      setJumlah((prev) => prev - 1);
    }
  };

  const handleSave = () => {
    if (onCustomerNameChange && localCustomerName.trim() !== customerName.trim()) {
      onCustomerNameChange(localCustomerName.trim());
    }
    onConfirm(produk, jumlah, currentOptions, unitPrice);
    onClose();
  };

  const categoryBadgeLabel = produk.kategori.replace('_', ' ').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="p-4 sm:p-5 border-b border-[#F2ECE6] dark:border-[#2E2522] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-[#FAF0E6] dark:bg-[#2C221E] text-[#8C5E3C]">
              {produk.kategori === 'kemasan' ? (
                <Package className="w-4 h-4" />
              ) : (
                <Coffee className="w-4 h-4" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                {isEditing ? 'Ubah Detail Pesanan' : 'Detail & Kustomisasi Pesanan'}
              </h3>
              <p className="text-[11px] text-[#8C7A70] dark:text-[#A8968D]">
                Sesuaikan varian dan catatan sebelum masuk keranjang
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-[#8C7A70] hover:text-[#2D2422] dark:hover:text-[#F5EBE6] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#28211B] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Card Info Produk dengan Foto Nyata & Proporsi Sempurna */}
          <div className="flex gap-4 p-3.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B]">
            <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 border border-[#E8DFD8] dark:border-[#382E2B] relative bg-[#EFE9DF] dark:bg-[#1E1715]">
              <ProductCardImage
                sku={produk.sku}
                nama={produk.nama}
                kategori={produk.kategori}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md bg-[#FAF0E6] dark:bg-[#2C221E] text-[#8C5E3C]">
                    {categoryBadgeLabel}
                  </span>
                  <span className="text-[10px] font-mono font-bold whitespace-nowrap min-w-[70px] text-right text-[#8C7A70] dark:text-[#A8968D]">
                    {produk.sku}
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#2D2422] dark:text-[#F5EBE6] truncate mt-1">
                  {produk.nama}
                </h4>
              </div>

              <div className="flex items-baseline justify-between mt-1 pt-1 border-t border-[#EFE9E2] dark:border-[#2C221E]">
                <div>
                  <span className="text-[10px] text-[#8C7A70] dark:text-[#A8968D] block">
                    Harga Dasar:
                  </span>
                  <span className="text-xs font-mono font-bold text-[#5C4538] dark:text-[#D5C2B6] tabular-nums">
                    {formatRupiah(produk.harga_jual)}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-[#8C5E3C] font-semibold block">
                    Harga Satuan:
                  </span>
                  <span className="text-sm font-black font-mono text-[#8C5E3C] tabular-nums">
                    {formatRupiah(unitPrice)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Input / Tampilan Identitas Pemesan */}
          <div className="p-3.5 rounded-2xl bg-[#FAF7F2] dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] space-y-1.5">
            <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-[#8C5E3C]" />
                <span>Nama Pemesan / Pelanggan:</span>
              </span>
              <span className="text-[10px] font-normal text-[#8C7A70] dark:text-[#A8968D]">
                Default: Pelanggan Umum
              </span>
            </label>
            <input
              type="text"
              placeholder="Contoh: Dino, Kak Dinda, atau kosongkan untuk umum"
              value={localCustomerName}
              onChange={(e) => setLocalCustomerName(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-[#1E1715] border border-[#E8DFD8] dark:border-[#3E312B] text-[#2D2422] dark:text-[#F5EBE6] placeholder-[#A8968D] outline-none focus:border-[#8C5E3C] transition-colors"
            />
          </div>

          {/* ============================================================== */}
          {/* A. MINUMAN: SUHU, GULA, ES, DAN UKURAN (REGULAR VS LARGE)      */}
          {/* ============================================================== */}
          {(config.kategori === 'kopi' || config.kategori === 'non_kopi') && (
            <div className="space-y-4">
              {/* Ukuran Minuman (Regular Cup vs Large Cup dengan Perbedaan Harga Nyata) */}
              {config.sizes && config.sizes.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6] flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-[#8C5E3C]" />
                      <span>Pilihan Ukuran Cup:</span>
                    </label>
                    {sizeDelta > 0 && (
                      <span className="text-[10px] font-mono font-bold text-[#8C5E3C] bg-[#FAF0E6] dark:bg-[#2C221E] px-2 py-0.5 rounded-full">
                        +{formatRupiah(sizeDelta)}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    {config.sizes.map((s) => {
                      const isSelected = ukuran === s.id;
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => setUkuran(s.id as UkuranMinuman)}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer ${
                            isSelected
                              ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm'
                              : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                          }`}
                        >
                          <span>{s.label}</span>
                          <span
                            className={`text-[10px] font-mono ${
                              isSelected ? 'text-white/80' : 'text-[#8C5E3C]'
                            }`}
                          >
                            {s.priceDelta > 0
                              ? `+${formatRupiah(s.priceDelta)}`
                              : 'Harga Dasar'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pilihan Suhu (Panas / Dingin) jika didukung */}
              {config.supportsTemp && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6] flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[#C67C4E]" />
                    <span>Suhu Penyajian:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['Dingin', 'Panas'] as const).map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setSuhu(opt)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          suhu === opt
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        {opt === 'Dingin' ? (
                          <Snowflake className="w-3.5 h-3.5" />
                        ) : (
                          <Flame className="w-3.5 h-3.5" />
                        )}
                        <span>{opt === 'Dingin' ? 'Dingin (Iced)' : 'Panas (Hot)'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tingkat Gula (Sugar Level) jika didukung */}
              {config.supportsSugar && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                    Tingkat Manis / Gula:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Normal', 'Less Sugar', 'No Sugar'] as const).map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setGula(opt)}
                        className={`py-2 px-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                          gula === opt
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm font-bold'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Takaran Es (Hanya jika Dingin & Didukung) */}
              {config.supportsIce && suhu === 'Dingin' && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6] flex items-center gap-1.5">
                    <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                    <span>Takaran Es Batu:</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['Normal Ice', 'Less Ice', 'No Ice'] as const).map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setEs(opt)}
                        className={`py-2 px-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                          es === opt
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm font-bold'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* B. ROTI & PASTRY: PENYAJIAN HANGAT/BIASA & VARIAN RASA          */}
          {/* ============================================================== */}
          {config.kategori === 'roti' && (
            <div className="space-y-4">
              {config.supportsWarming && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6] flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-amber-600" />
                    <span>Pilihan Pemanasan Roti / Pastry:</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['Hangat', 'Biasa'] as const).map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setPenyajian(opt)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          penyajian === opt
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        <span>{opt === 'Hangat' ? 'Dipanaskan (Hangat)' : 'Suhu Ruang (Biasa)'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {config.flavorVariants && config.flavorVariants.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                    Varian Rasa Terdaftar:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {config.flavorVariants.map((flavor) => (
                      <button
                        type="button"
                        key={flavor}
                        onClick={() => setVarianRasa(flavor)}
                        className={`py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          varianRasa === flavor
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm font-bold'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        {flavor}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {config.supportsSpicy && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                    Tingkat Kepedasan Abon:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        'Level 0 (Tidak Pedas)',
                        'Level 1 (Pedas Sedang)',
                        'Level 2 (Ekstra Pedas)',
                      ] as const
                    ).map((lvl) => (
                      <button
                        type="button"
                        key={lvl}
                        onClick={() => setLevelPedas(lvl)}
                        className={`py-2 px-2 rounded-xl border text-[11px] font-semibold text-center transition-all cursor-pointer ${
                          levelPedas === lvl
                            ? 'border-red-600 bg-red-600 text-white shadow-sm font-bold'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        {lvl.replace(' (', '\n(')}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* C. SNACK & CAMILAN: TINGKAT PEDAS / VARIAN RASA                */}
          {/* ============================================================== */}
          {config.kategori === 'snack' && (
            <div className="space-y-4">
              {config.flavorVariants && config.flavorVariants.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                    Pilihan Varian Snack:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {config.flavorVariants.map((flavor) => (
                      <button
                        type="button"
                        key={flavor}
                        onClick={() => setVarianRasa(flavor)}
                        className={`py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          varianRasa === flavor
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm font-bold'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        {flavor}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {config.supportsWarming && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                    Penyajian:
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['Hangat', 'Biasa'] as const).map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setPenyajian(opt)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          penyajian === opt
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        <span>{opt === 'Hangat' ? 'Dihangatkan' : 'Suhu Ruang'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* D. PRODUK KEMASAN, BEANS, DAN MERCHANDISE                      */}
          {/* ============================================================== */}
          {config.kategori === 'kemasan' && (
            <div className="space-y-4">
              {/* Pilihan Gilingan Biji Kopi */}
              {config.grindOptions && config.grindOptions.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                    Jenis Gilingan (Grind Size):
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {config.grindOptions.map((grind) => (
                      <button
                        type="button"
                        key={grind}
                        onClick={() => setGilingan(grind as JenisGilingan)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                          gilingan === grind
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm font-bold'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        {grind}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ukuran Kemasan Beans */}
              {config.packagingSizes && config.packagingSizes.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                    Berat Kemasan Biji Kopi:
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {config.packagingSizes.map((pkg) => (
                      <button
                        type="button"
                        key={pkg.id}
                        onClick={() => setUkuranKemasan(pkg.id)}
                        className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                          ukuranKemasan === pkg.id
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm font-bold'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        {pkg.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Pilihan Warna Tumbler */}
              {config.colorVariants && config.colorVariants.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                    Pilihan Warna Tumbler:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {config.colorVariants.map((col) => (
                      <button
                        type="button"
                        key={col}
                        onClick={() => setWarna(col)}
                        className={`py-2 px-2 rounded-xl border text-xs font-semibold text-center transition-all cursor-pointer ${
                          warna === col
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm font-bold'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Suhu Penyimpanan Botol */}
              {config.supportsTemp && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
                    Kondisi Botol:
                  </label>
                  <div className="grid grid-cols-2 gap-2.5">
                    {(['Dingin', 'Panas'] as const).map((opt) => (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => setSuhu(opt)}
                        className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          suhu === opt
                            ? 'border-[#8C5E3C] bg-[#8C5E3C] text-white shadow-sm'
                            : 'border-[#E8DFD8] dark:border-[#3E312B] bg-[#FAF7F2] dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] hover:bg-[#EFE7DE]'
                        }`}
                      >
                        <span>{opt === 'Dingin' ? 'Dingin (Chilled)' : 'Suhu Ruang'}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Catatan Khusus Barista / Dapur */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6]">
              Catatan Khusus Tambahan (Opsional):
            </label>
            <input
              type="text"
              placeholder="Contoh: Pisah es batu, kurangi manis, bungkus terpisah..."
              value={catatanKhusus}
              onChange={(e) => setCatatanKhusus(e.target.value)}
              maxLength={100}
              className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FAF7F2] dark:bg-[#1E1715] border border-[#E8DFD8] dark:border-[#3E312B] text-[#2D2422] dark:text-[#F5EBE6] placeholder-[#A8968D] outline-none focus:border-[#8C5E3C] transition-colors"
            />
          </div>

          {/* Jumlah Pesanan (Quantity Counter) */}
          <div className="p-4 rounded-2xl bg-[#FAF7F2] dark:bg-[#231B18] border border-[#E8DFD8] dark:border-[#382E2B] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-[#2D2422] dark:text-[#F5EBE6] block">
                Jumlah Pesanan:
              </span>
              <span className="text-[11px] text-[#8C7A70] dark:text-[#A8968D]">
                {produk.lacak_stok
                  ? `Stok tersedia: ${produk.stok_tersedia ?? 0} pcs`
                  : 'Maks. 99 per item'}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDecrement}
                disabled={jumlah <= 1}
                className="w-9 h-9 rounded-xl border border-[#E8DFD8] dark:border-[#3E312B] bg-white dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] flex items-center justify-center font-bold disabled:opacity-40 cursor-pointer transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-bold font-mono text-base tabular-nums text-[#2D2422] dark:text-[#F5EBE6]">
                {jumlah}
              </span>
              <button
                type="button"
                onClick={handleIncrement}
                disabled={jumlah >= maxStok}
                className="w-9 h-9 rounded-xl border border-[#E8DFD8] dark:border-[#3E312B] bg-white dark:bg-[#1E1715] text-[#5C4538] dark:text-[#D5C2B6] flex items-center justify-center font-bold disabled:opacity-40 cursor-pointer transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer Subtotal & Action */}
        <div className="p-4 sm:p-5 border-t border-[#F2ECE6] dark:border-[#2E2522] bg-white dark:bg-[#1E1915] flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-[#8C7A70] dark:text-[#A8968D]">
                Subtotal ({jumlah} item):
              </span>
              {sizeDelta > 0 && (
                <span className="text-[9px] font-bold text-[#8C5E3C] bg-[#FAF0E6] dark:bg-[#2C221E] px-1.5 py-0.2 rounded">
                  Large (+{formatRupiah(sizeDelta)})
                </span>
              )}
            </div>
            <span className="text-lg font-black font-mono tabular-nums text-[#8C5E3C]">
              {formatRupiah(subtotal)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#E8DFD8] dark:border-[#382E2B] text-xs font-semibold text-[#8C7A70] hover:text-[#2D2422] dark:hover:text-[#F5EBE6] transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2.5 rounded-xl bg-[#8C5E3C] hover:bg-[#734A2E] text-white text-xs font-bold flex items-center gap-2 shadow-sm transition-colors cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{isEditing ? 'Simpan Perubahan' : 'Tambah ke Keranjang'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
