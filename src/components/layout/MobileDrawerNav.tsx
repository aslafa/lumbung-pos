'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserRole } from '@/types/database';
import { getNavItemsForRole } from './nav-items';
import { LumbungLogo } from '@/components/brand/LumbungLogo';
import { X, MapPin } from 'lucide-react';

interface MobileDrawerNavProps {
  role: UserRole;
  branchName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function MobileDrawerNav({
  role,
  branchName,
  isOpen,
  onClose,
}: MobileDrawerNavProps) {
  const pathname = usePathname();
  const items = getNavItemsForRole(role);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 left-0 max-w-xs w-full bg-[#FAF7F2] dark:bg-[#1E1916] shadow-2xl flex flex-col z-50 border-r border-[#E8DFD3] dark:border-[#382F28] transition-all">
        {/* Drawer Header */}
        <div className="p-4 border-b border-[#E8DFD3] dark:border-[#382F28] flex items-center justify-between">
          <LumbungLogo size="sm" />
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#78716C] dark:text-[#A89F91] hover:bg-[#F3EDE2] dark:hover:bg-[#2C241E] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Branch Info Pill */}
        <div className="px-4 py-3 bg-[#F3EDE2]/60 dark:bg-[#14110F]/60 border-b border-[#E8DFD3] dark:border-[#382F28] flex items-center gap-2 text-xs">
          <MapPin className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
          <span className="font-semibold text-[#4A2E18] dark:text-[#FAF7F2] truncate">
            {branchName}
          </span>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E] dark:text-[#12100E] shadow-sm'
                    : 'text-[#57534E] dark:text-[#CBBDB0] hover:bg-[#F3EDE2] dark:hover:bg-[#28211B]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive
                      ? 'text-[#F59E0B] dark:text-[#12100E] stroke-[2.5]'
                      : 'text-[#A8A29E] dark:text-[#8C827A]'
                  }`}
                />
                <span className="whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-[#E8DFD3] dark:border-[#382F28] text-xs text-[#A8A29E] dark:text-[#78716C]">
          <p className="font-bold text-[#4A2E18] dark:text-[#FAF7F2]">Lumbung POS</p>
          <p className="text-[11px] mt-0.5 leading-snug">Operasional lebih rapi, bisnis lebih terkendali.</p>
        </div>
      </div>
    </div>
  );
}
