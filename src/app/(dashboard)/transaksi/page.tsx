import { getUserProfile } from '@/lib/auth/get-user-profile';
import { redirect } from 'next/navigation';
import { Search, Filter, Ban, Printer } from 'lucide-react';

export default async function TransaksiPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  const isVoidAllowed = profile.peran === 'kepala_toko' || profile.peran === 'owner';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-[#E8DFD3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#2C1810]">Riwayat Transaksi Penjualan</h1>
          <p className="text-xs text-[#78716C] mt-0.5">
            {profile.peran === 'kasir'
              ? 'Daftar transaksi yang Anda layani pada shift aktif'
              : profile.peran === 'kepala_toko'
              ? `Seluruh transaksi cabang ${profile.cabang?.nama || ''} (Pengawasan & Otorisasi Void)`
              : 'Seluruh transaksi penjualan di semua cabang Lumbung'}
          </p>
        </div>

        {isVoidAllowed && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
            <Ban className="w-3.5 h-3.5 text-amber-600" />
            <span>Hak Otorisasi Void Aktif (BR-08)</span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-[#E8DFD3] shadow-xs flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
          <input
            type="text"
            placeholder="Cari nomor struk (contoh: TBT-20261015-0004)..."
            disabled
            className="w-full pl-10 pr-4 py-2 bg-[#FAF7F2] border border-[#E8DFD3] rounded-xl text-xs focus:outline-none placeholder:text-[#A8A29E]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#FAF7F2] border border-[#E8DFD3] rounded-xl text-xs font-medium text-[#78716C] cursor-not-allowed"
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Semua Status</span>
          </button>
        </div>
      </div>

      {/* Sample Transactions Table / Cards */}
      <div className="bg-white border border-[#E8DFD3] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD3] text-[#78716C] uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Nomor Struk</th>
                <th className="px-4 py-3">Waktu (WIB)</th>
                <th className="px-4 py-3">Kasir</th>
                <th className="px-4 py-3">Metode</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3EDE2] text-[#2C1810]">
              {[
                {
                  struk: 'TBT-20261015-0003',
                  waktu: '15 Okt, 14:10',
                  kasir: 'Dimas Arya',
                  metode: 'tunai',
                  total: 44000,
                  status: 'lunas',
                  voidEligible: true,
                },
                {
                  struk: 'TBT-20261015-0002',
                  waktu: '15 Okt, 11:20',
                  kasir: 'Dimas Arya',
                  metode: 'qris',
                  total: 65000,
                  status: 'lunas',
                  voidEligible: true,
                },
                {
                  struk: 'TBT-20261011-0003',
                  waktu: '11 Okt, 16:45',
                  kasir: 'Putri M.',
                  metode: 'tunai',
                  total: 38000,
                  status: 'void',
                  voidEligible: false,
                },
              ].map((trx) => (
                <tr key={trx.struk} className="hover:bg-[#FAF7F2]/60 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#4A2E18]">{trx.struk}</td>
                  <td className="px-4 py-3 text-[#78716C]">{trx.waktu}</td>
                  <td className="px-4 py-3">{trx.kasir}</td>
                  <td className="px-4 py-3 uppercase font-semibold text-[#78716C]">
                    {trx.metode}
                  </td>
                  <td className="px-4 py-3 font-extrabold text-[#2C1810]">
                    Rp{trx.total.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        trx.status === 'lunas'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}
                    >
                      {trx.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-1.5">
                    <button
                      title="Cetak Salinan Struk"
                      disabled
                      className="p-1.5 text-[#78716C] hover:text-[#4A2E18] hover:bg-stone-100 rounded-lg transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                    {isVoidAllowed && trx.voidEligible && (
                      <button
                        title="Void Transaksi (BR-08)"
                        disabled
                        className="px-2 py-1 text-[11px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-all"
                      >
                        Void
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
