'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/types/database';
import { getNavItemsForRole } from './nav-items';
import { Coffee } from 'lucide-react';

interface SidebarNavProps {
  role: UserRole;
}

export function SidebarNav({ role }: SidebarNavProps) {
  const pathname = usePathname();
  const items = getNavItemsForRole(role);

  return (
    <aside className="hidden lg:flex flex-col w-[260px] bg-white dark:bg-[#1C1815] border-r border-[#E8DFD3] dark:border-[#382F28] sticky top-16 h-[calc(100vh-4rem)] p-4 shrink-0 transition-colors duration-200">
      <div className="mb-2 px-3 py-1 text-[11px] font-bold text-[#A8A29E] dark:text-[#78716C] uppercase tracking-wider shrink-0">
        Menu Utama
      </div>

      {/* Navigasi Scrollable Vertikal Tanpa Scroll Horizontal */}
      <nav className="space-y-1.5 flex-1 overflow-y-auto overflow-x-hidden pr-1">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          const isAntrean = item.href === '/antrean';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-semibold transition-all ${
                isActive
                  ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E] dark:text-[#12100E] shadow-sm'
                  : 'text-[#78716C] dark:text-[#CBBDB0] hover:text-[#2C1810] dark:hover:text-[#FAF7F2] hover:bg-[#FAF7F2] dark:hover:bg-[#28211B]'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive
                    ? 'text-[#F59E0B] dark:text-[#12100E] stroke-[2.5]'
                    : 'text-[#A8A29E] dark:text-[#8C827A]'
                }`}
              />
              <span className={`whitespace-nowrap tracking-tight ${isAntrean ? 'text-[13px]' : 'text-sm'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer Sidebar Sticky di Paling Bawah */}
      <div className="mt-auto pt-4 shrink-0 border-t border-[#F3EDE2] dark:border-[#2C241E] px-1">
        <div className="p-3 bg-[#FAF7F2] dark:bg-[#26201B] border border-[#E8DFD3] dark:border-[#382F28] rounded-2xl text-xs text-[#78716C] dark:text-[#A89F91]">
          <div className="flex items-center gap-2 mb-1">
            <Coffee className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
            <span className="font-bold text-[#4A2E18] dark:text-[#FAF7F2] whitespace-nowrap">Lumbung POS</span>
          </div>
          <p className="text-[11px] text-[#A8A29E] dark:text-[#78716C] leading-snug">
            Operasional lebih rapi, bisnis lebih terkendali.
          </p>
        </div>
      </div>
    </aside>
  );
}
