import { getUserProfile } from '@/lib/auth/get-user-profile';
import { redirect } from 'next/navigation';


export default async function ShiftCabangPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect('/login');
  }

  // Kasir dilarang
  if (profile.peran === 'kasir') {
    redirect('/kasir');
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-[#E8DFD3] pb-4">
        <h1 className="text-xl font-bold text-[#2C1810]">Pengawasan Shift Cabang</h1>
        <p className="text-xs text-[#78716C] mt-0.5">
          Periksa rekonsiliasi kas kasir dan lakukan verifikasi shift (BR-09 & BR-10)
        </p>
      </div>

      <div className="bg-white border border-[#E8DFD3] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF7F2] border-b border-[#E8DFD3] text-[#78716C] uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">Kasir</th>
                <th className="px-4 py-3">Waktu Buka / Tutup</th>
                <th className="px-4 py-3">Kas Awal</th>
                <th className="px-4 py-3">Kas Seharusnya</th>
                <th className="px-4 py-3">Uang Fisik</th>
                <th className="px-4 py-3">Selisih Kas</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F3EDE2] text-[#2C1810]">
              {[
                {
                  kasir: 'Dimas Arya',
                  waktu: '15 Okt 07:00 - sekarang',
                  awal: 200000,
                  seharusnya: 1050000,
                  fisik: null,
                  selisih: null,
                  status: 'buka',
                },
                {
                  kasir: 'Putri Maharani',
                  waktu: '14 Okt 07:00 - 15:30',
                  awal: 150000,
                  seharusnya: 940000,
                  fisik: 940000,
                  selisih: 0,
                  status: 'ditutup',
                },
                {
                  kasir: 'Dimas Arya',
                  waktu: '11 Okt 07:00 - 15:30',
                  awal: 200000,
                  seharusnya: 1120000,
                  fisik: 1085000,
                  selisih: -35000,
                  status: 'diverifikasi',
                },
              ].map((shift, idx) => (
                <tr key={idx} className="hover:bg-[#FAF7F2]/60 transition-colors">
                  <td className="px-4 py-3 font-bold text-[#4A2E18]">{shift.kasir}</td>
                  <td className="px-4 py-3 text-[#78716C]">{shift.waktu}</td>
                  <td className="px-4 py-3">Rp{shift.awal.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3 font-semibold">
                    Rp{shift.seharusnya.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3">
                    {shift.fisik !== null
                      ? `Rp${shift.fisik.toLocaleString('id-ID')}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {shift.selisih !== null ? (
                      <span
                        className={`font-semibold ${
                          Math.abs(shift.selisih) > 20000
                            ? 'text-red-600 font-bold'
                            : 'text-stone-700'
                        }`}
                      >
                        {shift.selisih === 0
                          ? 'Rp0 (Cocok)'
                          : `Rp${shift.selisih.toLocaleString('id-ID')}`}
                      </span>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        shift.status === 'buka'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : shift.status === 'ditutup'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}
                    >
                      {shift.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {shift.status === 'ditutup' ? (
                      <button
                        disabled
                        className="px-2.5 py-1 bg-[#4A2E18] text-white text-[11px] font-semibold rounded-lg shadow-xs opacity-70 cursor-not-allowed"
                      >
                        Verifikasi
                      </button>
                    ) : (
                      <span className="text-[11px] text-[#A8A29E] italic">Terkunci</span>
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
