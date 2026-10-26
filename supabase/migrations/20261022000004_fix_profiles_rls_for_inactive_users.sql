-- ============================================================================
-- CAPSTONE PROJECT: LUMBUNG KOPI DAN ROTI (POS MULTI-CABANG)
-- MIGRATION: 20261022000004_fix_profiles_rls_for_inactive_users.sql
-- DESKRIPSI: Memperbaiki policy RLS profiles_select_policy agar setiap pengguna
--            terautentikasi dapat membaca profil miliknya sendiri (id = auth.uid())
--            meskipun status akunnya aktif = false.
-- ============================================================================

-- Masalah RLS Sebelumnya:
-- Policy profiles_select_policy menggunakan `public.auth_user_is_active() AND (...)`.
-- Karena fungsi auth_user_is_active() mengembalikan FALSE jika aktif = false,
-- maka pengguna nonaktif tidak dapat membaca baris profil miliknya sendiri (0 rows),
-- sehingga aplikasi keliru menganggap profil tidak ditemukan.

-- Solusi Policy yang Benar:
-- 1. Pengguna selalu diizinkan membaca profil miliknya sendiri (id = auth.uid()).
-- 2. Untuk membaca profil staf lain, pengguna harus aktif AND (Owner atau satu cabang).

DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;

CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        id = auth.uid() OR (
            public.auth_user_is_active() AND (
                public.auth_user_role() = 'owner' OR
                cabang_id = public.auth_user_cabang_id()
            )
        )
    );
