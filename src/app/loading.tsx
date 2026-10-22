import { Coffee } from 'lucide-react';

export default function Loading() {
  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center p-6 text-center">
      <div className="relative w-14 h-14 rounded-2xl bg-[#4A2E18] text-[#F59E0B] flex items-center justify-center shadow-lg mb-4 animate-bounce">
        <Coffee className="w-7 h-7" />
      </div>
      <p className="text-sm font-semibold text-[#4A2E18]">Memuat Lumbung POS...</p>
      <p className="text-xs text-[#A8A29E] mt-0.5">Menyiapkan data kasir &amp; operasional</p>
    </div>
  );
}
