'use client';

import { useState, useTransition } from 'react';
import {
  Clock,
  Search,
  ShieldCheck,
  CheckCircle2,
  Store,
  X,
  Loader2,
  Layers
} from 'lucide-react';
import { verifikasiShiftAction, VerifikasiShiftResult } from '@/app/actions/supervisi';
import { formatRupiah } from '@/lib/utils/format';
import { TableTimeCell } from '@/components/ui/TableTimeCell';

export interface ShiftCabangItem {
  id: string;
  kasir_nama: string;
  cabang_id?: string;
  cabang_nama: string;
  waktu: string;
  awal: number;
  seharusnya: number;
  fisik: number | null;
  selisih: number | null;
  status: 'buka' | 'ditutup' | 'diverifikasi';
}

interface CabangOption {
  id: string;
  nama: string;
  kode: string;
}

interface ShiftCabangClientProps {
  initialShifts: ShiftCabangItem[];
  cabangList: CabangOption[];
  userRole: string;
  userCabangNama?: string;
}

export function ShiftCabangClient({
  initialShifts,
  cabangList,
  userRole,
  userCabangNama,
}: ShiftCabangClientProps) {
  const [shifts, setShifts] = useState<ShiftCabangItem[]>(initialShifts);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [cabangFilter, setCabangFilter] = useState<string>('all');

  // Modal Verifikasi State
  const [selectedShift, setSelectedShift] = useState<ShiftCabangItem | null>(null);
  const [catatan, setCatatan] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalSuccess, setModalSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isOwner = userRole === 'owner';

  // Stats
  const totalShifts = shifts.length;
  const bukaCount = shifts.filter((s) => s.status === 'buka').length;
  const ditutupCount = shifts.filter((s) => s.status === 'ditutup').length;
  const diverifikasiCount = shifts.filter((s) => s.status === 'diverifikasi').length;

  const filteredShifts = shifts.filter((s) => {
    const matchSearch =
      s.kasir_nama.toLowerCase().includes(search.toLowerCase()) ||
      s.cabang_nama.toLowerCase().includes(search.toLowerCase());

    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    const matchCabang = cabangFilter === 'all' || s.cabang_id === cabangFilter;

    return matchSearch && matchStatus && matchCabang;
  });

  const openVerifikasiModal = (shift: ShiftCabangItem) => {
    setSelectedShift(shift);
    setCatatan('');
    setModalError(null);
    setModalSuccess(null);
  };

  const handleConfirmVerifikasi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift) return;

    setModalError(null);
    setModalSuccess(null);

    startTransition(async () => {
      const res: VerifikasiShiftResult = await verifikasiShiftAction(selectedShift.id, catatan);

      if (!res.success) {
        setModalError(res.error || 'Gagal memverifikasi shift.');
      } else {
        setModalSuccess(res.pesan || 'Shift berhasil diverifikasi.');
        setShifts((prev) =>
          prev.map((s) => (s.id === selectedShift.id ? { ...s, status: 'diverifikasi' } : s))
        );
        setTimeout(() => {
          setSelectedShift(null);
          setModalSuccess(null);
        }, 1200);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E8DFD3] dark:border-[#2C2420] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#C67C4E]" />
            <span>Pengawasan Shift Cabang</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E] mt-1">
            {isOwner
              ? 'Rekonsiliasi kas kasir dan verifikasi supervisor antar-cabang.'
              : `Pengawasan sesi kerja kasir cabang ${userCabangNama || ''}.`}
          </p>
        </div>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Total Sesi Shift</span>
            <Layers className="w-4 h-4 text-[#C67C4E]" />
          </div>
          <div className="text-2xl font-bold font-mono text-[#2C1810] dark:text-[#F5EBE1]">
            {totalShifts}
          </div>
          <div className="text-[11px] text-[#A8A29E] mt-1">Semua sesi shift tercatat</div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Shift Sedang Buka</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {bukaCount}
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Kasir sedang beroperasi</div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Menunggu Verifikasi</span>
            <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-blue-600 dark:text-blue-400">
            {ditutupCount}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 mt-1">Perlu dicek supervisor</div>
        </div>

        <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E] mb-2">
            <span className="text-xs font-medium">Sudah Diverifikasi</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {diverifikasiCount}
          </div>
          <div className="text-[11px] text-[#A8A29E] mt-1">Selesai rekonsiliasi</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
            <input
              type="text"
              placeholder="Cari nama kasir atau cabang..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] placeholder-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
            />
          </div>

          {isOwner && cabangList.length > 0 && (
            <div className="w-full md:w-56">
              <select
                value={cabangFilter}
                onChange={(e) => setCabangFilter(e.target.value)}
                className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
              >
                <option value="all">Semua Cabang</option>
                {cabangList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nama} ({c.kode})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full md:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
            >
              <option value="all">Semua Status</option>
              <option value="buka">Buka (Aktif)</option>
              <option value="ditutup">Ditutup (Menunggu)</option>
              <option value="diverifikasi">Diverifikasi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl shadow-xs overflow-hidden">
        {filteredShifts.length === 0 ? (
          <div className="py-16 text-center text-[#78716C] dark:text-[#A8A29E] space-y-3">
            <Clock className="w-10 h-10 mx-auto text-[#A8A29E] dark:text-[#78716C]" />
            <p className="text-sm font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
              Tidak ada data shift yang ditemukan
            </p>
            <p className="text-xs">Ubah kata kunci pencarian atau filter yang dipilih.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-[#FAF7F2] dark:bg-[#14110F] border-b border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A89F91] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Kasir</th>
                  {isOwner && <th className="px-4 py-3.5">Cabang</th>}
                  <th className="px-4 py-3.5 whitespace-nowrap">Waktu Operasional</th>
                  <th className="px-4 py-3.5 text-right">Kas Awal</th>
                  <th className="px-4 py-3.5 text-right">Kas Sistem</th>
                  <th className="px-4 py-3.5 text-right">Uang Fisik</th>
                  <th className="px-4 py-3.5 text-right">Selisih</th>
                  <th className="px-4 py-3.5 text-center">Status</th>
                  <th className="px-4 py-3.5 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EDE2] dark:divide-[#2C2420] text-[#2C1810] dark:text-[#F5EBE1]">
                {filteredShifts.map((shift) => (
                  <tr
                    key={shift.id}
                    className="hover:bg-[#FAF7F2]/70 dark:hover:bg-[#14110F]/50 transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] flex items-center justify-center font-bold text-xs text-[#4A2E18] dark:text-[#C67C4E]">
                          {shift.kasir_nama.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                          {shift.kasir_nama}
                        </span>
                      </div>
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3.5 text-[#78716C] dark:text-[#A8A29E]">
                        <span className="inline-flex items-center gap-1">
                          <Store className="w-3.5 h-3.5 text-[#C67C4E]" />
                          <span>{shift.cabang_nama}</span>
                        </span>
                      </td>
                    )}
                    <TableTimeCell>{shift.waktu}</TableTimeCell>
                    <td className="px-4 py-3.5 text-right font-mono text-xs text-[#78716C] dark:text-[#A8A29E] tabular-nums">
                      {formatRupiah(shift.awal)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-xs text-[#4A2E18] dark:text-[#C67C4E] tabular-nums">
                      {formatRupiah(shift.seharusnya)}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      {shift.fisik !== null ? formatRupiah(shift.fisik) : '-'}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-xs tabular-nums">
                      {shift.selisih !== null ? (
                        <span
                          className={`font-semibold ${
                            shift.selisih === 0
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {shift.selisih === 0
                            ? 'Pas (Rp0)'
                            : formatRupiah(shift.selisih, { showSign: true })}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                          shift.status === 'buka'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-900'
                            : shift.status === 'ditutup'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-900'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900'
                        }`}
                      >
                        {shift.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-center">
                      {shift.status === 'ditutup' ? (
                        <button
                          onClick={() => openVerifikasiModal(shift)}
                          className="px-3 py-1 bg-[#4A2E18] hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
                        >
                          Verifikasi
                        </button>
                      ) : shift.status === 'diverifikasi' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Valid</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#A8A29E]">Sedang Aktif</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Verifikasi Shift */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Verifikasi Shift Kasir
                </h3>
              </div>
              <button
                onClick={() => setSelectedShift(null)}
                className="p-1 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-3 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            {modalSuccess && (
              <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-3 rounded-xl text-xs">
                {modalSuccess}
              </div>
            )}

            {/* Shift Summary Card */}
            <div className="bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[#78716C] dark:text-[#A8A29E]">Kasir / Cabang:</span>
                <span className="font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                  {selectedShift.kasir_nama} ({selectedShift.cabang_nama})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716C] dark:text-[#A89F91]">Waktu Operasional:</span>
                <span className="font-medium text-[#2C1810] dark:text-[#FAF7F2]">
                  {selectedShift.waktu}
                </span>
              </div>
              <div className="border-t border-[#E8DFD3] dark:border-[#2C2420] pt-2 flex justify-between">
                <span className="text-[#78716C] dark:text-[#A8A29E]">Kas Seharusnya:</span>
                <span className="font-mono font-bold text-[#4A2E18] dark:text-[#C67C4E] tabular-nums">
                  {formatRupiah(selectedShift.seharusnya)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78716C] dark:text-[#A8A29E]">Uang Fisik Dihitung:</span>
                <span className="font-mono font-bold text-[#2C1810] dark:text-[#F5EBE1] tabular-nums">
                  {selectedShift.fisik !== null
                    ? formatRupiah(selectedShift.fisik)
                    : '-'}
                </span>
              </div>
              <div className="flex justify-between font-bold">
                <span className="text-[#78716C] dark:text-[#A8A29E]">Selisih Kas:</span>
                <span
                  className={
                    selectedShift.selisih === 0
                      ? 'text-emerald-700 dark:text-emerald-400 font-mono tabular-nums'
                      : 'text-rose-600 dark:text-rose-400 font-mono tabular-nums'
                  }
                >
                  {selectedShift.selisih === 0
                    ? 'Pas (Rp0)'
                    : formatRupiah(selectedShift.selisih, { showSign: true })}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmVerifikasi} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Catatan Supervisor (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={catatan}
                  onChange={(e) => setCatatan(e.target.value)}
                  placeholder="Catatan hasil perhitungan uang brankas / serah terima..."
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedShift(null)}
                  disabled={isPending}
                  className="px-4 py-2 border border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <span>Konfirmasi Verifikasi</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
