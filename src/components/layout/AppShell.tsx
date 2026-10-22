import { Profile } from '@/types/database';
import { AppHeader } from './AppHeader';
import { SidebarNav } from './SidebarNav';
import { BottomNav } from './BottomNav';

interface AppShellProps {
  profile: Profile;
  children: React.ReactNode;
}

export function AppShell({ profile, children }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col bg-[#FAF7F2]">
      {/* Top Header Bar */}
      <AppHeader profile={profile} />

      {/* Main Content Area */}
      <div className="flex-1 flex w-full max-w-7xl mx-auto">
        {/* Sidebar Nav for Tablet (10"+) & Desktop */}
        <SidebarNav role={profile.peran} />

        {/* Page Content Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8 min-w-0">
          {children}
        </main>
      </div>

      {/* Bottom Nav for Mobile Phone (< 768px) */}
      <BottomNav role={profile.peran} />
    </div>
  );
}
