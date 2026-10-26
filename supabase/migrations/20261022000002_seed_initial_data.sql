-- ============================================================================
-- CAPSTONE PROJECT: LUMBUNG KOPI DAN ROTI (POS MULTI-CABANG)
-- MIGRATION: 20261022000002_seed_initial_data.sql
-- DESKRIPSI: Seed 3 cabang, 18 produk, modal awal, & stok cabang
-- CATATAN: Tidak memuat akun/password palsu (Akun dibuat via Supabase Auth)
-- ============================================================================

-- 1. SEED: 3 CABANG RESMI LUMBUNG KOPI DAN ROTI
INSERT INTO public.cabang (id, kode, nama, alamat, aktif, urut_struk_tanggal, urut_struk_terakhir)
VALUES
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', 'TBT', 'Lumbung Tebet', 'Jl. Tebet Raya No. 41, Jakarta Selatan', true, '2026-10-15', 3),
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', 'BTR', 'Lumbung Bintaro', 'Jl. Bintaro Utama 3 Blok B2, Tangerang Selatan', true, '2026-10-14', 3),
    ('b76a9d0d-9422-5849-8829-756d702053b9', 'DPK', 'Lumbung Depok', 'Jl. Margonda Raya No. 210, Depok', true, '2026-10-14', 3)
ON CONFLICT (id) DO UPDATE SET
    kode = EXCLUDED.kode,
    nama = EXCLUDED.nama,
    alamat = EXCLUDED.alamat,
    aktif = EXCLUDED.aktif;

-- 2. SEED: 18 PRODUK
INSERT INTO public.produk (id, sku, nama, kategori, harga_jual, lacak_stok, aktif)
VALUES
    ('ff9dd343-b627-5a17-a177-1a1d23e3439d', 'KOP-001', 'Espresso', 'kopi', 18000, false, true),
    ('03ba6239-2efb-5fdc-95f2-4f74f4489dd8', 'KOP-002', 'Americano', 'kopi', 22000, false, true),
    ('4bf1e555-3c86-53a0-9196-472bbe094338', 'KOP-003', 'Kopi Susu Lumbung', 'kopi', 25000, false, true),
    ('f1f24064-69f5-545e-b19c-71235a3ee074', 'KOP-004', 'Cappuccino', 'kopi', 28000, false, true),
    ('58043133-ec04-5c4d-840f-6cd5fb526c8a', 'KOP-005', 'Caffe Latte', 'kopi', 28000, false, true),
    ('bb4a689e-6d20-5de3-aaa0-b5e98453d576', 'NKP-001', 'Matcha Latte', 'non_kopi', 30000, false, true),
    ('88940f66-a081-5025-81b2-86ac7463ca47', 'NKP-002', 'Cokelat Panas', 'non_kopi', 27000, false, true),
    ('2bf690a2-35e4-58cf-8c45-f373c15d7cee', 'NKP-003', 'Teh Tarik', 'non_kopi', 20000, false, true),
    ('c9ec01ff-7c25-5284-91a2-0354afdfc511', 'ROT-001', 'Croissant Mentega', 'roti', 24000, true, true),
    ('b9a88e55-7705-5159-9f07-86b3e2913084', 'ROT-002', 'Roti Pisang Cokelat', 'roti', 18000, true, true),
    ('a782db86-9f4c-5c12-a981-8b4dd14205e0', 'ROT-003', 'Roti Sobek Keju', 'roti', 32000, true, true),
    ('f26530f3-0a9b-5b26-9136-750b5a5f55c0', 'ROT-004', 'Donat Gula Halus', 'roti', 10000, true, true),
    ('e6900790-c098-5fb8-be56-b0f4c11c15b0', 'ROT-005', 'Roti Abon Pedas', 'roti', 20000, true, false), -- Nonaktif (TC-09)
    ('2b967038-d218-54c7-9c5f-26a893e01f11', 'SNK-001', 'Cookies Oat Madu (isi 6)', 'snack', 35000, true, true),
    ('e492a9b2-879d-503d-89bc-2b2d47be0ab4', 'SNK-002', 'Banana Cake Slice', 'snack', 22000, true, true),
    ('2d5fb5b3-fa19-5c74-b13a-04cf2bc8234e', 'KMS-001', 'Kopi Susu Botol 1 L', 'kemasan', 95000, true, true),
    ('71c22606-2702-558e-b464-92af2dca8071', 'KMS-002', 'Biji Kopi Lumbung 250 g', 'kemasan', 85000, true, true),
    ('9656c367-b523-52c0-b46d-5eabbdac5c99', 'KMS-003', 'Tumbler Lumbung 450 ml', 'kemasan', 120000, true, true)
