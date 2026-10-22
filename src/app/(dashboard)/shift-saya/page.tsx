import { getUserProfile } from '@/lib/auth/get-user-profile';
import { redirect } from 'next/navigation';
import { Banknote } from 'lucide-react';

export default async function ShiftSayaPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir & Owner
  if (profile.peran === 'kepala_toko') {
    redirect('/transaksi');
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-[#E8DFD3] pb-4">
        <h1 className="text-xl font-bold text-[#2C1810]">Shift Saya</h1>
        <p className="text-xs text-[#78716C] mt-0.5">
          Kelola sesi kerja harian, kas awal laci, dan rekonsiliasi uang fisik (BR-02 & BR-09)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card Status Shift Aktif */}
        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider">
              Status Sesi Kasir
            </span>
            <span className="px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Shift Buka
            </span>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex justify-between text-xs">
              <span className="text-[#78716C]">Kasir Bertugas:</span>
              <span className="font-semibold text-[#2C1810]">{profile.nama_lengkap}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#78716C]">Waktu Dibuka:</span>
              <span className="font-mono text-[#2C1810]">Hari Ini, 07:00 WIB</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#78716C]">Kas Awal Laci:</span>
              <span className="font-semibold text-[#4A2E18]">Rp200.000</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#78716C]">Total Tunai Lunas:</span>
              <span className="font-semibold text-emerald-700">Rp850.000</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[#78716C]">Total QRIS Lunas:</span>
              <span className="font-semibold text-blue-700">Rp420.000</span>
            </div>
            <div className="flex justify-between text-sm font-extrabold text-[#4A2E18] pt-3 border-t border-[#F3EDE2]">
              <span>Kas Seharusnya di Laci:</span>
              <span>Rp1.050.000</span>
            </div>
          </div>
        </div>

        {/* Card Formulir Tutup Shift */}
        <div className="bg-white border border-[#E8DFD3] rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold text-[#2C1810] flex items-center gap-2">
            <Banknote className="w-4 h-4 text-[#D97706]" />
            Formulir Tutup Shift
          </h2>
          <p className="text-xs text-[#78716C]">
            Hitung uang fisik di laci kasir dan masukkan nominal sebenarnya sebelum menutup shift.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#4A2E18] mb-1">
                Hitungan Uang Fisik di Laci (Rp)
              </label>
              <input
                type="number"
                placeholder="Contoh: 1050000"
                disabled
                className="w-full px-3.5 py-2.5 bg-[#FAF7F2] border border-[#E8DFD3] rounded-xl text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A2E18] mb-1">
                Catatan Penjelasan (Wajib bila selisih &gt; Rp20.000 - BR-09)
              </label>
              <textarea
                rows={2}
                placeholder="Jelaskan alasan jika ada kelebihan atau kekurangan kas..."
                disabled
                className="w-full px-3.5 py-2 bg-[#FAF7F2] border border-[#E8DFD3] rounded-xl text-xs focus:outline-none"
              />
            </div>

            <button
              disabled
              className="w-full py-2.5 bg-[#4A2E18] text-white text-xs font-bold rounded-xl shadow-xs opacity-50 cursor-not-allowed"
            >
              Tutup Shift &amp; Kunci Angka
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
