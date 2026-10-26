'use client';

import { useState, useTransition } from 'react';
import {
  UserCog,
  Building2,
  ScrollText,
  Palette,
  Shield,
  CheckCircle2,
  XCircle,
  Search,
  Moon,
  Sun,
  Edit2,
  X,
  Loader2,
  FileCode,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Plus,
  Lock,
  AlertTriangle,
  Users
} from 'lucide-react';
import { useTheme } from '@/components/theme/ThemeProvider';
import {
  toggleStatusAkunAction,
  ubahPeranCabangAction,
  tambahAkunStafAction,
  tambahCabangAction,
  ubahCabangAction,
  ActionResult
} from '@/app/actions/pengaturan';
import { formatTanggalWaktu } from '@/lib/utils/format';

export interface StafProfile {
  id: string;
  nama_lengkap: string;
  email: string;
  peran: 'kasir' | 'kepala_toko' | 'owner';
  aktif: boolean;
  cabang_id: string | null;
  cabang_nama?: string;
  cabang_kode?: string;
}

export interface CabangItem {
  id: string;
  nama: string;
  kode: string;
  alamat?: string | null;
  aktif: boolean;
}

export interface AuditLogRow {
  id: string;
  dibuat_pada: string;
  pelaku_id: string;
  pelaku_nama: string;
  pelaku_peran: string;
  aksi: string;
  tabel: string;
  data_id: string | null;
  nilai_sebelum: unknown;
  nilai_sesudah: unknown;
}

interface PengaturanClientProps {
  currentProfile: StafProfile;
  stafList: StafProfile[];
  cabangList: CabangItem[];
  auditLogs: AuditLogRow[];
}