ON CONFLICT (id) DO UPDATE SET
    sku = EXCLUDED.sku,
    nama = EXCLUDED.nama,
    kategori = EXCLUDED.kategori,
    harga_jual = EXCLUDED.harga_jual,
    lacak_stok = EXCLUDED.lacak_stok,
    aktif = EXCLUDED.aktif;

-- 3. SEED: RIWAYAT HARGA MODAL AWAL (DATA RAHASIA OWNER)
INSERT INTO public.riwayat_harga_modal (produk_id, harga_modal, berlaku_mulai)
VALUES
    ('ff9dd343-b627-5a17-a177-1a1d23e3439d', 6000, '2026-10-01 00:00:00+07'),
    ('03ba6239-2efb-5fdc-95f2-4f74f4489dd8', 7500, '2026-10-01 00:00:00+07'),
    ('4bf1e555-3c86-53a0-9196-472bbe094338', 8500, '2026-10-01 00:00:00+07'),
    ('4bf1e555-3c86-53a0-9196-472bbe094338', 9000, '2026-10-08 00:00:00+07'), -- Perubahan modal 8 Okt (BR-11)
    ('f1f24064-69f5-545e-b19c-71235a3ee074', 10000, '2026-10-01 00:00:00+07'),
    ('58043133-ec04-5c4d-840f-6cd5fb526c8a', 10500, '2026-10-01 00:00:00+07'),
    ('bb4a689e-6d20-5de3-aaa0-b5e98453d576', 12000, '2026-10-01 00:00:00+07'),
    ('88940f66-a081-5025-81b2-86ac7463ca47', 11000, '2026-10-01 00:00:00+07'),
    ('2bf690a2-35e4-58cf-8c45-f373c15d7cee', 7000, '2026-10-01 00:00:00+07'),
    ('c9ec01ff-7c25-5284-91a2-0354afdfc511', 11000, '2026-10-01 00:00:00+07'),
    ('b9a88e55-7705-5159-9f07-86b3e2913084', 8000, '2026-10-01 00:00:00+07'),
    ('a782db86-9f4c-5c12-a981-8b4dd14205e0', 14000, '2026-10-01 00:00:00+07'),
    ('f26530f3-0a9b-5b26-9136-750b5a5f55c0', 4000, '2026-10-01 00:00:00+07'),
    ('e6900790-c098-5fb8-be56-b0f4c11c15b0', 9000, '2026-10-01 00:00:00+07'),
    ('2b967038-d218-54c7-9c5f-26a893e01f11', 16000, '2026-10-01 00:00:00+07'),
    ('e492a9b2-879d-503d-89bc-2b2d47be0ab4', 9500, '2026-10-01 00:00:00+07'),
    ('2d5fb5b3-fa19-5c74-b13a-04cf2bc8234e', 42000, '2026-10-01 00:00:00+07'),
    ('71c22606-2702-558e-b464-92af2dca8071', 47000, '2026-10-01 00:00:00+07'),
    ('71c22606-2702-558e-b464-92af2dca8071', 52000, '2026-10-08 00:00:00+07'), -- Perubahan modal 8 Okt (BR-11)
    ('9656c367-b523-52c0-b46d-5eabbdac5c99', 65000, '2026-10-01 00:00:00+07')
ON CONFLICT (produk_id, berlaku_mulai) DO UPDATE SET
    harga_modal = EXCLUDED.harga_modal;

