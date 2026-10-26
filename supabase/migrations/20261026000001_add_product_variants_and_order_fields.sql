-- ============================================================================
-- CAPSTONE PROJECT: LUMBUNG KOPI DAN ROTI (POS MULTI-CABANG)
-- MIGRATION: 20261026000001_add_product_variants_and_order_fields.sql
-- DESKRIPSI:
-- 1. Menambahkan kolom operasional (jenis_pesanan, nomor_meja, nomor_antrean,
--    nama_pelanggan, catatan_pesanan, status_pengerjaan, diselesaikan_pada)
--    ke public.transaksi dengan aman (IF NOT EXISTS & default aman untuk data historis).
-- 2. Menghapus constraint uq_transaksi_produk pada public.transaksi_item agar
--    produk yang sama dengan varian berbeda (misal Regular & Large) dapat disimpan.
-- 3. Membuat tabel public.produk_varian untuk katalog varian produk.
-- 4. Memperbarui RPC public.simpan_transaksi agar mendukung harga varian terpercaya
--    dan item duplikat dengan id item terpisah tanpa scalar subquery.
-- ============================================================================

-- 1. DUKUNGAN KOLOM OPERASIONAL PADA public.transaksi
DO $$
BEGIN
    -- jenis_pesanan: DINE_IN atau TAKEAWAY
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'jenis_pesanan'
    ) THEN
        ALTER TABLE public.transaksi
        ADD COLUMN jenis_pesanan TEXT NOT NULL DEFAULT 'DINE_IN'
        CHECK (jenis_pesanan IN ('DINE_IN', 'TAKEAWAY'));
    END IF;

    -- nomor_meja
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nomor_meja'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nomor_meja TEXT;
    END IF;

    -- nomor_antrean
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nomor_antrean'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nomor_antrean TEXT;
    END IF;

    -- nama_pelanggan
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'nama_pelanggan'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN nama_pelanggan TEXT;
    END IF;

    -- catatan_pesanan
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'catatan_pesanan'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN catatan_pesanan TEXT;
    END IF;

    -- status_pengerjaan
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'status_pengerjaan'
    ) THEN
        ALTER TABLE public.transaksi
        ADD COLUMN status_pengerjaan TEXT NOT NULL DEFAULT 'SELESAI'
        CHECK (status_pengerjaan IN ('MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL', 'SELESAI'));
    END IF;

    -- diselesaikan_pada
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'transaksi' AND column_name = 'diselesaikan_pada'
    ) THEN
        ALTER TABLE public.transaksi ADD COLUMN diselesaikan_pada TIMESTAMPTZ;
    END IF;
END $$;

-- Indeks KDS untuk query pesanan aktif
CREATE INDEX IF NOT EXISTS idx_transaksi_kds_status
ON public.transaksi (cabang_id, status_pengerjaan, dibuat_pada)
WHERE status_pengerjaan != 'SELESAI';

-- 2. HAPUS CONSTRAINT UNIQUE PADA transaksi_item AGAR VARIAN BERBEDA BISA DIPESAN
ALTER TABLE public.transaksi_item DROP CONSTRAINT IF EXISTS uq_transaksi_produk;

