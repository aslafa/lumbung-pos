import { redirect } from 'next/navigation';
import { getUserProfile } from '@/lib/auth/get-user-profile';
import { AppShell } from '@/components/layout/AppShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, profile, isInactive } = await getUserProfile();

  if (!user || !profile) {
    redirect('/login');
  }

  if (isInactive) {
    redirect('/nonaktif');
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
