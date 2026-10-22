'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/types/database';
import { getNavItemsForRole } from './nav-items';

interface SidebarNavProps {
  role: UserRole;
}

export function SidebarNav({ role }: SidebarNavProps) {
  const pathname = usePathname();
  const items = getNavItemsForRole(role);

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E8DFD3] min-h-[calc(100vh-4rem)] p-4 shrink-0">
      <div className="mb-2 px-3 py-1 text-[11px] font-semibold text-[#A8A29E] uppercase tracking-wider">
        Menu Utama
      </div>

      <nav className="space-y-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[#4A2E18] text-white shadow-xs'
                  : 'text-[#78716C] hover:text-[#2C1810] hover:bg-[#FAF7F2]'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-[#F59E0B] stroke-[2.5]' : 'text-[#78716C]'
                }`}
              />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-[#F3EDE2] px-3">
        <div className="p-3 bg-[#FAF7F2] border border-[#E8DFD3] rounded-xl text-xs text-[#78716C]">
          <p className="font-semibold text-[#4A2E18]">Lumbung POS</p>
          <p className="text-[11px] text-[#A8A29E] mt-0.5">Versi 1.0 &bull; Multi-Cabang</p>
        </div>
      </div>
    </aside>
  );
}