-- 4. SEED: STOK CABANG AWAL (TERMASUK KASUS BATAS PENGUJIAN)
-- Tebet (TBT)
INSERT INTO public.stok_cabang (cabang_id, produk_id, jumlah, stok_minimum)
VALUES
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', 'c9ec01ff-7c25-5284-91a2-0354afdfc511', 1, 4),  -- Croissant sisa 1 (Kasus Batas TC-07)
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', 'b9a88e55-7705-5159-9f07-86b3e2913084', 8, 3),
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', 'a782db86-9f4c-5c12-a981-8b4dd14205e0', 5, 3),
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', 'f26530f3-0a9b-5b26-9136-750b5a5f55c0', 12, 5),
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', 'e6900790-c098-5fb8-be56-b0f4c11c15b0', 0, 3),  -- Roti abon nonaktif
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', '2b967038-d218-54c7-9c5f-26a893e01f11', 6, 4),
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', 'e492a9b2-879d-503d-89bc-2b2d47be0ab4', 7, 3),
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', '2d5fb5b3-fa19-5c74-b13a-04cf2bc8234e', 4, 2),
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', '71c22606-2702-558e-b464-92af2dca8071', 8, 3),
    ('030cfd87-60a3-51b0-9cdf-c083b46a32cd', '9656c367-b523-52c0-b46d-5eabbdac5c99', 1, 2),  -- Tumbler menipis (Kasus Batas 3)

-- Bintaro (BTR)
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', 'c9ec01ff-7c25-5284-91a2-0354afdfc511', 6, 4),
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', 'b9a88e55-7705-5159-9f07-86b3e2913084', 7, 3),
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', 'a782db86-9f4c-5c12-a981-8b4dd14205e0', 4, 3),
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', 'f26530f3-0a9b-5b26-9136-750b5a5f55c0', 10, 5),
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', 'e6900790-c098-5fb8-be56-b0f4c11c15b0', 0, 3),
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', '2b967038-d218-54c7-9c5f-26a893e01f11', 2, 4),  -- Cookies menipis (Kasus Batas 3)
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', 'e492a9b2-879d-503d-89bc-2b2d47be0ab4', 5, 3),
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', '2d5fb5b3-fa19-5c74-b13a-04cf2bc8234e', 3, 2),
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', '71c22606-2702-558e-b464-92af2dca8071', 6, 3),
    ('5081871b-3bf3-50c3-b8f4-e5087f2996e2', '9656c367-b523-52c0-b46d-5eabbdac5c99', 4, 2),

-- Depok (DPK)
    ('b76a9d0d-9422-5849-8829-756d702053b9', 'c9ec01ff-7c25-5284-91a2-0354afdfc511', 7, 4),
    ('b76a9d0d-9422-5849-8829-756d702053b9', 'b9a88e55-7705-5159-9f07-86b3e2913084', 6, 3),
    ('b76a9d0d-9422-5849-8829-756d702053b9', 'a782db86-9f4c-5c12-a981-8b4dd14205e0', 0, 3),  -- Roti sobek stok 0 (Kasus Batas TC-06)
    ('b76a9d0d-9422-5849-8829-756d702053b9', 'f26530f3-0a9b-5b26-9136-750b5a5f55c0', 14, 5),
    ('b76a9d0d-9422-5849-8829-756d702053b9', 'e6900790-c098-5fb8-be56-b0f4c11c15b0', 0, 3),
    ('b76a9d0d-9422-5849-8829-756d702053b9', '2b967038-d218-54c7-9c5f-26a893e01f11', 5, 4),
    ('b76a9d0d-9422-5849-8829-756d702053b9', 'e492a9b2-879d-503d-89bc-2b2d47be0ab4', 6, 3),
    ('b76a9d0d-9422-5849-8829-756d702053b9', '2d5fb5b3-fa19-5c74-b13a-04cf2bc8234e', 5, 2),
    ('b76a9d0d-9422-5849-8829-756d702053b9', '71c22606-2702-558e-b464-92af2dca8071', 9, 3),
    ('b76a9d0d-9422-5849-8829-756d702053b9', '9656c367-b523-52c0-b46d-5eabbdac5c99', 3, 2)
ON CONFLICT (cabang_id, produk_id) DO UPDATE SET
    jumlah = EXCLUDED.jumlah,
    stok_minimum = EXCLUDED.stok_minimum;
