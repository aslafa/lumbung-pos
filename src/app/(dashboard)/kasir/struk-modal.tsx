'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Printer, CheckCircle, X, ListOrdered } from 'lucide-react';
import { StrukItem } from '@/app/actions/transaksi';
import { formatRupiah } from '@/lib/utils/format';

export interface StrukProps {
  nomorStruk: string;
  nomorAntrean?: string;
  jenisPesanan?: string;
  nomorMeja?: string | null;
  namaPelanggan?: string | null;
  catatanPesanan?: string | null;
  cabangNama: string;
  cabangAlamat?: string;
  waktuWib: string;
  kasirNama: string;
  items: StrukItem[];
  subtotal: number;
  diskon: number;
  alasanDiskon?: string;
  total: number;
  metodeBayar: string;
  uangDiterima: number;
  kembalian: number;
  onClose: () => void;
}

export function StrukModal({
  nomorStruk,
  nomorAntrean,
  jenisPesanan = 'DINE_IN',
  nomorMeja,
  namaPelanggan,
  catatanPesanan,
  cabangNama,
  cabangAlamat,
  waktuWib,
  kasirNama,
  items,
  subtotal,
  diskon,
  alasanDiskon,
  total,
  metodeBayar,
  uangDiterima,
  kembalian,
  onClose,
}: StrukProps) {
  const router = useRouter();
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      {/* Container Struk Modal */}
      <div className="bg-white dark:bg-[#1E1916] rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden border border-[#E8DFD3] dark:border-[#382F28] animate-in fade-in zoom-in-95 duration-200">
        {/* Header Dialog */}
        <div className="p-4 bg-[#FAF7F2] dark:bg-[#28211B] border-b border-[#E8DFD3] dark:border-[#382F28] flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h3 className="text-sm font-bold text-[#2C1810] dark:text-[#FAF7F2]">
                Pembayaran Berhasil!
              </h3>
              <p className="text-[10px] text-[#78716C] dark:text-[#A89F91]">
                Pesanan telah tercatat dan diteruskan ke KDS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-[#78716C] hover:text-[#2C1810] dark:text-[#A89F91] dark:hover:text-[#FAF7F2] rounded-lg hover:bg-[#F3EDE2] dark:hover:bg-[#342C25] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thermal Receipt Simulator (Format 58mm POS Printer - Always Paper White) */}
        <div className="p-5 bg-[#F5EFE6] dark:bg-[#14110F] print:p-0 flex justify-center" id="print-area">
          <div
            style={{ width: '100%', maxWidth: '280px', fontFamily: 'monospace' }}
            className="bg-white text-black p-4 rounded-xl shadow-md border border-neutral-200 print:border-none print:shadow-none text-xs leading-relaxed space-y-2 select-text"
          >
            {/* Header Struk */}
            <div className="text-center pb-2 border-b border-dashed border-neutral-400">
              <h2 className="font-black text-sm tracking-wider uppercase">LUMBUNG KOPI & ROTI</h2>
              <p className="text-[11px] font-bold">{cabangNama}</p>
              {cabangAlamat && (
                <p className="text-[10px] text-neutral-600">{cabangAlamat}</p>
              )}
            </div>

            {/* Nomor Antrean & Tipe Pesanan (Format Gacoan/Modern POS) */}
            {nomorAntrean && (
              <div className="text-center py-2 border-b-2 border-black space-y-0.5 bg-neutral-100 rounded-md">
                <p className="text-[10px] uppercase font-bold tracking-widest text-neutral-600">NOMOR ANTREAN</p>
                <p className="text-2xl font-black tracking-wider text-black">{nomorAntrean}</p>
                <div className="inline-block px-2 py-0.5 bg-black text-white text-[10px] font-bold rounded uppercase">
                  {(jenisPesanan || '').toUpperCase() === 'DINE_IN' || !!nomorMeja
                    ? `DINE IN — ${nomorMeja ? `MEJA ${nomorMeja}` : 'MEJA'}`
                    : 'TAKEAWAY / BUNGKUS'}
                </div>
                <p className="text-[10px] font-semibold text-neutral-800 pt-0.5">
                  Pelanggan: {namaPelanggan && namaPelanggan !== 'Pelanggan Umum'
                    ? namaPelanggan
                    : ((jenisPesanan || '').toUpperCase() === 'DINE_IN' || !!nomorMeja) && nomorMeja
                    ? `Tamu Meja ${nomorMeja}`
                    : (namaPelanggan || 'Pelanggan Umum')}
                </p>
              </div>
            )}

            {/* Metadata Transaksi */}
            <div className="text-[11px] py-1 border-b border-dashed border-neutral-400 space-y-0.5">
              <div className="flex justify-between">
                <span>No. Struk:</span>
                <span className="font-bold">{nomorStruk}</span>
              </div>
              <div className="flex justify-between">
                <span>Waktu:</span>
                <span>{waktuWib}</span>
              </div>
              <div className="flex justify-between">
                <span>Kasir:</span>
                <span>{kasirNama}</span>
              </div>
            </div>

            {/* Item List */}
            <div className="py-2 border-b border-dashed border-neutral-400 space-y-1.5">
              {items.map((item, idx) => (
                <div key={idx} className="text-[11px]">
                  <div className="font-bold">{item.nama}</div>
                  <div className="flex justify-between pl-2 text-neutral-700">
                    <span className="tabular-nums">
                      {item.jumlah} &times; {formatRupiah(item.harga)}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {formatRupiah(item.subtotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Catatan Khusus Pesanan */}
            {catatanPesanan && (
              <div className="py-1 border-b border-dashed border-neutral-400 text-[10px] text-neutral-800">
                <span className="font-bold">Catatan:</span> {catatanPesanan}
              </div>
            )}

            {/* Kalkulasi Total */}
            <div className="py-1 text-[11px] space-y-1 border-b border-dashed border-neutral-400">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="tabular-nums">{formatRupiah(subtotal)}</span>
              </div>
              {diskon > 0 && (
                <div className="flex justify-between text-neutral-700">
                  <span>Diskon {alasanDiskon ? `(${alasanDiskon})` : ''}:</span>
                  <span className="tabular-nums">-{formatRupiah(diskon)}</span>
                </div>
              )}
              <div className="flex justify-between font-black text-xs pt-1 border-t border-dotted border-neutral-300">
                <span>TOTAL:</span>
                <span className="tabular-nums">{formatRupiah(total)}</span>
              </div>
              <div className="flex justify-between pt-0.5">
                <span>Metode Bayar:</span>
                <span className="uppercase font-bold">{metodeBayar}</span>
              </div>
              <div className="flex justify-between">
                <span>Bayar:</span>
                <span className="tabular-nums">{formatRupiah(uangDiterima)}</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Kembalian:</span>
                <span className="tabular-nums">{formatRupiah(kembalian)}</span>
              </div>
            </div>

            {/* Footer Struk */}
            <div className="text-center pt-2 text-[10px] text-neutral-600 space-y-0.5">
              <p>Terima kasih atas kunjungan Anda!</p>
              <p>Nikmati hangatnya Lumbung Kopi &amp; Roti</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-[#FAF7F2] dark:bg-[#28211B] border-t border-[#E8DFD3] dark:border-[#382F28] flex flex-wrap items-center justify-between gap-2 no-print">
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push('/antrean');
            }}
            className="px-3 py-2 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Tracking Pesanan</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 bg-white dark:bg-[#1E1916] hover:bg-[#F3EDE2] dark:hover:bg-[#342C25] text-[#78716C] dark:text-[#A89F91] border border-[#E8DFD3] dark:border-[#382F28] text-xs font-semibold rounded-xl transition-all cursor-pointer"
            >
              Selesai
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 bg-[#4A2E18] hover:bg-[#382312] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white dark:text-[#12100E] text-xs font-bold rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak Struk</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
