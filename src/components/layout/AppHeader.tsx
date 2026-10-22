'use client';

import { Profile } from '@/types/database';
import { logoutAction } from '@/app/auth/actions';
import { Coffee, MapPin, LogOut } from 'lucide-react';

interface AppHeaderProps {
  profile: Profile;
}

export function AppHeader({ profile }: AppHeaderProps) {
  const roleDisplayNames: Record<string, string> = {
    kasir: 'Kasir',
    kepala_toko: 'Kepala Toko',
    owner: 'Owner',
  };

  const roleBadgeStyles: Record<string, string> = {
    kasir: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    kepala_toko: 'bg-blue-50 text-blue-700 border-blue-200',
    owner: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  const branchName = profile.cabang
    ? `${profile.cabang.nama} (${profile.cabang.kode})`
    : profile.peran === 'owner'
    ? 'Semua Cabang'
    : 'Cabang Utama';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#E8DFD3] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Branch */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#4A2E18] text-[#F59E0B] shadow-sm">
            <Coffee className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-[#2C1810] tracking-tight leading-tight">
                Lumbung
              </span>
              <span className="hidden sm:inline text-xs text-[#78716C] font-normal">
                Kopi & Roti
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-[#78716C]">
              <MapPin className="w-3 h-3 text-[#D97706]" />
              <span className="font-medium text-[#4A2E18]">{branchName}</span>
            </div>
          </div>
        </div>

        {/* User Info & Logout */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end text-right">
            <div className="text-sm font-semibold text-[#2C1810] leading-none">
              {profile.nama_lengkap}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  roleBadgeStyles[profile.peran] || 'bg-stone-50 text-stone-700'
                }`}
              >
                {roleDisplayNames[profile.peran] || profile.peran}
              </span>
            </div>
          </div>

          {/* User Initial Circle */}
          <div className="w-9 h-9 rounded-full bg-[#FAF7F2] border border-[#E8DFD3] flex items-center justify-center text-[#4A2E18] font-bold text-xs shadow-xs">
            {profile.nama_lengkap.slice(0, 2).toUpperCase()}
          </div>

          {/* Logout Button */}
          <form action={logoutAction}>
            <button
              type="submit"
              title="Keluar dari sistem"
              className="p-2 text-[#78716C] hover:text-red-600 hover:bg-red-50 rounded-xl border border-transparent hover:border-red-200 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
