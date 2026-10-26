import { Coffee } from 'lucide-react';

export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div className="border-b border-[#E8DFD3] dark:border-[#382F28] pb-4">
        <div className="h-6 w-48 bg-[#E8DFD3]/60 dark:bg-[#382F28] rounded-lg mb-2"></div>
        <div className="h-4 w-72 bg-[#E8DFD3]/40 dark:bg-[#2A231F] rounded-lg"></div>
      </div>

      {/* Content skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="h-32 bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-2xl p-4"></div>
        <div className="h-32 bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-2xl p-4"></div>
        <div className="h-32 bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-2xl p-4"></div>
      </div>

      {/* Main card skeleton */}
      <div className="h-64 bg-white dark:bg-[#1E1916] border border-[#E8DFD3] dark:border-[#382F28] rounded-2xl p-6 flex flex-col items-center justify-center text-[#A8A29E] dark:text-[#78716C]">
        <Coffee className="w-8 h-8 text-[#D97706] animate-bounce mb-2" />
        <span className="text-xs font-medium">Memuat data operasional Lumbung...</span>
      </div>
    </div>
  );
}
