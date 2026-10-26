-- ============================================================================
-- CAPSTONE PROJECT: LUMBUNG KOPI DAN ROTI (POS MULTI-CABANG)
-- MIGRATION: 20261026000002_add_transaksi_order_and_table_columns.sql
-- DESKRIPSI:
-- Usulan migration baru untuk melengkapi skema tabel public.transaksi dengan
-- kolom identitas operasional (jenis_pesanan, nomor_meja, nomor_antrean,
-- nama_pelanggan, catatan_pesanan, status_pengerjaan, diselesaikan_pada).
-- Menggunakan blok DO $$ IF NOT EXISTS untuk menjamin idempotensi tanpa
-- menghapus data historis maupun mengubah migration lama yang sudah ada.
-- ============================================================================

DO $$
BEGIN
    -- 1. Kolom jenis_pesanan (DINE_IN / TAKEAWAY)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'jenis_pesanan'
    ) THEN
        ALTER TABLE public.transaksi
        ADD COLUMN jenis_pesanan TEXT NOT NULL DEFAULT 'DINE_IN'
        CHECK (jenis_pesanan IN ('DINE_IN', 'TAKEAWAY'));
        COMMENT ON COLUMN public.transaksi.jenis_pesanan IS 'Tipe pesanan: DINE_IN (makan di tempat) atau TAKEAWAY (bungkus bawa pulang)';
    END IF;

    -- 2. Kolom nomor_meja (Khusus DINE_IN)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nomor_meja'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nomor_meja TEXT;
        COMMENT ON COLUMN public.transaksi.nomor_meja IS 'Identitas nomor meja untuk pesanan Dine In (misal: 07, M-07)';
    END IF;

    -- 3. Kolom nomor_antrean
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nomor_antrean'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nomor_antrean TEXT;
        COMMENT ON COLUMN public.transaksi.nomor_antrean IS 'Nomor tiket antrean harian pelanggan (misal: A-001, B-002)';
    END IF;

    -- 4. Kolom nama_pelanggan
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nama_pelanggan'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nama_pelanggan TEXT;
        COMMENT ON COLUMN public.transaksi.nama_pelanggan IS 'Nama pelanggan pemesan (default: Pelanggan Umum jika dikosongkan)';
    END IF;

    -- 5. Kolom catatan_pesanan
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'catatan_pesanan'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN catatan_pesanan TEXT;
        COMMENT ON COLUMN public.transaksi.catatan_pesanan IS 'Catatan instruksi racikan barista / dapur';
    END IF;

    -- 6. Kolom status_pengerjaan KDS
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'status_pengerjaan'
    ) THEN
        ALTER TABLE public.transaksi
        ADD COLUMN status_pengerjaan TEXT NOT NULL DEFAULT 'SELESAI'
        CHECK (status_pengerjaan IN ('MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL', 'SELESAI'));
        COMMENT ON COLUMN public.transaksi.status_pengerjaan IS 'Status alur peracikan pesanan di Kitchen Display System';
    END IF;

    -- 7. Kolom diselesaikan_pada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'diselesaikan_pada'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN diselesaikan_pada TIMESTAMPTZ;
        COMMENT ON COLUMN public.transaksi.diselesaikan_pada IS 'Waktu pesanan diserahkan dan selesai';
    END IF;
END $$;

-- Indeks performa KDS untuk pencarian pesanan aktif di cabang
CREATE INDEX IF NOT EXISTS idx_transaksi_kds_aktif
ON public.transaksi (cabang_id, status_pengerjaan, dibuat_pada)
WHERE status_pengerjaan != 'SELESAI';
