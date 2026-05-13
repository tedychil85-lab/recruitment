// Stages configuration shared across HR + Pelamar dashboards.
import {
  FileText, Search, ShieldCheck, ClipboardList,
  Video, Users, Crown, Award, XCircle, Hourglass,
} from "lucide-react";

export const STAGES = [
  { key: "applied", label: "Applied", short: "Lamaran", icon: FileText,
    bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE",
    description: "Lamaran berhasil diterima sistem." },
  { key: "screening", label: "Screening", short: "Screening", icon: Search,
    bg: "#FEFCE8", text: "#A16207", border: "#FEF08A",
    description: "Dokumen sedang diperiksa HR." },
  { key: "qualified", label: "Qualified", short: "Qualified", icon: ShieldCheck,
    bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0",
    description: "Selamat, anda lolos seleksi administrasi." },
  { key: "assessment", label: "Assessment", short: "Tes", icon: ClipboardList,
    bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA",
    description: "Silakan mengikuti tes sesuai jadwal." },
  { key: "online_interview", label: "Online Interview", short: "Online", icon: Video,
    bg: "#FAF5FF", text: "#7E22CE", border: "#E9D5FF",
    description: "Interview HR dijadwalkan." },
  { key: "user_interview", label: "User Interview", short: "User", icon: Users,
    bg: "#ECFEFF", text: "#0E7490", border: "#A5F3FC",
    description: "Interview dengan user perusahaan." },
  { key: "top_management_interview", label: "Top Management", short: "Top Mgmt", icon: Crown,
    bg: "#F0F9FF", text: "#0369A1", border: "#BAE6FD",
    description: "Interview final dengan top management." },
  { key: "accepted", label: "Accepted", short: "Diterima", icon: Award,
    bg: "#F0FDF4", text: "#15803D", border: "#BBF7D0",
    description: "Selamat! Anda diterima bergabung." },
];

// Terminal states besides accepted
export const TERMINAL = {
  rejected: { key: "rejected", label: "Rejected", icon: XCircle,
    bg: "#FEF2F2", text: "#B91C1C", border: "#FECACA",
    description: "Mohon maaf, anda belum sesuai pada posisi ini." },
  reserve: { key: "reserve", label: "Cadangan", icon: Hourglass,
    bg: "#F1F5F9", text: "#475569", border: "#CBD5E1",
    description: "Anda masuk daftar kandidat cadangan." },
};

export const STAGE_BY_KEY = {
  ...Object.fromEntries(STAGES.map((s) => [s.key, s])),
  ...Object.fromEntries(Object.values(TERMINAL).map((s) => [s.key, s])),
};

export const stageIndex = (key) => {
  const idx = STAGES.findIndex((s) => s.key === key);
  if (idx >= 0) return idx;
  // terminal states map to last (index 7)
  return 7;
};
