import { getUserProfile } from '@/lib/auth/get-user-profile';
import { redirect } from 'next/navigation';
import { TrendingUp, DollarSign, Receipt, Lock } from 'lucide-react';

export default async function LaporanPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir dilarang (BR-01)
  if (profile.peran === 'kasir') {
    redirect('/kasir');
  }

  const isOwner = profile.peran === 'owner';

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E8DFD3] pb-4">
        <h1 className="text-xl font-bold text-[#2C1810]">Laporan &amp; Analitik Penjualan</h1>
        <p className="text-xs text-[#78716C] mt-0.5">
          {isOwner
            ? 'Ringkasan omzet, laba kotor, dan margin multi-cabang (1 - 14 Oktober 2026)'
            : `Ringkasan penjualan harian cabang ${profile.cabang?.nama || ''}`}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#78716C] mb-1">
            <span>Total Omzet</span>
            <DollarSign className="w-4 h-4 text-[#D97706]" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-[#2C1810]">
            Rp{isOwner ? '6.880.500' : '2.225.100'}
          </div>
          <span className="text-[10px] text-emerald-600 font-medium mt-1 inline-block">
            Transaksi Lunas
          </span>
        </div>

        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs text-[#78716C] mb-1">
            <span>Total Transaksi</span>
            <Receipt className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-lg sm:text-xl font-extrabold text-[#2C1810]">
            {isOwner ? '60 Struk' : '20 Struk'}
          </div>
          <span className="text-[10px] text-[#A8A29E] mt-1 inline-block">
            Rata-rata: Rp{isOwner ? '114.675' : '111.255'}
          </span>
        </div>

        {/* Khusus Owner: Laba Kotor (BR-11) */}
        {isOwner ? (
          <>
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-amber-900 mb-1">
                <span className="font-semibold">Laba Kotor (Owner)</span>
                <TrendingUp className="w-4 h-4 text-[#D97706]" />
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#4A2E18]">
                Rp4.069.000
              </div>
              <span className="text-[10px] text-amber-700 font-medium mt-1 inline-block">
                Total Modal: Rp2.811.500
              </span>
            </div>

            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 shadow-xs">
              <div className="flex items-center justify-between text-xs text-amber-900 mb-1">
                <span className="font-semibold">Margin Rata-rata</span>
                <Lock className="w-3.5 h-3.5 text-amber-700" />
              </div>
              <div className="text-lg sm:text-xl font-extrabold text-[#4A2E18]">
                59.1%
              </div>
              <span className="text-[10px] text-amber-700 font-medium mt-1 inline-block">
                Data Rahasia (BR-11)
              </span>
            </div>
          </>
        ) : (
          <div className="col-span-2 bg-stone-50 border border-dashed border-[#E8DFD3] rounded-2xl p-4 flex items-center justify-center text-xs text-[#A8A29E] italic">
            Data harga modal &amp; laba hanya dapat diakses oleh Owner (BR-11)
          </div>
        )}
      </div>

      {/* Chart Placeholders */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-5 shadow-xs">
          <h2 className="text-sm font-bold text-[#2C1810] mb-4">
            Penjualan Harian per Cabang (Rp)
          </h2>
          <div className="h-48 bg-[#FAF7F2] rounded-xl border border-dashed border-[#E8DFD3] flex items-center justify-center text-xs text-[#A8A29E]">
            [Grafik Batang Penjualan Harian - Siap Terkoneksi Database di Tahap 6]
          </div>
        </div>

        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-5 shadow-xs">
          <h2 className="text-sm font-bold text-[#2C1810] mb-4">
            Komposisi Metode Pembayaran
          </h2>
          <div className="h-48 bg-[#FAF7F2] rounded-xl border border-dashed border-[#E8DFD3] flex items-center justify-center text-xs text-[#A8A29E]">
            [Grafik Donut: Tunai vs QRIS - Siap Terkoneksi Database di Tahap 6]
          </div>
        </div>
      </div>
    </div>
  );
}
