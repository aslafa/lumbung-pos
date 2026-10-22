import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lumbung POS — Lumbung Kopi dan Roti',
  description: 'Sistem Kasir Multi-Cabang (POS) Internal Lumbung Kopi dan Roti',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#FAF7F2] text-[#1C1917]">
        {children}
      </body>
    </html>
  );
}
