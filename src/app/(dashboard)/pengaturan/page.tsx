import { getUserProfile } from "@/lib/auth/get-user-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  PengaturanClient,
  StafProfile,
  CabangItem,
  AuditLogRow,
} from "./pengaturan-client";

export const instant = false;

interface RawProfileRow {
  id: string;
  nama_lengkap: string;
  email: string;
  peran: "kasir" | "kepala_toko" | "owner";
  aktif: boolean;
  cabang_id: string | null;
  cabang?: { nama: string; kode: string } | null;
}

interface RawAuditRow {
  id: string;
  dibuat_pada: string;
  pelaku_id: string;
  aksi: string;
  tabel: string;
  data_id: string | null;
  nilai_sebelum: unknown;
  nilai_sesudah: unknown;
  pelaku?: { nama_lengkap: string; peran: string } | null;
}

export default async function PengaturanPage() {
  const { profile } = await getUserProfile();

  if (!profile) {
    redirect("/login");
  }

  // Khusus Owner (BR-01 & BR-12)
  if (profile.peran !== "owner") {
    redirect(profile.peran === "kasir" ? "/kasir" : "/transaksi");
  }

  const supabase = await createClient();

  // 1. Query seluruh profil staf toko (BR-01)
  const { data: rawProfiles } = await supabase
    .from("profiles")
    .select(
      "id, nama_lengkap, email, peran, aktif, cabang_id, cabang:cabang_id(nama, kode)",
    )
    .order("peran", { ascending: false })
    .order("nama_lengkap", { ascending: true });

  const stafList: StafProfile[] = (
    (rawProfiles as unknown as RawProfileRow[]) || []
  ).map((p) => ({
    id: p.id,
    nama_lengkap: p.nama_lengkap,
    email: p.email,
    peran: p.peran,
    aktif: p.aktif,
    cabang_id: p.cabang_id,
    cabang_nama: p.cabang?.nama,
    cabang_kode: p.cabang?.kode,
  }));

  // 2. Query seluruh master cabang
  const { data: rawCabang } = await supabase
    .from("cabang")
    .select("id, nama, kode, alamat, aktif")
    .order("nama", { ascending: true });

  const cabangList: CabangItem[] = rawCabang || [];

  // 3. Query audit log nyata (BR-12)
  // Gunakan admin client jika RLS audit_log membutuhkan service role, atau supabase server client
  const admin = createAdminClient() || supabase;
  const { data: rawAudit } = await admin
    .from("audit_log")
    .select(
      "id, dibuat_pada, pelaku_id, aksi, tabel, data_id, nilai_sebelum, nilai_sesudah, pelaku:pelaku_id(nama_lengkap, peran)",
    )
    .order("dibuat_pada", { ascending: false })
    .limit(200);

  const auditLogs: AuditLogRow[] = (
    (rawAudit as unknown as RawAuditRow[]) || []
  ).map((a) => ({
    id: a.id,
    dibuat_pada: a.dibuat_pada,
    pelaku_id: a.pelaku_id,
    pelaku_nama: a.pelaku?.nama_lengkap || "Sistem / Service Role",
    pelaku_peran: a.pelaku?.peran || "sistem",
    aksi: a.aksi,
    tabel: a.tabel,
    data_id: a.data_id,
    nilai_sebelum: a.nilai_sebelum,
    nilai_sesudah: a.nilai_sesudah,
  }));

  const currentProfile: StafProfile = {
    id: profile.id,
    nama_lengkap: profile.nama_lengkap,
    email: profile.email,
    peran: profile.peran,
    aktif: profile.aktif,
    cabang_id: profile.cabang_id,
    cabang_nama: profile.cabang?.nama,
    cabang_kode: profile.cabang?.kode,
  };

  return (
    <PengaturanClient
      currentProfile={currentProfile}
      stafList={stafList}
      cabangList={cabangList}
      auditLogs={auditLogs}
    />
  );
}
