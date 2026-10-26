-- ============================================================================
-- CAPSTONE PROJECT: LUMBUNG KOPI DAN ROTI (POS MULTI-CABANG)
-- MIGRATION: 20261022000001_create_pos_schema_and_policies.sql
-- DESKRIPSI: Skema 9 tabel inti, relasi, constraint, indeks, trigger, RLS, & RPC
-- ============================================================================

-- 0. EKSTENSI POSTGRESQL
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. TABEL: cabang
-- Data cabang toko dan penghitung nomor struk harian (BR-04)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.cabang (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kode TEXT NOT NULL UNIQUE CHECK (kode ~ '^[A-Z]{3}$'),
    nama TEXT NOT NULL,
    alamat TEXT,
    aktif BOOLEAN NOT NULL DEFAULT true,
    urut_struk_tanggal DATE,
    urut_struk_terakhir INT NOT NULL DEFAULT 0 CHECK (urut_struk_terakhir >= 0)
);

-- ============================================================================
-- 2. TABEL: profiles
-- Profil setiap akun. Terhubung 1-to-1 dengan auth.users milik Supabase Auth
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nama_lengkap TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    peran TEXT NOT NULL CHECK (peran IN ('kasir', 'kepala_toko', 'owner')),
    cabang_id UUID REFERENCES public.cabang(id),
    aktif BOOLEAN NOT NULL DEFAULT false,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Aturan ERD: Kasir & KT wajib terikat cabang, Owner harus NULL
    CONSTRAINT chk_profiles_cabang_peran CHECK (
        (peran = 'owner' AND cabang_id IS NULL) OR
        (peran IN ('kasir', 'kepala_toko') AND cabang_id IS NOT NULL)
    )
);

-- Indeks aturan ERD: Tepat satu kepala toko aktif per cabang
CREATE UNIQUE INDEX IF NOT EXISTS idx_satu_kepala_toko_aktif_per_cabang
ON public.profiles (cabang_id)
WHERE peran = 'kepala_toko' AND aktif = true;

-- ============================================================================
-- 3. FUNGSI PEMBANTU SESSION & ROLE (SECURITY DEFINER)
-- Mencegah rekursi RLS dan mempercepat evaluasi izin di level database
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS UUID STABLE LANGUAGE sql SECURITY DEFINER AS $$
    SELECT auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT STABLE LANGUAGE sql SECURITY DEFINER AS $$
    SELECT peran FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_cabang_id()
RETURNS UUID STABLE LANGUAGE sql SECURITY DEFINER AS $$
    SELECT cabang_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_is_active()
