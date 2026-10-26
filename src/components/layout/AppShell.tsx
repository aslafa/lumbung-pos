'use client';

import { useState } from 'react';
import { Profile } from '@/types/database';
import { AppHeader } from './AppHeader';
import { SidebarNav } from './SidebarNav';
import { MobileDrawerNav } from './MobileDrawerNav';

interface AppShellProps {
  profile: Profile;
  children: React.ReactNode;
}

export function AppShell({ profile, children }: AppShellProps) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const branchName = profile.cabang
    ? `${profile.cabang.nama} (${profile.cabang.kode})`
    : profile.peran === 'owner'
    ? 'Semua Cabang'
    : 'Cabang Utama';

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2] dark:bg-[#14110F] text-[#1C1917] dark:text-[#FAF7F2] transition-colors duration-200">
      {/* Top Header Bar */}
      <AppHeader
        profile={profile}
        onOpenMobileDrawer={() => setIsMobileDrawerOpen(true)}
      />

      {/* Mobile Drawer (Slide-over) for screens < lg */}
      <MobileDrawerNav
        role={profile.peran}
        branchName={branchName}
        isOpen={isMobileDrawerOpen}
        onClose={() => setIsMobileDrawerOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        {/* Sidebar Nav for Large Desktop (lg+) */}
        <SidebarNav role={profile.peran} />

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
