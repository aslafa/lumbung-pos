'use client';

import { useActionState, useState } from 'react';
import { loginAction } from '@/app/auth/actions';
import { Coffee, Lock, Mail, AlertCircle, Loader2, Sparkles, UserCheck } from 'lucide-react';

const TEST_ACCOUNTS = [
  {
    role: 'Owner',
    email: 'ratna.owner@lumbung.test',
    branch: 'Semua Cabang',
    desc: 'Kelola produk, modal & laba',
  },
  {
    role: 'Kepala Toko',
    email: 'bayu.kt.tebet@lumbung.test',
    branch: 'Tebet (TBT)',
    desc: 'Verifikasi shift, void, stok',
  },
  {
    role: 'Kasir',
    email: 'dimas.kasir.tebet@lumbung.test',
    branch: 'Tebet (TBT)',
    desc: 'Buka shift, penjualan POS',
  },
  {
    role: 'Kasir Nonaktif',
    email: 'rizky.kasir.depok@lumbung.test',
    branch: 'Depok (DPK)',
    desc: 'Uji akun ditolak (TC-01)',
  },
];

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Latihan#2026');

  const fillTestAccount = (testEmail: string) => {
    setEmail(testEmail);
    setPassword('Latihan#2026');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 py-8 bg-[#FAF7F2]">
      {/* Container Form */}
      <div className="w-full max-w-md">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#4A2E18] text-[#FAF7F2] shadow-lg mb-4 ring-4 ring-[#E8DFD3]">
            <Coffee className="w-8 h-8 text-[#F59E0B]" />
          </div>
          <h1 className="text-2xl font-bold text-[#2C1810] tracking-tight">
            Lumbung Kopi dan Roti
          </h1>
          <p className="text-sm text-[#78716C] mt-1">
            Sistem Kasir & Operasional Multi-Cabang
          </p>
        </div>

        {/* Card Login */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#E8DFD3] p-6 sm:p-8 backdrop-blur-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[#2C1810]">Masuk ke Sistem</h2>
            <p className="text-xs text-[#78716C] mt-0.5">
              Gunakan akun staf terdaftar untuk mengakses cabang Anda
            </p>
          </div>

          {state?.error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-600" />
              <span className="leading-snug">{state.error}</span>
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-[#4A2E18] mb-1.5">
                Alamat Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A8A29E]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  name="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staf@lumbung.test"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF7F2] border border-[#E8DFD3] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A2E18] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A2E18] mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#A8A29E]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  name="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#FAF7F2] border border-[#E8DFD3] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#4A2E18] focus:border-transparent transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 py-3 px-4 bg-[#4A2E18] hover:bg-[#382312] active:bg-[#2C1810] text-white font-medium text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#F59E0B]" />
                  <span>Memverifikasi Akun...</span>
                </>
              ) : (
                <span>Masuk Sekarang</span>
              )}
            </button>
          </form>

          {/* Quick Test Accounts Drawer/Pills */}
          <div className="mt-8 pt-6 border-t border-[#F3EDE2]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-[#78716C] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#D97706]" />
                Akun Uji Cepat (Latihan)
              </span>
              <span className="text-[11px] text-[#A8A29E]">Klik untuk isi</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {TEST_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillTestAccount(acc.email)}
                  className="p-2.5 text-left rounded-xl border border-[#E8DFD3] bg-[#FAF7F2] hover:bg-[#F3EDE2] hover:border-[#D97706] transition-all group cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-[#4A2E18] group-hover:text-[#D97706]">
                      {acc.role}
                    </span>
                    <UserCheck className="w-3 h-3 text-[#A8A29E] group-hover:text-[#D97706]" />
                  </div>
                  <div className="text-[11px] text-[#78716C] truncate font-mono">
                    {acc.email.split('@')[0]}
                  </div>
                  <div className="text-[10px] text-[#A8A29E] mt-0.5">{acc.branch}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <p className="text-center text-xs text-[#A8A29E] mt-6">
          Lumbung POS &copy; 2026 &bull; Aplikasi Internal Resmi Lumbung Kopi dan Roti
        </p>
      </div>
    </div>
  );
}
