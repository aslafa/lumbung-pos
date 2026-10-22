import { NextResponse, type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Lewati static assets dan Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const { supabaseResponse, user, supabase } = await updateSession(request);

  const isLoginPage = pathname === '/login';
  const isNonaktifPage = pathname === '/nonaktif';

  // 1. Jika belum login
  if (!user) {
    if (!isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // 2. Jika sudah login, ambil profile dari tabel profiles
  if (!supabase) {
    return supabaseResponse;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('peran, aktif, cabang_id')
    .eq('id', user.id)
    .single();

  // Jika profile ditemukan tapi nonaktif (BR-01)
  if (profile && !profile.aktif) {
    if (!isNonaktifPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/nonaktif';
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Jika user aktif tapi berada di halaman /nonaktif, arahkan keluar
  if (isNonaktifPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  const role = profile?.peran;

  // 3. Jika sudah login dan mengakses /login atau root /
  if (isLoginPage || pathname === '/') {
    const url = request.nextUrl.clone();
    if (role === 'kasir') {
      url.pathname = '/kasir';
    } else if (role === 'kepala_toko') {
      url.pathname = '/transaksi';
    } else if (role === 'owner') {
      url.pathname = '/laporan';
    } else {
      url.pathname = '/kasir';
    }
    return NextResponse.redirect(url);
  }

  // 4. Role Guard Matriks Akses Sesuai PRD
  if (role === 'kasir') {
    // Kasir hanya boleh: /kasir, /shift-saya, /transaksi
    const allowed = ['/kasir', '/shift-saya', '/transaksi'];
    const isAllowed = allowed.some((p) => pathname.startsWith(p));
    if (!isAllowed) {
      const url = request.nextUrl.clone();
      url.pathname = '/kasir';
      return NextResponse.redirect(url);
    }
  } else if (role === 'kepala_toko') {
    // Kepala Toko boleh: /transaksi, /stok, /shift-cabang, /produk, /laporan
    // Kepala Toko TIDAK BOLEH: /kasir, /shift-saya, /pengaturan
    const forbidden = ['/kasir', '/shift-saya', '/pengaturan'];
    const isForbidden = forbidden.some((p) => pathname.startsWith(p));
    if (isForbidden) {
      const url = request.nextUrl.clone();
      url.pathname = '/transaksi';
      return NextResponse.redirect(url);
    }
  } else if (role === 'owner') {
    // Owner memiliki akses ke semua halaman
    return supabaseResponse;
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
