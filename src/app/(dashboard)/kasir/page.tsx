import { getUserProfile } from '@/lib/auth/get-user-profile';
import { redirect } from 'next/navigation';
import { ShoppingCart, Search, Coffee, Clock } from 'lucide-react';

export default async function KasirPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir & Owner diizinkan
  if (profile.peran === 'kepala_toko') {
    redirect('/transaksi');
  }

  return (
    <div className="space-y-6">
      {/* Top Notice Banner: Shift Status Requirement */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#4A2E18]">
              Status Shift Kasir: Siap Memulai
            </h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Sesuai aturan BR-02, transaksi hanya dapat dibuat setelah kasir membuka shift kerja.
            </p>
          </div>
        </div>
        <a
          href="/shift-saya"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4A2E18] hover:bg-[#382312] text-white text-xs font-semibold rounded-xl shadow-xs transition-all shrink-0"
        >
          <span>Buka Shift Kasir</span>
        </a>
      </div>

      {/* POS Layout: Responsive Mobile Stack & Tablet 10"+ Split Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Katalog Produk (Kira-kira 65% di Tablet/Desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Search Bar & Category Filter */}
          <div className="bg-white p-4 rounded-2xl border border-[#E8DFD3] shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
              <input
                type="text"
                placeholder="Cari kopi, roti, atau snack (SKU / Nama)..."
                disabled
                className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] border border-[#E8DFD3] rounded-xl text-sm focus:outline-none placeholder:text-[#A8A29E]"
              />
            </div>

            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
              <button className="px-3 py-1.5 bg-[#4A2E18] text-white font-medium rounded-lg shrink-0">
                Semua Menu
              </button>
              {['Kopi Racikan', 'Non-Kopi', 'Roti Segar', 'Snack & Kue', 'Kemasan'].map(
                (cat) => (
                  <button
                    key={cat}
                    disabled
                    className="px-3 py-1.5 bg-[#FAF7F2] text-[#78716C] border border-[#E8DFD3] font-medium rounded-lg shrink-0"
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Product Cards Placeholder */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              {
                sku: 'KOP-001',
                nama: 'Kopi Susu Lumbung',
                kategori: 'kopi',
                harga: 18000,
                lacak: false,
              },
              {
                sku: 'KOP-002',
                nama: 'Americano Dingin',
                kategori: 'kopi',
                harga: 15000,
                lacak: false,
              },
              {
                sku: 'ROT-001',
                nama: 'Croissant Mentega',
                kategori: 'roti',
                harga: 22000,
                lacak: true,
                stok: 1, // Kasus batas TC-07
              },
              {
                sku: 'ROT-002',
                nama: 'Roti Sobek Keju',
                kategori: 'roti',
                harga: 16000,
                lacak: true,
                stok: 0, // Kasus batas TC-06
              },
              {
                sku: 'SNK-001',
                nama: 'Cookies Oat Madu',
                kategori: 'snack',
                harga: 12000,
                lacak: true,
                stok: 2,
              },
              {
                sku: 'KMS-001',
                nama: 'Biji Kopi Lumbung 250g',
                kategori: 'kemasan',
                harga: 65000,
                lacak: true,
                stok: 14,
              },
            ].map((prod) => (
              <div
                key={prod.sku}
                className="bg-white border border-[#E8DFD3] rounded-2xl p-3.5 flex flex-col justify-between shadow-xs hover:border-[#D97706] transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-[#A8A29E]">{prod.sku}</span>
                    {prod.lacak ? (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold ${
                          prod.stok === 0
                            ? 'bg-red-50 text-red-600 border border-red-200'
                            : prod.stok === 1
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        Stok: {prod.stok}
                      </span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-medium bg-stone-100 text-stone-600">
                        Racikan
                      </span>
                    )}
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#2C1810] line-clamp-2">
                    {prod.nama}
                  </h3>
                </div>
                <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#F3EDE2]">
                  <span className="text-xs sm:text-sm font-extrabold text-[#4A2E18]">
                    Rp{prod.harga.toLocaleString('id-ID')}
                  </span>
                  <button
                    disabled={prod.stok === 0}
                    className="p-1.5 bg-[#FAF7F2] hover:bg-[#F3EDE2] text-[#4A2E18] rounded-lg border border-[#E8DFD3] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    <ShoppingCart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Keranjang & Pembayaran (Sticky di Tablet/Desktop) */}
        <div className="lg:col-span-5 xl:col-span-4 bg-white border border-[#E8DFD3] rounded-2xl p-5 shadow-sm lg:sticky lg:top-20 space-y-4">
          <div className="flex items-center justify-between border-b border-[#F3EDE2] pb-3">
            <h2 className="text-sm font-bold text-[#2C1810] flex items-center gap-2">
              <ShoppingCart className="w-4 h-4 text-[#D97706]" />
              Keranjang Transaksi
            </h2>
            <span className="text-xs bg-[#FAF7F2] text-[#78716C] px-2 py-0.5 rounded-full border border-[#E8DFD3]">
              0 Item
            </span>
          </div>

          {/* Empty State */}
          <div className="py-8 text-center text-[#A8A29E]">
            <Coffee className="w-8 h-8 mx-auto mb-2 stroke-[1.5]" />
            <p className="text-xs">Keranjang masih kosong</p>
            <p className="text-[11px] text-[#C4B5A5] mt-0.5">
              Klik produk di samping untuk menambahkan item
            </p>
          </div>

          {/* Summary Calculation Placeholder */}
          <div className="space-y-2 pt-3 border-t border-[#F3EDE2] text-xs text-[#78716C]">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="font-semibold text-[#2C1810]">Rp0</span>
            </div>
            <div className="flex justify-between text-amber-700">
              <span>Diskon (Maks 10% - BR-06)</span>
              <span>-Rp0</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-[#4A2E18] pt-2 border-t border-[#F3EDE2]">
              <span>Total Bayar</span>
              <span>Rp0</span>
            </div>
          </div>

          {/* Payment CTA */}
          <button
            disabled
            className="w-full py-3 bg-[#4A2E18] text-white text-xs font-bold rounded-xl shadow-md cursor-not-allowed opacity-50 flex items-center justify-center gap-2"
          >
            <span>Simpan & Cetak Struk (58mm)</span>
          </button>
        </div>
      </div>
    </div>
  );
}
