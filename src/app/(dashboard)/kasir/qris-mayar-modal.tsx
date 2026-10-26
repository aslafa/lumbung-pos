'use client';

import React, { useState, useEffect } from 'react';
import { QrCode, Clock, AlertTriangle, CheckCircle, ExternalLink, X, Loader2 } from 'lucide-react';
import {
  cekStatusTransaksiMayarAction,
  batalkanTransaksiMayarAction,
} from '@/app/actions/mayar';
import { formatRupiah } from '@/lib/utils/format';

export interface VerifiedPaymentData {
  jenis_pesanan?: string;
  nomor_meja?: string | null;
  nomor_antrean?: string;
  nama_pelanggan?: string;
}

export interface QrisMayarModalProps {
  transaksiId: string;
  nomorStruk: string;
  nomorAntrean?: string;
  jenisPesanan?: string;
  nomorMeja?: string | null;
  namaPelanggan?: string;
  total: number;
  paymentUrl: string;
  expiredAt: string;
  onSuccess: (verifiedData?: VerifiedPaymentData) => void;
  onCancel: () => void;
  onViewTracking?: (transaksiId: string) => void;
}

export function QrisMayarModal({
  transaksiId,
  nomorStruk,
  nomorAntrean: initialNomorAntrean,
  jenisPesanan: initialJenisPesanan,
  nomorMeja: initialNomorMeja,
  namaPelanggan: initialNamaPelanggan,
  total,
  paymentUrl,
  expiredAt,
  onSuccess,
  onCancel,
  onViewTracking,
}: QrisMayarModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(600); // 10 menit default
  const [status, setStatus] = useState<'menunggu_bayar' | 'lunas' | 'batal' | 'expired'>('menunggu_bayar');
  const [isCancelling, setIsCancelling] = useState<boolean>(false);
  const [isCheckingManual, setIsCheckingManual] = useState<boolean>(false);
  const [verifiedAntrean, setVerifiedAntrean] = useState<string>(initialNomorAntrean || '');
  const [verifiedCustomerName, setVerifiedCustomerName] = useState<string>(initialNamaPelanggan || 'Pelanggan Umum');
  const [verifiedJenisPesanan, setVerifiedJenisPesanan] = useState<string>(
    initialJenisPesanan || (initialNomorMeja ? 'DINE_IN' : 'TAKEAWAY')
  );
  const [verifiedNomorMeja, setVerifiedNomorMeja] = useState<string | null>(initialNomorMeja || null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 1. Countdown Timer
  useEffect(() => {
    const expireTime = new Date(expiredAt).getTime();

    const interval = setInterval(() => {
      const diff = Math.max(0, Math.floor((expireTime - Date.now()) / 1000));
      setSecondsRemaining(diff);

      if (diff <= 0) {
        clearInterval(interval);
        setStatus('expired');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiredAt]);

  // 2. Auto-polling Status Transaksi dari Server setiap 3 detik
  useEffect(() => {
    if (status !== 'menunggu_bayar') return;

    const pollInterval = setInterval(async () => {
      try {
        const res = await cekStatusTransaksiMayarAction(transaksiId);
        if (res.success) {
          if (res.status === 'lunas' || res.status === 'selesai') {
            setStatus('lunas');
            if (res.nomor_antrean) setVerifiedAntrean(res.nomor_antrean);
            const resolvedMeja = res.nomor_meja || initialNomorMeja || null;
            if (resolvedMeja) setVerifiedNomorMeja(resolvedMeja);
            const isDineIn = (res.jenis_pesanan || '').toUpperCase() === 'DINE_IN' || (initialJenisPesanan || '').toUpperCase() === 'DINE_IN' || !!resolvedMeja;
            const resolvedJenis: 'DINE_IN' | 'TAKEAWAY' = isDineIn ? 'DINE_IN' : 'TAKEAWAY';
            setVerifiedJenisPesanan(resolvedJenis);
            const resolvedName = (res.nama_pelanggan && res.nama_pelanggan !== 'Pelanggan Umum')
              ? res.nama_pelanggan
              : (initialNamaPelanggan && initialNamaPelanggan !== 'Pelanggan Umum')
              ? initialNamaPelanggan
              : (res.nama_pelanggan || initialNamaPelanggan || 'Pelanggan Umum');
            setVerifiedCustomerName(resolvedName);
            clearInterval(pollInterval);
          } else if (res.status === 'batal') {
            setStatus('batal');
            clearInterval(pollInterval);
          }
        }
      } catch {
        // Abaikan transient network error saat polling
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [transaksiId, status, initialJenisPesanan, initialNomorMeja, initialNamaPelanggan]);

  // 3. Manual Check Status
  const handleCheckStatus = async () => {
    if (isCheckingManual) return;
    setIsCheckingManual(true);
    setErrorMsg(null);
    try {
      const res = await cekStatusTransaksiMayarAction(transaksiId);
      if (res.success) {
        if (res.status === 'lunas' || res.status === 'selesai') {
          setStatus('lunas');
          if (res.nomor_antrean) setVerifiedAntrean(res.nomor_antrean);
          const resolvedMeja = res.nomor_meja || initialNomorMeja || null;
          if (resolvedMeja) setVerifiedNomorMeja(resolvedMeja);
          const isDineIn = (res.jenis_pesanan || '').toUpperCase() === 'DINE_IN' || (initialJenisPesanan || '').toUpperCase() === 'DINE_IN' || !!resolvedMeja;
          const resolvedJenis: 'DINE_IN' | 'TAKEAWAY' = isDineIn ? 'DINE_IN' : 'TAKEAWAY';
          setVerifiedJenisPesanan(resolvedJenis);
          const resolvedName = (res.nama_pelanggan && res.nama_pelanggan !== 'Pelanggan Umum')
            ? res.nama_pelanggan
            : (initialNamaPelanggan && initialNamaPelanggan !== 'Pelanggan Umum')
            ? initialNamaPelanggan
            : (res.nama_pelanggan || initialNamaPelanggan || 'Pelanggan Umum');
          setVerifiedCustomerName(resolvedName);
        } else if (res.status === 'batal') {
          setStatus('batal');
        } else {
          setErrorMsg('Menunggu Konfirmasi Pembayaran: Transaksi belum terdeteksi dibayar di gateway Mayar. Pastikan pelanggan telah menyelesaikan pembayaran di aplikasi e-wallet.');
        }
      } else {
        setErrorMsg(res.error || 'Gagal memeriksa status pembayaran.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan jaringan.');
    } finally {
      setIsCheckingManual(false);
    }
  };

  // 4. Handler Batalkan Transaksi
  const handleBatal = async () => {
    if (isCancelling) return;
    setIsCancelling(true);
    setErrorMsg(null);

    try {
      const res = await batalkanTransaksiMayarAction(transaksiId, 'Dibatalkan oleh kasir');
      if (res.success) {
        setStatus('batal');
        onCancel();
      } else {
        setErrorMsg(res.error || res.pesan || 'Gagal membatalkan transaksi.');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan sistem.');
    } finally {
      setIsCancelling(false);
    }
  };

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  // Render QR Code via QR Server API (High Resolution)
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(
    paymentUrl
  )}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#1E1916] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-[#E8DFD3] dark:border-[#382F28] animate-in fade-in zoom-in-95 duration-200">
        {/* Header Modal */}
        <div className="p-4 bg-[#FAF7F2] dark:bg-[#28211B] border-b border-[#E8DFD3] dark:border-[#382F28] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#D97706]" />
            <h3 className="text-sm font-bold text-[#2C1810] dark:text-[#FAF7F2]">
              QRIS Dinamis Mayar
            </h3>
          </div>
          <button
            type="button"
            onClick={handleBatal}
            disabled={isCancelling}
            className="p-1 text-[#78716C] dark:text-[#A89F91] hover:text-[#2C1810] dark:hover:text-[#FAF7F2] rounded-lg hover:bg-[#F3EDE2] dark:hover:bg-[#342C25] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col items-center text-center">
          {status === 'lunas' ? (
            <div className="py-6 flex flex-col items-center gap-4 w-full">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 animate-bounce">
                <CheckCircle className="w-10 h-10" />
              </div>
              <div>
                <h4 className="text-xl font-black text-emerald-800 dark:text-emerald-300">
                  Pembayaran Terverifikasi!
                </h4>
                <p className="text-xs text-[#78716C] dark:text-[#A89F91] mt-1">
                  Transaksi telah tervalidasi via gateway Mayar dan pesanan otomatis masuk ke KDS antrean barista.
                </p>
              </div>

              {/* Box Rincian Terverifikasi */}
              <div className="w-full bg-[#FAF7F2] dark:bg-[#28211B] border border-[#E8DFD3] dark:border-[#382F28] rounded-2xl p-4 text-left space-y-2.5">
                <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#382F28] pb-2">
                  <span className="text-xs font-semibold text-[#78716C] dark:text-[#A89F91]">Nomor Antrean</span>
                  <span className="font-ticket font-black text-2xl text-[#C67C4E] tracking-wider">
                    {verifiedAntrean || 'A-001'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#78716C] dark:text-[#A89F91]">Nama Pelanggan</span>
                  <span className="font-bold text-[#2C1810] dark:text-[#FAF7F2]">{verifiedCustomerName}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#78716C] dark:text-[#A89F91]">Tipe Pesanan</span>
                  <span className="font-bold text-[#2C1810] dark:text-[#FAF7F2] flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF0E6] dark:bg-[#382B24] text-[#8C5E3C] dark:text-[#E0A96D] text-[10px] font-bold">
                      {verifiedJenisPesanan === 'DINE_IN' ? 'DINE IN' : 'TAKEAWAY'}
                    </span>
                    {verifiedJenisPesanan === 'DINE_IN' && verifiedNomorMeja && (
                      <span className="text-[#C67C4E] font-extrabold">Meja {verifiedNomorMeja}</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#78716C] dark:text-[#A89F91]">Nomor Struk</span>
                  <span className="font-mono font-bold text-[#2C1810] dark:text-[#FAF7F2]">{nomorStruk}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#E8DFD3] dark:border-[#382F28]">
                  <span className="text-[#78716C] dark:text-[#A89F91] font-semibold">Total Pembayaran</span>
                  <span className="font-black text-[#2C1810] dark:text-[#FAF7F2] tabular-nums text-sm">
                    {formatRupiah(total)}
                  </span>
                </div>
              </div>

              {/* Tombol Aksi Setelah Lunas */}
              <div className="w-full space-y-2 pt-2">
                {onViewTracking && (
                  <button
                    type="button"
                    onClick={() => onViewTracking(transaksiId)}
                    className="w-full py-3 px-4 rounded-xl bg-[#FAF0E6] dark:bg-[#34241B] border border-[#C67C4E]/40 text-[#4A2E18] dark:text-[#FAF7F2] hover:bg-[#F3E5D8] font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ExternalLink className="w-4 h-4 text-[#C67C4E]" />
                    <span>Lihat Tracking Pesanan</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() =>
                    onSuccess({
                      jenis_pesanan: verifiedJenisPesanan,
                      nomor_meja: verifiedNomorMeja,
                      nomor_antrean: verifiedAntrean,
                      nama_pelanggan: verifiedCustomerName,
                    })
                  }
                  className="w-full py-3 px-4 rounded-xl bg-[#4A2E18] dark:bg-[#C67C4E] text-white dark:text-[#12100E] font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer shadow-md"
                >
                  Cetak Struk &amp; Selesai
                </button>
              </div>
            </div>
          ) : status === 'expired' || secondsRemaining <= 0 ? (
            <div className="py-6 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-[#2C1810] dark:text-[#FAF7F2]">
                Waktu Pembayaran Habis
              </h4>
              <p className="text-sm text-[#78716C] dark:text-[#A89F91]">
                Transaksi QRIS telah kedaluwarsa setelah 10 menit. Stok telah otomatis dikembalikan secara aman.
              </p>
              <button
                type="button"
                onClick={handleBatal}
                className="mt-4 px-6 py-2.5 bg-[#4A2E18] dark:bg-[#C67C4E] text-white dark:text-[#12100E] font-bold text-xs rounded-xl hover:opacity-90 transition-opacity cursor-pointer"
              >
                Tutup &amp; Kembali ke Kasir
              </button>
            </div>
          ) : (
            <>
              {/* Info Nomor Struk & Total Tagihan */}
              <div className="mb-4">
                <span className="text-xs font-mono font-bold px-3 py-1 bg-[#FAF7F2] dark:bg-[#28211B] text-[#4A2E18] dark:text-[#F59E0B] border border-[#E8DFD3] dark:border-[#382F28] rounded-full">
                  Struk: {nomorStruk}
                </span>
                <div className="text-3xl font-black text-[#2C1810] dark:text-[#FAF7F2] mt-3 tabular-nums">
                  {formatRupiah(total)}
                </div>
                <p className="text-xs text-[#78716C] dark:text-[#A89F91] mt-1 max-w-xs">
                  Minta pelanggan memindai kode QRIS di bawah menggunakan mobile banking atau e-wallet.
                </p>
              </div>

              {/* QR Code Container (Always White for Scanner Contrast) */}
              <div className="p-4 bg-white rounded-3xl shadow-md border-2 border-dashed border-[#D97706]/40 my-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrImageUrl}
                  alt="QRIS Mayar"
                  width={210}
                  height={210}
                  className="rounded-xl"
                />
              </div>

              {/* Timer Countdown */}
              <div className="mt-3 flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-1.5 rounded-full border border-amber-200 dark:border-amber-900/60">
                <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>
                  Sisa waktu:{' '}
                  {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </span>
              </div>

              {/* Link Pembayaran Alternatif */}
              <a
                href={paymentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#4A2E18] dark:text-[#F59E0B] hover:underline font-bold"
              >
                <span>Buka halaman tagihan Mayar</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              {errorMsg && (
                <div className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900">
                  {errorMsg}
                </div>
              )}

              {/* Tombol Aksi Kasir: Periksa Status Manual & Batalkan */}
              <div className="w-full mt-6 space-y-2">
                <button
                  type="button"
                  onClick={handleCheckStatus}
                  disabled={isCheckingManual || isCancelling}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#FAF0E6] dark:bg-[#2C221E] border border-[#C67C4E]/40 text-[#4A2E18] dark:text-[#FAF7F2] hover:bg-[#F3E5D8] dark:hover:bg-[#382C26] text-xs font-bold transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isCheckingManual ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#C67C4E]" />
                      <span>Memeriksa ke Gateway Mayar...</span>
                    </>
                  ) : (
                    <span>Periksa Status Pembayaran Sekarang</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBatal}
                  disabled={isCancelling || isCheckingManual}
                  className="w-full py-2.5 px-4 rounded-xl border border-red-300 dark:border-red-900 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isCancelling ? 'Membatalkan Transaksi...' : 'Batalkan Transaksi'}
                </button>
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 text-xs text-[#A8A29E] dark:text-[#78716C]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#D97706]" />
                <span>Menunggu konfirmasi pembayaran webhook...</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
