'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  Printer,
  ReceiptText,
  Eye,
  X,
  AlertTriangle,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { voidTransaksiAction } from '@/app/actions/supervisi';
import { StrukModal } from '../kasir/struk-modal';
import { formatRupiah } from '@/lib/utils/format';
import { TableTimeCell } from '@/components/ui/TableTimeCell';

export interface TransaksiItemDetail {
  id: string;
  nama_produk: string;
  harga_satuan: number;
  jumlah: number;
  subtotal: number;
}

export interface TransaksiRowData {
  id: string;
  nomor_struk: string;
  dibuat_pada: string;
  waktu_wib: string;
  subtotal: number;
  diskon: number;
  alasan_diskon?: string | null;
  total: number;
  metode_bayar: string;
  status: string;
  kasir_nama: string;
  cabang_nama: string;
  items: TransaksiItemDetail[];
  voidEligible: boolean;
}

interface TransaksiClientProps {
  transaksiList: TransaksiRowData[];
  peran: string;
  isVoidAllowed: boolean;
}

export function TransaksiClient({
  transaksiList,
  peran,
  isVoidAllowed,
}: TransaksiClientProps) {
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('semua');
  const [metodeFilter, setMetodeFilter] = useState('semua');

  // Selected for Detail / Print / Void
  const [selectedDetail, setSelectedDetail] = useState<TransaksiRowData | null>(null);
  const [selectedForPrint, setSelectedForPrint] = useState<TransaksiRowData | null>(null);
  const [selectedForVoid, setSelectedForVoid] = useState<TransaksiRowData | null>(null);

  // Void Modal State
  const [alasanVoid, setAlasanVoid] = useState('');
  const [isVoidLoading, setIsVoidLoading] = useState(false);
  const [voidError, setVoidError] = useState<string | null>(null);
  const [voidSuccess, setVoidSuccess] = useState<string | null>(null);

  // Filter Data
  const filteredList = transaksiList.filter((trx) => {
    const matchSearch =
      trx.nomor_struk.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.kasir_nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
      trx.cabang_nama.toLowerCase().includes(searchQuery.toLowerCase());

    const matchStatus = statusFilter === 'semua' || trx.status === statusFilter;
    const matchMetode = metodeFilter === 'semua' || trx.metode_bayar === metodeFilter;

    return matchSearch && matchStatus && matchMetode;
  });

  // Handler Submit Void
  const handleConfirmVoid = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedForVoid) return;

    if (!alasanVoid || alasanVoid.trim().length < 10) {
      setVoidError('Alasan void wajib diisi minimal 10 karakter.');
      return;
    }

    setIsVoidLoading(true);
    setVoidError(null);

    const res = await voidTransaksiAction(selectedForVoid.id, alasanVoid.trim());
    setIsVoidLoading(false);

    if (!res.success) {
      setVoidError(res.error || 'Gagal memproses void transaksi.');
    } else {
      setVoidSuccess(`Transaksi ${selectedForVoid.nomor_struk} berhasil di-void dan stok telah dikembalikan.`);
      setTimeout(() => {
        setSelectedForVoid(null);
        setAlasanVoid('');
        setVoidSuccess(null);
        window.location.reload();
      }, 1500);
    }
  };

  return (
    <div className="space-y-5">
      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-[#1E1916] p-4 rounded-3xl border border-[#E8DFD3] dark:border-[#382F28] shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between transition-colors">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E] dark:text-[#78716C]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor struk atau kasir..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#FAF7F2] dark:bg-[#14110F] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#C67C4E] placeholder:text-[#A8A29E] dark:placeholder:text-[#665D54]"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-[#FAF7F2] dark:bg-[#14110F] px-2.5 py-1.5 rounded-xl border border-[#E8DFD3] dark:border-[#382F28] text-xs">
            <Filter className="w-3.5 h-3.5 text-[#D97706]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-[#2C1810] dark:text-[#FAF7F2] font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="semua">Semua Status</option>
              <option value="lunas">Lunas</option>
              <option value="void">Void</option>
              <option value="menunggu_bayar">Menunggu Bayar</option>
              <option value="batal">Batal</option>
            </select>
          </div>

          {/* Metode Bayar Filter */}
          <div className="flex items-center gap-1.5 bg-[#FAF7F2] dark:bg-[#14110F] px-2.5 py-1.5 rounded-xl border border-[#E8DFD3] dark:border-[#382F28] text-xs">
            <span className="text-[#A8A29E] dark:text-[#78716C] font-semibold">Bayar:</span>
            <select
              value={metodeFilter}
              onChange={(e) => setMetodeFilter(e.target.value)}
              className="bg-transparent text-[#2C1810] dark:text-[#FAF7F2] font-semibold text-xs focus:outline-none cursor-pointer"
            >
              <option value="semua">Semua Metode</option>
              <option value="tunai">Tunai</option>
              <option value="qris">QRIS</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-3xl shadow-xs overflow-hidden transition-colors">
        {filteredList.length === 0 ? (
          <div className="py-14 text-center text-[#78716C] dark:text-[#A89F91] space-y-2">
            <ReceiptText className="w-10 h-10 mx-auto text-[#A8A29E] dark:text-[#78716C]" />
            <p className="text-xs font-bold text-[#2C1810] dark:text-[#FAF7F2]">
              Tidak ada transaksi yang cocok dengan filter.
            </p>
            <p className="text-[11px] text-[#A8A29E] dark:text-[#78716C]">
              Coba ganti filter status atau nomor struk pencarian.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7F2] dark:bg-[#28211B] border-b border-[#E8DFD3] dark:border-[#382F28] text-[#78716C] dark:text-[#A89F91] uppercase font-bold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Nomor Struk</th>
                  <th className="px-4 py-3.5">Waktu (WIB)</th>
                  {peran === 'owner' && <th className="px-4 py-3.5">Cabang</th>}
                  <th className="px-4 py-3.5">Kasir</th>
                  <th className="px-4 py-3.5">Metode</th>
                  <th className="px-4 py-3.5">Total</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3EDE2] dark:divide-[#2C241E] text-[#2C1810] dark:text-[#FAF7F2]">
                {filteredList.map((trx) => (
                  <tr
                    key={trx.id}
                    className="hover:bg-[#FAF7F2]/60 dark:hover:bg-[#28211B]/40 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-mono font-bold whitespace-nowrap text-[#4A2E18] dark:text-[#F59E0B]">
                      {trx.nomor_struk}
                    </td>
                    <TableTimeCell>{trx.waktu_wib}</TableTimeCell>
                    {peran === 'owner' && (
                      <td className="px-4 py-3.5 font-medium text-[#78716C] dark:text-[#CBBDB0]">
                        {trx.cabang_nama}
                      </td>
                    )}
                    <td className="px-4 py-3.5 font-bold">{trx.kasir_nama}</td>
                    <td className="px-4 py-3.5 uppercase font-bold text-[11px] text-[#78716C] dark:text-[#A89F91]">
                      {trx.metode_bayar}
                    </td>
                    <td className="px-4 py-3.5 font-black text-[#2C1810] dark:text-[#FAF7F2] tabular-nums">
                      {formatRupiah(trx.total)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full font-black text-[10px] uppercase border ${
                          trx.status === 'lunas'
                            ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                            : trx.status === 'void'
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800'
                            : trx.status === 'menunggu_bayar'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            : 'bg-stone-100 dark:bg-[#28211B] text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-800'
                        }`}
                      >
                        {trx.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {/* Lihat Detail */}
                      <button
                        type="button"
                        onClick={() => setSelectedDetail(trx)}
                        title="Rincian Item"
                        className="p-1.5 text-[#78716C] dark:text-[#A89F91] hover:text-[#4A2E18] dark:hover:text-[#FAF7F2] hover:bg-[#FAF7F2] dark:hover:bg-[#28211B] rounded-lg transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Cetak Struk */}
                      <button
                        type="button"
                        onClick={() => setSelectedForPrint(trx)}
                        title="Cetak Salinan Struk"
                        className="p-1.5 text-[#78716C] dark:text-[#A89F91] hover:text-[#4A2E18] dark:hover:text-[#FAF7F2] hover:bg-[#FAF7F2] dark:hover:bg-[#28211B] rounded-lg transition-colors cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                      </button>

                      {/* Tombol Void Supervisor */}
                      {isVoidAllowed && trx.voidEligible && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedForVoid(trx);
                            setAlasanVoid('');
                            setVoidError(null);
                          }}
                          title="Void Transaksi"
                          className="px-2.5 py-1 text-[11px] font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 border border-red-200 dark:border-red-900 rounded-lg transition-all cursor-pointer"
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
        )}
      </div>

      {/* Modal Detail Transaksi */}
      {selectedDetail && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E1916] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-[#E8DFD3] dark:border-[#382F28] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#F3EDE2] dark:border-[#382F28] pb-3">
              <div>
                <h3 className="text-sm font-black text-[#2C1810] dark:text-[#FAF7F2]">
                  Detail Transaksi {selectedDetail.nomor_struk}
                </h3>
                <p className="text-[11px] text-[#78716C] dark:text-[#A89F91]">
                  {selectedDetail.waktu_wib} &bull; {selectedDetail.cabang_nama}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="p-1.5 rounded-lg text-[#78716C] hover:bg-[#FAF7F2] dark:hover:bg-[#28211B]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Item List */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {selectedDetail.items && selectedDetail.items.length > 0 ? (
                selectedDetail.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center text-xs p-2 bg-[#FAF7F2] dark:bg-[#28211B] rounded-xl border border-[#E8DFD3] dark:border-[#382F28]"
                  >
                    <div>
                      <p className="font-bold text-[#2C1810] dark:text-[#FAF7F2]">
                        {it.nama_produk}
                      </p>
                      <p className="text-[11px] text-[#78716C] dark:text-[#A89F91]">
                        {it.jumlah} &times; <span className="tabular-nums">{formatRupiah(it.harga_satuan)}</span>
                      </p>
                    </div>
                    <span className="font-black text-[#4A2E18] dark:text-[#F59E0B] tabular-nums">
                      {formatRupiah(it.subtotal)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#A8A29E] text-center py-4">Rincian item tidak tersedia.</p>
              )}
            </div>

            {/* Total Ringkasan */}
            <div className="pt-2 border-t border-[#F3EDE2] dark:border-[#382F28] text-xs space-y-1">
              <div className="flex justify-between text-[#78716C] dark:text-[#A8A29E]">
                <span>Subtotal:</span>
                <span className="font-bold tabular-nums">{formatRupiah(selectedDetail.subtotal)}</span>
              </div>
              {selectedDetail.diskon > 0 && (
                <div className="flex justify-between text-amber-700 dark:text-amber-400">
                  <span>Diskon {selectedDetail.alasan_diskon ? `(${selectedDetail.alasan_diskon})` : ''}:</span>
                  <span className="font-bold tabular-nums">-{formatRupiah(selectedDetail.diskon)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black text-[#2C1810] dark:text-[#FAF7F2] pt-1 border-t border-[#F3EDE2] dark:border-[#382F28]">
                <span>Total:</span>
                <span className="tabular-nums">{formatRupiah(selectedDetail.total)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedDetail(null)}
                className="px-4 py-2 bg-[#FAF7F2] dark:bg-[#28211B] hover:bg-[#F3EDE2] dark:hover:bg-[#342C25] text-xs font-bold rounded-xl text-[#4A2E18] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Void (Supervisor BR-08) */}
      {selectedForVoid && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1E1916] rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-[#E8DFD3] dark:border-[#382F28] p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 rounded-2xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-[#2C1810] dark:text-[#FAF7F2]">
                  Otorisasi Void Transaksi
                </h3>
                <p className="text-xs text-[#78716C] dark:text-[#A89F91]">
                  Nomor Struk: <strong className="font-mono">{selectedForVoid.nomor_struk}</strong>
                </p>
              </div>
            </div>

            <p className="text-xs text-[#78716C] dark:text-[#A89F91] leading-relaxed">
              Tindakan ini akan membatalkan transaksi, mengembalikan seluruh stok item ke cabang, dan mencatat alasan pembatalan ke dalam catatan audit log.
            </p>

            {voidError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl text-xs text-red-700 dark:text-red-300">
                {voidError}
              </div>
            )}
            {voidSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{voidSuccess}</span>
              </div>
            )}

            <form onSubmit={handleConfirmVoid} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#4A2E18] dark:text-[#FAF7F2] mb-1.5">
                  Alasan Void (Wajib minimal 10 karakter):
                </label>
                <textarea
                  rows={3}
                  value={alasanVoid}
                  onChange={(e) => setAlasanVoid(e.target.value)}
                  placeholder="Contoh: Pelanggan salah memesan varian dan minta dibatalkan segera..."
                  required
                  className="w-full p-3 bg-[#FAF7F2] dark:bg-[#14110F] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-red-500 placeholder:text-[#A8A29E]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedForVoid(null)}
                  disabled={isVoidLoading}
                  className="px-4 py-2.5 bg-[#FAF7F2] dark:bg-[#28211B] text-xs font-bold rounded-xl border border-[#E8DFD3] dark:border-[#382F28] text-[#78716C] dark:text-[#A89F91] cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isVoidLoading || alasanVoid.trim().length < 10}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isVoidLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses Void...</span>
                    </>
                  ) : (
                    <span>Konfirmasi Void</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cetak Ulang Struk */}
      {selectedForPrint && (
        <StrukModal
          nomorStruk={selectedForPrint.nomor_struk}
          cabangNama={selectedForPrint.cabang_nama}
          waktuWib={selectedForPrint.waktu_wib}
          kasirNama={selectedForPrint.kasir_nama}
          items={selectedForPrint.items.map((it) => ({
            nama: it.nama_produk,
            harga: it.harga_satuan,
            jumlah: it.jumlah,
            subtotal: it.subtotal,
          }))}
          subtotal={selectedForPrint.subtotal}
          diskon={selectedForPrint.diskon}
          alasanDiskon={selectedForPrint.alasan_diskon || undefined}
          total={selectedForPrint.total}
          metodeBayar={selectedForPrint.metode_bayar}
          uangDiterima={selectedForPrint.total}
          kembalian={0}
          onClose={() => setSelectedForPrint(null)}
        />
      )}
    </div>
  );
}
