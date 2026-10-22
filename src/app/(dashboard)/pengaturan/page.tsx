import { getUserProfile } from '@/lib/auth/get-user-profile';
import { redirect } from 'next/navigation';
import { UserCog, Building2, ScrollText } from 'lucide-react';

export default async function PengaturanPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Khusus Owner (BR-01 & BR-12)
  if (profile.peran !== 'owner') {
    redirect(profile.peran === 'kasir' ? '/kasir' : '/transaksi');
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E8DFD3] pb-4">
        <h1 className="text-xl font-bold text-[#2C1810]">Pengaturan Sistem (Owner)</h1>
        <p className="text-xs text-[#78716C] mt-0.5">
          Manajemen staf, data master cabang, dan inspeksi riwayat audit log (BR-12)
        </p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-5 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-[#D97706] rounded-xl shrink-0">
            <UserCog className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#2C1810]">Akun &amp; Staf (9 Akun)</h2>
            <p className="text-xs text-[#78716C] mt-1">
              Atur peran (Kasir, Kepala Toko), penetapan cabang, serta status aktif/nonaktif.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-5 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#2C1810]">Cabang Toko (3 Lokasi)</h2>
            <p className="text-xs text-[#78716C] mt-1">
              Informasi Tebet (TBT), Bintaro (BTR), dan Depok (DPK) beserta counter struk.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-5 shadow-xs flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-700 rounded-xl shrink-0">
            <ScrollText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[#2C1810]">Audit Log (Append-Only)</h2>
            <p className="text-xs text-[#78716C] mt-1">
              Catatan mutlak aksi void, verifikasi shift, penyesuaian stok, dan perubahan akun.
            </p>
          </div>
        </div>
      </div>

      {/* Sample Audit Log Table */}
      <div className="bg-white border border-[#E8DFD3] rounded-2xl shadow-xs p-5 space-y-3">
        <h2 className="text-sm font-bold text-[#2C1810] flex items-center gap-2">
          <ScrollText className="w-4 h-4 text-[#D97706]" />
          Inspeksi Audit Log Terbaru (Immutable)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD3] text-[#78716C] uppercase font-semibold">
              <tr>
                <th className="px-3 py-2.5">Waktu</th>
                <th className="px-3 py-2.5">Pelaku</th>
                <th className="px-3 py-2.5">Aksi</th>
                <th className="px-3 py-2.5">Tabel</th>
                <th className="px-3 py-2.5">Keterangan Nilai</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3EDE2] text-[#2C1810]">
              {[
                {
                  waktu: '11 Okt 16:45',
                  pelaku: 'Bayu Prasetyo (KT)',
                  aksi: 'void_transaksi',
                  tabel: 'transaksi',
                  detail: 'Void struk TBT-20261011-0003: Salah input item pesanan',
                },
                {
                  waktu: '08 Okt 08:00',
                  pelaku: 'Ratna K. (Owner)',
                  aksi: 'ubah_harga_modal',
                  tabel: 'riwayat_harga_modal',
                  detail: 'Update modal KOP-001 Rp8.500 -> Rp9.000',
                },
              ].map((log, idx) => (
                <tr key={idx} className="hover:bg-[#FAF7F2]/60">
                  <td className="px-3 py-2.5 text-[#78716C] font-mono">{log.waktu}</td>
                  <td className="px-3 py-2.5 font-semibold text-[#4A2E18]">{log.pelaku}</td>
                  <td className="px-3 py-2.5 font-mono text-[11px] font-bold text-[#D97706]">
                    {log.aksi}
                  </td>
                  <td className="px-3 py-2.5 text-[#78716C] font-mono">{log.tabel}</td>
                  <td className="px-3 py-2.5 text-xs text-[#2C1810]">{log.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
