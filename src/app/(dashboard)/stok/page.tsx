import { getUserProfile } from '@/lib/auth/get-user-profile';
import { redirect } from 'next/navigation';
import { AlertTriangle, ArrowDownUp } from 'lucide-react';

export default async function StokPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir dilarang (BR-01)
  if (profile.peran === 'kasir') {
    redirect('/kasir');
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E8DFD3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#2C1810]">Manajemen Stok Cabang</h1>
          <p className="text-xs text-[#78716C] mt-0.5">
            Pantau stok fisik produk dan lakukan penyesuaian stok (barang masuk / rusak - BR-12)
          </p>
        </div>

        <button
          disabled
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4A2E18] text-white text-xs font-semibold rounded-xl shadow-xs opacity-50 cursor-not-allowed"
        >
          <ArrowDownUp className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Penyesuaian Stok Baru</span>
        </button>
      </div>

      {/* Warning Box: Low Stock Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 shadow-xs">
        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-bold text-amber-900">Perhatian: Stok Menipis Terdeteksi</p>
          <p className="text-amber-800 mt-0.5">
            Croissant Mentega (sisa: 1 pcs) dan Cookies Oat Madu berada di bawah ambang batas stok minimum. Segera koordinasikan pengiriman dari dapur pusat.
          </p>
        </div>
      </div>

      {/* Table Stok */}
      <div className="bg-white border border-[#E8DFD3] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD3] text-[#78716C] uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Nama Produk</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Stok Saat Ini</th>
                <th className="px-4 py-3">Batas Minimum</th>
                <th className="px-4 py-3">Status Stok</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3EDE2] text-[#2C1810]">
              {[
                {
                  sku: 'ROT-001',
                  nama: 'Croissant Mentega',
                  kategori: 'roti',
                  stok: 1,
                  min: 4,
                  status: 'kritis',
                },
                {
                  sku: 'ROT-002',
                  nama: 'Roti Sobek Keju',
                  kategori: 'roti',
                  stok: 0,
                  min: 3,
                  status: 'habis',
                },
                {
                  sku: 'SNK-001',
                  nama: 'Cookies Oat Madu',
                  kategori: 'snack',
                  stok: 2,
                  min: 4,
                  status: 'menipis',
                },
                {
                  sku: 'KMS-001',
                  nama: 'Biji Kopi Lumbung 250g',
                  kategori: 'kemasan',
                  stok: 14,
                  min: 5,
                  status: 'aman',
                },
              ].map((item) => (
                <tr key={item.sku} className="hover:bg-[#FAF7F2]/60 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#4A2E18]">{item.sku}</td>
                  <td className="px-4 py-3 font-semibold">{item.nama}</td>
                  <td className="px-4 py-3 capitalize text-[#78716C]">{item.kategori}</td>
                  <td className="px-4 py-3 font-mono font-extrabold text-sm text-[#2C1810]">
                    {item.stok} pcs
                  </td>
                  <td className="px-4 py-3 text-[#78716C]">{item.min} pcs</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        item.status === 'habis'
                          ? 'bg-red-50 text-red-700 border border-red-200'
                          : item.status === 'kritis' || item.status === 'menipis'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {item.status.toUpperCase()}
                    </span>
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
