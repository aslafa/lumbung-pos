-- ============================================================================
-- CAPSTONE PROJECT: LUMBUNG KOPI DAN ROTI (POS MULTI-CABANG)
-- MIGRATION: 20261024000001_create_meja_and_areas.sql
-- DESKRIPSI: Penyempurnaan Denah Meja, Kapasitas & Bentuk Fisik Meja,
--            Area (Indoor, Outdoor, Teras), Antrean KDS & Pelacakan Pesanan
-- SIFAT: IDEMPOTEN, AMAN TERHADAP DATA HISTORIS, DAN MEMATUHI PRD BR-01 S/D BR-12
-- ============================================================================

-- 1. TABEL: meja
CREATE TABLE IF NOT EXISTS public.meja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabang_id UUID NOT NULL REFERENCES public.cabang(id) ON DELETE CASCADE,
    nomor_meja TEXT NOT NULL,
    kapasitas INT NOT NULL DEFAULT 4 CHECK (kapasitas BETWEEN 1 AND 20),
    area TEXT NOT NULL DEFAULT 'Indoor' CHECK (area IN ('Indoor', 'Outdoor', 'Teras')),
    bentuk TEXT NOT NULL DEFAULT 'persegi' CHECK (bentuk IN ('lingkaran', 'persegi', 'persegi_panjang')),
    posisi_x INT NOT NULL DEFAULT 0,
    posisi_y INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'tersedia' CHECK (status IN ('tersedia', 'terisi', 'menunggu_dibersihkan')),
    aktif BOOLEAN NOT NULL DEFAULT true,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    diubah_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cabang_nomor_meja UNIQUE (cabang_id, nomor_meja)
);

CREATE INDEX IF NOT EXISTS idx_meja_cabang_status ON public.meja (cabang_id, status);
CREATE INDEX IF NOT EXISTS idx_meja_cabang_area ON public.meja (cabang_id, area);

-- 2. DUKUNGAN KOLOM OPERASIONAL PADA TABEL: transaksi
DO $$
BEGIN
    -- Jenis pesanan: DINE_IN atau TAKEAWAY (default aman DINE_IN untuk 62 transaksi historis)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'jenis_pesanan'
    ) THEN
        ALTER TABLE public.transaksi
        ADD COLUMN jenis_pesanan TEXT NOT NULL DEFAULT 'DINE_IN'
        CHECK (jenis_pesanan IN ('DINE_IN', 'TAKEAWAY'));
    END IF;

    -- Nomor meja (opsional jika takeaway, terisi jika dine in)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nomor_meja'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nomor_meja TEXT;
    END IF;

    -- Nomor antrean (unik per hari & per cabang)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nomor_antrean'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nomor_antrean TEXT;
    END IF;

    -- Nama pelanggan (opsional)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nama_pelanggan'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nama_pelanggan TEXT;
    END IF;

    -- Catatan pesanan khusus
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'catatan_pesanan'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN catatan_pesanan TEXT;
    END IF;

    -- Status pengerjaan barista / dapur (KDS)
    -- Transaksi historis default 'SELESAI' agar tidak mengotori antrean aktif hari ini
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'status_pengerjaan'
    ) THEN
        ALTER TABLE public.transaksi
        ADD COLUMN status_pengerjaan TEXT NOT NULL DEFAULT 'SELESAI'
        CHECK (status_pengerjaan IN ('MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL', 'SELESAI'));
    END IF;
END $$;

-- 3. INDEKS BARU KITCHEN DISPLAY SYSTEM (KDS)
CREATE INDEX IF NOT EXISTS idx_transaksi_kds_status
ON public.transaksi (cabang_id, status_pengerjaan, dibuat_pada)
WHERE status_pengerjaan != 'SELESAI';

-- 4. ROW LEVEL SECURITY (RLS) UNTUK TABEL: meja
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

-- Owner dapat menambah dan mengubah konfigurasi meja
DROP POLICY IF EXISTS "meja_owner_insert" ON public.meja;
CREATE POLICY "meja_owner_insert" ON public.meja
FOR INSERT WITH CHECK (public.auth_user_role() = 'owner');

DROP POLICY IF EXISTS "meja_owner_delete" ON public.meja;
CREATE POLICY "meja_owner_delete" ON public.meja
FOR DELETE USING (public.auth_user_role() = 'owner');

-- 5. SEED DATA DEFAULT MEJA UNTUK CABANG (12 MEJA PER CABANG DENGAN BENTUK & AREA)
-- Tebet (TBT), Bintaro (BTR), Depok (DPK)
DO $$
DECLARE
    v_cabang RECORD;
