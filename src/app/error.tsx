'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Lumbung POS Error:', error);
  }, [error]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6" />
      </div>
      <h2 className="text-base font-bold text-[#2C1810]">Terjadi Gangguan pada Halaman</h2>
      <p className="text-xs text-[#78716C] mt-1 mb-4 max-w-sm">
        {error.message || 'Sistem mendeteksi kendala saat memuat data. Silakan coba muat ulang.'}
      </p>
      <button
        onClick={() => reset()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-[#4A2E18] hover:bg-[#382312] text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Muat Ulang Halaman</span>
      </button>
    </div>
  );
}
