'use client';

import { useSearchParams } from 'next/navigation';
import { useState, Suspense } from 'react';
import { ShieldAlert, X } from 'lucide-react';

function AccessDeniedBannerContent() {
  const searchParams = useSearchParams();
  const isDenied = searchParams.get('denied') === '1';
  const [dismissed, setDismissed] = useState(false);

  if (!isDenied || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('denied');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  };

  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/90 p-4 text-rose-900 shadow-sm backdrop-blur-sm dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-200"
    >
      <div className="rounded-lg bg-rose-100 p-2 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300">
        <ShieldAlert className="h-5 w-5 flex-shrink-0" />
      </div>
      <div className="flex-1 pt-0.5">
        <h4 className="text-sm font-semibold text-rose-900 dark:text-rose-100">
          Akses Ditolak
        </h4>
        <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
          Akses ditolak. Anda tidak memiliki izin untuk membuka halaman ini.
        </p>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        className="rounded-lg p-1.5 text-rose-600 hover:bg-rose-100 dark:text-rose-400 dark:hover:bg-rose-900/50 transition-colors"
        aria-label="Tutup pemberitahuan"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function AccessDeniedNotice() {
  return (
    <Suspense fallback={null}>
      <AccessDeniedBannerContent />
    </Suspense>
  );
}
