'use client';

import React, { useState } from 'react';
import {
  Banknote,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { bukaShiftAction, tutupShiftAction } from '@/app/actions/shift';
import { formatRupiah, formatTanggalWaktu } from '@/lib/utils/format';

export interface ShiftDetailData {
  id: string;
  cabang_id: string;
  kasir_id: string;
  status: 'buka' | 'ditutup' | 'diverifikasi';
  kas_awal: number;
  total_tunai: number;
  total_qris: number;
  kas_seharusnya: number;
  uang_fisik: number | null;
  selisih: number | null;
  catatan_tutup: string | null;
  dibuka_pada: string;
  ditutup_pada: string | null;
}

interface ShiftSayaClientProps {
  kasirNama: string;
  cabangNama: string;
  initialShift: ShiftDetailData | null;
}

export function ShiftSayaClient({
  kasirNama,
  cabangNama,
  initialShift,
}: ShiftSayaClientProps) {
  // State Pembukaan Shift
  const [kasAwalInput, setKasAwalInput] = useState<string>('200000');
  const [isBukaLoading, setIsBukaLoading] = useState(false);

  // State Penutupan Shift
  const [uangFisikInput, setUangFisikInput] = useState<string>('');
  const [catatanTutup, setCatatanTutup] = useState<string>('');
  const [isTutupLoading, setIsTutupLoading] = useState(false);

  // State Feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Perhitungan Selisih Kas saat Penutupan
  const kasSeharusnya = initialShift ? initialShift.kas_seharusnya : 0;
  const nominalUangFisik = parseInt(uangFisikInput || '0', 10);
  const selisihKas = uangFisikInput ? nominalUangFisik - kasSeharusnya : 0;
  const isSelisihMelebihiBatas = Math.abs(selisihKas) > 20000;

  // Handler Buka Shift
  const handleBukaShift = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const nominal = parseInt(kasAwalInput || '0', 10);
    if (isNaN(nominal) || nominal < 0 || nominal > 2000000) {
      setErrorMessage('Kas awal harus antara Rp0 dan Rp2.000.000.');
      return;
    }

    setIsBukaLoading(true);
    const result = await bukaShiftAction(nominal);
    setIsBukaLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Gagal membuka shift.');
    } else {
      setSuccessMessage('Shift kerja berhasil dibuka! Anda dapat memproses transaksi kasir.');
    }
  };

  // Handler Tutup Shift
  const handleTutupShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialShift) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    if (!uangFisikInput) {
      setErrorMessage('Masukkan nominal uang fisik yang dihitung di laci.');
      return;
    }

    if (nominalUangFisik < 0) {
      setErrorMessage('Uang fisik di laci tidak boleh bernilai negatif.');
      return;
    }

    if (isSelisihMelebihiBatas && (!catatanTutup || catatanTutup.trim().length < 5)) {
      setErrorMessage(
        `Selisih kas sebesar Rp${Math.abs(selisihKas).toLocaleString(
          'id-ID'
        )} melebihi ambang toleransi Rp20.000. Wajib mengisi catatan penjelasan minimal 5 karakter.`
      );
      return;
    }

    setIsTutupLoading(true);
    const result = await tutupShiftAction(
      initialShift.id,
      nominalUangFisik,
      catatanTutup
    );
    setIsTutupLoading(false);

    if (!result.success) {
      setErrorMessage(result.error || 'Gagal menutup shift.');
    } else {
      setSuccessMessage('Shift berhasil ditutup dan angka rekonsiliasi telah dikunci.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-[#E8DFD3] dark:border-[#382F28] pb-4">
        <h1 className="text-xl sm:text-2xl font-black text-[#2C1810] dark:text-[#FAF7F2] tracking-tight">
          Shift Saya
        </h1>
        <p className="text-xs text-[#78716C] dark:text-[#A89F91] mt-0.5">
          Kelola sesi kerja kasir harian, kas awal laci, dan rekonsiliasi uang fisik.
        </p>
      </div>

      {/* Alert Error / Success */}
      {errorMessage && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl p-4 flex items-start gap-3 text-xs text-red-700 dark:text-red-300 shadow-xs">
          <AlertCircle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
          <span>{errorMessage}</span>
        </div>
      )}
      {successMessage && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-800 dark:text-emerald-300 shadow-xs">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Kondisi 1: Shift Belum Dibuka */}
      {!initialShift ? (
        <div className="bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-3xl p-6 sm:p-8 shadow-sm max-w-xl mx-auto space-y-6 transition-all">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-2xl border border-amber-200 dark:border-amber-800/60 flex items-center justify-center mx-auto shadow-inner">
              <Clock className="w-7 h-7" />
            </div>
            <h2 className="text-lg font-black text-[#2C1810] dark:text-[#FAF7F2]">
              Buka Shift Kerja Baru
            </h2>
            <p className="text-xs text-[#78716C] dark:text-[#A89F91]">
              Cabang: <strong className="text-[#4A2E18] dark:text-[#FAF7F2]">{cabangNama}</strong> &bull; Kasir: <strong className="text-[#4A2E18] dark:text-[#FAF7F2]">{kasirNama}</strong>
            </p>
            <p className="text-xs text-[#78716C] dark:text-[#A89F91]">
              Masukkan nominal uang kembalian awal di laci kasir (maksimal Rp2.000.000).
            </p>
          </div>

          <form onSubmit={handleBukaShift} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#4A2E18] dark:text-[#FAF7F2] mb-1.5">
                Kas Awal Laci (Rp)
              </label>
              <div className="relative">
                <DollarSign className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#78716C]" />
                <input
                  type="number"
                  min="0"
                  max="2000000"
                  step="1000"
                  value={kasAwalInput}
                  onChange={(e) => setKasAwalInput(e.target.value)}
                  placeholder="Contoh: 200000"
                  required
                  className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] dark:bg-[#14110F] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#C67C4E]"
                />
              </div>
              <div className="flex gap-2 mt-2.5 overflow-x-auto pb-1">
                {[100000, 200000, 300000, 500000].map((nominal) => (
                  <button
                    key={nominal}
                    type="button"
                    onClick={() => setKasAwalInput(nominal.toString())}
                    className="px-3 py-1.5 text-xs bg-[#FAF7F2] dark:bg-[#28211B] hover:bg-[#F3EDE2] dark:hover:bg-[#342C25] text-[#4A2E18] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-lg font-bold shrink-0 cursor-pointer"
                  >
                    Rp{nominal.toLocaleString('id-ID')}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={isBukaLoading}
              className="w-full py-3.5 bg-[#4A2E18] hover:bg-[#382312] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white dark:text-[#12100E] text-xs font-bold rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              {isBukaLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />
                  <span>Membuka Shift...</span>
                </>
              ) : (
                <>
                  <span>Buka Shift Sekarang</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      ) : (
        /* Kondisi 2: Shift Sedang Terbuka */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Status Shift Aktif */}
          <div className="bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-3xl p-6 shadow-xs space-y-4 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#78716C] dark:text-[#A89F91] uppercase tracking-wider">
                Status Sesi Kasir
              </span>
              <span className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-full text-xs font-black flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Shift Buka
              </span>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex justify-between text-xs">
                <span className="text-[#78716C] dark:text-[#A89F91]">Kasir Bertugas:</span>
                <span className="font-bold text-[#2C1810] dark:text-[#FAF7F2]">{kasirNama}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#78716C] dark:text-[#A89F91]">Cabang:</span>
                <span className="font-bold text-[#2C1810] dark:text-[#FAF7F2]">{cabangNama}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#78716C] dark:text-[#A89F91]">Waktu Dibuka:</span>
                <span className="font-mono text-[#2C1810] dark:text-[#FAF7F2] tabular-nums">
                  {formatTanggalWaktu(initialShift.dibuka_pada, { withSeconds: true })}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#78716C] dark:text-[#A89F91]">Kas Awal Laci:</span>
                <span className="font-bold text-[#4A2E18] dark:text-[#F59E0B] tabular-nums">
                  {formatRupiah(initialShift.kas_awal)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#78716C] dark:text-[#A89F91]">Total Tunai Lunas:</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                  {formatRupiah(initialShift.total_tunai)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#78716C] dark:text-[#A89F91]">Total QRIS Lunas:</span>
                <span className="font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                  {formatRupiah(initialShift.total_qris)}
                </span>
              </div>
              <div className="flex justify-between text-sm font-black text-[#4A2E18] dark:text-[#F59E0B] pt-3 border-t border-[#F3EDE2] dark:border-[#382F28]">
                <span>Kas Seharusnya di Laci:</span>
                <span className="tabular-nums">{formatRupiah(kasSeharusnya)}</span>
              </div>
            </div>

            <div className="pt-2">
              <a
                href="/kasir"
                className="w-full py-3 bg-[#FAF7F2] dark:bg-[#28211B] hover:bg-[#F3EDE2] dark:hover:bg-[#342C25] text-[#4A2E18] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <span>Buka Layar Kasir POS</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Card Formulir Tutup Shift */}
          <div className="bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-3xl p-6 shadow-xs space-y-4 transition-colors">
            <h2 className="text-sm font-bold text-[#2C1810] dark:text-[#FAF7F2] flex items-center gap-2">
              <Banknote className="w-4 h-4 text-[#D97706]" />
              <span>Formulir Rekonsiliasi Tutup Shift</span>
            </h2>
            <p className="text-xs text-[#78716C] dark:text-[#A89F91]">
              Hitung uang fisik di laci kasir dan masukkan nominal sebenarnya sebelum mengunci sesi kerja.
            </p>

            <form onSubmit={handleTutupShift} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#4A2E18] dark:text-[#FAF7F2] mb-1">
                  Hitungan Uang Fisik di Laci (Rp)
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={uangFisikInput}
                  onChange={(e) => setUangFisikInput(e.target.value)}
                  placeholder={`Contoh: ${kasSeharusnya}`}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF7F2] dark:bg-[#14110F] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#C67C4E]"
                />
              </div>

              {/* Tampilan Selisih Kas Real-time */}
              {uangFisikInput && (
                <div
                  className={`p-3 rounded-xl border text-xs space-y-1 ${
                    selisihKas === 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : isSelisihMelebihiBatas
                      ? 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-800 dark:text-red-300'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <div className="flex justify-between font-bold">
                    <span>Selisih Kas:</span>
                    <span className="tabular-nums">
                      {selisihKas === 0
                        ? 'Pas (Rp0)'
                        : selisihKas > 0
                        ? `Lebih +${formatRupiah(selisihKas)}`
                        : `Kurang -${formatRupiah(Math.abs(selisihKas))}`}
                    </span>
                  </div>
                  {isSelisihMelebihiBatas && (
                    <p className="text-[11px] text-red-700 dark:text-red-300">
                      Perhatian: Selisih melebihi batas toleransi Rp20.000. Wajib menyertakan catatan penjelasan!
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#4A2E18] dark:text-[#FAF7F2] mb-1">
                  Catatan Penjelasan {isSelisihMelebihiBatas ? '(Wajib - min 5 kar)' : '(Opsional)'}
                </label>
                <textarea
                  rows={2}
                  value={catatanTutup}
                  onChange={(e) => setCatatanTutup(e.target.value)}
                  placeholder="Jelaskan alasan jika ada kelebihan atau kekurangan uang kas..."
                  required={isSelisihMelebihiBatas}
                  className="w-full px-3.5 py-2 bg-[#FAF7F2] dark:bg-[#14110F] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C67C4E]"
                />
              </div>

              <button
                type="submit"
                disabled={isTutupLoading}
                className="w-full py-3 bg-[#4A2E18] hover:bg-[#382312] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white dark:text-[#12100E] text-xs font-bold rounded-xl shadow-md cursor-pointer transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isTutupLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />
                    <span>Mengunci Shift...</span>
                  </>
                ) : (
                  <span>Tutup Shift &amp; Kunci Angka</span>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