BEGIN
    FOR v_cabang IN SELECT id, kode FROM public.cabang LOOP
        -- M-01 s/d M-02: 2 Orang (Lingkaran, Indoor)
        INSERT INTO public.meja (cabang_id, nomor_meja, kapasitas, area, bentuk, status, aktif)
        VALUES
            (v_cabang.id, 'M-01', 2, 'Indoor', 'lingkaran', 'tersedia', true),
            (v_cabang.id, 'M-02', 2, 'Indoor', 'lingkaran', 'tersedia', true)
        ON CONFLICT (cabang_id, nomor_meja) DO UPDATE
        SET kapasitas = EXCLUDED.kapasitas, area = EXCLUDED.area, bentuk = EXCLUDED.bentuk;

        -- M-03 s/d M-05: 4 Orang (Persegi, Indoor)
        INSERT INTO public.meja (cabang_id, nomor_meja, kapasitas, area, bentuk, status, aktif)
        VALUES
            (v_cabang.id, 'M-03', 4, 'Indoor', 'persegi', 'tersedia', true),
            (v_cabang.id, 'M-04', 4, 'Indoor', 'persegi', 'tersedia', true),
            (v_cabang.id, 'M-05', 4, 'Indoor', 'persegi', 'tersedia', true)
        ON CONFLICT (cabang_id, nomor_meja) DO UPDATE
        SET kapasitas = EXCLUDED.kapasitas, area = EXCLUDED.area, bentuk = EXCLUDED.bentuk;

        -- M-06: 6 Orang (Persegi Panjang, Indoor)
        INSERT INTO public.meja (cabang_id, nomor_meja, kapasitas, area, bentuk, status, aktif)
        VALUES (v_cabang.id, 'M-06', 6, 'Indoor', 'persegi_panjang', 'tersedia', true)
        ON CONFLICT (cabang_id, nomor_meja) DO UPDATE
        SET kapasitas = EXCLUDED.kapasitas, area = EXCLUDED.area, bentuk = EXCLUDED.bentuk;

        -- M-07: 2 Orang (Lingkaran, Outdoor)
        INSERT INTO public.meja (cabang_id, nomor_meja, kapasitas, area, bentuk, status, aktif)
        VALUES (v_cabang.id, 'M-07', 2, 'Outdoor', 'lingkaran', 'tersedia', true)
        ON CONFLICT (cabang_id, nomor_meja) DO UPDATE
        SET kapasitas = EXCLUDED.kapasitas, area = EXCLUDED.area, bentuk = EXCLUDED.bentuk;

        -- M-08 s/d M-09: 4 Orang (Persegi, Outdoor)
        INSERT INTO public.meja (cabang_id, nomor_meja, kapasitas, area, bentuk, status, aktif)
        VALUES
            (v_cabang.id, 'M-08', 4, 'Outdoor', 'persegi', 'tersedia', true),
            (v_cabang.id, 'M-09', 4, 'Outdoor', 'persegi', 'tersedia', true)
        ON CONFLICT (cabang_id, nomor_meja) DO UPDATE
        SET kapasitas = EXCLUDED.kapasitas, area = EXCLUDED.area, bentuk = EXCLUDED.bentuk;

        -- M-10: 6 Orang (Persegi Panjang, Outdoor)
        INSERT INTO public.meja (cabang_id, nomor_meja, kapasitas, area, bentuk, status, aktif)
        VALUES (v_cabang.id, 'M-10', 6, 'Outdoor', 'persegi_panjang', 'tersedia', true)
        ON CONFLICT (cabang_id, nomor_meja) DO UPDATE
        SET kapasitas = EXCLUDED.kapasitas, area = EXCLUDED.area, bentuk = EXCLUDED.bentuk;

        -- M-11: 4 Orang (Persegi, Teras)
        INSERT INTO public.meja (cabang_id, nomor_meja, kapasitas, area, bentuk, status, aktif)
        VALUES (v_cabang.id, 'M-11', 4, 'Teras', 'persegi', 'tersedia', true)
        ON CONFLICT (cabang_id, nomor_meja) DO UPDATE
        SET kapasitas = EXCLUDED.kapasitas, area = EXCLUDED.area, bentuk = EXCLUDED.bentuk;

        -- M-12: 8 Orang (Persegi Panjang Besar, Teras)
        INSERT INTO public.meja (cabang_id, nomor_meja, kapasitas, area, bentuk, status, aktif)
        VALUES (v_cabang.id, 'M-12', 8, 'Teras', 'persegi_panjang', 'tersedia', true)
        ON CONFLICT (cabang_id, nomor_meja) DO UPDATE
        SET kapasitas = EXCLUDED.kapasitas, area = EXCLUDED.area, bentuk = EXCLUDED.bentuk;
    END LOOP;
END $$;
