'use client';

import { Profile } from '@/types/database';
import { logoutAction } from '@/app/auth/actions';
import { LumbungLogo } from '@/components/brand/LumbungLogo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { MapPin, LogOut, Menu } from 'lucide-react';

interface AppHeaderProps {
  profile: Profile;
  onOpenMobileDrawer?: () => void;
}

export function AppHeader({ profile, onOpenMobileDrawer }: AppHeaderProps) {
  const roleDisplayNames: Record<string, string> = {
    kasir: 'Kasir',
    kepala_toko: 'Kepala Toko',
    owner: 'Owner',
  };

  const roleBadgeStyles: Record<string, string> = {
    kasir: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    kepala_toko: 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    owner: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  };

  const branchName = profile.cabang
    ? `${profile.cabang.nama} (${profile.cabang.kode})`
    : profile.peran === 'owner'
    ? 'Semua Cabang'
    : 'Cabang Utama';

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#1C1815]/95 backdrop-blur-md border-b border-[#E8DFD3] dark:border-[#382F28] shadow-xs transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Mobile Hamburger & Brand */}
        <div className="flex items-center gap-3">
          {onOpenMobileDrawer && (
            <button
              type="button"
              onClick={onOpenMobileDrawer}
              className="lg:hidden p-2 rounded-xl text-[#78716C] dark:text-[#A89F91] hover:bg-[#F3EDE2] dark:hover:bg-[#2A231F] border border-[#E8DFD3] dark:border-[#382F28] transition-colors cursor-pointer"
              title="Buka Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          )}

          <LumbungLogo size="md" />

          {/* Branch Pill (Desktop) */}
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-[#FAF7F2] dark:bg-[#28211B] border border-[#E8DFD3] dark:border-[#382F28] rounded-full text-xs ml-2">
            <MapPin className="w-3.5 h-3.5 text-[#D97706]" />
            <span className="font-semibold text-[#4A2E18] dark:text-[#FAF7F2]">{branchName}</span>
          </div>
        </div>

        {/* Right: Theme Toggle, User Info & Logout */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Branch Pill (Mobile icon only) */}
          <div className="md:hidden flex items-center gap-1 text-xs text-[#78716C] dark:text-[#A89F91]">
            <MapPin className="w-3.5 h-3.5 text-[#D97706]" />
            <span className="font-semibold text-[#4A2E18] dark:text-[#FAF7F2] max-w-[90px] truncate">
              {profile.cabang?.kode || (profile.peran === 'owner' ? 'ALL' : 'POS')}
            </span>
          </div>

          {/* User Info Chips (Desktop) */}
          <div className="hidden sm:flex flex-col items-end text-right">
            <div className="text-sm font-bold text-[#2C1810] dark:text-[#FAF7F2] leading-none">
              {profile.nama_lengkap}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  roleBadgeStyles[profile.peran] || 'bg-stone-50 text-stone-700'
                }`}
              >
                {roleDisplayNames[profile.peran] || profile.peran}
              </span>
            </div>
          </div>

          {/* User Avatar Circle */}
          <div
            title={`${profile.nama_lengkap} (${roleDisplayNames[profile.peran] || profile.peran})`}
            className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4A2E18] to-[#2C1810] text-[#FAF7F2] border border-[#6B4423]/40 flex items-center justify-center font-bold text-xs shadow-xs"
          >
            {profile.nama_lengkap.slice(0, 2).toUpperCase()}
          </div>

          {/* Logout Button */}
          <form action={logoutAction}>
            <button
              type="submit"
              title="Keluar dari sistem"
              className="p-2 text-[#78716C] dark:text-[#A89F91] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-transparent hover:border-red-200 dark:hover:border-red-900 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
