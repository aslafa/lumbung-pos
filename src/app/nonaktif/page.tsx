import { logoutAction } from '@/app/auth/actions';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function NonaktifPage() {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center px-4 bg-[#FAF7F2]">
      <div className="w-full max-w-md bg-white border border-red-200 rounded-2xl shadow-xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="w-9 h-9" />
        </div>

        <h1 className="text-xl font-bold text-[#2C1810]">Akun Dinonaktifkan</h1>
        <p className="text-sm text-[#78716C] mt-2 mb-6 leading-relaxed">
          Akun Anda saat ini berstatus <span className="font-semibold text-red-600">nonaktif</span>. Akun nonaktif tidak diizinkan membuka data apa pun di dalam sistem.
        </p>

        <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#E8DFD3] text-xs text-[#78716C] text-left mb-6 space-y-1">
          <p className="font-medium text-[#4A2E18]">Langkah aktivasi:</p>
          <p>1. Hubungi Owner usaha atau manajer cabang Anda.</p>
          <p>2. Minta pembaruan status akun melalui menu Pengaturan Staf.</p>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full py-2.5 px-4 bg-[#4A2E18] hover:bg-[#382312] text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span>Kembali ke Halaman Masuk</span>
          </button>
        </form>
      </div>
    </div>
  );
}
