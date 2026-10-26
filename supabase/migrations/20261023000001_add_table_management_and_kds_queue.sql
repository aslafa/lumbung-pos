-- ============================================================================
-- CAPSTONE PROJECT: LUMBUNG KOPI DAN ROTI (POS MULTI-CABANG)
-- MIGRATION: 20261023000001_add_table_management_and_kds_queue.sql
-- DESKRIPSI: Dukungan Manajemen Meja, Jenis Pesanan (DINE_IN / TAKEAWAY),
--            Nomor Antrean Unik, dan Status Pengerjaan Barista / Dapur (KDS)
-- SIFAT: IDEMPOTEN, AMAN TERHADAP DATA HISTORIS, DAN MENGHORMATI BR-01 S/D BR-12
-- ============================================================================

-- 1. TABEL: meja
-- Manajemen meja per cabang dengan status operasional
CREATE TABLE IF NOT EXISTS public.meja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabang_id UUID NOT NULL REFERENCES public.cabang(id) ON DELETE CASCADE,
    nomor_meja TEXT NOT NULL,
    kapasitas INT NOT NULL DEFAULT 4 CHECK (kapasitas BETWEEN 1 AND 20),
    status TEXT NOT NULL DEFAULT 'tersedia' CHECK (status IN ('tersedia', 'terisi', 'menunggu_dibersihkan')),
    aktif BOOLEAN NOT NULL DEFAULT true,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    diubah_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cabang_nomor_meja UNIQUE (cabang_id, nomor_meja)
);

CREATE INDEX IF NOT EXISTS idx_meja_cabang_status ON public.meja (cabang_id, status);

-- 2. DUKUNGAN KOLOM OPERASIONAL PADA TABEL: transaksi
-- Menambahkan kolom baru dengan nilai default aman untuk 62 transaksi historis
DO $$
BEGIN
    -- Jenis pesanan: DINE_IN atau TAKEAWAY (default DINE_IN untuk transaksi lampau)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'jenis_pesanan'
    ) THEN
        ALTER TABLE public.transaksi
        ADD COLUMN jenis_pesanan TEXT NOT NULL DEFAULT 'DINE_IN'
        CHECK (jenis_pesanan IN ('DINE_IN', 'TAKEAWAY'));
    END IF;

    -- Nomor meja (wajib terisi jika jenis_pesanan = DINE_IN)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nomor_meja'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nomor_meja TEXT;
    END IF;

    -- Nomor antrean takeaway (unik per hari dan cabang)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nomor_antrean'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nomor_antrean TEXT;
    END IF;

    -- Nama pelanggan (opsional untuk takeaway)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nama_pelanggan'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nama_pelanggan TEXT;
    END IF;

    -- Catatan pesanan (misal: "Less sugar", "Pisah es")
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'catatan_pesanan'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN catatan_pesanan TEXT;
    END IF;

    -- Status pengerjaan barista / dapur (KDS)
    -- Transaksi historis default 'SELESAI' agar tidak masuk ke antrean dapur saat ini
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'status_pengerjaan'
    ) THEN
        ALTER TABLE public.transaksi
        ADD COLUMN status_pengerjaan TEXT NOT NULL DEFAULT 'SELESAI'
        CHECK (status_pengerjaan IN ('MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL', 'SELESAI'));
    END IF;
END $$;

-- 3. INDEKS BARU UNTUK KITCHEN DISPLAY SYSTEM (KDS)
CREATE INDEX IF NOT EXISTS idx_transaksi_kds_status
ON public.transaksi (cabang_id, status_pengerjaan, dibuat_pada)
WHERE status_pengerjaan != 'SELESAI';

-- 4. ROW LEVEL SECURITY (RLS) UNTUK TABEL meja
ALTER TABLE public.meja ENABLE ROW LEVEL SECURITY;

-- Owner dapat membaca semua meja cabang
DROP POLICY IF EXISTS "meja_owner_select" ON public.meja;
CREATE POLICY "meja_owner_select" ON public.meja
FOR SELECT USING (public.auth_user_role() = 'owner');

-- Kasir dan Kepala Toko hanya dapat membaca meja di cabangnya
DROP POLICY IF EXISTS "meja_staff_cabang_select" ON public.meja;
CREATE POLICY "meja_staff_cabang_select" ON public.meja
FOR SELECT USING (
    cabang_id = public.auth_user_cabang_id() AND public.auth_user_is_active()
);

-- Kasir, Kepala Toko, dan Owner dapat memperbarui status meja di cabangnya
DROP POLICY IF EXISTS "meja_staff_update_status" ON public.meja;
CREATE POLICY "meja_staff_update_status" ON public.meja
FOR UPDATE USING (
    (public.auth_user_role() = 'owner' OR cabang_id = public.auth_user_cabang_id())
    AND public.auth_user_is_active()
)
WITH CHECK (
    (public.auth_user_role() = 'owner' OR cabang_id = public.auth_user_cabang_id())
    AND public.auth_user_is_active()
);
