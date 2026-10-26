'use client';

import { useActionState, useState, useEffect, useSyncExternalStore } from 'react';
import { loginAction } from '@/app/auth/actions';
import { Lock, Mail, AlertCircle, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { LumbungLogo } from '@/components/brand/LumbungLogo';
import { ThemeToggle } from '@/components/theme/ThemeToggle';

const FULL_TITLE = 'Lumbung POS';
const FULL_SUBTITLE = 'Sistem Kasir & Operasional Multi-Cabang Lumbung Kopi dan Roti';

function subscribeReducedMotion(callback: () => void) {
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  mediaQuery.addEventListener('change', callback);
  return () => mediaQuery.removeEventListener('change', callback);
}

function getReducedMotionSnapshot() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServerSnapshot() {
  return false;
}

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Hormati preferensi aksesibilitas pengguna (prefers-reduced-motion)
  const prefersReducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot
  );

  // State untuk efek mengetik (typewriter)
  const [typedTitle, setTypedTitle] = useState('');
  const [typedSubtitle, setTypedSubtitle] = useState('');
  const [cursorPhase, setCursorPhase] = useState<'title' | 'subtitle' | 'done'>('title');

  useEffect(() => {
    if (prefersReducedMotion) return;

    let currentTimeout: ReturnType<typeof setTimeout> | null = null;
    let titleIndex = 0;
    let subtitleIndex = 0;

    // Animasi judul: ~80ms per karakter (rentang 70–90 ms)
    const typeTitle = () => {
      if (titleIndex < FULL_TITLE.length) {
        titleIndex++;
        setTypedTitle(FULL_TITLE.slice(0, titleIndex));
        currentTimeout = setTimeout(typeTitle, 80);
      } else {
        // Jeda sejenak sebelum subtitle mulai diketik
        currentTimeout = setTimeout(() => {
          setCursorPhase('subtitle');
          typeSubtitle();
        }, 300);
      }
    };

    // Animasi subtitle: ~30ms per karakter (rentang 25–35 ms)
    const typeSubtitle = () => {
      if (subtitleIndex < FULL_SUBTITLE.length) {
        subtitleIndex++;
        setTypedSubtitle(FULL_SUBTITLE.slice(0, subtitleIndex));
        currentTimeout = setTimeout(typeSubtitle, 30);
      } else {
        // Setelah selesai, biarkan teks tampil utuh dan hilangkan kursor setelah jeda singkat
        currentTimeout = setTimeout(() => {
          setCursorPhase('done');
        }, 800);
      }
    };

    // Jalankan sekali saat halaman dimuat
    currentTimeout = setTimeout(typeTitle, 150);

    return () => {
      if (currentTimeout) clearTimeout(currentTimeout);
    };
  }, [prefersReducedMotion]);

  const displayTitle = prefersReducedMotion ? FULL_TITLE : typedTitle;
  const displaySubtitle = prefersReducedMotion ? FULL_SUBTITLE : typedSubtitle;

  return (
    <div className="min-h-screen flex flex-col justify-between items-center px-4 py-8 bg-[#FAF7F2] dark:bg-[#14110F] transition-colors duration-200">
      {/* Top Header with Theme Switcher */}
      <header className="w-full max-w-5xl flex justify-between items-center py-2">
        <LumbungLogo size="sm" />
        <div className="flex items-center gap-2">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md my-auto">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <LumbungLogo size="xl" iconOnly className="drop-shadow-md" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#2C1810] dark:text-[#FAF7F2] tracking-tight min-h-[2rem] sm:min-h-[2.25rem]">
            <span>{displayTitle}</span>
            {!prefersReducedMotion && cursorPhase === 'title' && (
              <span
                aria-hidden="true"
                className="inline-block w-[3px] h-[0.85em] bg-[#C67C4E] dark:bg-[#F59E0B] align-middle ml-1 rounded-full animate-pulse"
              />
            )}
          </h1>
          <p className="text-sm text-[#78716C] dark:text-[#A89F91] mt-1 font-medium min-h-[2.5rem] sm:min-h-[1.5rem] leading-snug">
            <span>{displaySubtitle}</span>
            {!prefersReducedMotion && cursorPhase === 'subtitle' && (
              <span
                aria-hidden="true"
                className="inline-block w-[2px] h-[0.85em] bg-[#C67C4E] dark:bg-[#F59E0B] align-middle ml-0.5 rounded-full animate-pulse"
              />
            )}
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-white dark:bg-[#1E1916] rounded-3xl shadow-xl border border-[#E8DFD3] dark:border-[#382F28] p-6 sm:p-8 backdrop-blur-sm transition-all">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-[#2C1810] dark:text-[#FAF7F2]">
              Masuk ke Sistem
            </h2>
            <p className="text-xs text-[#78716C] dark:text-[#A89F91] mt-0.5">
              Silakan masukkan kredensial staf terdaftar untuk mengakses cabang Anda
            </p>
          </div>

          {state?.error && (
            <div
              data-testid="login-alert"
              className="mb-5 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 text-red-800 dark:text-red-300 text-sm rounded-2xl flex items-start gap-3 shadow-xs"
            >
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div className="space-y-1">
                {state.errorTitle && (
                  <h3
                    data-testid="login-alert-title"
                    className="font-bold text-red-900 dark:text-red-200 leading-tight"
                  >
                    {state.errorTitle}
                  </h3>
                )}
                <p
                  data-testid="login-alert-message"
                  className="text-xs text-red-700 dark:text-red-300 leading-relaxed"
                >
                  {state.error}
                </p>
              </div>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4A2E18] dark:text-[#D6C7B2] mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A8A29E] dark:text-[#78716C]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama.staf@lumbung.test"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF7F2] dark:bg-[#14110F] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C67C4E] focus:border-transparent transition-all placeholder:text-[#A8A29E] dark:placeholder:text-[#5E554D]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A2E18] dark:text-[#D6C7B2] mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A8A29E] dark:text-[#78716C]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full pl-10 pr-11 py-2.5 text-sm bg-[#FAF7F2] dark:bg-[#14110F] text-[#2C1810] dark:text-[#FAF7F2] border border-[#E8DFD3] dark:border-[#382F28] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C67C4E] focus:border-transparent transition-all placeholder:text-[#A8A29E] dark:placeholder:text-[#5E554D]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-[#A8A29E] hover:text-[#4A2E18] dark:hover:text-[#F5EFE6] transition-colors cursor-pointer"
                  title={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-3 py-3 px-4 bg-[#4A2E18] hover:bg-[#382312] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white font-semibold text-sm rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <span>Masuk ke Dashboard</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-[#F3EDE2] dark:border-[#2C241E] flex items-center justify-center gap-1.5 text-[11px] text-[#A8A29E] dark:text-[#78716C]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#10B981]" />
            <span>Sesi Terenkripsi &bull; Autentikasi Supabase RLS</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md text-center py-4 text-xs text-[#A8A29E] dark:text-[#78716C]">
        <p>&copy; {new Date().getFullYear()} Lumbung Kopi dan Roti. Hak Cipta Dilindungi.</p>
        <p className="text-[10px] mt-0.5">Sistem Internal &bull; Akses Terbatas untuk Staf Terdaftar</p>
      </footer>
    </div>
  );
}