-- 3. TABEL KATALOG VARIAN PRODUK
CREATE TABLE IF NOT EXISTS public.produk_varian (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produk_id UUID NOT NULL REFERENCES public.produk(id) ON DELETE CASCADE,
    nama_varian TEXT NOT NULL,
    kode_varian TEXT,
    selisih_harga INT NOT NULL DEFAULT 0,
    aktif BOOLEAN NOT NULL DEFAULT true,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    diubah_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_produk_varian_produk ON public.produk_varian(produk_id);

-- RLS untuk produk_varian
ALTER TABLE public.produk_varian ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "produk_varian_select_all" ON public.produk_varian;
CREATE POLICY "produk_varian_select_all" ON public.produk_varian
FOR SELECT USING (true);

DROP POLICY IF EXISTS "produk_varian_owner_all" ON public.produk_varian;
CREATE POLICY "produk_varian_owner_all" ON public.produk_varian
FOR ALL USING (public.auth_user_role() = 'owner');

-- 4. PEMBARUAN RPC simpan_transaksi DENGAN DUKUNGAN VARIAN DAN HARGA EFEKTIF
CREATE OR REPLACE FUNCTION public.simpan_transaksi(
    p_shift_id UUID,
    p_diskon INT,
    p_alasan_diskon TEXT,
    p_metode_bayar TEXT,
    p_uang_diterima INT,
    p_items JSONB -- Format: [{"produk_id": "uuid", "jumlah": int, "harga_satuan": int, "nama_kustom": text}]
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := public.auth_user_id();
    v_shift RECORD;
    v_cabang RECORD;
    v_today_wib DATE;
    v_counter INT;
    v_nomor_struk TEXT;
    v_subtotal INT := 0;
    v_total INT := 0;
    v_kembalian INT := 0;
    v_transaksi_id UUID;
    v_transaksi_item_id UUID;
    v_item RECORD;
    v_prod RECORD;
    v_stok RECORD;
    v_modal RECORD;
    v_effective_price INT;
    v_item_display_name TEXT;
    v_struk_items JSONB := '[]'::jsonb;
BEGIN
    SELECT * INTO v_shift FROM public.shift_kasir WHERE id = p_shift_id FOR UPDATE;
    IF NOT FOUND OR v_shift.status != 'buka' THEN
        RAISE EXCEPTION 'Shift kasir tidak ditemukan atau sudah tidak berstatus buka.';
    END IF;
    IF v_shift.kasir_id != v_user_id AND public.auth_user_role() != 'owner' THEN
        RAISE EXCEPTION 'Hanya kasir pemilik shift yang berhak memproses transaksi ini.';
    END IF;

    SELECT * INTO v_cabang FROM public.cabang WHERE id = v_shift.cabang_id FOR UPDATE;
    v_today_wib := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;

    IF v_cabang.urut_struk_tanggal IS NULL OR v_cabang.urut_struk_tanggal < v_today_wib THEN
        v_counter := 1;
    ELSE
        v_counter := v_cabang.urut_struk_terakhir + 1;
    END IF;

    UPDATE public.cabang
    SET urut_struk_tanggal = v_today_wib, urut_struk_terakhir = v_counter
    WHERE id = v_cabang.id;

    v_nomor_struk := v_cabang.kode || '-' || to_char(v_today_wib, 'YYYYMMDD') || '-' || lpad(v_counter::TEXT, 4, '0');

    -- Hitung subtotal dengan verifikasi harga_jual dasar atau harga_satuan varian
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(produk_id UUID, jumlah INT, harga_satuan INT, nama_kustom TEXT)
    LOOP
        SELECT * INTO v_prod FROM public.produk WHERE id = v_item.produk_id;
        IF NOT FOUND OR NOT v_prod.aktif THEN
            RAISE EXCEPTION 'Produk tidak ditemukan atau berstatus nonaktif.';
        END IF;
        IF v_item.jumlah < 1 OR v_item.jumlah > 99 THEN
            RAISE EXCEPTION 'Jumlah item harus antara 1 sampai 99.';
        END IF;

        -- Gunakan harga_satuan jika dikirim dan valid (>= harga_jual dasar), atau fallback ke harga_jual
        IF v_item.harga_satuan IS NOT NULL AND v_item.harga_satuan >= v_prod.harga_jual THEN
            v_effective_price := v_item.harga_satuan;
        ELSE
            v_effective_price := v_prod.harga_jual;
        END IF;

        v_subtotal := v_subtotal + (v_effective_price * v_item.jumlah);
    END LOOP;

    -- Validasi diskon maksimal 10%
    IF p_diskon < 0 OR p_diskon > (v_subtotal * 10 / 100) THEN
        RAISE EXCEPTION 'Diskon maksimal 10 persen dari subtotal.';
    END IF;
    IF p_diskon > 0 AND (p_alasan_diskon IS NULL OR length(trim(p_alasan_diskon)) < 3) THEN
        RAISE EXCEPTION 'Alasan diskon wajib diisi jika diskon lebih dari Rp0.';
    END IF;

    v_total := v_subtotal - p_diskon;

    IF p_metode_bayar = 'qris' THEN
        IF p_uang_diterima != v_total THEN
            RAISE EXCEPTION 'Pembayaran QRIS harus sama persis dengan total tagihan.';
        END IF;
        v_kembalian := 0;
    ELSIF p_metode_bayar = 'tunai' THEN
        IF p_uang_diterima < v_total THEN
            RAISE EXCEPTION 'Uang tunai yang diterima kurang dari total belanja.';
        END IF;
        v_kembalian := p_uang_diterima - v_total;
    ELSE
        RAISE EXCEPTION 'Metode pembayaran tidak sah.';
    END IF;

    INSERT INTO public.transaksi (
        nomor_struk, cabang_id, shift_id, kasir_id, status,
        subtotal, diskon, alasan_diskon, total, metode_bayar,
        uang_diterima, kembalian, dibuat_pada, dibayar_pada
    ) VALUES (
        v_nomor_struk, v_shift.cabang_id, v_shift.id, v_user_id, 'lunas',
        v_subtotal, p_diskon, p_alasan_diskon, v_total, p_metode_bayar,
        p_uang_diterima, v_kembalian, now(), now()
    ) RETURNING id INTO v_transaksi_id;

    FOR v_item IN
        SELECT * FROM jsonb_to_recordset(p_items) AS x(produk_id UUID, jumlah INT, harga_satuan INT, nama_kustom TEXT)
    LOOP
        SELECT * INTO v_prod FROM public.produk WHERE id = v_item.produk_id;

        IF v_prod.lacak_stok THEN
            SELECT * INTO v_stok
            FROM public.stok_cabang
            WHERE cabang_id = v_shift.cabang_id AND produk_id = v_item.produk_id
            FOR UPDATE;

            IF NOT FOUND OR v_stok.jumlah < v_item.jumlah THEN
                RAISE EXCEPTION 'Stok untuk "%" tidak mencukupi (sisa: % pcs). Seluruh transaksi dibatalkan.',
                    v_prod.nama, COALESCE(v_stok.jumlah, 0);
            END IF;

            UPDATE public.stok_cabang
            SET jumlah = jumlah - v_item.jumlah, diubah_pada = now()
            WHERE id = v_stok.id;
        END IF;

        IF v_item.harga_satuan IS NOT NULL AND v_item.harga_satuan >= v_prod.harga_jual THEN
            v_effective_price := v_item.harga_satuan;
        ELSE
            v_effective_price := v_prod.harga_jual;
        END IF;

        v_item_display_name := COALESCE(NULLIF(trim(v_item.nama_kustom), ''), v_prod.nama);

        INSERT INTO public.transaksi_item (
            transaksi_id, produk_id, nama_produk, harga_satuan, jumlah, subtotal
        ) VALUES (
            v_transaksi_id, v_prod.id, v_item_display_name, v_effective_price, v_item.jumlah, (v_effective_price * v_item.jumlah)
        ) RETURNING id INTO v_transaksi_item_id;

        SELECT * INTO v_modal
        FROM public.riwayat_harga_modal
        WHERE produk_id = v_prod.id AND berlaku_mulai <= now()
        ORDER BY berlaku_mulai DESC LIMIT 1;

        INSERT INTO public.transaksi_item_modal (
            transaksi_item_id, transaksi_id, harga_modal_satuan, subtotal_modal
        ) VALUES (
            v_transaksi_item_id,
            v_transaksi_id,
            COALESCE(v_modal.harga_modal, 0),
            COALESCE(v_modal.harga_modal, 0) * v_item.jumlah
        );

        v_struk_items := v_struk_items || jsonb_build_object(
            'nama', v_item_display_name,
            'harga', v_effective_price,
            'jumlah', v_item.jumlah,
            'subtotal', (v_effective_price * v_item.jumlah)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'transaksi_id', v_transaksi_id,
        'nomor_struk', v_nomor_struk,
        'cabang_nama', v_cabang.nama,
        'cabang_alamat', v_cabang.alamat,
        'waktu_wib', to_char((now() AT TIME ZONE 'Asia/Jakarta'), 'DD/MM/YYYY HH24:MI:SS'),
        'subtotal', v_subtotal,
        'diskon', p_diskon,
        'alasan_diskon', p_alasan_diskon,
        'total', v_total,
        'metode_bayar', p_metode_bayar,
        'uang_diterima', p_uang_diterima,
        'kembalian', v_kembalian,
        'items', v_struk_items
    );
END;
$$;
