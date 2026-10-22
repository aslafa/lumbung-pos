import {
  ShoppingCart,
  Clock,
  Receipt,
  Boxes,
  Users,
  Package,
  BarChart3,
  Settings,
  LucideIcon,
} from 'lucide-react';
import { UserRole } from '@/types/database';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[];
}

export const ALL_NAV_ITEMS: NavItem[] = [
  {
    label: 'Kasir POS',
    href: '/kasir',
    icon: ShoppingCart,
    roles: ['kasir', 'owner'],
  },
  {
    label: 'Shift Saya',
    href: '/shift-saya',
    icon: Clock,
    roles: ['kasir', 'owner'],
  },
  {
    label: 'Transaksi',
    href: '/transaksi',
    icon: Receipt,
    roles: ['kasir', 'kepala_toko', 'owner'],
  },
  {
    label: 'Stok Cabang',
    href: '/stok',
    icon: Boxes,
    roles: ['kepala_toko', 'owner'],
  },
  {
    label: 'Shift Cabang',
    href: '/shift-cabang',
    icon: Users,
    roles: ['kepala_toko', 'owner'],
  },
  {
    label: 'Produk',
    href: '/produk',
    icon: Package,
    roles: ['kepala_toko', 'owner'],
  },
  {
    label: 'Laporan',
    href: '/laporan',
    icon: BarChart3,
    roles: ['kepala_toko', 'owner'],
  },
  {
    label: 'Pengaturan',
    href: '/pengaturan',
    icon: Settings,
    roles: ['owner'],
  },
];

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return ALL_NAV_ITEMS.filter((item) => item.roles.includes(role));
}
