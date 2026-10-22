import { getUserProfile } from '@/lib/auth/get-user-profile';
import { redirect } from 'next/navigation';
import { Plus } from 'lucide-react';

export default async function ProdukPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir dilarang
  if (profile.peran === 'kasir') {
    redirect('/kasir');
  }

  const isOwner = profile.peran === 'owner';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#E8DFD3] pb-4">
        <div>
          <h1 className="text-xl font-bold text-[#2C1810]">Katalog Master Produk</h1>
          <p className="text-xs text-[#78716C] mt-0.5">
            {isOwner
              ? 'Kelola master produk, harga jual, dan riwayat harga modal rahasia (BR-05 & BR-11)'
              : 'Daftar katalog produk aktif Lumbung Kopi dan Roti (Hanya Lihat)'}
          </p>
        </div>

        {isOwner && (
          <button
            disabled
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#4A2E18] text-white text-xs font-semibold rounded-xl shadow-xs opacity-50 cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5 text-[#F59E0B]" />
            <span>Tambah Produk Baru</span>
          </button>
        )}
      </div>

      <div className="bg-white border border-[#E8DFD3] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD3] text-[#78716C] uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">Nama Produk</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Harga Jual</th>
                {isOwner && <th className="px-4 py-3 text-amber-900">Harga Modal (Rahasia)</th>}
                <th className="px-4 py-3">Pelacakan Stok</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3EDE2] text-[#2C1810]">
              {[
                {
                  sku: 'KOP-001',
                  nama: 'Kopi Susu Lumbung',
                  kategori: 'kopi',
                  jual: 18000,
                  modal: 9000,
                  lacak: false,
                  aktif: true,
                },
                {
                  sku: 'ROT-001',
                  nama: 'Croissant Mentega',
                  kategori: 'roti',
                  jual: 22000,
                  modal: 10000,
                  lacak: true,
                  aktif: true,
                },
                {
                  sku: 'ROT-005',
                  nama: 'Roti Abon Pedas',
                  kategori: 'roti',
                  jual: 17000,
                  modal: 8500,
                  lacak: true,
                  aktif: false, // Kasus batas TC-09
                },
              ].map((prod) => (
                <tr key={prod.sku} className="hover:bg-[#FAF7F2]/60 transition-colors">
                  <td className="px-4 py-3 font-mono font-bold text-[#4A2E18]">{prod.sku}</td>
                  <td className="px-4 py-3 font-semibold">{prod.nama}</td>
                  <td className="px-4 py-3 capitalize text-[#78716C]">{prod.kategori}</td>
                  <td className="px-4 py-3 font-extrabold text-[#2C1810]">
                    Rp{prod.jual.toLocaleString('id-ID')}
                  </td>
                  {isOwner && (
                    <td className="px-4 py-3 font-mono text-amber-800 font-semibold bg-amber-50/40">
                      Rp{prod.modal.toLocaleString('id-ID')}
                    </td>
                  )}
                  <td className="px-4 py-3 text-[#78716C]">
                    {prod.lacak ? 'Fisik Cabang' : 'Racikan (Tanpa Stok)'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        prod.aktif
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-stone-100 text-stone-600 border border-stone-200'
                      }`}
                    >
                      {prod.aktif ? 'AKTIF' : 'NONAKTIF'}
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
