import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { getUserProfile } from '@/lib/auth/get-user-profile';
import { AppShell } from '@/components/layout/AppShell';

export const instant = false;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const { user, profile, isInactive } = await getUserProfile();

  if (!user || !profile) {
    redirect('/login');
  }

  if (isInactive) {
    redirect('/nonaktif');
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
