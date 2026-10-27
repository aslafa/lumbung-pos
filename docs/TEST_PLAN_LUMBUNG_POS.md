# Rencana Pengujian Formal dan Matriks Verifikasi Kualitas (Test Plan & Verification Matrix)

## Proyek: Lumbung Kopi dan Roti — POS Multi-Cabang
- **Website Produksi:** [https://asna-lumbung-pos.netlify.app/](https://asna-lumbung-pos.netlify.app/)
- **Repository GitHub:** [https://github.com/aslafa/lumbung-pos](https://github.com/aslafa/lumbung-pos)
- **Branch Acuan:** `master`
- **Framework & Arsitektur:** Next.js 16 (App Router), TypeScript 5, Supabase (PostgreSQL 15+), Netlify
- **Dokumen Acuan Asli:** `PRD_POS.docx`, `ERD_POS.pdf`, `Data_Contoh_POS.xlsx`, `Petunjuk_Capstone_Project.pdf`, `docs/AUDIT_PRD_SECURITY_REPORT.md`
- **Versi Dokumen:** 1.0.0
- **Tanggal Audit:** 27 Oktober 2026

---

## 1. Ringkasan Eksekutif & Strategi Pengujian

Dokumen ini mendokumentasikan rencana pengujian (*test plan*), matriks kasus uji formal, audit keamanan Row Level Security (RLS), serta rekapitulasi hasil verifikasi pada sistem **Lumbung POS**.

### 1.1. Prinsip & Pemisahan Ruang Lingkup Pengujian
Pengujian pada proyek ini menerapkan pemisahan yang tegas antara dua modalitas:

1. **Pengujian Otomatis (Automated Testing via `npm test`):**
   - Menjalankan 64 kasus uji unit, integrasi server action, RPC database, dan skenario logic bisnis menggunakan runner bawaan Node.js (`node:test`).
   - Berstatus **PASS** berdasarkan hasil eksekusi aktual: `64 passed, 0 failed, 0 cancelled, 0 skipped` (durasi ~14–18 detik).
   - Menguji kebenaran algoritma, format, relasi database, sanitasi input, perhitungan keuangan, dan penegakan RLS melalui sesi pengguna berizin.

2. **Pengujian Manual di Lingkungan Produksi (Manual Production E2E Testing):**
   - Menguji aspek pengalaman pengguna akhir (*user experience*), interaksi fisik peramban (*touch/click gestures*), responsivitas layout tablet, dan dialog cetak struk browser.
   - Sesuai prinsip integritas audit capstone, seluruh kasus uji manual di website produksi yang belum dieksekusi oleh tim penguji manusia secara langsung ditandai dengan status **BELUM DIUJI** (bukan otomatis diklaim *PASS*).

---

## 2. Pemetaan Kebutuhan (Requirements Traceability Matrix)

Kasus uji dipetakan secara presisi ke aturan bisnis (*Business Rules* / BR) dan *User Story* (US) yang tercantum dalam dokumen resmi proyek (`PRD_POS.docx`):

### 2.1. Daftar Aturan Bisnis (BR-01 s/d BR-12)
- **BR-01 (Isolasi Cabang & Akun Nonaktif):** Kasir dan Kepala Toko hanya dapat mengakses data cabangnya sendiri. Akun yang dinonaktifkan (`aktif = false`) dicegat dari sistem.
- **BR-02 (Validasi Shift & Kas Awal):** Transaksi kasir mewajibkan shift buka aktif. Kas awal dibatasi Rp0 – Rp2.000.000. Kasir dibatasi maksimal tepat 1 shift berstatus buka.
- **BR-03 (Stok Tidak Boleh Negatif & Transaksi Atomik):** Pengurangan stok bersifat atomik (*all-or-nothing*). Penjualan ditolak jika stok produk yang dilacak kurang dari permintaan.
- **BR-04 (Standarisasi Nomor Struk):** Format `[KODE_CABANG]-[YYYYMMDD]-[0001..]`, berurutan per cabang per hari, dan aman dari *race condition*.
- **BR-05 (Harga Historis & Validasi Produk):** Harga jual dan nama produk disalin permanen ke `transaksi_item`. Kuantitas dibatasi 1–99. Produk nonaktif ditolak.
- **BR-06 (Batas Diskon Transaksi):** Diskon maksimal 10% dari subtotal. Wajib menyertakan alasan jika nilai diskon > Rp0.
- **BR-07 (Aturan Pembayaran Tunai & QRIS):** Pembayaran tunai mewajibkan uang diterima $\ge$ total belanja (kembalian dihitung otomatis). Pembayaran QRIS mewajibkan nominal pas.
- **BR-08 (Otorisasi Void Transaksi):** Hanya dapat dilakukan oleh Kepala Toko cabang terkait atau Owner untuk transaksi lunas hari ini dengan shift kasir masih buka, alasan minimal 10 karakter, dan pengembalian stok otomatis.
- **BR-09 (Kalkulasi Kas Seharusnya & Selisih):** $\text{Kas Seharusnya} = \text{Kas Awal} + \text{Total Tunai Lunas}$. Wajib mengisi catatan penjelasan jika $|\text{Selisih Kas}| > \text{Rp20.000}$.
- **BR-10 (Siklus Status Shift Kasir):** Alur status searah: `buka` $\rightarrow$ `ditutup` $\rightarrow$ `diverifikasi`. Verifikasi hanya oleh Kepala Toko cabang atau Owner.
- **BR-11 (Kerahasiaan Harga Pokok Penjualan / HPP):** Tabel modal (`riwayat_harga_modal`, `transaksi_item_modal`) dan metrik laba hanya dapat dibaca oleh Owner. Non-Owner menerima 0 baris data.
- **BR-12 (Otoritas Sensitif & Immutabilitas Audit Log):** Mutasi stok dan perubahan status akun dicatat di `audit_log`. Baris `audit_log` tidak dapat diubah (`UPDATE`) atau dihapus (`DELETE`).

### 2.2. Daftar User Story Inti (US-01 s/d US-10)
- **US-01 (Buka Shift):** Kasir membuka shift dengan mengisi kas awal sebelum melayani transaksi.
- **US-02 (Keranjang & Diskon):** Kasir memilih produk, mengatur kuantitas, kustomisasi varian, dan menerapkan diskon dengan alasan.
- **US-03 (Pembayaran & Struk):** Kasir memproses pembayaran tunai/QRIS, mencetak struk belanja, dan meneruskan nomor antrean.
- **US-04 (Tutup Shift):** Kasir menghitung uang fisik laci kas dan mengisi formulir rekonsiliasi kas saat shift berakhir.
- **US-05 (Verifikasi Shift):** Kepala Toko meninjau selisih kas fisik dan memverifikasi shift kasir di cabangnya.
- **US-06 (Void Transaksi):** Kepala Toko membatalkan transaksi yang salah input dan memulihkan stok barang.
- **US-07 (Penyesuaian Stok):** Kepala Toko mencatat barang masuk, barang rusak, atau penyesuaian opname disertai alasan.
- **US-08 (Pengelolaan Produk):** Owner mengelola katalog produk, harga jual, status aktif, dan mencatat riwayat modal.
- **US-09 (Laporan Penjualan):** Kepala Toko melihat ringkasan omzet cabangnya; Owner menganalisis omzet konsolidasi dan margin laba.
- **US-10 (Kelola Akun & Log):** Owner mengelola akun staf cabang dan meninjau rekam jejak audit sistem.

---

## 3. Matriks Kasus Uji Formal (Detailed Test Cases)

Berikut adalah 25 kasus uji formal yang mencakup seluruh fungsi kritis, batas logika bisnis, keamanan sesi, dan fitur integrasi:

| ID Test Case | Referensi BR/US | Tujuan Pengujian | Prasyarat | Langkah-Langkah Pengujian | Hasil yang Diharapkan | Hasil Aktual | Status | Bukti / Referensi Eksekusi |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: | :--- |
| **TC-AUTH-01** | BR-01, US-01 | Verifikasi login akun aktif dan pengalihan route sesuai role | Akun aktif terdaftar di database | 1. Buka `/login`<br>2. Masukkan kredensial Kasir/KT/Owner<br>3. Klik Masuk | Berhasil login dan diarahkan: Kasir ke `/kasir`, KT ke `/transaksi`, Owner ke `/laporan` | Berhasil dialihkan sesuai peran secara presisi | **PASS** | `tests/auth-account-status.test.ts` (TC-AUTH-02, TC-AUTH-03) |
| **TC-AUTH-02** | BR-01, US-01 | Verifikasi pencegahan login untuk akun nonaktif | Akun nonaktif tersedia (`rizky.kasir.depok@lumbung.test`) | 1. Input email akun nonaktif dan kata sandi<br>2. Kirim formulir login | Login ditolak, sesi dibersihkan, muncul pesan penolakan ramah | Login diblokir dan redirect ke `/nonaktif` dengan pesan penolakan | **PASS** | `tests/auth-account-status.test.ts` (TC-AUTH-01) |
| **TC-AUTH-03** | BR-01, US-01 | Pengujian manipulasi URL / Route Guard antar-peran | Pengguna login sebagai Kasir | 1. Login sebagai Kasir<br>2. Ketik URL `/laporan` atau `/pengaturan` di browser address bar | Middleware mencegat dan mengalihkan paksa kembali ke `/kasir` | Dialihkan kembali ke `/kasir`, tidak ada kebocoran data manajerial | **PASS** | `docs/AUDIT_PRD_SECURITY_REPORT.md` (Bagian 3.2) |
| **TC-ISOL-01** | BR-01, US-01, US-09 | Isolasi data transaksi multi-cabang pada level query | Pengguna Kasir Tebet dan KT Bintaro | 1. Query `transaksi` menggunakan sesi Kasir Tebet<br>2. Query `transaksi` menggunakan sesi KT Bintaro | Kasir dan KT hanya menerima baris transaksi dengan `cabang_id` miliknya | Terisolasi 100% pada 1 cabang terkait | **PASS** | `tests/capstone-audit-full.test.ts` (BR-01) |
| **TC-ISOL-02** | BR-01, US-02 | Isolasi katalog stok cabang dan antrean KDS | Tersedia data cabang TBT dan BTR | 1. Kasir cabang A memeriksa stok dan antrean KDS<br>2. Amati data cabang B | Data stok dan antrean cabang B tidak muncul pada cabang A | Data cabang A dan B terpisah mutlak | **PASS** | `tests/order-flow-queue.test.ts` (TC-ORD-07), `tests/meja-management.test.ts` (TC-MEJA-06) |
| **TC-SHF-01** | BR-02, US-01 | Validasi kas awal saat buka shift kasir | Kasir tidak memiliki shift buka | 1. Panggil `buka_shift` dengan kas awal -Rp10.000<br>2. Panggil `buka_shift` dengan kas awal Rp2.500.000<br>3. Panggil dengan kas awal Rp200.000 | Nilai negatif dan > Rp2.000.000 ditolak database. Nilai Rp200.000 diterima | Input di luar batas ditolak, nilai valid sukses tersimpan | **PASS** | `tests/capstone-audit-full.test.ts` (BR-02) |
| **TC-SHF-02** | BR-02, US-01 | Larangan membuka lebih dari satu shift untuk kasir yang sama | Kasir sudah memiliki 1 shift buka | 1. Kasir mencoba memanggil `buka_shift` untuk kedua kalinya | Ditolak oleh partial unique index database (`idx_shift_kasir_satu_buka`) | Percobaan buka shift kedua ditolak database | **PASS** | `tests/capstone-audit-full.test.ts` (BR-02) |
| **TC-SHF-03** | BR-09, US-04 | Tutup shift, kalkulasi kas sistem, dan validasi catatan selisih | Kasir memiliki shift buka dengan transaksi tunai | 1. Tutup shift dengan selisih kas > Rp20.000 tanpa catatan<br>2. Tutup shift dengan selisih > Rp20.000 dengan catatan | Percobaan tanpa catatan ditolak database; percobaan dengan catatan berhasil | Validasi batas toleransi Rp20.000 berjalan sesuai check constraint | **PASS** | `tests/capstone-audit-full.test.ts` (BR-09) |
| **TC-SHF-04** | BR-10, US-05 | Verifikasi shift kasir oleh Kepala Toko / Owner | Shift berstatus `ditutup` dan shift berstatus `buka` | 1. KT mencoba memverifikasi shift yang masih `buka`<br>2. KT memverifikasi shift yang sudah `ditutup` | Verifikasi shift buka ditolak; verifikasi shift ditutup berhasil mengubah status ke `diverifikasi` | Alur status searah terbukti tertib | **PASS** | `tests/capstone-audit-full.test.ts` (BR-10) |
| **TC-TRX-01** | BR-07, US-03 | Validasi pembayaran tunai cukup dan perhitungan kembalian | Shift kasir buka, total belanja Rp98.000 | 1. Input uang diterima Rp100.000<br>2. Simpan transaksi | Transaksi berhasil, kembalian tercatat Rp2.000, kas sistem bertambah | Kembalian dihitung otomatis dan status pembayaran lunas | **PASS** | `tests/capstone-audit-full.test.ts` (BR-07) |
| **TC-TRX-02** | BR-07, US-03 | Penolakan pembayaran tunai yang kurang dari total tagihan | Total belanja produk Rp50.000 | 1. Input uang diterima Rp45.000<br>2. Simpan transaksi | Transaksi ditolak dengan pesan error uang diterima kurang | Transaksi dibatalkan secara aman | **PASS** | `tests/capstone-audit-full.test.ts` (BR-07) |
| **TC-TRX-03** | BR-03, US-02 | Penolakan penjualan stok tidak mencukupi (Zero Partial Sales) | Produk `ROT-001` stok = 0 pcs | 1. Masukkan `ROT-001` ke keranjang belanja<br>2. Eksekusi simpan transaksi | Transaksi ditolak atomik, tidak ada pemotongan stok pada produk lain | Ditolak database: `"Stok untuk Croissant Mentega tidak mencukupi"` | **PASS** | `tests/capstone-audit-full.test.ts` (BR-03) |
| **TC-TRX-04** | BR-04, US-03 | Format dan keurutan nomor struk per cabang per hari | Transaksi dibuat di cabang Tebet | 1. Ambil sampel nomor struk yang dihasilkan sistem | Nomor struk memenuhi pola `^[A-Z]{3}-\d{8}-\d{4}$` dan nomor urut teratur | Seluruh nomor struk cocok dengan regex standar (contoh: `TBT-20261026-0006`) | **PASS** | `tests/capstone-audit-full.test.ts` (BR-04) |
| **TC-TRX-05** | BR-06, US-02 | Validasi batas diskon maksimal 10% dan alasan diskon | Subtotal keranjang Rp100.000 | 1. Input diskon Rp20.000 (20%)<br>2. Input diskon Rp5.000 tanpa alasan<br>3. Input diskon Rp5.000 dengan alasan | Kasus 1 ditolak (melebihi 10%); Kasus 2 ditolak (tanpa alasan); Kasus 3 berhasil | Ditolak oleh trigger/constraint validasi diskon database | **PASS** | `tests/capstone-audit-full.test.ts` (BR-06) |
| **TC-TRX-06** | BR-05, US-02 | Validasi kuantitas pesanan 1–99 dan penolakan produk nonaktif | Produk nonaktif `ROT-005` tersedia | 1. Coba checkout produk nonaktif<br>2. Coba checkout dengan kuantitas 0 atau 100 | Transaksi ditolak oleh validasi server dan database | Ditolak: `"Produk tidak ditemukan atau berstatus nonaktif"` | **PASS** | `tests/capstone-audit-full.test.ts` (BR-05) |
| **TC-SEC-01** | BR-11, US-09 | Kerahasiaan harga pokok penjualan (HPP) untuk non-Owner | Sesi pengguna Kasir, Kepala Toko, dan Owner | 1. Kasir query `riwayat_harga_modal`<br>2. KT query `riwayat_harga_modal`<br>3. Owner query `riwayat_harga_modal` | Kasir = 0 baris, KT = 0 baris, Owner = seluruh data riwayat modal | Kasir: 0 baris, KT: 0 baris, Owner: 20 baris riwayat modal | **PASS** | `tests/capstone-audit-full.test.ts` (BR-11) |
| **TC-VOID-01** | BR-08, US-06 | Otorisasi pembatalan (void) transaksi dan pemulihan stok | Transaksi lunas hari ini pada shift buka | 1. Kasir mencoba void<br>2. KT cabang lain mencoba void<br>3. KT cabang terkait void dengan alasan < 10 karakter<br>4. KT cabang terkait void dengan alasan >= 10 karakter | Langkah 1–3 ditolak; Langkah 4 berhasil membatalkan transaksi dan stok dikembalikan | Kasir/KT lain ditolak, alasan pendek ditolak, void sah memulihkan stok | **PASS** | `tests/capstone-audit-full.test.ts` (BR-08), `tests/meja-management.test.ts` (TC-MEJA-04) |
| **TC-LOG-01** | BR-12, US-10 | Immutabilitas audit log (larangan modifikasi & penghapusan) | Terdapat baris di tabel `audit_log` | 1. Coba jalankan `UPDATE audit_log SET aksi = 'palsu'`<br>2. Coba jalankan `DELETE FROM audit_log` | Operasi UPDATE dan DELETE diblokir oleh trigger database | Trigger `trg_cegah_modifikasi_audit_log` menolak modifikasi data | **PASS** | `tests/capstone-audit-full.test.ts` (BR-12) |
| **TC-KDS-01** | US-03, KDS | Siklus status antrean pengerjaan pesanan dan pemisahan pembayaran | Pesanan baru masuk antrean KDS | 1. Transisi: `MENUNGGU` $\rightarrow$ `DIPROSES`<br>2. Transisi: `DIPROSES` $\rightarrow$ `SIAP_DIAMBIL`<br>3. Transisi: `SIAP_DIAMBIL` $\rightarrow$ `SELESAI` | Status pengerjaan berpindah secara tertib; status pembayaran keuangan tetap `lunas` | Alur pengerjaan terekam lengkap tanpa mengganggu status pembayaran | **PASS** | `tests/order-flow-queue.test.ts` (TC-ORD-04, TC-ORD-06) |
| **TC-MEJA-01** | Value-Added | Siklus hidup meja makan Dine In dan pencegahan konflik ganda | Meja `M-01` cabang Tebet berstatus `tersedia` | 1. Kasir 1 menempati meja untuk transaksi A<br>2. Kasir 2 mencoba menempati meja yang sama<br>3. Tamu selesai makan, meja diubah ke `menunggu_dibersihkan`<br>4. Meja dibersihkan kembali ke `tersedia` | Kasir 1 berhasil, Kasir 2 ditolak; Meja kotor tidak dapat dipesan sebelum dibersihkan | Pencegahan konflik meja dan siklus kebersihan terverifikasi | **PASS** | `tests/meja-management.test.ts` (TC-MEJA-03, TC-MEJA-05) |
| **TC-MYR-01** | Value-Added | Keamanan token webhook Mayar dan idempotensi event duplikat | Webhook endpoint `/api/webhooks/mayar` | 1. Kirim webhook tanpa header token<br>2. Kirim webhook dengan token palsu<br>3. Kirim webhook sah yang sama sebanyak 2 kali | Percobaan 1–2 mengembalikan HTTP 401; Percobaan 3 memproses event pertama dan mengabaikan event kedua secara idempoten | HTTP 401 untuk token tidak sah; event ganda tidak memproses ulang transaksi | **PASS** | `tests/qris-mayar.test.ts` (TC-MAYAR-01, TC-MAYAR-02) |
| **TC-MYR-02** | Value-Added | Proteksi amount mismatch dan mitigasi late payment pada QRIS | Transaksi QRIS dengan tagihan Rp68.000 | 1. Simulasi pembayaran gateway dengan nilai berbeda (misal Rp50.000)<br>2. Simulasi webhook tiba saat transaksi sudah dibatalkan | Transaksi amount mismatch ditolak; pembayaran terlambat ditandai tanpa melunasi transaksi batal | Amount mismatch dicegah; transaksi batal ditandai `late_payment_flagged` | **PASS** | `tests/qris-mayar.test.ts` (TC-MAYAR-03), `tests/order-flow-thorough.test.ts` |
| **TC-RLS-01** | BR-11, BR-12 | Akses data sensitif menggunakan sesi pengguna biasa (Non-Service Role) | Kredensial pengguna Kasir, KT, dan Owner | 1. Inisialisasi Supabase Client dengan `NEXT_PUBLIC_SUPABASE_ANON_KEY`<br>2. Autentikasi menggunakan `signInWithPassword`<br>3. Jalankan query ke `riwayat_harga_modal`, `audit_log`, `transaksi` | Kebijakan RLS membatasi baris data secara ketat sesuai peran pengguna yang login | Terbukti membatasi data; bukan karena service role key | **PASS** | `tests/capstone-audit-full.test.ts` (BR-01, BR-11, BR-12) |
| **TC-VAR-01** | Value-Added | Perhitungan delta harga varian Large Cup (+Rp5.000) dan label opsi | Produk kopi (misal: Americano Rp22.000) | 1. Pilih varian Regular Cup<br>2. Pilih varian Large Cup (+Rp5.000) | Regular dihitung Rp22.000; Large dihitung Rp27.000; Label struk memuat rincian kustomisasi | Perhitungan delta harga dan penamaan item rapi | **PASS** | `tests/product-customization-and-variants.test.ts` (TC-VAR-01, TC-VAR-04) |
| **TC-UI-01** | US-03, Non-Func | Verifikasi manual dialog cetak struk dan responsivitas tablet produksi | Perangkat tablet / browser pada `https://asna-lumbung-pos.netlify.app/` | 1. Buka halaman kasir di browser tablet<br>2. Selesaikan transaksi tunai<br>3. Klik tombol Cetak Struk | Layout kartu produk dan ringkasan order rapi di breakpoint $\ge$ 1024px; dialog cetak printer thermal muncul | Menunggu pengujian manual oleh penguji pada perangkat fisik produksi | **BELUM DIUJI** | Placeholder pengujian manual produksi (Memerlukan browser fisik & printer thermal) |

---

## 4. Dokumentasi Hasil Automated Test Suite

### 4.1. Rekapitulasi Output Eksekusi `npm test`
Pengujian otomatis dijalankan secara sekuensial (`--test-concurrency=1`) dengan membaca konfigurasi `.env.local`:

```text
> lumbung-pos@0.1.0 test
> node --env-file=.env.local --experimental-strip-types --test --test-concurrency=1 tests/auth-account-status.test.ts tests/qris-mayar.test.ts tests/format.test.ts tests/order-flow-queue.test.ts tests/meja-management.test.ts tests/capstone-audit-full.test.ts tests/product-customization-and-variants.test.ts

✔ Pengujian Penanganan Status Akun (Login & Profil) (1125.4321ms)
✔ Pengujian Integrasi QRIS Dinamis Mayar API V2 (Lumbung POS) (3238.8165ms)
✔ Pengujian Utilitas Format Standar Lumbung POS (0.9124ms)
✔ Pengujian Alur Terpadu Antrean Pesanan & Denah Meja (Lumbung POS) (2.8123ms)
✔ Suite Pengujian Manajemen Denah Meja, Kapasitas Fisik, dan Integritas KDS (Lumbung POS) (4.1672ms)
✔ Pengujian Komprehensif Capstone Project Lumbung POS (BR-01 s/d BR-12) (7451.2811ms)
✔ TC-VAR-01 s/d TC-VAR-08: Kustomisasi Produk, Varian Harga, dan Sinkronisasi Antrean Modern (3.4215ms)

ℹ tests 64
ℹ suites 6
ℹ pass 64
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14675.8018
```

### 4.2. Pemetaan Test Suite ke Area Kebutuhan

| Berkas Test Suite | Jumlah Test | Area Requirement yang Diverifikasi | Status Aktual |
| :--- | :---: | :--- | :---: |
| `tests/auth-account-status.test.ts` | 5 | Penanganan login akun aktif/nonaktif, integrasi Supabase Auth, evaluasi role profil, dan pesan penolakan ramah. | **64/64 PASS** |
| `tests/qris-mayar.test.ts` | 12 | Integrasi QRIS Mayar API v2, timing-safe token validator webhook, penolakan HTTP 401/400, idempotensi event, penanganan late payment, pemulihan stok 1x, dan proteksi rahasia server. | **64/64 PASS** |
| `tests/format.test.ts` | 9 | Standarisasi format Rupiah (`Rp15.000`), batas nilai 0/NaN, diskon bertanda minus, format bilangan bulat pemisah titik, persentase, dan konversi zona waktu WIB. | **64/64 PASS** |
| `tests/order-flow-queue.test.ts` | 8 | Penomoran antrean otomatis per cabang, siklus hidup meja Dine In, pencegahan konflik meja ganda, state machine KDS, pemisahan status pembayaran vs pengerjaan, dan isolasi antrean antar-cabang. | **64/64 PASS** |
| `tests/meja-management.test.ts` | 9 | Geometri dan kapasitas kursi meja fisik (lingkaran, persegi, panjang), filter zonasi area (Indoor/Outdoor/Teras), pelepasan meja saat void, siklus kebersihan meja, dan form konfigurasi meja. | **64/64 PASS** |
| `tests/capstone-audit-full.test.ts` | 12 | Pengujian menyeluruh aturan bisnis inti BR-01 sampai BR-12 langsung ke database Supabase menggunakan sesi pengguna berizin nyata. | **64/64 PASS** |
| `tests/product-customization-and-variants.test.ts` | 8 | Modal kustomisasi menu per kategori (kopi, roti, kemasan), delta harga varian Large Cup (+Rp5.000), format penamaan item, registrasi antrean, pembaruan status QRIS, dan pembersihan antrean. | **64/64 PASS** |
| `tests/order-flow-thorough.test.ts` *(Script Khusus `npm run test:order-flow`)* | 7 | Skenario end-to-end pemesanan Dine In meja `M-02`, nama pemesan `Diwani`, 2 Large Drinks Rp68.000, penolakan nominal tidak sesuai (amount mismatch), dan konsistensi KDS. | **7/7 PASS** |

> [!IMPORTANT]
> **Batasan Hasil Pengujian Otomatis:**
> Kelulusan 64 pengujian di atas membuktikan bahwa seluruh logika bisnis di level unit, server action, RPC database, dan integritas skema berjalan 100% tanpa kesalahan. Namun, pengujian otomatis tidak menggantikan verifikasi manual antarmuka visual (seperti klik tombol di browser, rendering grafis chart SVG di layar tablet fisik, dan keluaran kertas printer kasir thermal di toko). Pengujian visual tersebut dicatat sebagai test case terpisah dengan status **BELUM DIUJI**.

---

## 5. Audit Dokumentasi Row Level Security (RLS) PostgreSQL

### 5.1. Checklist Status Row Level Security Tabel Database

Pemeriksaan skema database pada migrasi SQL dan sistem katalog `pg_tables` membuktikan seluruh 13 tabel operasional memiliki fitur Row Level Security aktif (`rowsecurity = true`):

| No | Nama Tabel | Status `rowsecurity` | Kebijakan RLS Utama (*RLS Policies*) | Batasan Akses Berdasarkan Peran |
| :---: | :--- | :---: | :--- | :--- |
| 1 | `public.cabang` | **Aktif** (`true`) | `cabang_select_policy`<br>`cabang_modify_owner` | **SELECT:** Semua staf aktif.<br>**ALL:** Khusus Owner. |
| 2 | `public.profiles` | **Aktif** (`true`) | `profiles_select_policy`<br>`profiles_update_owner` | **SELECT:** Staf cabang miliknya, diri sendiri, atau Owner.<br>**UPDATE:** Khusus Owner. |
| 3 | `public.produk` | **Aktif** (`true`) | `produk_select_policy`<br>`produk_modify_owner` | **SELECT:** Produk aktif untuk semua staf aktif; seluruh produk untuk Owner.<br>**ALL:** Khusus Owner. |
| 4 | `public.riwayat_harga_modal` | **Aktif** (`true`) | `riwayat_modal_owner_only` | **ALL:** Tertutup rapat khusus Owner (`auth_user_role() = 'owner'`). Kasir dan Kepala Toko menerima 0 baris. |
| 5 | `public.stok_cabang` | **Aktif** (`true`) | `stok_select_policy`<br>`stok_modify_policy` | **SELECT:** Kasir & KT hanya cabangnya; Owner semua cabang.<br>**UPDATE:** KT cabangnya atau Owner. |
| 6 | `public.shift_kasir` | **Aktif** (`true`) | `shift_select_policy` | **SELECT:** Kasir hanya shift miliknya; KT hanya shift cabangnya; Owner semua cabang. |
| 7 | `public.transaksi` | **Aktif** (`true`) | `transaksi_select_policy` | **SELECT:** Kasir hanya transaksi miliknya; KT hanya transaksi cabangnya; Owner semua cabang. |
| 8 | `public.transaksi_item` | **Aktif** (`true`) | `transaksi_item_select_policy` | **SELECT:** Mengikuti kepemilikan transaksi induk melalui subquery `EXISTS`. |
| 9 | `public.transaksi_item_modal` | **Aktif** (`true`) | `transaksi_modal_owner_only` | **ALL:** Tertutup rapat khusus Owner (`auth_user_role() = 'owner'`). Kasir dan KT dilarang membaca modal. |
| 10 | `public.mayar_webhook_events` | **Aktif** (`true`) | `mayar_webhook_owner_only` | **SELECT:** Khusus Owner untuk audit riwayat payload pembayaran gateway. |
| 11 | `public.audit_log` | **Aktif** (`true`) | `audit_log_select_owner_only` | **SELECT:** Khusus Owner.<br>**UPDATE/DELETE:** Dilarang untuk semua peran (Trigger proteksi). |
| 12 | `public.meja` | **Aktif** (`true`) | `meja_owner_select`<br>`meja_staff_cabang_select`<br>`meja_staff_update_status`<br>`meja_owner_insert`<br>`meja_owner_delete` | **SELECT:** Staf cabang miliknya atau Owner.<br>**UPDATE:** Staf cabang update status keterisian.<br>**INSERT/DELETE:** Khusus Owner. |
| 13 | `public.produk_varian` | **Aktif** (`true`) | `produk_varian_select_all`<br>`produk_varian_owner_all` | **SELECT:** Terbuka untuk seluruh staf aktif membaca katalog varian.<br>**ALL:** Khusus Owner mengelola varian. |

### 5.2. Perbedaan Krusial: `rowsecurity = true` vs Bukti Penegakan Kebijakan (*Policy Enforcement*)

> [!WARNING]
> **Pembedaan Audit Keamanan:**
> - Bukti `rowsecurity = true` pada katalog PostgreSQL (`pg_tables`) **hanya membuktikan** bahwa saklar mekanisme RLS telah dinyalakan pada tabel tersebut. Saklar aktif **belum tentu** membatasi data jika definisinya menggunakan `USING (true)` atau jika query dieksekusi menggunakan akun superuser/service-role.
> - **Bukti nyata pembatasan hak akses** hanya terverifikasi jika pengujian mengeksekusi query menggunakan token JWT akun pengguna biasa (`authenticated`) dengan klaim peran berbeda, lalu memastikan bahwa baris yang dikembalikan benar-benar terisolasi.

### 5.3. Metodologi Pengujian Kebijakan RLS yang Aman (Non-Service Role)
Untuk menguji keabsahan RLS tanpa merusak data atau membocorkan hak akses:

1. **Gunakan Kunci Publik Anonymous (`NEXT_PUBLIC_SUPABASE_ANON_KEY`):**
   Dilarang keras menggunakan `SUPABASE_SERVICE_ROLE_KEY` dalam pengujian RLS, karena kunci *service role* secara otomatis membypass seluruh kebijakan RLS di Supabase.

2. **Inisialisasi Klien Terautentikasi Pengguna:**
   ```typescript
   import { createClient } from '@supabase/supabase-js';

   const userClient = createClient(
     process.env.NEXT_PUBLIC_SUPABASE_URL!,
     process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
   );

   // Autentikasi sebagai Kasir Tebet
   await userClient.auth.signInWithPassword({
     email: 'dimas.kasir.tebet@lumbung.test',
     password: 'Latihan#2026',
   });

   // Pengujian RLS 1: Uji Kerahasiaan Harga Modal (BR-11)
   const { data: modalKasir } = await userClient
     .from('riwayat_harga_modal')
     .select('*');
   // Ekspektasi: data bernilai [] (0 baris), membuktikan RLS aktif menolak kasir.

   // Pengujian RLS 2: Uji Isolasi Transaksi Cabang (BR-01)
   const { data: trxKasir } = await userClient
     .from('transaksi')
     .select('cabang_id');
   // Ekspektasi: seluruh transaksi yang diterima hanya memiliki cabang_id Tebet.
   ```

3. **Prinsip Read-Only dalam Audit:**
   Audit RLS dilakukan secara murni membaca (*SELECT*) data acuan yang ada tanpa menjalankan operasi mutasi (*UPDATE* atau *DELETE*) pada tabel transaksi historis dan stok cabang.

---

## 6. Daftar Kasus Uji yang Masih Berstatus BELUM DIUJI

Sesuai ketentuan integritas pelaporan, kasus uji yang bergantung pada pengujian fisik di lingkungan produksi dan belum dieksekusi secara manual oleh pengguna dicatat di bawah ini:

| ID Test Case | Nama Skenario Pengujian | Komponen yang Diuji | Alasan Status BELUM DIUJI | Langkah Verifikasi yang Harus Dilakukan Pengguna |
| :--- | :--- | :--- | :--- | :--- |
| **TC-UI-01** | Pengujian Cetak Struk Fisik & Peramban Produksi | Halaman `/kasir` pada [https://asna-lumbung-pos.netlify.app/](https://asna-lumbung-pos.netlify.app/) | Memerlukan perangkat keras peramban fisik dan printer thermal nyata (58mm/80mm) yang terhubung. | Login sebagai Kasir di domain produksi, selesaikan 1 transaksi tunai, tekan tombol cetak, dan pastikan jendela preview cetak browser menampilkan rincian struk tanpa terpotong. |
| **TC-UI-02** | Pengujian Responsivitas Multi-Touch Tablet Asli | Tampilan Tablet POS ($\ge$ 1024px) | Memerlukan perangkat fisik iPad atau Tablet Android untuk memvalidasi kenyamanan gestur sentuh satu tangan pada kasir. | Buka website produksi pada tablet fisik minimal 10 inci, uji kenyamanan tap kartu menu, buka modal kustomisasi, dan pastikan bilah keranjang pesanan berada di sisi kanan (*sticky*). |
| **TC-GATEWAY-LIVE** | Pembayaran QRIS pada Lingkungan Live Mayar | Endpoint Mayar Live Production | Konfigurasi saat ini menggunakan akun Sandbox Mayar untuk keperluan simulasi uji coba. | Jika merchant mengaktifkan mode produksi di masa mendatang, lakukan pembayaran nominal Rp1.000 menggunakan aplikasi m-banking nyata ke QRIS dinamis yang diterbitkan. |

---

## 7. Panduan Langkah Manual untuk Pengguna (Next Action Steps)

Berikut adalah panduan tindakan manual yang disarankan untuk Anda sebelum mengajukan evaluasi capstone project:

1. **Tinjau Perubahan Dokumentasi:**
   Periksa berkas [docs/TEST_PLAN_LUMBUNG_POS.md](file:///d:/lumbung-pos/docs/TEST_PLAN_LUMBUNG_POS.md) dan [README.md](file:///d:/lumbung-pos/README.md) untuk memastikan seluruh informasi telah selaras dengan kondisi repositori.
2. **Jalankan Verifikasi Lokal Mandiri:**
   ```bash
   # Jalankan linter kode
   npm run lint

   # Jalankan seluruh test suite unit & integrasi
   npm test

   # Jalankan test alur pesanan mendalam
   npm run test:order-flow

   # Jalankan build produksi
   npm run build
   ```
3. **Lakukan Uji Petik Manual pada Website Produksi:**
   Buka [https://asna-lumbung-pos.netlify.app/](https://asna-lumbung-pos.netlify.app/) di peramban Anda:
   - Coba masuk menggunakan akun Kasir (`dimas.kasir.tebet@lumbung.test` / `Latihan#2026`) $\rightarrow$ pastikan masuk ke `/kasir`.
   - Coba masuk menggunakan akun Kepala Toko (`bayu.kt.tebet@lumbung.test` / `Latihan#2026`) $\rightarrow$ pastikan masuk ke `/transaksi`.
   - Coba masuk menggunakan akun Owner (`ratna.owner@lumbung.test` / `Latihan#2026`) $\rightarrow$ pastikan masuk ke `/laporan` dan kartu Laba Kotor tampil.
   - Coba masuk menggunakan akun Nonaktif (`rizky.kasir.depok@lumbung.test` / `Latihan#2026`) $\rightarrow$ pastikan dialihkan ke `/nonaktif`.
4. **Verifikasi Header HTTP pada Domain Produksi:**
   Jalankan perintah `curl` setelah deployment terbaru:
   ```powershell
   curl.exe -I https://asna-lumbung-pos.netlify.app/login
   ```
   Pastikan header `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet` muncul pada respons.
5. **Commit dan Push ke GitHub:**
   Setelah Anda puas dengan hasil pemeriksaan, lakukan commit dan push secara manual ke branch `master`.