RETURNS BOOLEAN STABLE LANGUAGE sql SECURITY DEFINER AS $$
    SELECT COALESCE((SELECT aktif FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- ============================================================================
-- 4. TABEL: produk
-- Master produk yang dijual di seluruh cabang (BR-05)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.produk (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT NOT NULL UNIQUE,
    nama TEXT NOT NULL,
    kategori TEXT NOT NULL CHECK (kategori IN ('kopi', 'non_kopi', 'roti', 'snack', 'kemasan')),
    harga_jual INT NOT NULL CHECK (harga_jual > 0),
    lacak_stok BOOLEAN NOT NULL DEFAULT true,
    aktif BOOLEAN NOT NULL DEFAULT true,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    diubah_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 5. TABEL: riwayat_harga_modal
-- DATA RAHASIA: Riwayat harga modal per produk, hanya dapat dibaca Owner (BR-11)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.riwayat_harga_modal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produk_id UUID NOT NULL REFERENCES public.produk(id) ON DELETE CASCADE,
    harga_modal INT NOT NULL CHECK (harga_modal >= 0),
    berlaku_mulai TIMESTAMPTZ NOT NULL,
    dibuat_oleh UUID REFERENCES public.profiles(id),
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_produk_berlaku_mulai UNIQUE (produk_id, berlaku_mulai)
);

-- ============================================================================
-- 6. TABEL: stok_cabang
-- Jumlah stok setiap produk yang dilacak di setiap cabang (BR-03)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.stok_cabang (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabang_id UUID NOT NULL REFERENCES public.cabang(id) ON DELETE CASCADE,
    produk_id UUID NOT NULL REFERENCES public.produk(id) ON DELETE CASCADE,
    jumlah INT NOT NULL DEFAULT 0 CHECK (jumlah >= 0),
    stok_minimum INT NOT NULL DEFAULT 0 CHECK (stok_minimum >= 0),
    diubah_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_cabang_produk UNIQUE (cabang_id, produk_id)
);

-- ============================================================================
-- 7. TABEL: shift_kasir
-- Sesi kerja kasir dari buka sampai diverifikasi (BR-02, BR-09, BR-10)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.shift_kasir (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cabang_id UUID NOT NULL REFERENCES public.cabang(id),
    kasir_id UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'buka' CHECK (status IN ('buka', 'ditutup', 'diverifikasi')),
    dibuka_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    kas_awal INT NOT NULL CHECK (kas_awal BETWEEN 0 AND 2000000),
    ditutup_pada TIMESTAMPTZ,
    total_tunai INT NOT NULL DEFAULT 0 CHECK (total_tunai >= 0),
    total_qris INT NOT NULL DEFAULT 0 CHECK (total_qris >= 0),
    kas_seharusnya INT NOT NULL DEFAULT 0,
    uang_fisik INT CHECK (uang_fisik IS NULL OR uang_fisik >= 0),
    selisih INT,
    catatan_tutup TEXT,
    diverifikasi_oleh UUID REFERENCES public.profiles(id),
    diverifikasi_pada TIMESTAMPTZ,
    catatan_verifikasi TEXT,

    -- Konsistensi tutup shift (BR-09)
    CONSTRAINT chk_shift_tutup CHECK (
        (status = 'buka' AND ditutup_pada IS NULL) OR
        (status IN ('ditutup', 'diverifikasi') AND ditutup_pada IS NOT NULL AND uang_fisik IS NOT NULL)
    ),
    -- Selisih kas > Rp20.000 wajib catatan (BR-09)
    CONSTRAINT chk_shift_selisih_catatan CHECK (
        status = 'buka' OR
        abs(COALESCE(selisih, 0)) <= 20000 OR
        (catatan_tutup IS NOT NULL AND length(trim(catatan_tutup)) > 0)
    ),
    -- Verifikasi shift harus lengkap (BR-10)
    CONSTRAINT chk_shift_verifikasi CHECK (
        status != 'diverifikasi' OR
        (diverifikasi_oleh IS NOT NULL AND diverifikasi_pada IS NOT NULL)
    )
);

-- Indeks aturan ERD & BR-02: Satu kasir hanya boleh memiliki satu shift buka
CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_kasir_satu_buka
ON public.shift_kasir (kasir_id)
WHERE status = 'buka';

-- ============================================================================
-- 8. TABEL: transaksi
-- Kepala transaksi penjualan (satu struk) (BR-04, BR-06, BR-07, BR-08)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transaksi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nomor_struk TEXT NOT NULL UNIQUE,
    cabang_id UUID NOT NULL REFERENCES public.cabang(id),
    shift_id UUID NOT NULL REFERENCES public.shift_kasir(id),
    kasir_id UUID NOT NULL REFERENCES public.profiles(id),
    status TEXT NOT NULL DEFAULT 'lunas' CHECK (status IN ('lunas', 'void', 'menunggu_bayar', 'batal')),
    subtotal INT NOT NULL CHECK (subtotal > 0),
    diskon INT NOT NULL DEFAULT 0 CHECK (diskon >= 0),
    alasan_diskon TEXT,
    total INT NOT NULL CHECK (total > 0),
    metode_bayar TEXT NOT NULL CHECK (metode_bayar IN ('tunai', 'qris')),
    uang_diterima INT NOT NULL CHECK (uang_diterima > 0),
    kembalian INT NOT NULL DEFAULT 0 CHECK (kembalian >= 0),
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now(),
    dibayar_pada TIMESTAMPTZ,
    void_oleh UUID REFERENCES public.profiles(id),
    void_pada TIMESTAMPTZ,
    alasan_void TEXT,
    mayar_invoice_id TEXT UNIQUE,

    CONSTRAINT chk_transaksi_total CHECK (total = subtotal - diskon),
    CONSTRAINT chk_transaksi_batas_diskon CHECK (diskon <= (subtotal * 10 / 100)),
    CONSTRAINT chk_transaksi_alasan_diskon CHECK (
        diskon = 0 OR (alasan_diskon IS NOT NULL AND length(trim(alasan_diskon)) > 0)
    ),
    CONSTRAINT chk_transaksi_kembalian CHECK (kembalian = uang_diterima - total),
    CONSTRAINT chk_transaksi_metode_bayar CHECK (
        (metode_bayar = 'qris' AND uang_diterima = total) OR
        (metode_bayar = 'tunai' AND uang_diterima >= total)
    ),
    CONSTRAINT chk_transaksi_void CHECK (
        status != 'void' OR
        (void_oleh IS NOT NULL AND void_pada IS NOT NULL AND alasan_void IS NOT NULL AND length(trim(alasan_void)) >= 10)
    )
);

CREATE INDEX IF NOT EXISTS idx_transaksi_cabang_tanggal ON public.transaksi (cabang_id, dibuat_pada);
CREATE INDEX IF NOT EXISTS idx_transaksi_shift ON public.transaksi (shift_id);

-- ============================================================================
-- 9. TABEL: transaksi_item
-- Baris produk dalam transaksi. Nama & harga disalin agar riwayat tidak berubah (BR-05)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transaksi_item (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaksi_id UUID NOT NULL REFERENCES public.transaksi(id) ON DELETE CASCADE,
    produk_id UUID NOT NULL REFERENCES public.produk(id),
    nama_produk TEXT NOT NULL,
    harga_satuan INT NOT NULL CHECK (harga_satuan > 0),
    jumlah INT NOT NULL CHECK (jumlah BETWEEN 1 AND 99),
    subtotal INT NOT NULL CHECK (subtotal = harga_satuan * jumlah),
    CONSTRAINT uq_transaksi_produk UNIQUE (transaksi_id, produk_id)
);

CREATE INDEX IF NOT EXISTS idx_transaksi_item_transaksi ON public.transaksi_item (transaksi_id);

-- ============================================================================
-- 10. TABEL: transaksi_item_modal
-- SNAPSHOT HARGA MODAL RAHASIA: Hanya dapat dibaca oleh Owner (BR-11)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.transaksi_item_modal (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaksi_item_id UUID NOT NULL UNIQUE REFERENCES public.transaksi_item(id) ON DELETE CASCADE,
    transaksi_id UUID NOT NULL REFERENCES public.transaksi(id) ON DELETE CASCADE,
    harga_modal_satuan INT NOT NULL CHECK (harga_modal_satuan >= 0),
    subtotal_modal INT NOT NULL CHECK (subtotal_modal >= 0)
);

CREATE INDEX IF NOT EXISTS idx_transaksi_item_modal_transaksi ON public.transaksi_item_modal (transaksi_id);

-- ============================================================================
-- 11. TABEL: mayar_webhook_events
-- Idempotensi & audit webhook pembayaran pihak ketiga (Bagian 11)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.mayar_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL UNIQUE,
    invoice_id TEXT NOT NULL,
    status_pembayaran TEXT NOT NULL,
    payload JSONB,
    diterima_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 12. TABEL: audit_log
-- Catatan aksi sensitif: Hanya dapat dibaca Owner, tidak dapat diubah/dihapus (BR-12)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    pelaku_id UUID REFERENCES public.profiles(id),
    aksi TEXT NOT NULL CHECK (
        aksi IN (
            'void_transaksi',
            'verifikasi_shift',
            'penyesuaian_stok',
            'ubah_harga_jual',
            'ubah_harga_modal',
            'nonaktifkan_produk',
            'ubah_akun'
        )
    ),
    tabel TEXT NOT NULL,
    data_id UUID,
    nilai_sebelum JSONB,
    nilai_sesudah JSONB,
    dibuat_pada TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_pelaku_waktu ON public.audit_log (pelaku_id, dibuat_pada);

-- ============================================================================
-- 13. TRIGGERS PENJAGA INTEGRITAS
-- ============================================================================

-- Trigger 1: Mencegah transaksi pada shift yang tidak berstatus 'buka' (BR-02 & BR-09)
CREATE OR REPLACE FUNCTION public.check_shift_sebelum_transaksi()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_shift_status TEXT;
BEGIN
    SELECT status INTO v_shift_status FROM public.shift_kasir WHERE id = NEW.shift_id;
    IF v_shift_status IS NULL THEN
        RAISE EXCEPTION 'Shift yang dirujuk tidak ditemukan.';
    END IF;
    IF v_shift_status != 'buka' THEN
        RAISE EXCEPTION 'Transaksi ditolak: Shift ini berstatus % dan tidak dapat menerima transaksi baru.', v_shift_status;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_transaksi_cek_shift_buka ON public.transaksi;
CREATE TRIGGER trg_transaksi_cek_shift_buka
BEFORE INSERT ON public.transaksi
FOR EACH ROW EXECUTE FUNCTION public.check_shift_sebelum_transaksi();

-- Trigger 2: Mencegah perubahan atau penghapusan audit log (BR-12 Immutable)
CREATE OR REPLACE FUNCTION public.mencegah_perubahan_audit_log()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Audit log bersifat permanen dan tidak dapat diubah atau dihapus oleh siapa pun.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_log_immutable ON public.audit_log;
CREATE TRIGGER trg_audit_log_immutable
BEFORE UPDATE OR DELETE ON public.audit_log
FOR EACH ROW EXECUTE FUNCTION public.mencegah_perubahan_audit_log();

-- ============================================================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

ALTER TABLE public.cabang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.produk ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riwayat_harga_modal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stok_cabang ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_kasir ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaksi_item_modal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mayar_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- POLICIES: cabang
CREATE POLICY "cabang_select_policy" ON public.cabang
    FOR SELECT TO authenticated
    USING (public.auth_user_is_active());

CREATE POLICY "cabang_modify_owner" ON public.cabang
    FOR ALL TO authenticated
    USING (public.auth_user_role() = 'owner' AND public.auth_user_is_active())
    WITH CHECK (public.auth_user_role() = 'owner' AND public.auth_user_is_active());

-- POLICIES: profiles (BR-01)
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT TO authenticated
    USING (
        public.auth_user_is_active() AND (
            public.auth_user_role() = 'owner' OR
            id = public.auth_user_id() OR
            cabang_id = public.auth_user_cabang_id()
        )
    );

CREATE POLICY "profiles_update_owner" ON public.profiles
    FOR UPDATE TO authenticated
    USING (public.auth_user_role() = 'owner' AND public.auth_user_is_active())
    WITH CHECK (public.auth_user_role() = 'owner' AND public.auth_user_is_active());

-- POLICIES: produk (BR-05)
CREATE POLICY "produk_select_policy" ON public.produk
    FOR SELECT TO authenticated
    USING (
        public.auth_user_is_active() AND (
            public.auth_user_role() = 'owner' OR aktif = true
        )
    );

CREATE POLICY "produk_modify_owner" ON public.produk
    FOR ALL TO authenticated
    USING (public.auth_user_role() = 'owner' AND public.auth_user_is_active())
    WITH CHECK (public.auth_user_role() = 'owner' AND public.auth_user_is_active());

-- POLICIES: riwayat_harga_modal (BR-11 HANYA OWNER)
CREATE POLICY "riwayat_modal_owner_only" ON public.riwayat_harga_modal
    FOR ALL TO authenticated
    USING (public.auth_user_role() = 'owner' AND public.auth_user_is_active())
    WITH CHECK (public.auth_user_role() = 'owner' AND public.auth_user_is_active());

-- POLICIES: stok_cabang (BR-01, BR-03)
CREATE POLICY "stok_select_policy" ON public.stok_cabang
    FOR SELECT TO authenticated
    USING (
        public.auth_user_is_active() AND (
            public.auth_user_role() = 'owner' OR cabang_id = public.auth_user_cabang_id()
        )
    );

CREATE POLICY "stok_modify_policy" ON public.stok_cabang
    FOR UPDATE TO authenticated
    USING (
        public.auth_user_is_active() AND (
            public.auth_user_role() = 'owner' OR
            (public.auth_user_role() = 'kepala_toko' AND cabang_id = public.auth_user_cabang_id())
        )
    )
    WITH CHECK (
        public.auth_user_is_active() AND (
            public.auth_user_role() = 'owner' OR
            (public.auth_user_role() = 'kepala_toko' AND cabang_id = public.auth_user_cabang_id())
        )
    );

-- POLICIES: shift_kasir (BR-01, BR-09, BR-10)
CREATE POLICY "shift_select_policy" ON public.shift_kasir
    FOR SELECT TO authenticated
    USING (
        public.auth_user_is_active() AND (
            public.auth_user_role() = 'owner' OR
            (public.auth_user_role() = 'kepala_toko' AND cabang_id = public.auth_user_cabang_id()) OR
            (public.auth_user_role() = 'kasir' AND kasir_id = public.auth_user_id())
        )
    );

-- POLICIES: transaksi (BR-01, BR-08)
CREATE POLICY "transaksi_select_policy" ON public.transaksi
    FOR SELECT TO authenticated
    USING (
        public.auth_user_is_active() AND (
            public.auth_user_role() = 'owner' OR
            (public.auth_user_role() = 'kepala_toko' AND cabang_id = public.auth_user_cabang_id()) OR
            (public.auth_user_role() = 'kasir' AND kasir_id = public.auth_user_id())
        )
    );

-- POLICIES: transaksi_item
CREATE POLICY "transaksi_item_select_policy" ON public.transaksi_item
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.transaksi t
            WHERE t.id = transaksi_item.transaksi_id
        )
    );

