-- ============================================================================
-- CAPSTONE PROJECT: LUMBUNG KOPI DAN ROTI (POS MULTI-CABANG)
-- MIGRATION: 20261022000006_add_mayar_qris_functions.sql
-- DESKRIPSI: Fungsi RPC pendukung transaksi QRIS Dinamis Mayar
--            (Reservasi stok, pembatalan/timeout, dan pelunasan transaksi)
-- ============================================================================

-- A. PESAN TRANSAKSI QRIS MAYAR (STATUS: menunggu_bayar & RESERVASI STOK)
CREATE OR REPLACE FUNCTION public.pesan_transaksi_mayar(
    p_shift_id UUID,
    p_diskon INT DEFAULT 0,
    p_alasan_diskon TEXT DEFAULT NULL,
    p_items JSONB DEFAULT '[]'::jsonb
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
    v_transaksi_id UUID;
    v_item RECORD;
    v_prod RECORD;
    v_stok RECORD;
    v_modal RECORD;
    v_items_list JSONB := '[]'::jsonb;
BEGIN
    -- 1. Validasi shift buka
    SELECT * INTO v_shift FROM public.shift_kasir WHERE id = p_shift_id FOR UPDATE;
    IF NOT FOUND OR v_shift.status != 'buka' THEN
        RAISE EXCEPTION 'Shift kasir tidak ditemukan atau sudah tidak berstatus buka.';
    END IF;
    IF v_shift.kasir_id != v_user_id AND public.auth_user_role() != 'owner' THEN
        RAISE EXCEPTION 'Hanya kasir pemilik shift yang berhak memproses transaksi ini.';
    END IF;

    -- 2. Generate Nomor Struk Urut BR-04
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

    -- 3. Validasi produk & kalkulasi subtotal
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

    -- 4. Validasi diskon
    IF p_diskon < 0 OR p_diskon > (v_subtotal * 10 / 100) THEN
        RAISE EXCEPTION 'Diskon maksimal 10 persen dari subtotal.';
    END IF;
    IF p_diskon > 0 AND (p_alasan_diskon IS NULL OR length(trim(p_alasan_diskon)) < 3) THEN
        RAISE EXCEPTION 'Alasan diskon wajib diisi jika diskon lebih dari Rp0.';
    END IF;

    v_total := v_subtotal - p_diskon;

    -- 5. Simpan Transaksi dengan status 'menunggu_bayar'
    INSERT INTO public.transaksi (
        nomor_struk, cabang_id, shift_id, kasir_id, status,
        subtotal, diskon, alasan_diskon, total, metode_bayar,
        uang_diterima, kembalian, dibuat_pada
    ) VALUES (
        v_nomor_struk, v_shift.cabang_id, v_shift.id, v_user_id, 'menunggu_bayar',
        v_subtotal, p_diskon, p_alasan_diskon, v_total, 'qris',
        v_total, 0, now()
    ) RETURNING id INTO v_transaksi_id;

    -- 6. Reservasi Stok (Kurangi stok produk terverifikasi sekarang juga)
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

        v_items_list := v_items_list || jsonb_build_object(
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
        'cabang_kode', v_cabang.kode,
        'cabang_nama', v_cabang.nama,
        'cabang_alamat', v_cabang.alamat,
        'subtotal', v_subtotal,
        'diskon', p_diskon,
        'total', v_total,
        'items', v_items_list
    );
END;
$$;

-- B. UPDATE INVOICE ID MAYAR KE TRANSAKSI
CREATE OR REPLACE FUNCTION public.set_mayar_invoice_id(
    p_transaksi_id UUID,
    p_invoice_id TEXT
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.transaksi
    SET mayar_invoice_id = p_invoice_id
    WHERE id = p_transaksi_id;
    RETURN FOUND;
END;
$$;

-- C. PEMBATALAN TRANSAKSI MAYAR & PENGEMBALIAN STOK TEPAT SATU KALI
CREATE OR REPLACE FUNCTION public.batalkan_transaksi_mayar(
    p_transaksi_id UUID,
    p_alasan TEXT DEFAULT 'Pembatalan transaksi QRIS Mayar'
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_trx RECORD;
    v_item RECORD;
    v_prod RECORD;
    v_stok_dipulihkan JSONB := '[]'::jsonb;
BEGIN
    SELECT * INTO v_trx
    FROM public.transaksi
    WHERE id = p_transaksi_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transaksi tidak ditemukan.';
    END IF;

    -- Idempoten: Jika sudah bukan 'menunggu_bayar', jangan kembalikan stok berulang kali
    IF v_trx.status != 'menunggu_bayar' THEN
        RETURN jsonb_build_object(
            'success', false,
            'status_saat_ini', v_trx.status,
            'pesan', 'Transaksi tidak dapat dibatalkan karena berstatus ' || v_trx.status
        );
    END IF;

    -- Ubah status transaksi menjadi 'batal'
    UPDATE public.transaksi
    SET status = 'batal'
    WHERE id = v_trx.id;

    -- Kembalikan seluruh stok yang tadinya di-reserve
    FOR v_item IN SELECT * FROM public.transaksi_item WHERE transaksi_id = v_trx.id
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

    RETURN jsonb_build_object(
        'success', true,
        'transaksi_id', v_trx.id,
        'nomor_struk', v_trx.nomor_struk,
        'status', 'batal',
        'stok_dipulihkan', v_stok_dipulihkan,
        'pesan', 'Transaksi berhasil dibatalkan dan stok dikembalikan.'
    );
END;
$$;

-- D. PELUNASAN TRANSAKSI MAYAR VIA WEBHOOK / KONFIRMASI PEMBAYARAN
CREATE OR REPLACE FUNCTION public.selesaikan_transaksi_mayar(
    p_invoice_id TEXT,
    p_event_id TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_trx RECORD;
BEGIN
    SELECT * INTO v_trx
    FROM public.transaksi
    WHERE mayar_invoice_id = p_invoice_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'NOT_FOUND',
            'pesan', 'Transaksi dengan invoice Mayar tersebut tidak ditemukan.'
        );
    END IF;

    -- Kasus Pembayaran Terlambat (Late Payment):
    -- Jika transaksi sudah 'batal' karena timeout/dibatalkan kasir, tolak pelunasan!
    IF v_trx.status = 'batal' THEN
        RETURN jsonb_build_object(
            'success', false,
            'error_code', 'LATE_PAYMENT',
            'transaksi_id', v_trx.id,
            'nomor_struk', v_trx.nomor_struk,
            'pesan', 'Pembayaran diterima setelah transaksi dibatalkan (Late Payment).'
        );
    END IF;

    -- Idempoten: Jika sudah lunas, langsung sukses
    IF v_trx.status = 'lunas' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_paid', true,
            'transaksi_id', v_trx.id,
            'nomor_struk', v_trx.nomor_struk,
            'pesan', 'Transaksi sudah berstatus lunas sebelumnya.'
        );
    END IF;

    -- Ubah status menjadi 'lunas'
    UPDATE public.transaksi
    SET status = 'lunas',
        dibayar_pada = now()
    WHERE id = v_trx.id;

    RETURN jsonb_build_object(
        'success', true,
        'transaksi_id', v_trx.id,
        'nomor_struk', v_trx.nomor_struk,
        'total', v_trx.total,
        'pesan', 'Transaksi QRIS Mayar berhasil dilunasi.'
    );
END;
$$;
