import React from 'react';

interface TableTimeCellProps {
  children?: React.ReactNode;
  waktu?: string;
  className?: string;
}

/**
 * Komponen sel tabel waktu standar Lumbung POS.
 * Menyelaraskan tipografi kolom waktu di seluruh dashboard (Transaksi & Shift Cabang):
 * - Font-family: Sans (mengikuti antarmuka Lumbung POS)
 * - Font-size: text-xs (0.75rem / 12px)
 * - Font-weight: font-medium (500)
 * - Line-height: leading-normal
 * - Warna teks: text-[#78716C] dark:text-[#A89F91]
 * - Whitespace: whitespace-nowrap (mencegah teks terpotong atau bertumpuk)
 */
export function TableTimeCell({
  children,
  waktu,
  className = '',
}: TableTimeCellProps) {
  const content = children ?? waktu;
  return (
    <td
      className={`px-4 py-3.5 text-[#78716C] dark:text-[#A89F91] whitespace-nowrap font-medium text-xs ${className}`.trim()}
    >
      {content}
    </td>
  );
}