-- POLICIES: transaksi_item_modal (BR-11 HANYA OWNER)
CREATE POLICY "transaksi_modal_owner_only" ON public.transaksi_item_modal
    FOR ALL TO authenticated
    USING (public.auth_user_role() = 'owner' AND public.auth_user_is_active())
    WITH CHECK (public.auth_user_role() = 'owner' AND public.auth_user_is_active());

-- POLICIES: audit_log (BR-12 HANYA OWNER BACA, TIDAK ADA UPDATE/DELETE)
CREATE POLICY "audit_log_select_owner_only" ON public.audit_log
    FOR SELECT TO authenticated
    USING (public.auth_user_role() = 'owner' AND public.auth_user_is_active());

-- POLICIES: mayar_webhook_events
CREATE POLICY "mayar_webhook_owner_only" ON public.mayar_webhook_events
    FOR SELECT TO authenticated
    USING (public.auth_user_role() = 'owner' AND public.auth_user_is_active());

-- ============================================================================
-- 15. STORED PROCEDURES / ATOMIC RPC FUNCTIONS
-- ============================================================================

-- A. BUKA SHIFT KASIR (BR-02)
CREATE OR REPLACE FUNCTION public.buka_shift(p_kas_awal INT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := public.auth_user_id();
    v_peran TEXT := public.auth_user_role();
    v_cabang_id UUID := public.auth_user_cabang_id();
    v_new_shift_id UUID;
    v_shift_aktif RECORD;
BEGIN
    IF NOT public.auth_user_is_active() THEN
        RAISE EXCEPTION 'Akun Anda berstatus nonaktif.';
    END IF;
    IF v_peran NOT IN ('kasir', 'owner') THEN
        RAISE EXCEPTION 'Hanya kasir yang dapat membuka shift.';
    END IF;
    IF p_kas_awal < 0 OR p_kas_awal > 2000000 THEN
        RAISE EXCEPTION 'Kas awal harus antara Rp0 dan Rp2.000.000.';
    END IF;

    SELECT id INTO v_shift_aktif
    FROM public.shift_kasir
    WHERE kasir_id = v_user_id AND status = 'buka';

    IF FOUND THEN
        RAISE EXCEPTION 'Anda sudah memiliki shift yang berstatus buka.';
    END IF;

    INSERT INTO public.shift_kasir (
        cabang_id, kasir_id, status, kas_awal, dibuka_pada,
        total_tunai, total_qris, kas_seharusnya
    ) VALUES (
        v_cabang_id, v_user_id, 'buka', p_kas_awal, now(),
        0, 0, p_kas_awal
    ) RETURNING id INTO v_new_shift_id;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', v_new_shift_id,
        'kas_awal', p_kas_awal,
        'pesan', 'Shift berhasil dibuka.'
    );
