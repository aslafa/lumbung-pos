# Lumbung Kopi dan Roti — Sistem Point of Sale (POS) Multi-Cabang

**Lumbung POS** adalah platform sistem kasir (*Point of Sale*) multi-cabang modern yang dirancang untuk mendukung operasional terpadu kedai kopi dan roti **Lumbung Kopi dan Roti**. Sistem ini mengintegrasikan seluruh alur bisnis dari hulu ke hilir: mulai dari transaksi kasir berkecepatan tinggi, kustomisasi varian menu, manajemen meja *Dine In*, antrean pesanan dapur secara *real-time* (Kitchen Display System), pembukuan shift dan rekonsiliasi uang kasir, validasi stok terisolasi per cabang, hingga laporan performa omzet dan analitik margin laba konsolidasian khusus pemilik toko (*Owner*).

---

## Daftar Isi
1. [Latar Belakang](#latar-belakang)
2. [Fitur Aplikasi](#fitur-aplikasi)
   - [Fitur Utama](#fitur-utama)
   - [Fitur Tambahan (Value-Added)](#fitur-tambahan-value-added)
   - [Fitur yang Memerlukan Konfigurasi Eksternal](#fitur-yang-memerlukan-konfigurasi-eksternal)
3. [Hak Akses Pengguna (Role-Based Access Control)](#hak-akses-pengguna-role-based-access-control)
4. [Akun Uji Coba (Demo & Testing Credentials)](#akun-uji-coba-demo--testing-credentials)
5. [Teknologi yang Digunakan](#teknologi-yang-digunakan)
6. [Struktur Proyek](#struktur-proyek)
7. [Cara Menjalankan Aplikasi](#cara-menjalankan-aplikasi)
   - [Prasyarat Sistem](#prasyarat-sistem)
   - [Langkah Instalasi dan Setup](#langkah-instalasi-dan-setup)
   - [Perintah Menjalankan Aplikasi](#perintah-menjalankan-aplikasi)
8. [Konfigurasi Environment](#konfigurasi-environment)
9. [Database dan Migrasi](#database-dan-migrasi)
10. [Catatan Keputusan Arsitektur & Teknis (ADR)](#catatan-keputusan-arsitektur--teknis-adr)
11. [Pengujian dan Kualitas Kode](#pengujian-dan-kualitas-kode)
12. [Keamanan](#keamanan)
13. [Lisensi](#lisensi)

---

## Latar Belakang

Operasional kedai kopi dan roti multi-cabang menghadapi berbagai tantangan pencatatan manual dan sistem kasir konvensional yang terfragmentasi:

- **Risiko Ketidakkonsistenan Penjualan dan Stok:** Penjualan bersamaan saat jam sibuk berisiko menyebabkan stok bernilai negatif atau selisih fisik barang.  
  *Solusi Lumbung POS:* Validasi stok atomik dengan mekanisme penguncian baris (`FOR UPDATE`) di level database Supabase/PostgreSQL serta transaksi all-or-nothing (tanpa potongan stok parsial).
- **Penomoran Struk Tidak Teratur:** Kurangnya standarisasi penomoran struk mempersulit pelacakan transaksi antar-cabang.  
  *Solusi Lumbung POS:* Penomoran struk terstandarisasi dengan format otomatis `[KODE_CABANG]-[YYYYMMDD]-[0001..]` yang urut per cabang per hari dan aman terhadap *race condition*.
- **Risiko Selisih Kas saat Pergantian Shift:** Ketidaksesuaian antara uang tunai di laci kasir dan catatan penjualan sistem sering tidak teridentifikasi penyebabnya.  
  *Solusi Lumbung POS:* Manajemen shift kasir terstruktur dengan batas kas awal, perhitungan kas sistem otomatis, validasi uang fisik, serta kewajiban mengisi catatan rekonsiliasi jika selisih kas melebihi Rp20.000.
- **Kesulitan Pengawasan Multi-Cabang bagi Pemilik:** Owner kesulitan memantau performa penjualan dan profitabilitas per cabang secara konsolidasi tanpa membocorkan data harga pokok penjualan (HPP/COGS) kepada staf cabang.  
  *Solusi Lumbung POS:* Isolasi data berbasis cabang melalui Row Level Security (RLS) di database. Kasir dan Kepala Toko hanya dapat mengakses data cabangnya tanpa melihat harga modal, sementara Owner dapat memantau seluruh cabang dan margin laba kotor.
- **Alur Pelayanan dan Pesanan Dine-In yang Kurang Terstruktur:** Pesanan makan di tempat sering kali mengalami kendala pelacakan nomor meja dan antrean pesanan di meja barista/dapur.  
  *Solusi Lumbung POS:* Fitur denah meja interaktif (*Dine-In Table Management*) dan integrasi antrean pesanan dapur (Kitchen Display System/KDS) real-time.

---

## Fitur Aplikasi

Fitur aplikasi dikelompokkan secara jelas berdasarkan implementasi aktual di dalam basis kode:

### Fitur Utama

1. **Autentikasi & Otorisasi Berbasis Peran (RBAC):**
   - Otentikasi sesi berbasis cookie melalui Supabase SSR Auth.
   - Pembagian hak akses menjadi 3 peran: **Kasir**, **Kepala Toko**, dan **Owner**.
   - Route guard otomatis via middleware (`src/middleware.ts`) dan verifikasi lapis kedua di Server Actions.
   - Penanganan akun nonaktif: Akun dengan status `aktif = false` langsung diblokir dan diarahkan ke halaman `/nonaktif`.

2. **Kasir dan Transaksi Penjualan (`/kasir`):**
   - Katalog produk dengan filter kategori (*kopi*, *non_kopi*, *roti*, *snack*, *kemasan*) dan kolom pencarian.
   - Keranjang belanja interaktif: pengaturan kuantitas (dibatasi 1–99), ringkasan subtotal, total akhir, dan catatan pesanan.
   - Pilihan tipe pesanan (*Dine In* dengan pemilihan meja atau *Takeaway*).
   - Validasi diskon: Diskon maksimal 10% dari subtotal, wajib menyertakan alasan diskon jika diskon > Rp0.
   - Pembayaran tunai: Validasi uang diterima harus mencukupi, perhitungan kembalian otomatis, dan penolakan transaksi jika uang kurang.
   - Penomoran struk urut per cabang dan dialog cetak struk thermal standar browser.

3. **Manajemen Produk dan Harga (`/produk`):**
   - Khusus diakses oleh **Owner**.
   - Pengelolaan katalog produk: SKU, nama, kategori, harga jual, status lacak stok, dan status aktif/nonaktif.
   - Pencatatan riwayat harga modal (COGS) terlindungi yang hanya dapat dilihat oleh Owner.

4. **Manajemen Stok Cabang (`/stok`):**
   - Pemantauan jumlah stok fisik per cabang secara real-time.
   - Peringatan visual untuk stok menipis (di bawah batas minimum) dan stok habis (0).
   - Formulir penyesuaian stok oleh **Kepala Toko** atau **Owner** dengan tipe: *Barang Masuk*, *Barang Rusak*, dan *Stock Opname* disertai alasan mutasi.
   - Jaminan database agar jumlah stok tidak pernah bernilai negatif.

5. **Manajemen Shift Kasir (`/shift-saya` dan `/shift-cabang`):**
   - **Buka Shift:** Wajib dilakukan sebelum transaksi dapat dibuat; validasi kas awal antara Rp0 hingga Rp2.000.000; pembatasan maksimal 1 shift buka per kasir.
   - **Tutup Shift:** Perhitungan kas sistem otomatis dari kas awal ditambah akumulasi tunai lunas; input kas akhir fisik; kalkulasi selisih kas; form catatan penjelasan wajib jika selisih > Rp20.000.
   - **Verifikasi Shift:** Kepala Toko atau Owner memeriksa dan memverifikasi shift yang sudah berstatus `ditutup` menjadi `diverifikasi`.

6. **Riwayat Transaksi dan Pembatalan/Void (`/transaksi`):**
   - Daftar riwayat transaksi penjualan terfilter berdasarkan cabang dan rentang tanggal.
   - Detail struk transaksi lengkap dengan rincian item, kustomisasi varian, dan bukti pembayaran.
   - Fitur **Void Transaksi:** Hanya dapat dieksekusi oleh Kepala Toko cabang terkait atau Owner untuk transaksi lunas pada hari yang sama saat shift kasir masih buka, dengan alasan pembatalan minimal 10 karakter dan pengembalian stok otomatis.

7. **Laporan & Analitik Penjualan (`/laporan`):**
   - Dapat diakses oleh Kepala Toko (terisolasi pada cabangnya) dan Owner (seluruh cabang).
   - **4 Visualisasi Data Interaktif:**
     1. *Grafik Tren Penjualan Harian (SVG Line/Area Chart)* dengan titik interaktif dan tooltip.
     2. *Grafik Komposisi Metode Pembayaran (SVG Donut Chart)* untuk perbandingan transaksi Tunai vs QRIS.
     3. *Grafik 10 Produk Terlaris (Horizontal Bar Chart)* berdasarkan kuantitas terjual dan omzet.
     4. *Grafik Perbandingan Omzet Antar-Cabang (Multi-Branch Bar Chart)* khusus Owner.
   - Metrik laba kotor, HPP, dan persentase margin kotor yang terlindungi ketat dan hanya ditampilkan kepada Owner.
   - Tabel ringkasan selisih kas per shift untuk audit rekonsiliasi kasir.

---

### Fitur Tambahan (Value-Added)

1. **Kustomisasi Minuman dan Varian Harga:**
   - Modal kustomisasi produk: pilihan suhu (*Panas/Dingin*), level gula (*Normal/Kurang Gula/Tanpa Gula*), level es (*Normal/Sedikit Es/Tanpa Es*).
   - Pilihan varian ukuran: **Regular Cup** (harga dasar) dan **Large Cup** (tambahan biaya ukuran +Rp5.000 per cup).
   - Kustomisasi khusus kategori roti (opsi dihangatkan) dan biji kopi kemasan (pilihan tingkat gilingan *Fine*, *Medium*, *Coarse*, atau *Whole Beans*).

2. **Manajemen Meja Interaktif (`/meja`):**
   - Visualisasi denah meja kedai kopi per cabang.
   - Menampilkan nomor meja, kapasitas kursi, area (*Indoor* / *Outdoor*), bentuk meja (*lingkaran*, *persegi*, *panjang*), serta status keterisian (*tersedia*, *terisi*, *kotor*).
   - Integrasi langsung dengan pemesanan kasir untuk pesanan *Dine In*.

3. **Antrean Pesanan & Kitchen Display System / KDS (`/antrean`):**
   - Layar antrean real-time untuk barista dan staf dapur.
   - Nomor antrean harian otomatis (contoh: `A-001`, `A-002`).
   - Alur status tahapan pesanan: **Menunggu** $\rightarrow$ **Diproses** $\rightarrow$ **Siap Disajikan** $\rightarrow$ **Selesai**.
   - Modal pelacakan pesanan (*Order Tracking Modal*) untuk kasir dan pelanggan.

4. **Tema Gelap & Terang (Dark / Light Mode):**
   - Dukungan tema antarmuka terang dan gelap yang dapat disesuaikan melalui tombol toggle di header navigasi, dengan preferensi tersimpan di local storage.

5. **Antarmuka Responsif:**
   - Navigasi bilah samping (*SidebarNav*) untuk perangkat desktop dan tablet.
   - Laci navigasi geser (*MobileDrawerNav*) dan header adaptif untuk kemudahan pengoperasian di perangkat smartphone atau tablet kasir.

---

### Fitur yang Memerlukan Konfigurasi Eksternal

1. **Pembayaran QRIS Dinamis melalui Gateway Mayar:**
   - Pembuatan invoice QRIS dinamis secara real-time via Mayar API v2.
   - Polling status pembayaran otomatis pada dialog kasir.
   - Endpoint webhook di `/api/webhooks/mayar` dengan validasi token keamanan untuk pembaruan status transaksi menjadi `lunas` secara otomatis.
   - Proteksi *amount mismatch* (menolak pembayaran jika nilai yang dibayar berbeda dari tagihan transaksi) dan penanganan idempotensi event webhook.
   - *Prasyarat:* Memerlukan `MAYAR_API_KEY` dan `MAYAR_WEBHOOK_TOKEN` yang terdaftar pada dashboard akun Mayar (Sandbox maupun Live).

---

## Hak Akses Pengguna (Role-Based Access Control)

Penegakan hak akses diterapkan secara ketat pada tiga lapisan: navigasi UI, Next.js Server Actions, dan Row Level Security (RLS) PostgreSQL:

| Modul / Tindakan | Kasir | Kepala Toko | Owner | Mekanisme Penegakan Keamanan |
| :--- | :---: | :---: | :---: | :--- |
| **Akses Halaman POS (`/kasir`)** | ✅ Cabang Sendiri | ✅ Cabang Sendiri | ✅ Semua Cabang | Middleware & Server Action |
| **Buka & Tutup Shift Sendiri** | ✅ | ❌ | ❌ | RPC `tutup_shift` & Check ID Kasir |
| **Melihat Shift Seluruh Staf Cabang** | ❌ | ✅ Cabang Sendiri | ✅ Semua Cabang | RLS Policy `shift_kasir` |
| **Verifikasi Shift Kasir (`/shift-cabang`)** | ❌ | ✅ Cabang Sendiri | ✅ Semua Cabang | RPC `verifikasi_shift` (Role Guard) |
| **Transaksi Penjualan (Tunai / QRIS)** | ✅ | ✅ | ✅ | Server Action & RPC Transaksi |
| **Void Transaksi Penjualan** | ❌ | ✅ Cabang Sendiri | ✅ Semua Cabang | RPC `void_transaksi` (Role & Cabang Guard) |
| **Penyesuaian Stok (Masuk/Rusak/Opname)** | ❌ (Hanya lihat stok) | ✅ Cabang Sendiri | ✅ Semua Cabang | Server Action `sesuaikanStok` & RLS |
| **Kelola Master Produk & Harga Jual** | ❌ | ❌ | ✅ | Server Action & RLS `produk` |
| **Melihat Harga Modal (COGS) & Laba** | ❌ (Dibatasi 0 baris) | ❌ (Dibatasi 0 baris) | ✅ Terbuka Penuh | RLS Policy `riwayat_harga_modal` |
| **Melihat Laporan Omzet Penjualan** | ❌ | ✅ Cabang Sendiri | ✅ Semua Cabang | Server-side query guard di `/laporan` |
| **Kelola Pengguna, Akun, & Cabang** | ❌ | ❌ | ✅ | Next.js Server Action Admin Client |
| **Melihat Audit Log Aktivitas Sensitif** | ❌ | ❌ | ✅ | RLS Policy `audit_log` (Owner Only View) |
| **Mengubah / Menghapus Audit Log** | ❌ DILARANG | ❌ DILARANG | ❌ DILARANG | RLS Database (Tanpa Grant UPDATE/DELETE) |

---

## Akun Uji Coba (Demo & Testing Credentials)

Berikut adalah daftar 9 akun pengguna yang telah terkonfigurasi pada basis data Supabase untuk pengujian alur bisnis seluruh peran:

> **Kata Sandi Standar untuk Seluruh Akun Uji:** `Latihan#2026`

| Peran | Nama Staf | Email Login | Cabang Penugasan | Status | Tujuan / Skenario Pengujian |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **Kasir** | Dimas Arya | `dimas.kasir.tebet@lumbung.test` | Lumbung Tebet (TBT) | **Aktif** | Alur utama kasir: buka shift, pesanan POS, pembayaran tunai/QRIS, tutup shift |
| **Kasir** | Putri Maharani | `putri.kasir.tebet@lumbung.test` | Lumbung Tebet (TBT) | **Aktif** | Uji shift bergantian antar-kasir pada cabang yang sama |
| **Kasir** | Fajar Nugroho | `fajar.kasir.bintaro@lumbung.test` | Lumbung Bintaro (BTR) | **Aktif** | Uji isolasi transaksi dan katalog stok Cabang Bintaro |
| **Kasir** | Wulan Sari | `wulan.kasir.depok@lumbung.test` | Lumbung Depok (DPK) | **Aktif** | Uji isolasi transaksi dan antrean KDS Cabang Depok |
| **Kasir** | Rizky Ramadhan | `rizky.kasir.depok@lumbung.test` | Lumbung Depok (DPK) | **Nonaktif** | **Kasus Uji Batas BR-01:** Verifikasi penolakan login dan pengalihan ke `/nonaktif` |
| **Kepala Toko** | Bayu Prasetyo | `bayu.kt.tebet@lumbung.test` | Lumbung Tebet (TBT) | **Aktif** | Verifikasi shift kasir Tebet, void transaksi hari ini, mutasi stok cabang |
| **Kepala Toko** | Sekar Ayuningtyas | `sekar.kt.bintaro@lumbung.test` | Lumbung Bintaro (BTR) | **Aktif** | Supervisi operasional dan verifikasi shift Cabang Bintaro |
| **Kepala Toko** | Hendra Saputra | `hendra.kt.depok@lumbung.test` | Lumbung Depok (DPK) | **Aktif** | Supervisi operasional dan mutasi stok Cabang Depok |
| **Owner** | Ratna Kusumawardani | `ratna.owner@lumbung.test` | **Semua Cabang** | **Aktif** | Akses laporan laba kotor konsolidasian, HPP/COGS, audit log, kelola produk & akun |

---

## Teknologi yang Digunakan

- **Framework Web:** [Next.js](https://nextjs.org/) versi 16.4.2 (App Router, Server Actions, Partial Prerendering, Turbopack).
- **Library UI:** [React](https://react.dev/) versi 19.3.0.
- **Bahasa Pemrograman:** [TypeScript](https://www.typescriptlang.org/) versi 5.
- **Styling & Desain:** [Tailwind CSS](https://tailwindcss.com/) versi 4.
- **Ikon Antarmuka:** [Lucide React](https://lucide.dev/) versi 1.61.0.
- **Backend & Database:** [Supabase](https://supabase.com/) & [PostgreSQL](https://www.postgresql.org/) (Row Level Security, Stored Procedures/RPC, Partial Unique Indexes, Check Constraints).
- **Supabase SDK:** `@supabase/supabase-js`, `@supabase/ssr`, dan `@supabase/server`.
- **Payment Gateway:** [Mayar API v2](https://mayar.id/) (Integrasi QRIS dinamis & webhook).
- **Test Runner:** Node.js Native Test Runner (`node:test`, `node:assert/strict`) dan `tsx`.

---

## Struktur Proyek

```text
lumbung-pos/
├── docs/
│   └── AUDIT_PRD_SECURITY_REPORT.md
├── public/
│   └── images/products/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (dashboard)/
│   │   │   ├── antrean/
│   │   │   ├── kasir/
│   │   │   ├── laporan/
│   │   │   ├── meja/
│   │   │   ├── pengaturan/
│   │   │   ├── produk/
│   │   │   ├── shift-cabang/
│   │   │   ├── shift-saya/
│   │   │   ├── stok/
│   │   │   └── transaksi/
│   │   ├── actions/
│   │   ├── api/
│   │   │   └── webhooks/mayar/
│   │   ├── nonaktif/
│   │   └── globals.css
│   ├── components/
│   │   ├── brand/
│   │   ├── layout/
│   │   ├── meja/
│   │   ├── orders/
│   │   ├── pos/
│   │   ├── theme/
│   │   └── ui/
│   ├── lib/
│   │   ├── auth/
│   │   ├── mayar/
│   │   ├── orders/
│   │   ├── products/
│   │   ├── supabase/
│   │   └── utils/
│   └── middleware.ts
├── supabase/
│   └── migrations/
├── tests/
├── .env.local.example
├── package.json
└── tsconfig.json
```

---

## Cara Menjalankan Aplikasi

Ikuti panduan langkah demi langkah berikut untuk menjalankan aplikasi Lumbung POS di lingkungan lokal Anda:

### Prasyarat Sistem
- **Node.js:** Versi 20.x atau lebih baru (disarankan Node.js LTS v20 atau v22).
- **npm:** Versi 10.x atau lebih baru.
- **Git:** Untuk kloning kode sumber.
- **Proyek Supabase:** Akun Supabase aktif (Cloud maupun Supabase CLI lokal) dengan ekstensi `pgcrypto` aktif.

### Langkah Instalasi dan Setup

1. **Clone Repository:**
   ```bash
   git clone https://github.com/aslafa/lumbung-pos.git
   cd lumbung-pos
   ```

2. **Instal Seluruh Dependensi:**
   ```bash
   npm install
   ```

3. **Konfigurasi Berkas Environment:**
   Salin berkas `.env.local.example` menjadi `.env.local`:
   ```bash
   cp .env.local.example .env.local
   ```
   Buka berkas `.env.local` dan isi kredensial Supabase Anda:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-publishable-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-secret-key
   MAYAR_API_KEY=your-mayar-api-key
   MAYAR_WEBHOOK_TOKEN=your-mayar-webhook-token
   ```

4. **Terapkan Migrasi Database SQL ke Supabase:**
   Jalankan seluruh 10 berkas migrasi SQL yang berada di direktori `supabase/migrations/` secara berurutan pada SQL Editor Supabase:
   - `20261022000001_create_pos_schema_and_policies.sql` (Skema 9 tabel inti & RLS)
   - `20261022000002_seed_initial_data.sql` (Seed cabang, produk, dan modal)
   - `20261022000003_grant_permissions.sql` (Izin hak akses SQL)
   - `20261022000004_fix_profiles_rls_for_inactive_users.sql` (RLS akun nonaktif)
   - `20261022000005_import_historical_data.sql` (Data historis transaksi & shift)
   - `20261022000006_add_mayar_qris_functions.sql` (Fungsi settlement Mayar)
   - `20261023000001_add_table_management_and_kds_queue.sql` (Antrean pesanan KDS)
   - `20261024000001_create_meja_and_areas.sql` (Tabel meja & denah area)
   - `20261026000001_add_product_variants_and_order_fields.sql` (Varian Large Cup)
   - `20261026000002_add_transaksi_order_and_table_columns.sql` (Kolom Dine In & Meja)

### Perintah Menjalankan Aplikasi

- **Menjalankan Server Pengembangan (Development Server):**
  ```bash
  npm run dev
  ```
  Buka peramban web pada alamat:
  ```text
  http://localhost:3000
  ```
  Masuk menggunakan salah satu akun pada tabel [Akun Uji Coba](#akun-uji-coba-demo--testing-credentials) (misal: Kasir Tebet `dimas.kasir.tebet@lumbung.test` dengan kata sandi `Latihan#2026`).

- **Membangun & Menjalankan Mode Produksi (Production Build):**
  ```bash
  # 1. Kompilasi build Next.js
  npm run build

  # 2. Jalankan server produksi
  npm run start
  ```

- **Menjalankan Seluruh Pengujian Otomatis:**
  ```bash
  # Menjalankan 64 test case unit & integrasi
  npm test

  # Menjalankan 7 test case alur pemesanan menyeluruh
  npm run test:order-flow
  ```

---

## Konfigurasi Environment

Aplikasi membaca konfigurasi lingkungan melalui berkas `.env.local`. Variabel yang digunakan dirangkum dalam tabel berikut:

| Nama Variabel | Lingkup | Status | Deskripsi |
| :--- | :---: | :---: | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public (Client & Server) | **Wajib** | URL endpoint proyek Supabase (contoh: `https://xyz.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (Client & Server) | **Wajib** | Supabase Anonymous / Publishable Key untuk otentikasi sesi dan operasi berizin RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only | **Wajib** | Supabase Secret / Service Role Key untuk operasi latar belakang administratif dan webhook (tidak pernah diekspos ke browser). |
| `MAYAR_API_KEY` | Server-Only | Opsional* | API Key dari dashboard akun Mayar untuk integrasi pembuatan invoice QRIS dinamis (*wajib jika fitur QRIS digunakan). |
| `MAYAR_API_BASE_URL` | Server-Only | Opsional | URL endpoint API Mayar (default: `https://api.mayar.io/hl/v2`). |
| `MAYAR_WEBHOOK_TOKEN` | Server-Only | Opsional* | Token keamanan untuk memvalidasi keaslian header permintaan webhook dari Mayar (*wajib jika webhook aktif). |
| `MAYAR_DEBUG` | Server-Only | Opsional | Set `'true'` untuk mengaktifkan logging diagnosis integrasi Mayar pada console server. |

> [!CAUTION]
> **Peringatan Keamanan Kredensial:**  
> Berkas `.env.local` berisi kunci rahasia (`SUPABASE_SERVICE_ROLE_KEY`, `MAYAR_API_KEY`) dan **DILARANG KERAS** diunggah atau di-commit ke repository publik GitHub. Pastikan `.env.local` tercantum dalam berkas `.gitignore`.

---

## Database dan Migrasi

Sistem menggunakan database relasional PostgreSQL yang di-host pada Supabase. Seluruh skema, batasan integritas, kebijakan RLS, dan stored procedure dikelola melalui 10 berkas migrasi SQL berikut:

1. `20261022000001_create_pos_schema_and_policies.sql`:  
   Mendefinisikan 9 tabel inti (`cabang`, `profiles`, `produk`, `riwayat_harga_modal`, `stok_cabang`, `shift_kasir`, `transaksi`, `transaksi_item`, `transaksi_item_modal`, `audit_log`), check constraint validasi, indeks parsial unik, fungsi helper sesi, kebijakan Row Level Security (RLS), dan RPC transaksi inti.
2. `20261022000002_seed_initial_data.sql`:  
   Menyemai data awal master 3 cabang toko (Tebet, Bintaro, Depok), 9 akun pengguna awal, 18 katalog produk, riwayat harga modal, serta stok awal cabang.
3. `20261022000003_grant_permissions.sql`:  
   Memberikan izin hak akses SQL (`GRANT SELECT, INSERT, UPDATE`) yang tepat pada tabel dan sequence untuk role `authenticated`.
4. `20261022000004_fix_profiles_rls_for_inactive_users.sql`:  
   Menyesuaikan kebijakan RLS tabel `profiles` agar akun dengan status nonaktif dapat diverifikasi status keaktifannya oleh middleware sebelum sesi diblokir.
5. `20261022000005_import_historical_data.sql`:  
   Mengimpor 62 data transaksi historis (periode 1–15 Oktober 2026) dan 24 shift kerja untuk keperluan pengujian baseline dan audit laporan.
6. `20261022000006_add_mayar_qris_functions.sql`:  
   Menambahkan tabel `mayar_webhook_events` untuk audit payload webhook dan stored procedure `selesaikan_transaksi_mayar` dengan penanganan idempotensi pelunasan.
7. `20261023000001_add_table_management_and_kds_queue.sql`:  
   Menambahkan tabel `antrean_pesanan` untuk sinkronisasi status pesanan antrean dapur (KDS) dan nomor antrean harian.
8. `20261024000001_create_meja_and_areas.sql`:  
   Mendefinisikan tabel `meja`, area penempatan, kapasitas kursi, bentuk geometri meja, serta status ketersediaan meja makan.
9. `20261026000001_add_product_variants_and_order_fields.sql`:  
   Menambahkan tabel `produk_varian` untuk mendukung varian ukuran minuman (Large Cup +Rp5.000) dan kolom kustomisasi produk.
10. `20261026000002_add_transaksi_order_and_table_columns.sql`:  
    Menambahkan relasi kolom `tipe_pesanan`, `meja_id`, dan `nama_pelanggan` pada tabel `transaksi` untuk menjamin persistensi identitas pesanan makan di tempat.

---

## Catatan Keputusan Arsitektur & Teknis (ADR)

Bagian ini mendokumentasikan keputusan arsitektur dan teknis kunci yang melandasi implementasi sistem Lumbung POS:

### ADR-01: Penegakan Isolasi Multi-Cabang pada Lapisan Database (PostgreSQL RLS)
- **Konteks:** Sistem melayani beberapa cabang kedai yang beroperasi secara independen. Keamanan data tidak boleh hanya bergantung pada logika filter frontend atau middleware.
- **Keputusan:** Menerapkan Row Level Security (RLS) pada PostgreSQL dengan fungsi helper sesi `auth_user_cabang_id()` dan `auth_user_role()`. Kasir dan Kepala Toko dibatasi secara mutlak pada `cabang_id` mereka. Percobaan query lintas cabang melalui Supabase Client secara otomatis menghasilkan data kosong (*zero rows*).

### ADR-02: Kerahasiaan Absolut Harga Pokok Penjualan (HPP) & Margin Laba
- **Konteks:** Persyaratan BR-11 melarang staf operasional cabang (Kasir & Kepala Toko) mengetahui harga modal bahan baku dan margin laba bersih kedai.
- **Keputusan:** Tabel `riwayat_harga_modal` dan `transaksi_item_modal` dipisahkan secara skema dan dilindungi RLS khusus role `owner`. Query ke tabel modal pada halaman `/laporan` hanya dipanggil di server jika pengguna terverifikasi sebagai Owner.

### ADR-03: Validasi Stok Atomik dengan Penguncian Baris (`FOR UPDATE`)
- **Konteks:** Pada jam sibuk kedai kopi, kasir di kasir yang berbeda dapat menjual produk yang sama secara simultan, berpotensi memicu *race condition* dan stok minus.
- **Keputusan:** Eksekusi transaksi penjualan menggunakan transaksi atomik database dengan klausa `SELECT jumlah FROM stok_cabang WHERE ... FOR UPDATE`. Jika salah satu item dalam keranjang tidak mencukupi, seluruh transaksi dibatalkan (*all-or-nothing*) dan stok item lain tidak terpotong sebagian (*zero partial sales*). Skema tabel juga diperkuat dengan check constraint `jumlah >= 0`.

### ADR-04: Penomoran Struk Transaksi Urut Harian (Format BR-04)
- **Konteks:** Struk transaksi wajib memiliki format standar `[KODE_CABANG]-[YYYYMMDD]-[0001..]` yang urut per cabang dan tanggal, serta tidak terduplikasi saat ada request bersamaan.
- **Keputusan:** Menggunakan kolom penghitung `urut_struk_terakhir` dan `urut_struk_tanggal` pada tabel `cabang` dengan row-locking `FOR UPDATE` saat transaksi dibuat. Jika hari berganti, counter otomatis di-reset ke 1. Transaksi yang dibatalkan (*void*) tetap mempertahankan nomor struknya agar jejak audit keuangan tidak terputus.

### ADR-05: State Machine Siklus Hidup Shift Kasir Searah
- **Konteks:** Rekonsiliasi kas kasir menuntut alur status yang tertib dan tidak dapat dibalik secara sepihak untuk mencegah manipulasi selisih kas.
- **Keputusan:** Status shift kasir mengikuti siklus satu arah: `buka` $\rightarrow$ `ditutup` $\rightarrow$ `diverifikasi`. Kasir dibatasi hanya memiliki tepat 1 shift buka melalui partial unique index `idx_shift_kasir_satu_buka`. Penutupan shift menghitung kas sistem otomatis, dan check constraint database mewajibkan pengisian catatan penjelasan jika $|selisih| > \text{Rp20.000}$. Verifikasi shift hanya dapat disetujui oleh Kepala Toko cabang terkait atau Owner.

### ADR-06: Integrasi QRIS Mayar v2 dengan Proteksi Amount Mismatch & Idempotensi
- **Konteks:** Pembayaran QRIS non-tunai melalui gateway rentan terhadap pembayaran nominal yang tidak sesuai, notifikasi webhook ganda (*replay*), atau keterlambatan jaringan.
- **Keputusan:** Menggunakan alur pembuatan invoice dinamis Mayar API v2 dengan status awal `menunggu_bayar`. Endpoint webhook memvalidasi signature/token dan menyimpan payload pada tabel `mayar_webhook_events`. Logika pelunasan menolak pembayaran jika nominal gateway tidak cocok dengan total transaksi (`AMOUNT_MISMATCH`) dan mengembalikan respon sukses yang aman jika webhook untuk invoice yang sama diterima berulang kali (*idempotent*).

### ADR-07: Pemisahan State Operasional Denah Meja & Antrean KDS dari Finansial Transaksi
- **Konteks:** Barista dan staf dapur perlu memperbarui tahapan penyajian pesanan kopi tanpa mengubah status finansial transaksi yang telah lunas.
- **Keputusan:** Tabel `antrean_pesanan` dan `meja` dirancang terpisah dari tabel `transaksi`. Status pengerjaan pesanan (`menunggu` $\rightarrow$ `diproses` $\rightarrow$ `siap` $\rightarrow$ `selesai`) dapat dimutasi secara independen oleh barista melalui layar KDS tanpa mengganggu integritas status pembayaran `lunas` pada pembukuan kasir.

---

## Pengujian dan Kualitas Kode

Proyek dilengkapi dengan test suite otomatis komprehensif menggunakan runner bawaan Node.js.

### Perintah Pengujian dan Verifikasi Kualitas

- **Menjalankan Seluruh Test Suite Unit & Integrasi:**
  ```bash
  npm test
  ```
  *Cakupan:* 64 test case pada 6 test suite (`auth-account-status.test.ts`, `format.test.ts`, `meja-management.test.ts`, `order-flow-queue.test.ts`, `product-customization-and-variants.test.ts`, `qris-mayar.test.ts`, `capstone-audit-full.test.ts`).  
  *Status:* **64 Passed (100% SUCCESS)**.

- **Menjalankan Pengujian Alur Pesanan Menyeluruh (Thorough Order Flow):**
  ```bash
  npm run test:order-flow
  ```
  *Cakupan:* 7 pengujian skenario end-to-end mencakup perhitungan varian Large Cup (+Rp5.000), preservasi tipe pesanan *Dine In* dan Meja `M-02`, nama pemesan `Diwani`, penolakan pembayaran *Amount Mismatch*, idempotensi pelunasan, dan penempatan antrean KDS cabang.  
  *Status:* **7 Passed (100% SUCCESS)**.

- **Pemeriksaan Linter Kode:**
  ```bash
  npm run lint
  ```
  *Status:* **0 Error, 0 Warning** (Clean code).

- **Kompilasi Build Produksi:**
  ```bash
  npm run build
  ```
  *Status:* Berhasil mengompilasi 17 rute aplikasi Next.js menggunakan Turbopack tanpa kesalahan tipe TypeScript.

---

## Keamanan

Aspek keamanan merupakan prioritas dalam perancangan Lumbung POS:

1. **Autentikasi & Proteksi Sesi:** Otentikasi terpusat pada Supabase Auth dengan token JWT yang disimpan dalam cookie HTTP-only melalui `@supabase/ssr`.
2. **Row Level Security (RLS) Berlapis:** Seluruh tabel database dilindungi kebijakan RLS. Staf cabang Kasir dan Kepala Toko tidak dapat membaca maupun memodifikasi data cabang lain.
3. **Kerahasiaan Harga Pokok Penjualan (HPP):** Tabel harga modal (`riwayat_harga_modal` dan `transaksi_item_modal`) dikunci dengan RLS khusus role `owner`. Staf cabang yang mencoba melakukan query langsung ke endpoint Supabase akan menerima respon kosong (`0 rows`).
4. **Validasi Ganda (Server Action & Database Constraints):** Validasi integritas bisnis (kuantitas 1–99, batas diskon $\le$ 10%, uang tunai $\ge$ total tagihan, kas awal $\le$ Rp2.000.000) diterapkan ganda pada kode aplikasi TypeScript dan PostgreSQL Check Constraints.
5. **Verifikasi Webhook Mayar:** Endpoint webhook memverifikasi kesesuaian token rahasia pada header permintaan serta mencatat seluruh riwayat event pada tabel `mayar_webhook_events` untuk mencegah serangan replay (*replay attack*).
6. **Immutabilitas Audit Log:** Tabel `audit_log` hanya memiliki izin `SELECT` dan `INSERT` internal tanpa izin `UPDATE` atau `DELETE`, sehingga catatan jejak audit tidak dapat dimanipulasi atau dihapus oleh pengguna mana pun.

> [!NOTE]  
> Sebelum menggunakan aplikasi di lingkungan produksi nyata, pastikan untuk mengganti seluruh password akun default, mengonfigurasi domain webhook berprotokol HTTPS, dan membatasi kredensial service role hanya pada server yang terpercaya.

---

## Lisensi

Hak Cipta © 2026 **Lumbung Kopi dan Roti**. Seluruh hak cipta dilindungi undang-undang (*All Rights Reserved*).

Seluruh kode sumber, aset desain, skema database, dan dokumentasi pada repositori ini merupakan karya orisinal yang dikembangkan untuk sistem operasional kasir multi-cabang **Lumbung Kopi dan Roti**. Dilarang menggandakan, mendistribusikan, memodifikasi, atau memanfaatkan materi dalam repositori ini untuk tujuan komersial tanpa izin tertulis terlebih dahulu dari pemilik hak cipta.