export function PengaturanClient({
  currentProfile,
  stafList: initialStafList,
  cabangList: initialCabangList,
  auditLogs,
}: PengaturanClientProps) {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<'profil' | 'staf' | 'cabang' | 'audit'>('profil');

  // Cabang State (Reactive)
  const [cabangs, setCabangs] = useState<CabangItem[]>(initialCabangList);

  // Staf State & Filters
  const [stafList, setStafList] = useState<StafProfile[]>(initialStafList);
  const [stafSearch, setStafSearch] = useState('');
  const [stafFilterPeran, setStafFilterPeran] = useState<string>('all');
  const [stafFilterStatus, setStafFilterStatus] = useState<string>('all');
  const [stafFilterCabang, setStafFilterCabang] = useState<string>('all');

  // Modal Edit Staf
  const [editingStaf, setEditingStaf] = useState<StafProfile | null>(null);
  const [editPeran, setEditPeran] = useState<'kasir' | 'kepala_toko' | 'owner'>('kasir');
  const [editCabangId, setEditCabangId] = useState<string>('');

  // Modal Tambah Staf Baru
  const [showAddStafModal, setShowAddStafModal] = useState(false);
  const [newStafNama, setNewStafNama] = useState('');
  const [newStafEmail, setNewStafEmail] = useState('');
  const [newStafPassword, setNewStafPassword] = useState('');
  const [newStafPeran, setNewStafPeran] = useState<'kasir' | 'kepala_toko' | 'owner'>('kasir');
  const [newStafCabangId, setNewStafCabangId] = useState<string>(initialCabangList[0]?.id || '');

  // Modal Tambah Cabang Baru
  const [showAddCabangModal, setShowAddCabangModal] = useState(false);
  const [newCabangKode, setNewCabangKode] = useState('');
  const [newCabangNama, setNewCabangNama] = useState('');
  const [newCabangAlamat, setNewCabangAlamat] = useState('');

  // Modal Ubah Cabang
  const [editingCabang, setEditingCabang] = useState<CabangItem | null>(null);
  const [editCabangNama, setEditCabangNama] = useState('');
  const [editCabangAlamat, setEditCabangAlamat] = useState('');
  const [editCabangAktif, setEditCabangAktif] = useState(true);

  // Dialog Konfirmasi Tindakan Penting
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmText?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  } | null>(null);

  // Audit Search & Filter (BR-12 & Tahap 5)
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterAksi, setAuditFilterAksi] = useState('all');
  const [auditFilterPelaku, setAuditFilterPelaku] = useState('all');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const AUDIT_PER_PAGE = 15;
  const [selectedAuditDetail, setSelectedAuditDetail] = useState<AuditLogRow | null>(null);

  // Async feedback state
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Handle Toggle Akun Aktif/Nonaktif dengan Konfirmasi
  const handleToggleStatus = (staf: StafProfile) => {
    if (staf.id === currentProfile.id && staf.aktif) {
      alert('Anda tidak dapat menonaktifkan akun Owner Anda sendiri.');
      return;
    }

    const nextStatus = !staf.aktif;
    const actionLabel = nextStatus ? 'mengaktifkan' : 'menonaktifkan';

    setConfirmDialog({
      title: `Konfirmasi ${nextStatus ? 'Aktivasi' : 'Penonaktifan'} Akun`,
      message: `Apakah Anda yakin ingin ${actionLabel} akun staf ${staf.nama_lengkap} (${staf.email})? ${
        !nextStatus ? 'Staf yang dinonaktifkan tidak akan dapat masuk (login) ke sistem POS.' : 'Staf akan dapat kembali mengakses sistem sesuai perannya.'
      }`,
      confirmText: nextStatus ? 'Aktifkan Akun' : 'Nonaktifkan Akun',
      isDestructive: !nextStatus,
      onConfirm: () => {
        setConfirmDialog(null);
        setActionError(null);
        setActionSuccess(null);

        startTransition(async () => {
          const res: ActionResult = await toggleStatusAkunAction(staf.id, nextStatus);
          if (!res.success) {
            setActionError(res.error || 'Gagal mengubah status akun.');
          } else {
            setActionSuccess(res.pesan || 'Status akun diperbarui.');
            setStafList((prev) =>
              prev.map((s) => (s.id === staf.id ? { ...s, aktif: nextStatus } : s))
            );
            setTimeout(() => setActionSuccess(null), 3500);
          }
        });
      },
    });
  };

  // Open Edit Role & Cabang
  const handleOpenEditStaf = (staf: StafProfile) => {
    setEditingStaf(staf);
    setEditPeran(staf.peran);
    setEditCabangId(staf.cabang_id || (cabangs[0]?.id || ''));
    setActionError(null);
    setActionSuccess(null);
  };

  // Submit Edit Role & Cabang
  const handleSaveEditStaf = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStaf) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res: ActionResult = await ubahPeranCabangAction(
        editingStaf.id,
        editPeran,
        editPeran === 'owner' ? null : editCabangId
      );

      if (!res.success) {
        setActionError(res.error || 'Gagal memperbarui peran dan cabang staf.');
      } else {
        setActionSuccess(res.pesan || 'Peran staf berhasil diperbarui.');
        const assignedCabang = cabangs.find((c) => c.id === editCabangId);
        setStafList((prev) =>
          prev.map((s) =>
            s.id === editingStaf.id
              ? {
                  ...s,
                  peran: editPeran,
                  cabang_id: editPeran === 'owner' ? null : editCabangId,
                  cabang_nama: editPeran === 'owner' ? 'Semua Cabang' : assignedCabang?.nama,
                  cabang_kode: editPeran === 'owner' ? 'HQ' : assignedCabang?.kode,
                }
              : s
          )
        );
        setTimeout(() => {
          setEditingStaf(null);
          setActionSuccess(null);
        }, 1200);
      }
    });
  };

  // Submit Tambah Akun Staf
  const handleCreateStaf = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await tambahAkunStafAction({
        nama_lengkap: newStafNama,
        email: newStafEmail,
        password_awal: newStafPassword,
        peran: newStafPeran,
        cabang_id: newStafPeran === 'owner' ? null : newStafCabangId,
      });

      if (!res.success) {
        setActionError(res.error || 'Gagal menambahkan akun staf.');
      } else {
        setActionSuccess(res.pesan || 'Akun staf berhasil dibuat.');
        if (res.newStaf) {
          setStafList((prev) => [res.newStaf as StafProfile, ...prev]);
        }
        setShowAddStafModal(false);
        setNewStafNama('');
        setNewStafEmail('');
        setNewStafPassword('');
        setNewStafPeran('kasir');
        setTimeout(() => setActionSuccess(null), 3500);
      }
    });
  };

  // Submit Tambah Cabang
  const handleCreateCabang = (e: React.FormEvent) => {
    e.preventDefault();
    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await tambahCabangAction({
        kode: newCabangKode.toUpperCase().trim(),
        nama: newCabangNama.trim(),
        alamat: newCabangAlamat.trim() || undefined,
      });

      if (!res.success) {
        setActionError(res.error || 'Gagal menambahkan cabang toko.');
      } else {
        setActionSuccess(res.pesan || 'Cabang toko berhasil didaftarkan.');
        if (res.newCabang) {
          setCabangs((prev) => [...prev, res.newCabang as CabangItem]);
        }
        setShowAddCabangModal(false);
        setNewCabangKode('');
        setNewCabangNama('');
        setNewCabangAlamat('');
        setTimeout(() => setActionSuccess(null), 3500);
      }
    });
  };

  // Open Edit Cabang
  const handleOpenEditCabang = (cabang: CabangItem) => {
    setEditingCabang(cabang);
    setEditCabangNama(cabang.nama);
    setEditCabangAlamat(cabang.alamat || '');
    setEditCabangAktif(cabang.aktif);
    setActionError(null);
    setActionSuccess(null);
  };

  // Submit Ubah Cabang
  const handleSaveEditCabang = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCabang) return;

    setActionError(null);
    setActionSuccess(null);

    startTransition(async () => {
      const res = await ubahCabangAction({
        cabangId: editingCabang.id,
        nama: editCabangNama.trim(),
        alamat: editCabangAlamat.trim(),
        aktif: editCabangAktif,
      });

      if (!res.success) {
        setActionError(res.error || 'Gagal memperbarui data cabang.');
      } else {
        setActionSuccess(res.pesan || 'Data cabang berhasil diperbarui.');
        setCabangs((prev) =>
          prev.map((c) =>
            c.id === editingCabang.id
              ? {
                  ...c,
                  nama: editCabangNama.trim(),
                  alamat: editCabangAlamat.trim() || null,
                  aktif: editCabangAktif,
                }
              : c
          )
        );
        setEditingCabang(null);
        setTimeout(() => setActionSuccess(null), 3500);
      }
    });
  };

  // Filter Staf Multi-kriteria (Search text, Peran, Status Aktif, Cabang)
  const filteredStaf = stafList.filter((s) => {
    const term = stafSearch.toLowerCase();
    const matchSearch =
      !term ||
      s.nama_lengkap.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term);

    const matchPeran = stafFilterPeran === 'all' || s.peran === stafFilterPeran;
    const matchStatus =
      stafFilterStatus === 'all' ||
      (stafFilterStatus === 'aktif' && s.aktif) ||
      (stafFilterStatus === 'nonaktif' && !s.aktif);

    const matchCabang =
      stafFilterCabang === 'all' ||
      (stafFilterCabang === 'hq' && s.peran === 'owner') ||
      s.cabang_id === stafFilterCabang;

    return matchSearch && matchPeran && matchStatus && matchCabang;
  });

  // Distinct Pelaku for Dropdown (BR-12)
  const distinctPelaku = Array.from(
    new Set(auditLogs.map((l) => l.pelaku_nama).filter(Boolean))
  );

  // Filter Audit Multi-kriteria (Pelaku, Aksi, Tanggal, Text Search)
  const filteredAudit = auditLogs.filter((log) => {
    const term = auditSearch.toLowerCase();
    const matchSearch =
      !term ||
      log.pelaku_nama.toLowerCase().includes(term) ||
      log.aksi.toLowerCase().includes(term) ||
      log.tabel.toLowerCase().includes(term) ||
      (log.data_id && log.data_id.toLowerCase().includes(term));

    const matchAksi = auditFilterAksi === 'all' || log.aksi === auditFilterAksi;
    const matchPelaku = auditFilterPelaku === 'all' || log.pelaku_nama === auditFilterPelaku;

    let matchDate = true;
    if (auditDateFrom) {
      const fromTime = new Date(`${auditDateFrom}T00:00:00+07:00`).getTime();
      matchDate = matchDate && new Date(log.dibuat_pada).getTime() >= fromTime;
    }
    if (auditDateTo) {
      const toTime = new Date(`${auditDateTo}T23:59:59+07:00`).getTime();
      matchDate = matchDate && new Date(log.dibuat_pada).getTime() <= toTime;
    }

    return matchSearch && matchAksi && matchPelaku && matchDate;
  });

  const totalAuditPages = Math.max(1, Math.ceil(filteredAudit.length / AUDIT_PER_PAGE));
  const currentAuditPage = Math.min(auditPage, totalAuditPages);
  const paginatedAudit = filteredAudit.slice(
    (currentAuditPage - 1) * AUDIT_PER_PAGE,
    currentAuditPage * AUDIT_PER_PAGE
  );

  return (
    <div className="space-y-6">
      {/* Top Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#E8DFD3] dark:border-[#2C2420] pb-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-2">
            <UserCog className="w-6 h-6 text-[#C67C4E]" />
            <span>Pengaturan Sistem &amp; Operasional</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#78716C] dark:text-[#A8A29E] mt-1">
            Konfigurasi preferensi tampilan, hak akses staf, cabang, dan catatan audit log sistem.
          </p>
        </div>
      </div>

      {/* Global Alerts */}
      {actionError && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 p-4 rounded-2xl text-xs sm:text-sm">
          {actionError}
        </div>
      )}

      {actionSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-4 rounded-2xl text-xs sm:text-sm">
          {actionSuccess}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E8DFD3] dark:border-[#2C2420] pb-2">
        <button
          onClick={() => setActiveTab('profil')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
            activeTab === 'profil'
              ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
              : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F]'
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Profil &amp; Tampilan</span>
        </button>

        <button
          onClick={() => setActiveTab('staf')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
            activeTab === 'staf'
              ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
              : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Manajemen Staf ({stafList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('cabang')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
            activeTab === 'cabang'
              ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
              : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F]'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Cabang Toko ({cabangs.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-colors cursor-pointer ${
            activeTab === 'audit'
              ? 'bg-[#4A2E18] text-white dark:bg-[#C67C4E]'
              : 'text-[#78716C] dark:text-[#A8A29E] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F]'
          }`}
        >
          <ScrollText className="w-4 h-4" />
          <span>Audit Log Immutable ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: Profil & Tampilan */}
      {activeTab === 'profil' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* User Profile Card */}
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-3 border-b border-[#E8DFD3] dark:border-[#2C2420] pb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#4A2E18] text-white flex items-center justify-center font-bold text-lg shadow-xs">
                {currentProfile.nama_lengkap.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-base text-[#2C1810] dark:text-[#F5EBE1]">
                  {currentProfile.nama_lengkap}
                </h3>
                <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">{currentProfile.email}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex justify-between py-1.5 border-b border-[#F3EDE2] dark:border-[#2C2420]">
                <span className="text-[#78716C] dark:text-[#A8A29E]">Peran Akun:</span>
                <span className="font-bold text-[#4A2E18] dark:text-[#C67C4E] uppercase">
                  {currentProfile.peran}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-[#F3EDE2] dark:border-[#2C2420]">
                <span className="text-[#78716C] dark:text-[#A8A29E]">Penetapan Cabang:</span>
                <span className="font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                  {currentProfile.cabang_nama || 'Semua Cabang (Kantor Pusat)'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-[#78716C] dark:text-[#A8A29E]">Status Autentikasi:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Aktif (Supabase Auth)</span>
                </span>
              </div>
            </div>
          </div>

          {/* Theme Settings Card */}
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-base text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-2">
                <Palette className="w-5 h-5 text-[#C67C4E]" />
                <span>Preferensi Tema &amp; Tampilan</span>
              </h3>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-1">
                Pilih skema warna antarmuka kasir dan dasbor operasional
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (theme === 'dark') toggleTheme();
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  theme === 'light'
                    ? 'border-[#C67C4E] bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-[#C67C4E]'
                    : 'border-[#E8DFD3] dark:border-[#2C2420] bg-[#FAF7F2] dark:bg-[#14110F]'
                }`}
              >
                <Sun className="w-6 h-6 text-[#D97706] mb-2" />
                <div className="font-bold text-sm text-[#2C1810] dark:text-[#F5EBE1]">Light Mode</div>
                <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1">
                  Krem hangat &amp; espresso cerah untuk pencahayaan kedai
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (theme === 'light') toggleTheme();
                }}
                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                  theme === 'dark'
                    ? 'border-[#C67C4E] bg-amber-50/50 dark:bg-amber-950/20 ring-2 ring-[#C67C4E]'
                    : 'border-[#E8DFD3] dark:border-[#2C2420] bg-[#FAF7F2] dark:bg-[#14110F]'
                }`}
              >
                <Moon className="w-6 h-6 text-[#C67C4E] mb-2" />
                <div className="font-bold text-sm text-[#2C1810] dark:text-[#F5EBE1]">Dark Mode</div>
                <div className="text-[11px] text-[#78716C] dark:text-[#A8A29E] mt-1">
                  Hitam charcoal nyaman mata untuk shift malam
                </div>
              </button>
            </div>

            <p className="text-[11px] text-[#A8A29E] italic">
              *Preferensi tema tersimpan aman secara lokal pada peramban kasir tanpa mengubah konfigurasi database.
            </p>
          </div>
        </div>
      )}

      {/* TAB 2: Manajemen Staf & Akses (BR-01) */}
      {activeTab === 'staf' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="font-bold text-sm sm:text-base text-[#2C1810] dark:text-[#F5EBE1]">
                  Kelola Akun &amp; Hak Akses Staf
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActionError(null);
                  setActionSuccess(null);
                  setShowAddStafModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#4A2E18] dark:bg-[#C67C4E] hover:bg-[#382212] dark:hover:bg-[#B56B3D] text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-xs w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Akun Staf</span>
              </button>
            </div>

            {/* Filter Bar Staf */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[#E8DFD3]/60 dark:border-[#2C2420]/60">
              {/* Search text */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="text"
                  placeholder="Cari nama atau email..."
                  value={stafSearch}
                  onChange={(e) => setStafSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] placeholder-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
                />
              </div>

              {/* Filter Peran */}
              <div>
                <select
                  value={stafFilterPeran}
                  onChange={(e) => setStafFilterPeran(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
                >
                  <option value="all">Semua Peran</option>
                  <option value="kasir">Kasir</option>
                  <option value="kepala_toko">Kepala Toko</option>
                  <option value="owner">Owner</option>
                </select>
              </div>

              {/* Filter Status Aktif */}
              <div>
                <select
                  value={stafFilterStatus}
                  onChange={(e) => setStafFilterStatus(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
                >
                  <option value="all">Semua Status Akun</option>
                  <option value="aktif">Aktif Saja</option>
                  <option value="nonaktif">Nonaktif Saja</option>
                </select>
              </div>

              {/* Filter Cabang */}
              <div>
                <select
                  value={stafFilterCabang}
                  onChange={(e) => setStafFilterCabang(e.target.value)}
                  className="w-full px-3 py-1.5 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
                >
                  <option value="all">Semua Penempatan Cabang</option>
                  <option value="hq">Kantor Pusat (Owner)</option>
                  {cabangs.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama} ({c.kode})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#78716C] dark:text-[#A8A29E] pt-1">
              <span>
                Menampilkan <strong className="text-[#2C1810] dark:text-[#F5EBE1]">{filteredStaf.length}</strong> dari {stafList.length} staf terdaftar
              </span>
              {(stafSearch || stafFilterPeran !== 'all' || stafFilterStatus !== 'all' || stafFilterCabang !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setStafSearch('');
                    setStafFilterPeran('all');
                    setStafFilterStatus('all');
                    setStafFilterCabang('all');
                  }}
                  className="font-semibold text-[#C67C4E] hover:underline cursor-pointer"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl shadow-xs overflow-hidden">
            {filteredStaf.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#78716C] dark:text-[#A8A29E]">
                Tidak ada staf yang sesuai dengan kriteria filter atau pencarian.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#FAF7F2] dark:bg-[#14110F] border-b border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] uppercase font-semibold text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Nama Staf</th>
                      <th className="px-4 py-3.5">Email</th>
                      <th className="px-4 py-3.5 text-center">Peran</th>
                      <th className="px-4 py-3.5">Cabang Bertugas</th>
                      <th className="px-4 py-3.5 text-center">Status Akun</th>
                      <th className="px-4 py-3.5 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EDE2] dark:divide-[#2C2420] text-[#2C1810] dark:text-[#F5EBE1]">
                    {filteredStaf.map((staf) => (
                      <tr
                        key={staf.id}
                        className="hover:bg-[#FAF7F2]/70 dark:hover:bg-[#14110F]/50 transition-colors"
                      >
                        <td className="px-4 py-3.5 font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                          {staf.nama_lengkap}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-[#78716C] dark:text-[#A8A29E]">
                          {staf.email}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase tracking-wider ${
                              staf.peran === 'owner'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200'
                                : staf.peran === 'kepala_toko'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200'
                            }`}
                          >
                            {staf.peran.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#78716C] dark:text-[#A8A29E]">
                          {staf.peran === 'owner' ? 'Semua Cabang (Kantor Pusat)' : staf.cabang_nama || '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                              staf.aktif
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {staf.aktif ? (
                              <>
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Aktif</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3 h-3" />
                                <span>Nonaktif</span>
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleOpenEditStaf(staf)}
                              className="px-2.5 py-1 text-xs font-semibold text-[#4A2E18] dark:text-[#C67C4E] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] rounded-lg border border-[#E8DFD3] dark:border-[#2C2420] transition-colors cursor-pointer"
                            >
                              Ubah Peran
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(staf)}
                              disabled={isPending || (staf.id === currentProfile.id && staf.aktif)}
                              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer disabled:opacity-40 ${
                                staf.aktif
                                  ? 'text-rose-700 border-rose-200 hover:bg-rose-50 dark:border-rose-900 dark:hover:bg-rose-950/30'
                                  : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900 dark:hover:bg-emerald-950/30'
                              }`}
                            >
                              {staf.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Cabang Toko */}
      {activeTab === 'cabang' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-sm sm:text-base text-[#2C1810] dark:text-[#F5EBE1] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#C67C4E]" />
                <span>Pengelolaan Cabang Toko Operasional</span>
              </h3>
              <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-0.5">
                Kelola outlet fisik, alokasi staf, dan konfigurasi identitas cabang multi-outlet
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setActionSuccess(null);
                setShowAddCabangModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#4A2E18] dark:bg-[#C67C4E] hover:bg-[#382212] dark:hover:bg-[#B56B3D] text-white font-semibold text-xs sm:text-sm transition-colors cursor-pointer shadow-xs w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Cabang Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cabangs.map((cabang) => {
              // Hitung staf di cabang ini
              const branchStaff = stafList.filter((s) => s.cabang_id === cabang.id);
              const ktCount = branchStaff.filter((s) => s.peran === 'kepala_toko' && s.aktif).length;
              const kasirCount = branchStaff.filter((s) => s.peran === 'kasir' && s.aktif).length;

              return (
                <div
                  key={cabang.id}
                  className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-5 shadow-xs space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-[#FAF7F2] dark:bg-[#14110F] text-[#4A2E18] dark:text-[#C67C4E] border border-[#E8DFD3] dark:border-[#2C2420]">
                        KODE: {cabang.kode}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          cabang.aktif
                            ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40'
                            : 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40'
                        }`}
                      >
                        {cabang.aktif ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Operasional</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Nonaktif</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div>
                      <h4 className="font-bold text-base text-[#2C1810] dark:text-[#F5EBE1]">
                        {cabang.nama}
                      </h4>
                      <p className="text-xs text-[#78716C] dark:text-[#A8A29E] mt-1 flex items-start gap-1">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-[#C67C4E] mt-0.5" />
                        <span>{cabang.alamat || 'Alamat fisik belum diisi'}</span>
                      </p>
                    </div>

                    {/* Ringkasan Staf Operasional */}
                    <div className="bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl p-3 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-[#78716C] dark:text-[#A8A29E]">
                        <span className="flex items-center gap-1.5 font-medium">
                          <Users className="w-3.5 h-3.5 text-[#C67C4E]" />
                          <span>Alokasi Staf Aktif:</span>
                        </span>
                        <strong className="text-[#2C1810] dark:text-[#F5EBE1]">
                          {branchStaff.filter((s) => s.aktif).length} staf
                        </strong>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#A8A29E]">
                        <span>Kepala Toko: {ktCount > 0 ? `${ktCount} orang` : 'Belum ada'}</span>
                        <span>Kasir: {kasirCount} orang</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F3EDE2] dark:border-[#2C2420] text-xs flex items-center justify-between">
                    <div>
                      <span className="text-[#A8A29E] block text-[10px]">Prefix Struk:</span>
                      <span className="font-mono font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                        {cabang.kode}-YYYYMMDD-XXXX
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenEditCabang(cabang)}
                      className="px-3 py-1.5 font-semibold text-xs text-[#4A2E18] dark:text-[#C67C4E] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] rounded-lg border border-[#E8DFD3] dark:border-[#2C2420] transition-colors cursor-pointer"
                    >
                      Ubah Cabang
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: Audit Log (BR-12 & Tahap 5) */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Multi-filter Bar */}
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-4 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Text Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                <input
                  type="text"
                  placeholder="Cari pelaku, aksi, data ID..."
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value);
                    setAuditPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] placeholder-[#A8A29E] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
                />
              </div>

              {/* Filter Pelaku */}
              <div>
                <select
                  value={auditFilterPelaku}
                  onChange={(e) => {
                    setAuditFilterPelaku(e.target.value);
                    setAuditPage(1);
                  }}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
                >
                  <option value="all">Semua Pelaku / Aktor</option>
                  {distinctPelaku.map((nama) => (
                    <option key={nama} value={nama}>
                      {nama}
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter Aksi */}
              <div>
                <select
                  value={auditFilterAksi}
                  onChange={(e) => {
                    setAuditFilterAksi(e.target.value);
                    setAuditPage(1);
                  }}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
                >
                  <option value="all">Semua Jenis Aksi</option>
                  <option value="void_transaksi">void_transaksi</option>
                  <option value="verifikasi_shift">verifikasi_shift</option>
                  <option value="sesuaikan_stok">sesuaikan_stok</option>
                  <option value="ubah_akun">ubah_akun</option>
                  <option value="ubah_harga_jual">ubah_harga_jual</option>
                  <option value="ubah_produk">ubah_produk</option>
                </select>
              </div>

              {/* Date Range Inputs */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={auditDateFrom}
                  onChange={(e) => {
                    setAuditDateFrom(e.target.value);
                    setAuditPage(1);
                  }}
                  title="Dari Tanggal"
                  className="w-1/2 px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
                />
                <span className="text-xs text-[#A8A29E]">-</span>
                <input
                  type="date"
                  value={auditDateTo}
                  onChange={(e) => {
                    setAuditDateTo(e.target.value);
                    setAuditPage(1);
                  }}
                  title="Sampai Tanggal"
                  className="w-1/2 px-2.5 py-1.5 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-xs text-[#2C1810] dark:text-[#F5EBE1] focus:outline-hidden focus:ring-2 focus:ring-[#C67C4E]"
                />
              </div>
            </div>

            {(auditSearch || auditFilterPelaku !== 'all' || auditFilterAksi !== 'all' || auditDateFrom || auditDateTo) && (
              <div className="flex items-center justify-between pt-2 border-t border-[#E8DFD3]/60 dark:border-[#2C2420]/60 text-xs text-[#78716C] dark:text-[#A8A29E]">
                <span>Ditemukan <strong>{filteredAudit.length}</strong> catatan log</span>
                <button
                  onClick={() => {
                    setAuditSearch('');
                    setAuditFilterPelaku('all');
                    setAuditFilterAksi('all');
                    setAuditDateFrom('');
                    setAuditDateTo('');
                    setAuditPage(1);
                  }}
                  className="text-xs font-semibold text-[#C67C4E] hover:underline cursor-pointer"
                >
                  Reset Filter
                </button>
              </div>
            )}
          </div>

          {/* Audit Table */}
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl shadow-xs overflow-hidden">
            {filteredAudit.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#78716C] dark:text-[#A8A29E]">
                Belum ada catatan audit log yang cocok dengan filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#FAF7F2] dark:bg-[#14110F] border-b border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] uppercase font-semibold text-[11px] tracking-wider">
                    <tr>
                      <th className="px-4 py-3.5">Waktu WIB</th>
                      <th className="px-4 py-3.5">Pelaku</th>
                      <th className="px-4 py-3.5">Aksi Sistem</th>
                      <th className="px-4 py-3.5">Tabel Terkait</th>
                      <th className="px-4 py-3.5">Identitas Data ID</th>
                      <th className="px-4 py-3.5 text-center">Payload Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F3EDE2] dark:divide-[#2C2420] text-[#2C1810] dark:text-[#F5EBE1]">
                    {paginatedAudit.map((log) => (
                      <tr
                        key={log.id}
                        className="hover:bg-[#FAF7F2]/70 dark:hover:bg-[#14110F]/50 transition-colors"
                      >
                        <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-[#78716C] dark:text-[#A8A29E] whitespace-nowrap">
                          {formatTanggalWaktu(log.dibuat_pada, { withSeconds: true })}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                            {log.pelaku_nama}
                          </span>
                          <span className="block text-[10px] text-[#A8A29E] capitalize">
                            {log.pelaku_peran.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs font-bold text-[#C67C4E]">
                          <span className="inline-block px-2 py-0.5 rounded-md bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420]">
                            {log.aksi}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-xs text-[#78716C] dark:text-[#A8A29E]">
                          {log.tabel}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-[#A8A29E] max-w-xs truncate">
                          {log.data_id || '-'}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            onClick={() => setSelectedAuditDetail(log)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#4A2E18] dark:text-[#C67C4E] hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] rounded-lg border border-[#E8DFD3] dark:border-[#2C2420] transition-colors cursor-pointer"
                          >
                            <FileCode className="w-3.5 h-3.5" />
                            <span>Lihat Diff</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            {filteredAudit.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-[#E8DFD3] dark:border-[#2C2420] bg-[#FAF7F2]/40 dark:bg-[#14110F]/40 text-xs text-[#78716C] dark:text-[#A8A29E]">
                <span>
                  Menampilkan{' '}
                  <strong className="text-[#2C1810] dark:text-[#F5EBE1] tabular-nums">
                    {(currentAuditPage - 1) * AUDIT_PER_PAGE + 1}
                  </strong>{' '}
                  -{' '}
                  <strong className="text-[#2C1810] dark:text-[#F5EBE1] tabular-nums">
                    {Math.min(currentAuditPage * AUDIT_PER_PAGE, filteredAudit.length)}
                  </strong>{' '}
                  dari{' '}
                  <strong className="text-[#2C1810] dark:text-[#F5EBE1] tabular-nums">
                    {filteredAudit.length}
                  </strong>{' '}
                  catatan log aktual
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    disabled={currentAuditPage <= 1}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E8DFD3] dark:border-[#2C2420] bg-white dark:bg-[#1E1915] text-[#2C1810] dark:text-[#F5EBE1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium hover:bg-[#FAF7F2]"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>Sebelumnya</span>
                  </button>

                  <span className="px-2 font-mono tabular-nums">
                    {currentAuditPage} / {totalAuditPages}
                  </span>

                  <button
                    onClick={() => setAuditPage((p) => Math.min(totalAuditPages, p + 1))}
                    disabled={currentAuditPage >= totalAuditPages}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E8DFD3] dark:border-[#2C2420] bg-white dark:bg-[#1E1915] text-[#2C1810] dark:text-[#F5EBE1] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-medium hover:bg-[#FAF7F2]"
                  >
                    <span>Selanjutnya</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Edit Role Staf */}
      {editingStaf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Ubah Peran &amp; Cabang Staf
                </h3>
              </div>
              <button
                onClick={() => setEditingStaf(null)}
                className="p-1 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-2xl p-3.5 text-xs space-y-1">
              <div className="font-bold text-sm text-[#2C1810] dark:text-[#F5EBE1]">
                {editingStaf.nama_lengkap}
              </div>
              <div className="text-[#78716C] dark:text-[#A8A29E] font-mono">{editingStaf.email}</div>
            </div>

            <form onSubmit={handleSaveEditStaf} className="space-y-4 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Peran Akun
                </label>
                <select
                  value={editPeran}
                  onChange={(e) => setEditPeran(e.target.value as 'kasir' | 'kepala_toko' | 'owner')}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1]"
                >
                  <option value="kasir">Kasir (Hanya POS &amp; Shift Saya)</option>
                  <option value="kepala_toko">Kepala Toko (Supervisi Cabang)</option>
                  <option value="owner">Owner (Akses Seluruh Cabang &amp; Laporan)</option>
                </select>
              </div>

              {editPeran !== 'owner' && (
                <div>
                  <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                    Penetapan Cabang
                  </label>
                  <select
                    value={editCabangId}
                    onChange={(e) => setEditCabangId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1]"
                  >
                    {cabangs.map((c: CabangItem) => (
                      <option key={c.id} value={c.id}>
                        {c.nama} ({c.kode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStaf(null)}
                  disabled={isPending}
                  className="px-4 py-2 border border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#4A2E18] hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Akun Staf Baru (Owner only) */}
      {showAddStafModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Tambah Akun Staf Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddStafModal(false)}
                className="p-1 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              Akun akan didaftarkan ke Supabase Auth dengan kata sandi terenkripsi aman dan dicatat di audit log.
            </p>

            <form onSubmit={handleCreateStaf} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Nama Lengkap Staf *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={newStafNama}
                  onChange={(e) => setNewStafNama(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Alamat Email (Login) *
                </label>
                <input
                  type="email"
                  required
                  placeholder="budi@lumbungkopi.com"
                  value={newStafEmail}
                  onChange={(e) => setNewStafEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Kata Sandi Awal (Min. 8 karakter) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#A8A29E]" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    placeholder="Minimal 8 karakter"
                    value={newStafPassword}
                    onChange={(e) => setNewStafPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Peran Akun *
                </label>
                <select
                  value={newStafPeran}
                  onChange={(e) => setNewStafPeran(e.target.value as 'kasir' | 'kepala_toko' | 'owner')}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden"
                >
                  <option value="kasir">Kasir (Hanya POS &amp; Shift Sendiri)</option>
                  <option value="kepala_toko">Kepala Toko (Supervisi Cabang)</option>
                  <option value="owner">Owner (Akses Seluruh Cabang &amp; Laporan)</option>
                </select>
              </div>

              {newStafPeran !== 'owner' && (
                <div>
                  <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                    Penugasan Cabang *
                  </label>
                  <select
                    value={newStafCabangId}
                    onChange={(e) => setNewStafCabangId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden"
                  >
                    {cabangs.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nama} ({c.kode})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8DFD3] dark:border-[#2C2420]">
                <button
                  type="button"
                  onClick={() => setShowAddStafModal(false)}
                  disabled={isPending}
                  className="px-4 py-2 border border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#4A2E18] hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Mendaftarkan...</span>
                    </>
                  ) : (
                    <span>Daftarkan Staf</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tambah Cabang Baru (Owner only) */}
      {showAddCabangModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Tambah Cabang Baru
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddCabangModal(false)}
                className="p-1 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-[#78716C] dark:text-[#A8A29E]">
              Sistem akan otomatis menginisialisasi baris stok cabang untuk produk yang dilacak.
            </p>

            <form onSubmit={handleCreateCabang} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Kode Cabang (Tepat 3 Huruf Kapital) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={3}
                  pattern="^[A-Z]{3}$"
                  placeholder="Contoh: DKT, SBY, BDG"
                  value={newCabangKode}
                  onChange={(e) => setNewCabangKode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 font-mono font-bold uppercase bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden"
                />
                <span className="text-[10px] text-[#A8A29E] mt-0.5 block">
                  *Digunakan sebagai awalan nomor struk (contoh: DKT-20260216-0001)
                </span>
              </div>

              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Nama Cabang *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Lumbung Dago Heritage"
                  value={newCabangNama}
                  onChange={(e) => setNewCabangNama(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Alamat Lengkap Cabang
                </label>
                <textarea
                  rows={3}
                  placeholder="Alamat fisik outlet, jalan, kota..."
                  value={newCabangAlamat}
                  onChange={(e) => setNewCabangAlamat(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8DFD3] dark:border-[#2C2420]">
                <button
                  type="button"
                  onClick={() => setShowAddCabangModal(false)}
                  disabled={isPending}
                  className="px-4 py-2 border border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#4A2E18] hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Tambah Cabang</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ubah Cabang */}
      {editingCabang && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Ubah Data Cabang {editingCabang.kode}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingCabang(null)}
                className="p-1 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEditCabang} className="space-y-3.5 text-xs sm:text-sm">
              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Nama Cabang *
                </label>
                <input
                  type="text"
                  required
                  value={editCabangNama}
                  onChange={(e) => setEditCabangNama(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1] mb-1">
                  Alamat Fisik Cabang
                </label>
                <textarea
                  rows={3}
                  value={editCabangAlamat}
                  onChange={(e) => setEditCabangAlamat(e.target.value)}
                  className="w-full px-3 py-2 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl text-[#2C1810] dark:text-[#F5EBE1] focus:ring-2 focus:ring-[#C67C4E] focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editCabangAktif}
                    onChange={(e) => setEditCabangAktif(e.target.checked)}
                    className="w-4 h-4 rounded border-[#E8DFD3] text-[#C67C4E] focus:ring-[#C67C4E]"
                  />
                  <span className="font-semibold text-xs sm:text-sm text-[#2C1810] dark:text-[#F5EBE1]">
                    Status Cabang Aktif (Operasional)
                  </span>
                </label>
                <p className="text-[11px] text-[#A8A29E] mt-1 pl-6">
                  Jika dinonaktifkan, kasir tidak dapat membuka shift baru di cabang ini.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8DFD3] dark:border-[#2C2420]">
                <button
                  type="button"
                  onClick={() => setEditingCabang(null)}
                  disabled={isPending}
                  className="px-4 py-2 border border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] font-semibold cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-[#4A2E18] hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] text-white font-semibold rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <span>Simpan Perubahan</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Dialog Konfirmasi Tindakan Penting */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                  confirmDialog.isDestructive
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
                }`}
              >
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-base text-[#2C1810] dark:text-[#F5EBE1]">
                {confirmDialog.title}
              </h3>
            </div>

            <p className="text-xs text-[#78716C] dark:text-[#A8A29E] leading-relaxed">
              {confirmDialog.message}
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 border border-[#E8DFD3] dark:border-[#2C2420] text-[#78716C] dark:text-[#A8A29E] rounded-xl hover:bg-[#FAF7F2] dark:hover:bg-[#14110F] text-xs font-semibold cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmDialog.onConfirm}
                className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-colors cursor-pointer ${
                  confirmDialog.isDestructive
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#4A2E18] dark:bg-[#C67C4E] hover:bg-[#382212]'
                }`}
              >
                {confirmDialog.confirmText || 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
      {selectedAuditDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white dark:bg-[#1E1915] border border-[#E8DFD3] dark:border-[#2C2420] rounded-3xl max-w-xl w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between border-b border-[#E8DFD3] dark:border-[#2C2420] pb-3">
              <div className="flex items-center gap-2">
                <FileCode className="w-5 h-5 text-[#C67C4E]" />
                <h3 className="text-base sm:text-lg font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                  Detail Payload Audit Log
                </h3>
              </div>
              <button
                onClick={() => setSelectedAuditDetail(null)}
                className="p-1 text-[#78716C] hover:text-[#2C1810] dark:hover:text-[#F5EBE1] rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-[#FAF7F2] dark:bg-[#14110F] p-3 rounded-xl">
                <div>
                  <span className="text-[#A8A29E]">Aksi:</span>
                  <span className="block font-mono font-bold text-[#4A2E18] dark:text-[#C67C4E]">
                    {selectedAuditDetail.aksi}
                  </span>
                </div>
                <div>
                  <span className="text-[#A8A29E]">Tabel:</span>
                  <span className="block font-mono font-bold text-[#2C1810] dark:text-[#F5EBE1]">
                    {selectedAuditDetail.tabel}
                  </span>
                </div>
                <div>
                  <span className="text-[#A8A29E]">Pelaku:</span>
                  <span className="block font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                    {selectedAuditDetail.pelaku_nama} ({selectedAuditDetail.pelaku_peran})
                  </span>
                </div>
                <div>
                  <span className="text-[#A8A29E]">Data ID:</span>
                  <span className="block font-mono text-[10px] text-[#78716C] dark:text-[#A8A29E] truncate">
                    {selectedAuditDetail.data_id || '-'}
                  </span>
                </div>
                <div className="col-span-2 pt-1 border-t border-[#E8DFD3]/50 dark:border-[#2C2420]/50 flex justify-between items-center text-[11px]">
                  <span className="text-[#A8A29E]">Waktu Kejadian (WIB):</span>
                  <span className="font-mono tabular-nums text-[#2C1810] dark:text-[#F5EBE1]">
                    {formatTanggalWaktu(selectedAuditDetail.dibuat_pada, { withSeconds: true })}
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-[#2C1810] dark:text-[#F5EBE1]">
                    Nilai Sebelum:
                  </span>
                  {selectedAuditDetail.nilai_sebelum === null && (
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold">
                      Record Baru (Insert)
                    </span>
                  )}
                </div>
                <pre className="p-3 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl font-mono text-[11px] overflow-x-auto text-[#78716C] dark:text-[#A8A29E] max-h-48">
                  {selectedAuditDetail.nilai_sebelum !== null && selectedAuditDetail.nilai_sebelum !== undefined
                    ? JSON.stringify(selectedAuditDetail.nilai_sebelum, null, 2)
                    : '(null - tidak ada data sebelumnya)'}
                </pre>
              </div>

              <div>
                <span className="font-semibold text-[#2C1810] dark:text-[#F5EBE1] block mb-1">
                  Nilai Sesudah:
                </span>
                <pre className="p-3 bg-[#FAF7F2] dark:bg-[#14110F] border border-[#E8DFD3] dark:border-[#2C2420] rounded-xl font-mono text-[11px] overflow-x-auto text-emerald-700 dark:text-emerald-400 max-h-48">
                  {selectedAuditDetail.nilai_sesudah !== null && selectedAuditDetail.nilai_sesudah !== undefined
                    ? JSON.stringify(selectedAuditDetail.nilai_sesudah, null, 2)
                    : '(null)'}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedAuditDetail(null)}
                className="px-4 py-2 bg-[#4A2E18] text-white text-xs font-semibold rounded-xl hover:bg-[#382212] dark:bg-[#C67C4E] dark:hover:bg-[#B56B3D] transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