END;
$$;

-- B. SIMPAN TRANSAKSI PENJUALAN ATOMIK (BR-03, BR-04, BR-05, BR-06, BR-07, BR-11)
CREATE OR REPLACE FUNCTION public.simpan_transaksi(
    p_shift_id UUID,
    p_diskon INT,
    p_alasan_diskon TEXT,
    p_metode_bayar TEXT,
    p_uang_diterima INT,
    p_items JSONB -- Format: [{"produk_id": "uuid", "jumlah": int}]
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
    v_item RECORD;
    v_prod RECORD;
    v_stok RECORD;
    v_modal RECORD;
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

    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(produk_id UUID, jumlah INT)
    LOOP
        SELECT * INTO v_prod FROM public.produk WHERE id = v_item.produk_id;
        IF NOT FOUND OR NOT v_prod.aktif THEN
            RAISE EXCEPTION 'Produk tidak ditemukan atau berstatus nonaktif.';
        END IF;
        IF v_item.jumlah < 1 OR v_item.jumlah > 99 THEN
            RAISE EXCEPTION 'Jumlah item harus antara 1 sampai 99.';
        END IF;
        v_subtotal := v_subtotal + (v_prod.harga_jual * v_item.jumlah);
    END LOOP;

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
        SELECT * FROM jsonb_to_recordset(p_items) AS x(produk_id UUID, jumlah INT)
        ORDER BY produk_id
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

        INSERT INTO public.transaksi_item (
            transaksi_id, produk_id, nama_produk, harga_satuan, jumlah, subtotal
        ) VALUES (
            v_transaksi_id, v_prod.id, v_prod.nama, v_prod.harga_jual, v_item.jumlah, (v_prod.harga_jual * v_item.jumlah)
        );

        SELECT * INTO v_modal
        FROM public.riwayat_harga_modal
        WHERE produk_id = v_prod.id AND berlaku_mulai <= now()
        ORDER BY berlaku_mulai DESC LIMIT 1;

        INSERT INTO public.transaksi_item_modal (
            transaksi_item_id, transaksi_id, harga_modal_satuan, subtotal_modal
        ) VALUES (
            (SELECT id FROM public.transaksi_item WHERE transaksi_id = v_transaksi_id AND produk_id = v_prod.id),
            v_transaksi_id,
            COALESCE(v_modal.harga_modal, 0),
            COALESCE(v_modal.harga_modal, 0) * v_item.jumlah
        );

        v_struk_items := v_struk_items || jsonb_build_object(
            'nama', v_prod.nama,
            'harga', v_prod.harga_jual,
            'jumlah', v_item.jumlah,
            'subtotal', (v_prod.harga_jual * v_item.jumlah)
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

-- C. VOID TRANSAKSI PENJUALAN (BR-08, BR-12)
CREATE OR REPLACE FUNCTION public.void_transaksi(
    p_transaksi_id UUID,
    p_alasan_void TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := public.auth_user_id();
    v_peran TEXT := public.auth_user_role();
    v_cabang_user UUID := public.auth_user_cabang_id();
    v_trx RECORD;
    v_shift RECORD;
    v_item RECORD;
    v_prod RECORD;
    v_today_wib DATE;
    v_trx_date_wib DATE;
    v_stok_dipulihkan JSONB := '[]'::jsonb;
BEGIN
    IF v_peran NOT IN ('kepala_toko', 'owner') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Kepala Toko atau Owner yang berhak melakukan void transaksi.';
    END IF;
    IF p_alasan_void IS NULL OR length(trim(p_alasan_void)) < 10 THEN
        RAISE EXCEPTION 'Alasan void wajib diisi minimal 10 karakter.';
    END IF;

    SELECT * INTO v_trx FROM public.transaksi WHERE id = p_transaksi_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaksi tidak ditemukan.';
    END IF;
    IF v_trx.status != 'lunas' THEN
        RAISE EXCEPTION 'Hanya transaksi berstatus lunas yang dapat di-void. Status saat ini: %.', v_trx.status;
    END IF;
    IF v_peran = 'kepala_toko' AND v_trx.cabang_id != v_cabang_user THEN
        RAISE EXCEPTION 'Akses ditolak: Kepala Toko hanya dapat me-void transaksi di cabangnya sendiri.';
    END IF;

    v_today_wib := (now() AT TIME ZONE 'Asia/Jakarta')::DATE;
    v_trx_date_wib := (v_trx.dibuat_pada AT TIME ZONE 'Asia/Jakarta')::DATE;
    IF v_trx_date_wib != v_today_wib THEN
        RAISE EXCEPTION 'Void hanya dapat dilakukan pada hari yang sama saat transaksi dibuat.';
    END IF;

    SELECT * INTO v_shift FROM public.shift_kasir WHERE id = v_trx.shift_id;
    IF v_shift.status != 'buka' THEN
        RAISE EXCEPTION 'Transaksi tidak dapat di-void karena shift-nya sudah ditutup.';
    END IF;

    FOR v_item IN SELECT * FROM public.transaksi_item WHERE transaksi_id = p_transaksi_id
    LOOP
        SELECT * INTO v_prod FROM public.produk WHERE id = v_item.produk_id;
        IF v_prod.lacak_stok THEN
            UPDATE public.stok_cabang
            SET jumlah = jumlah + v_item.jumlah, diubah_pada = now()
            WHERE cabang_id = v_trx.cabang_id AND produk_id = v_item.produk_id;

            v_stok_dipulihkan := v_stok_dipulihkan || jsonb_build_object(
                'produk_id', v_prod.id,
                'nama_produk', v_prod.nama,
                'jumlah_dikembalikan', v_item.jumlah
            );
        END IF;
    END LOOP;

    UPDATE public.transaksi
    SET status = 'void',
        void_oleh = v_user_id,
        void_pada = now(),
        alasan_void = trim(p_alasan_void)
    WHERE id = p_transaksi_id;

    INSERT INTO public.audit_log (pelaku_id, aksi, tabel, data_id, nilai_sebelum, nilai_sesudah)
    VALUES (
        v_user_id, 'void_transaksi', 'transaksi', p_transaksi_id,
        jsonb_build_object('status', 'lunas', 'total', v_trx.total),
        jsonb_build_object('status', 'void', 'alasan_void', trim(p_alasan_void), 'stok_dipulihkan', v_stok_dipulihkan)
    );

    RETURN jsonb_build_object(
        'success', true,
        'nomor_struk', v_trx.nomor_struk,
        'status', 'void',
        'pesan', 'Transaksi berhasil di-void dan stok telah dikembalikan.'
    );
END;
$$;

-- D. TUTUP SHIFT KASIR (BR-09)
CREATE OR REPLACE FUNCTION public.tutup_shift(
    p_shift_id UUID,
    p_uang_fisik INT,
    p_catatan_tutup TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := public.auth_user_id();
    v_shift RECORD;
    v_tot_tunai INT := 0;
    v_tot_qris INT := 0;
    v_kas_seharusnya INT := 0;
    v_selisih INT := 0;
BEGIN
    SELECT * INTO v_shift FROM public.shift_kasir WHERE id = p_shift_id FOR UPDATE;
    IF NOT FOUND OR v_shift.status != 'buka' THEN
        RAISE EXCEPTION 'Shift tidak valid atau sudah ditutup.';
    END IF;
    IF v_shift.kasir_id != v_user_id AND public.auth_user_role() != 'owner' THEN
        RAISE EXCEPTION 'Hanya kasir pemilik shift yang dapat menutup shift.';
    END IF;
    IF p_uang_fisik < 0 THEN
        RAISE EXCEPTION 'Uang fisik tidak boleh bernilai negatif.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.transaksi WHERE shift_id = p_shift_id AND status = 'menunggu_bayar') THEN
        RAISE EXCEPTION 'Masih ada transaksi menunggu pembayaran Mayar. Selesaikan atau batalkan dulu.';
    END IF;

    SELECT COALESCE(SUM(total), 0) INTO v_tot_tunai
    FROM public.transaksi
    WHERE shift_id = p_shift_id AND status = 'lunas' AND metode_bayar = 'tunai';

    SELECT COALESCE(SUM(total), 0) INTO v_tot_qris
    FROM public.transaksi
    WHERE shift_id = p_shift_id AND status = 'lunas' AND metode_bayar = 'qris';

    v_kas_seharusnya := v_shift.kas_awal + v_tot_tunai;
    v_selisih := p_uang_fisik - v_kas_seharusnya;

    IF abs(v_selisih) > 20000 AND (p_catatan_tutup IS NULL OR length(trim(p_catatan_tutup)) < 5) THEN
        RAISE EXCEPTION 'Selisih kas sebesar Rp% melebihi batas Rp20.000. Catatan wajib diisi minimal 5 karakter.', abs(v_selisih);
    END IF;

    UPDATE public.shift_kasir
    SET status = 'ditutup',
        ditutup_pada = now(),
        total_tunai = v_tot_tunai,
        total_qris = v_tot_qris,
        kas_seharusnya = v_kas_seharusnya,
        uang_fisik = p_uang_fisik,
        selisih = v_selisih,
        catatan_tutup = p_catatan_tutup
    WHERE id = p_shift_id;

    RETURN jsonb_build_object(
        'success', true,
        'shift_id', p_shift_id,
        'kas_seharusnya', v_kas_seharusnya,
        'uang_fisik', p_uang_fisik,
        'selisih', v_selisih,
        'pesan', 'Shift berhasil ditutup dan angka telah dikunci.'
    );
END;
$$;

-- E. VERIFIKASI SHIFT (BR-10, BR-12)
CREATE OR REPLACE FUNCTION public.verifikasi_shift(
    p_shift_id UUID,
    p_catatan_verifikasi TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := public.auth_user_id();
    v_peran TEXT := public.auth_user_role();
    v_cabang_id UUID := public.auth_user_cabang_id();
    v_shift RECORD;
BEGIN
    IF v_peran NOT IN ('kepala_toko', 'owner') THEN
        RAISE EXCEPTION 'Hanya Kepala Toko atau Owner yang berhak memverifikasi shift.';
    END IF;

    SELECT * INTO v_shift FROM public.shift_kasir WHERE id = p_shift_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Shift tidak ditemukan.';
    END IF;
    IF v_shift.status != 'ditutup' THEN
        RAISE EXCEPTION 'Hanya shift berstatus ditutup yang dapat diverifikasi.';
    END IF;
    IF v_peran = 'kepala_toko' AND v_shift.cabang_id != v_cabang_id THEN
        RAISE EXCEPTION 'Kepala Toko hanya dapat memverifikasi shift di cabangnya sendiri.';
    END IF;

    UPDATE public.shift_kasir
    SET status = 'diverifikasi',
        diverifikasi_oleh = v_user_id,
        diverifikasi_pada = now(),
        catatan_verifikasi = p_catatan_verifikasi
    WHERE id = p_shift_id;

    INSERT INTO public.audit_log (pelaku_id, aksi, tabel, data_id, nilai_sebelum, nilai_sesudah)
    VALUES (
        v_user_id, 'verifikasi_shift', 'shift_kasir', p_shift_id,
        jsonb_build_object('status', 'ditutup'),
        jsonb_build_object('status', 'diverifikasi', 'catatan', p_catatan_verifikasi)
    );

    RETURN jsonb_build_object('success', true, 'pesan', 'Shift berhasil diverifikasi.');
END;
$$;

-- F. PENYESUAIAN STOK CABANG (BR-12)
CREATE OR REPLACE FUNCTION public.sesuaikan_stok(
    p_cabang_id UUID,
    p_produk_id UUID,
    p_jumlah_baru INT,
    p_jenis_penyesuaian TEXT,
    p_alasan TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := public.auth_user_id();
    v_peran TEXT := public.auth_user_role();
    v_cabang_user UUID := public.auth_user_cabang_id();
    v_stok RECORD;
    v_prod RECORD;
    v_selisih INT;
BEGIN
    IF v_peran NOT IN ('kepala_toko', 'owner') THEN
        RAISE EXCEPTION 'Akses ditolak: Hanya Kepala Toko atau Owner yang berhak menyesuaikan stok.';
    END IF;
    IF v_peran = 'kepala_toko' AND p_cabang_id != v_cabang_user THEN
        RAISE EXCEPTION 'Akses ditolak: Kepala Toko hanya dapat menyesuaikan stok di cabangnya sendiri.';
    END IF;
    IF p_jumlah_baru < 0 THEN
        RAISE EXCEPTION 'Jumlah stok baru tidak boleh bernilai negatif.';
    END IF;
    IF p_alasan IS NULL OR length(trim(p_alasan)) < 5 THEN
        RAISE EXCEPTION 'Alasan penyesuaian stok wajib diisi minimal 5 karakter.';
    END IF;

    SELECT * INTO v_stok
    FROM public.stok_cabang
    WHERE cabang_id = p_cabang_id AND produk_id = p_produk_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Baris stok cabang tidak ditemukan.';
    END IF;

    SELECT nama INTO v_prod FROM public.produk WHERE id = p_produk_id;
    v_selisih := p_jumlah_baru - v_stok.jumlah;

    UPDATE public.stok_cabang
    SET jumlah = p_jumlah_baru, diubah_pada = now()
    WHERE id = v_stok.id;

    INSERT INTO public.audit_log (pelaku_id, aksi, tabel, data_id, nilai_sebelum, nilai_sesudah)
    VALUES (
        v_user_id, 'penyesuaian_stok', 'stok_cabang', v_stok.id,
        jsonb_build_object('produk', v_prod.nama, 'jumlah_lama', v_stok.jumlah),
        jsonb_build_object('produk', v_prod.nama, 'jumlah_baru', p_jumlah_baru, 'perubahan', v_selisih, 'jenis', p_jenis_penyesuaian, 'alasan', trim(p_alasan))
    );

    RETURN jsonb_build_object(
        'success', true,
        'produk', v_prod.nama,
        'jumlah_baru', p_jumlah_baru,
        'pesan', 'Stok berhasil diperbarui dan dicatat ke audit log.'
    );
END;
$$;

-- ============================================================================
-- 16. HAK AKSES PERAN SUPABASE (GRANTS)
-- Memberikan akses skema & tabel ke peran Supabase (RLS tetap menyaring baris)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
