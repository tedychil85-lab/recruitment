import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  LogOut, LayoutDashboard, Users, BarChart3, Briefcase, Calendar,
  Search, ChevronRight, Award, MessageSquare, ClipboardList, Plus, Trash2, Printer,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import NotificationBell from "@/components/NotificationBell";
import RecruitmentTimeline from "@/components/RecruitmentTimeline";
import ChatPanel from "@/components/ChatPanel";
import { STAGES, TERMINAL, STAGE_BY_KEY } from "@/lib/stages";

const ALL_STAGE_KEYS = [...STAGES.map((s) => s.key), ...Object.keys(TERMINAL)];

const formatDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
};

const StageBadge = ({ stage }) => {
  const s = STAGE_BY_KEY[stage];
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-semibold whitespace-nowrap"
          style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.text }} />
      {s.label}
    </span>
  );
};

export default function HRDashboard() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("overview");
  const [apps, setApps] = useState([]);
  const [positions, setPositions] = useState([]);
  const [stats, setStats] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  const [selectedApp, setSelectedApp] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);

  const loadAll = useCallback(async () => {
    const [a, p, s] = await Promise.all([
      api.get("/applications"),
      api.get("/positions"),
      api.get("/stats"),
    ]);
    setApps(a.data);
    setPositions(p.data);
    setStats(s.data);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Polling
  useEffect(() => {
    const t = setInterval(loadAll, 7000);
    return () => clearInterval(t);
  }, [loadAll]);

  const filteredApps = useMemo(() => {
    const q = search.toLowerCase();
    return apps.filter((a) => {
      const m = !q ||
        a.applicant_name.toLowerCase().includes(q) ||
        a.applicant_email.toLowerCase().includes(q) ||
        a.position_title.toLowerCase().includes(q);
      const s = stageFilter === "all" || a.stage === stageFilter;
      return m && s;
    });
  }, [apps, search, stageFilter]);

  const loadRanking = async () => {
    const { data } = await api.get("/saw/ranking");
    setRanking(data);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 bg-white border-r border-slate-200 min-h-screen sticky top-0 hidden md:flex md:flex-col">
        <div className="px-5 py-5 border-b border-slate-100 flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-slate-900 grid place-items-center">
            <span className="text-white font-display font-bold">P</span>
          </div>
          <div>
            <div className="font-display text-base font-bold tracking-tight leading-none">Pertacareer</div>
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500 mt-1">HR Console</div>
          </div>
        </div>
        <nav className="p-3 space-y-1">
          {[
            { key: "overview", label: "Overview", icon: LayoutDashboard },
            { key: "candidates", label: "Kandidat", icon: Users },
            { key: "ranking", label: "Ranking SAW", icon: BarChart3 },
            { key: "positions", label: "Lowongan", icon: Briefcase },
          ].map((it) => {
            const Icon = it.icon;
            const active = view === it.key;
            return (
              <button
                key={it.key}
                onClick={() => { setView(it.key); if (it.key === "ranking") loadRanking(); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
                }`}
                data-testid={`sidebar-${it.key}`}
              >
                <Icon size={16} /> {it.label}
              </button>
            );
          })}
        </nav>
        <div className="mt-auto p-3 border-t border-slate-100">
          <div className="px-3 py-2 rounded-lg bg-slate-50 mb-2">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Logged in</div>
            <div className="text-sm font-semibold text-slate-900 mt-0.5 truncate">{user?.name}</div>
            <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-slate-700" onClick={logout} data-testid="hr-logout-btn">
            <LogOut size={14} className="mr-1.5" /> Keluar
          </Button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {/* Top bar (mobile + actions) */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between sticky top-0 z-20">
          <div>
            <div className="text-[11px] uppercase tracking-widest font-bold text-slate-500">HR Dashboard</div>
            <div className="font-display text-lg font-bold tracking-tight capitalize">{view}</div>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button variant="ghost" onClick={logout} className="md:hidden text-slate-700" data-testid="hr-mobile-logout">
              <LogOut size={16} />
            </Button>
          </div>
        </header>

        <main className="p-4 sm:p-6 space-y-6">
          {view === "overview" && <OverviewView stats={stats} apps={apps} onJump={(v) => setView(v)} />}
          {view === "candidates" && (
            <CandidatesView
              apps={filteredApps}
              search={search} setSearch={setSearch}
              stageFilter={stageFilter} setStageFilter={setStageFilter}
              onOpenCandidate={setSelectedApp}
              onDelete={setPendingDelete}
            />
          )}
          {view === "ranking" && <RankingView ranking={ranking} positions={positions} onReload={loadRanking} />}
          {view === "positions" && <PositionsView positions={positions} reload={loadAll} />}
        </main>
      </div>

      {/* Candidate detail dialog */}
      <CandidateDetailDialog
        app={selectedApp}
        onClose={() => setSelectedApp(null)}
        onChanged={loadAll}
        onDelete={(a) => { setSelectedApp(null); setPendingDelete(a); }}
        currentUser={user}
      />

      {/* Delete confirm dialog */}
      <DeleteCandidateDialog
        app={pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirmed={() => { setPendingDelete(null); loadAll(); }}
      />
    </div>
  );
}

/* ---------- Delete confirm ---------- */
function DeleteCandidateDialog({ app, onClose, onConfirmed }) {
  const [busy, setBusy] = useState(false);
  if (!app) return null;
  const confirm = async () => {
    setBusy(true);
    try {
      await api.delete(`/applications/${app.id}`);
      toast.success(`Kandidat "${app.applicant_name}" dihapus`);
      onConfirmed?.();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Gagal menghapus kandidat");
    } finally { setBusy(false); }
  };
  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2 text-rose-700">
            <Trash2 size={18} /> Hapus kandidat ditolak?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-slate-700">
          <p>
            Anda akan menghapus permanen lamaran <span className="font-semibold">{app.applicant_name}</span>{" "}
            untuk posisi <span className="font-semibold">{app.position_title}</span>.
          </p>
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
            Tindakan ini juga akan menghapus seluruh riwayat pesan dan jadwal interview kandidat tersebut. Tidak dapat dibatalkan.
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose} data-testid="delete-cancel-btn">Batal</Button>
          <Button onClick={confirm} disabled={busy}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                  data-testid="delete-confirm-btn">
            {busy ? "Menghapus…" : "Ya, hapus permanen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Overview ---------- */
function OverviewView({ stats, apps, onJump }) {
  if (!stats) return null;
  const recent = apps.slice(0, 6);
  const cards = [
    {
      label: "Pelamar Aktif",
      n: stats.total_pelamar,
      sub: stats.total_pelamar_all != null ? `dari ${stats.total_pelamar_all} terdaftar` : null,
      k: "candidates",
    },
    { label: "Lowongan Aktif", n: stats.total_positions, k: "positions" },
    { label: "Total Lamaran", n: stats.total_applications, k: "candidates" },
    { label: "Diterima", n: stats.accepted, k: "ranking" },
  ];
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="stats-grid">
        {cards.map((c) => (
          <button key={c.label}
                  onClick={() => onJump(c.k)}
                  data-testid={`stat-${c.label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="text-left rounded-xl border border-slate-200 bg-white p-5 hover:shadow-md hover:border-slate-300 transition-all">
            <div className="text-xs uppercase tracking-widest font-bold text-slate-500">{c.label}</div>
            <div className="font-display text-3xl font-bold mt-2 text-slate-900">{c.n}</div>
            {c.sub && <div className="text-[11px] text-slate-500 mt-1">{c.sub}</div>}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Distribusi tahapan</div>
              <div className="font-display text-lg font-semibold">Funnel rekrutmen</div>
            </div>
          </div>
          <div className="space-y-2.5">
            {[...STAGES, TERMINAL.rejected, TERMINAL.reserve].map((s) => {
              const n = stats.by_stage?.[s.key] ?? 0;
              const max = Math.max(...Object.values(stats.by_stage || { x: 1 }), 1);
              const pct = (n / max) * 100;
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-3" data-testid={`funnel-${s.key}`}>
                  <div className="w-32 flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md grid place-items-center"
                         style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                      <Icon size={14} />
                    </div>
                    <div className="text-xs font-semibold text-slate-700 truncate">{s.label}</div>
                  </div>
                  <div className="flex-1 h-3 rounded-full bg-slate-100 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full"
                      style={{ background: s.text }}
                    />
                  </div>
                  <div className="w-10 text-right text-sm font-semibold text-slate-700">{n}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Aktivitas Terbaru</div>
              <div className="font-display text-lg font-semibold">Lamaran masuk</div>
            </div>
          </div>
          <div className="space-y-2">
            {recent.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-900 truncate">{a.applicant_name}</div>
                  <div className="text-xs text-slate-500 truncate">{a.position_title}</div>
                </div>
                <StageBadge stage={a.stage} />
              </div>
            ))}
            {recent.length === 0 && <div className="text-sm text-slate-400 text-center py-6">Belum ada aktivitas.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------- Candidates ---------- */
function CandidatesView({ apps, search, setSearch, stageFilter, setStageFilter, onOpenCandidate, onDelete }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Daftar Kandidat</div>
          <div className="font-display text-lg font-semibold">{apps.length} kandidat</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)}
                   placeholder="Cari nama, posisi…" className="pl-8 h-10 w-60"
                   data-testid="candidate-search" />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="h-10 w-44" data-testid="stage-filter">
              <SelectValue placeholder="Semua tahap" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tahap</SelectItem>
              {ALL_STAGE_KEYS.map((k) => (
                <SelectItem key={k} value={k}>{STAGE_BY_KEY[k]?.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>Kandidat</TableHead>
              <TableHead>Posisi</TableHead>
              <TableHead>Dilamar</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {apps.map((a) => (
              <TableRow key={a.id} data-testid={`cand-row-${a.id}`}>
                <TableCell>
                  <div className="font-semibold text-slate-900">{a.applicant_name}</div>
                  <div className="text-xs text-slate-500">{a.applicant_email}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm text-slate-900">{a.position_title}</div>
                  <div className="text-xs text-slate-500">{a.department} · {a.location}</div>
                </TableCell>
                <TableCell className="text-xs text-slate-600">{formatDate(a.applied_at)}</TableCell>
                <TableCell><StageBadge stage={a.stage} /></TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => onOpenCandidate(a)}
                            className="text-slate-700"
                            data-testid={`open-cand-${a.id}`}>
                      Kelola <ChevronRight size={14} className="ml-1" />
                    </Button>
                    {a.stage === "rejected" && (
                      <Button variant="ghost" size="sm"
                              onClick={() => onDelete?.(a)}
                              className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              data-testid={`delete-cand-${a.id}`}
                              title="Hapus kandidat yang ditolak">
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {apps.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-sm text-slate-400">Tidak ada kandidat.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ---------- Ranking SAW ---------- */
function RankingView({ ranking, positions, onReload }) {
  const [positionId, setPositionId] = useState("all");
  const [list, setList] = useState(ranking);
  const [info, setInfo] = useState(null);
  const [matrixMode, setMatrixMode] = useState("raw"); // raw | normalized | weighted
  const [showDetail, setShowDetail] = useState(null);

  useEffect(() => { setList(ranking); }, [ranking]);
  useEffect(() => {
    api.get("/saw/info").then(({ data }) => setInfo(data));
    onReload?.();
    /* eslint-disable-next-line */
  }, []);

  const reload = async (pid = positionId) => {
    const params = pid !== "all" ? { position_id: pid } : {};
    const { data } = await api.get("/saw/ranking", { params });
    setList(data);
  };

  const criteria = info?.criteria ?? [];

  const valueFor = (row, key) => {
    if (matrixMode === "raw") return row.scores?.[key];
    if (matrixMode === "normalized") return row.normalized?.[key];
    if (matrixMode === "weighted") return row.weighted?.[key];
    return undefined;
  };

  const fmt = (v) => {
    if (v == null || v === "") return "—";
    if (matrixMode === "raw") return v;
    return Number(v).toFixed(3);
  };

  const selectedPositionLabel =
    positionId === "all"
      ? "Semua Posisi"
      : (positions.find((p) => p.id === positionId)?.title ?? "—");

  const printedAt = new Date().toLocaleString("id-ID", { dateStyle: "full", timeStyle: "short" });

  return (
    <div className="space-y-4">
      {/* Print-only header (visible only when printing) */}
      <div className="print-only" data-testid="print-header">
        <div style={{ borderBottom: "2px solid #0F172A", paddingBottom: 10, marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 10, letterSpacing: 2, fontWeight: 700, textTransform: "uppercase" }}>
                Pertacareer · Recruitment System
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4 }}>
                LAPORAN RANKING KANDIDAT — METODE SAW
              </div>
              <div style={{ fontSize: 11, marginTop: 4 }}>
                Untuk: <b>Top Management</b> · Bersifat Rahasia (Confidential)
              </div>
            </div>
            <div style={{ textAlign: "right", fontSize: 10 }}>
              <div><b>Posisi:</b> {selectedPositionLabel}</div>
              <div><b>Dicetak:</b> {printedAt}</div>
              <div><b>Total kandidat:</b> {list.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Formula card (hidden on print) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 no-print">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Metode SAW</div>
            <div className="font-display text-xl font-semibold">Simple Additive Weighting</div>
            <p className="text-xs text-slate-500 mt-1 max-w-2xl">
              Setiap kriteria dinormalisasi sesuai jenisnya (benefit / cost), dikalikan bobot, lalu dijumlah menjadi skor akhir <span className="font-mono">V<sub>i</sub></span>.
              <span className="block mt-1 text-rose-600">Catatan: kandidat yang sudah <b>Accepted</b> otomatis tidak ditampilkan di ranking.</span>
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={positionId} onValueChange={(v) => { setPositionId(v); reload(v); }}>
              <SelectTrigger className="h-10 w-56" data-testid="ranking-position-filter">
                <SelectValue placeholder="Semua posisi" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua posisi</SelectItem>
                {positions.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white" onClick={() => reload()}
                    data-testid="recompute-saw-btn">
              <BarChart3 size={14} className="mr-1.5" /> Hitung Ulang
            </Button>
            <Button variant="outline" onClick={() => window.print()}
                    className="border-slate-300"
                    data-testid="print-ranking-btn">
              <Printer size={14} className="mr-1.5" /> Cetak Laporan
            </Button>
          </div>
        </div>

        <div className="mt-4 grid md:grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">1. Normalisasi</div>
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-700 font-semibold text-[10px]">BENEFIT</span>
                <span className="font-mono text-slate-700">r<sub>ij</sub> = x<sub>ij</sub> / max(x<sub>j</sub>)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 font-semibold text-[10px]">COST</span>
                <span className="font-mono text-slate-700">r<sub>ij</sub> = min(x<sub>j</sub>) / x<sub>ij</sub></span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">2. Terbobot & Skor Akhir</div>
            <div className="mt-2 space-y-1.5 text-xs">
              <div className="font-mono text-slate-700">v<sub>ij</sub> = w<sub>j</sub> · r<sub>ij</sub></div>
              <div className="font-mono text-slate-900 font-semibold">V<sub>i</sub> = Σ (w<sub>j</sub> · r<sub>ij</sub>),  j = 1..n</div>
            </div>
          </div>
        </div>

        {/* Criteria weights table */}
        <div className="mt-4 overflow-x-auto" data-testid="saw-criteria-table">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Kriteria</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead className="text-right">Bobot (w)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {criteria.map((c) => (
                <TableRow key={c.key}>
                  <TableCell className="font-medium text-slate-900">{c.label}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wider ${
                      c.type === "benefit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                    }`}>{c.type}</span>
                  </TableCell>
                  <TableCell className="text-right font-mono">{(c.weight * 100).toFixed(0)}%</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-slate-50">
                <TableCell colSpan={2} className="text-right text-xs uppercase tracking-widest font-bold text-slate-500">Total</TableCell>
                <TableCell className="text-right font-mono font-bold">
                  {info ? (info.total_weight * 100).toFixed(0) : "—"}%
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* View mode toggle (hidden on print) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 flex items-center gap-2 flex-wrap no-print">
        <div className="text-xs uppercase tracking-widest font-bold text-slate-500 mr-2">Tampilan Matriks:</div>
        {[
          { k: "raw", label: "Nilai Asli (x)" },
          { k: "normalized", label: "Normalisasi (r)" },
          { k: "weighted", label: "Terbobot (v = w·r)" },
        ].map((m) => (
          <button
            key={m.k}
            onClick={() => setMatrixMode(m.k)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
              matrixMode === m.k
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
            data-testid={`matrix-mode-${m.k}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Ranking table (this is the print area) */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto print-area">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-14">Rank</TableHead>
              <TableHead>Kandidat</TableHead>
              <TableHead>Posisi</TableHead>
              {criteria.map((c) => (
                <TableHead key={c.key} className="text-right">
                  <div className="flex flex-col items-end">
                    <span>{c.label}</span>
                    <span className={`text-[9px] uppercase tracking-wider font-bold mt-0.5 ${
                      c.type === "benefit" ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {c.type} · {(c.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right">V<sub>i</sub></TableHead>
              <TableHead className="text-right no-print">Detail</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((r) => (
              <TableRow key={r.id} data-testid={`rank-row-${r.id}`}>
                <TableCell>
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                    r.rank === 1 ? "bg-amber-100 text-amber-700" :
                    r.rank === 2 ? "bg-slate-200 text-slate-700" :
                    r.rank === 3 ? "bg-orange-100 text-orange-700" :
                    "bg-slate-50 text-slate-500"
                  }`}>
                    {r.rank === 1 ? <Award size={14} /> : `#${r.rank}`}
                  </span>
                </TableCell>
                <TableCell className="font-semibold text-slate-900">{r.applicant_name}</TableCell>
                <TableCell className="text-sm text-slate-600">{r.position_title}</TableCell>
                {criteria.map((c) => (
                  <TableCell key={c.key} className="text-right font-mono text-slate-700"
                             data-testid={`cell-${r.id}-${c.key}`}>
                    {fmt(valueFor(r, c.key))}
                  </TableCell>
                ))}
                <TableCell className="text-right font-display font-bold text-slate-900">
                  {r.saw_score?.toFixed(4)}
                </TableCell>
                <TableCell className="text-right no-print">
                  <Button variant="ghost" size="sm" onClick={() => setShowDetail(r)} data-testid={`detail-${r.id}`}>
                    Breakdown
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {list.length === 0 && (
              <TableRow><TableCell colSpan={4 + criteria.length} className="text-center py-10 text-sm text-slate-400">
                Belum ada kandidat yang dinilai. Input nilai pada panel "Kelola Kandidat".
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>

        {/* Print-only signature block */}
        <div className="print-only" style={{ marginTop: 30, padding: "0 8px" }}>
          <div style={{ fontSize: 10, color: "#475569", marginBottom: 18 }}>
            * Skor V<sub>i</sub> dihitung menggunakan metode Simple Additive Weighting (SAW) dengan bobot kriteria sesuai konfigurasi sistem.
            Ranking ini bersifat rekomendasi dan keputusan akhir ada pada manajemen.
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <div style={{ width: 200, textAlign: "center" }}>
              <div style={{ fontSize: 11 }}>Disusun oleh,</div>
              <div style={{ height: 60 }} />
              <div style={{ borderTop: "1px solid #000", paddingTop: 4, fontSize: 11 }}>HR / Recruiter</div>
            </div>
            <div style={{ width: 200, textAlign: "center" }}>
              <div style={{ fontSize: 11 }}>Mengetahui,</div>
              <div style={{ height: 60 }} />
              <div style={{ borderTop: "1px solid #000", paddingTop: 4, fontSize: 11 }}>HR Manager</div>
            </div>
            <div style={{ width: 200, textAlign: "center" }}>
              <div style={{ fontSize: 11 }}>Menyetujui,</div>
              <div style={{ height: 60 }} />
              <div style={{ borderTop: "1px solid #000", paddingTop: 4, fontSize: 11 }}>Top Management</div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail breakdown dialog */}
      <Dialog open={!!showDetail} onOpenChange={(o) => !o && setShowDetail(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Breakdown SAW — {showDetail?.applicant_name}</DialogTitle>
          </DialogHeader>
          {showDetail && (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">{showDetail.position_title} · Rank #{showDetail.rank}</div>
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Kriteria</TableHead>
                    <TableHead>Tipe</TableHead>
                    <TableHead className="text-right">x (asli)</TableHead>
                    <TableHead className="text-right">r (normal)</TableHead>
                    <TableHead className="text-right">w</TableHead>
                    <TableHead className="text-right">v = w·r</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {criteria.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                          c.type === "benefit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                        }`}>{c.type}</span>
                      </TableCell>
                      <TableCell className="text-right font-mono">{showDetail.scores?.[c.key] ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{showDetail.normalized?.[c.key]?.toFixed(4) ?? "—"}</TableCell>
                      <TableCell className="text-right font-mono">{c.weight.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold text-slate-900">
                        {showDetail.weighted?.[c.key]?.toFixed(4) ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-slate-900 text-white">
                    <TableCell colSpan={5} className="text-right text-xs uppercase tracking-widest font-bold">
                      V<sub>i</sub> = Σ(w · r)
                    </TableCell>
                    <TableCell className="text-right font-display font-bold">
                      {showDetail.saw_score?.toFixed(4)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Positions ---------- */
function PositionsView({ positions, reload }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", department: "", location: "", description: "", requirements: "", closing_date: "" });

  const submit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/positions", {
        title: form.title, department: form.department, location: form.location,
        description: form.description,
        requirements: form.requirements.split("\n").map((s) => s.trim()).filter(Boolean),
        closing_date: form.closing_date || null,
      });
      toast.success("Lowongan dibuat");
      setOpen(false);
      setForm({ title: "", department: "", location: "", description: "", requirements: "", closing_date: "" });
      reload?.();
    } catch (err) {
      toast.error("Gagal membuat lowongan");
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus lowongan ini?")) return;
    await api.delete(`/positions/${id}`);
    toast.success("Lowongan dihapus");
    reload?.();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Manajemen Lowongan</div>
          <div className="font-display text-lg font-semibold">{positions.length} posisi</div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="new-position-btn">
              <Plus size={14} className="mr-1.5" /> Lowongan Baru
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Buat Lowongan</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3" data-testid="position-form">
              <Input placeholder="Judul Posisi" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-testid="pos-title" />
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Departemen" required value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} data-testid="pos-department" />
                <Input placeholder="Lokasi" required value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} data-testid="pos-location" />
              </div>
              <Textarea placeholder="Deskripsi" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="pos-description" />
              <Textarea placeholder="Persyaratan (per baris)" rows={3} value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} data-testid="pos-requirements" />
              <Input type="date" value={form.closing_date} onChange={(e) => setForm({ ...form, closing_date: e.target.value })} data-testid="pos-closing-date" />
              <DialogFooter>
                <Button type="submit" className="bg-slate-900 hover:bg-slate-800 text-white" data-testid="pos-submit-btn">Simpan</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {positions.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col" data-testid={`hr-pos-${p.id}`}>
            <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">{p.department}</div>
            <div className="font-display text-lg font-semibold mt-1 text-slate-900">{p.title}</div>
            <div className="text-xs text-slate-500 mt-1">{p.location}</div>
            <p className="text-sm text-slate-600 mt-3 line-clamp-3">{p.description}</p>
            <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="text-xs text-slate-500">Tutup: {p.closing_date || "—"}</div>
              <Button variant="ghost" size="sm" onClick={() => remove(p.id)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      data-testid={`del-pos-${p.id}`}>
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Candidate detail dialog (stage / scores / interview / chat) ---------- */
function CandidateDetailDialog({ app, onClose, onChanged, onDelete, currentUser }) {
  const [busy, setBusy] = useState(false);
  const [scores, setScores] = useState({ pendidikan: 0, pengalaman: 0, tes_teknis: 0, interview: 0, usia: 0, sertifikasi: 0 });
  const [interviewForm, setInterviewForm] = useState({ type: "online_interview", scheduled_at: "", meeting_link: "", location: "", notes: "" });
  const [stageNote, setStageNote] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [latestApp, setLatestApp] = useState(app);

  useEffect(() => {
    setLatestApp(app);
    if (app) {
      setScores({
        pendidikan: app.scores?.pendidikan ?? 0,
        pengalaman: app.scores?.pengalaman ?? 0,
        tes_teknis: app.scores?.tes_teknis ?? 0,
        interview: app.scores?.interview ?? 0,
        usia: app.scores?.usia ?? 0,
        sertifikasi: app.scores?.sertifikasi ?? 0,
      });
    }
  }, [app, refreshKey]);

  const reloadApp = async () => {
    if (!app) return;
    const { data } = await api.get(`/applications/${app.id}`);
    setLatestApp(data);
  };

  const updateStage = async (newStage) => {
    setBusy(true);
    try {
      await api.patch(`/applications/${app.id}/stage`, { stage: newStage, note: stageNote || undefined });
      toast.success("Status diperbarui");
      setStageNote("");
      await reloadApp();
      onChanged?.();
    } catch {
      toast.error("Gagal memperbarui status");
    } finally { setBusy(false); }
  };

  const saveScores = async () => {
    setBusy(true);
    try {
      await api.patch(`/applications/${app.id}/scores`, scores);
      toast.success("Nilai disimpan");
      await reloadApp();
      onChanged?.();
    } catch {
      toast.error("Gagal menyimpan nilai");
    } finally { setBusy(false); }
  };

  const scheduleInterview = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/interviews", { ...interviewForm, application_id: app.id });
      toast.success("Jadwal dikirim ke kandidat");
      setInterviewForm({ ...interviewForm, scheduled_at: "", meeting_link: "", location: "", notes: "" });
      setRefreshKey((k) => k + 1);
    } catch {
      toast.error("Gagal menjadwalkan");
    } finally { setBusy(false); }
  };

  if (!app) return null;
  const a = latestApp || app;

  return (
    <Dialog open={!!app} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <DialogTitle className="font-display flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white grid place-items-center font-bold">
              {a.applicant_name?.[0]}
            </div>
            <div>
              <div>{a.applicant_name}</div>
              <div className="text-xs font-normal text-slate-500">{a.applicant_email} · {a.applicant_phone || "—"}</div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <StageBadge stage={a.stage} />
              {a.stage === "rejected" && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onDelete?.(a)}
                  className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  data-testid="dlg-delete-cand-btn"
                  title="Hapus kandidat ditolak"
                >
                  <Trash2 size={14} className="mr-1" /> Hapus
                </Button>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 max-h-[78vh] overflow-y-auto scrollbar-thin">
          <div className="mb-4 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{a.position_title}</span> · {a.department} · {a.location}
          </div>

          <RecruitmentTimeline currentStage={a.stage} />

          <Tabs defaultValue="stage" className="mt-6">
            <TabsList className="bg-slate-100">
              <TabsTrigger value="stage" data-testid="dlg-tab-stage">Ubah Status</TabsTrigger>
              <TabsTrigger value="scores" data-testid="dlg-tab-scores">Nilai SAW</TabsTrigger>
              <TabsTrigger value="schedule" data-testid="dlg-tab-schedule">Jadwal</TabsTrigger>
              <TabsTrigger value="chat" data-testid="dlg-tab-chat">Chat</TabsTrigger>
              <TabsTrigger value="profile" data-testid="dlg-tab-profile">Profil</TabsTrigger>
            </TabsList>

            <TabsContent value="stage" className="pt-4 space-y-3">
              <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Pindahkan ke tahap berikutnya</div>
              <Textarea placeholder="Catatan opsional untuk kandidat…" value={stageNote}
                        onChange={(e) => setStageNote(e.target.value)} rows={2} data-testid="stage-note" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {ALL_STAGE_KEYS.map((k) => {
                  const s = STAGE_BY_KEY[k];
                  const cur = a.stage === k;
                  return (
                    <button key={k} disabled={busy || cur} onClick={() => updateStage(k)}
                            className={`text-left p-2.5 rounded-lg border text-xs font-semibold transition-all ${
                              cur ? "opacity-50 cursor-not-allowed" : "hover:shadow-sm"
                            }`}
                            style={{ background: s.bg, color: s.text, borderColor: s.border }}
                            data-testid={`stage-btn-${k}`}>
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="scores" className="pt-4">
              <div className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2">Input nilai (0–100)</div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  ["pendidikan", "Pendidikan", "benefit", "20%"],
                  ["pengalaman", "Pengalaman Kerja", "benefit", "20%"],
                  ["tes_teknis", "Tes Teknis", "benefit", "25%"],
                  ["interview", "Interview", "benefit", "20%"],
                  ["usia", "Usia (tahun)", "cost", "5%"],
                  ["sertifikasi", "Sertifikasi", "benefit", "10%"],
                ].map(([k, label, type, weight]) => (
                  <div key={k} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>{label}</Label>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                        type === "benefit" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                      }`}>{type} · {weight}</span>
                    </div>
                    <Input type="number" min={0} max={100} value={scores[k]}
                           onChange={(e) => setScores({ ...scores, [k]: Number(e.target.value) })}
                           data-testid={`score-${k}`} className="h-10" />
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-slate-500">
                <span className="font-semibold">Catatan:</span> Kriteria <span className="px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">benefit</span> = semakin besar semakin baik.
                Kriteria <span className="px-1 py-0.5 rounded bg-rose-100 text-rose-700 font-semibold">cost</span> = semakin kecil semakin baik (mis. usia).
              </div>
              <div className="mt-4 flex justify-end">
                <Button onClick={saveScores} disabled={busy}
                        className="bg-slate-900 hover:bg-slate-800 text-white"
                        data-testid="save-scores-btn">
                  Simpan Nilai
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="pt-4">
              <form onSubmit={scheduleInterview} className="space-y-3" data-testid="schedule-form">
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Tipe</Label>
                    <Select value={interviewForm.type} onValueChange={(v) => setInterviewForm({ ...interviewForm, type: v })}>
                      <SelectTrigger className="h-10" data-testid="sched-type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assessment">Assessment</SelectItem>
                        <SelectItem value="online_interview">Online Interview</SelectItem>
                        <SelectItem value="user_interview">User Interview</SelectItem>
                        <SelectItem value="top_management_interview">Top Mgmt Interview</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Jadwal</Label>
                    <Input type="datetime-local" required value={interviewForm.scheduled_at}
                           onChange={(e) => setInterviewForm({ ...interviewForm, scheduled_at: e.target.value })}
                           className="h-10" data-testid="sched-datetime" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Meeting link</Label>
                    <Input placeholder="https://meet…" value={interviewForm.meeting_link}
                           onChange={(e) => setInterviewForm({ ...interviewForm, meeting_link: e.target.value })}
                           className="h-10" data-testid="sched-link" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Lokasi (opsional)</Label>
                    <Input value={interviewForm.location}
                           onChange={(e) => setInterviewForm({ ...interviewForm, location: e.target.value })}
                           className="h-10" data-testid="sched-location" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Catatan</Label>
                  <Textarea rows={2} value={interviewForm.notes}
                            onChange={(e) => setInterviewForm({ ...interviewForm, notes: e.target.value })}
                            data-testid="sched-notes" />
                </div>
                <div className="flex justify-end">
                  <Button type="submit" disabled={busy}
                          className="bg-slate-900 hover:bg-slate-800 text-white"
                          data-testid="sched-submit-btn">
                    <Calendar size={14} className="mr-1.5" /> Kirim Jadwal
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="chat" className="pt-4">
              <div className="h-[420px] border border-slate-200 rounded-xl overflow-hidden">
                <ChatPanel applicationId={a.id} currentUserId={currentUser.id} currentUserRole={currentUser.role} />
              </div>
            </TabsContent>

            <TabsContent value="profile" className="pt-4">
              <div className="grid sm:grid-cols-2 gap-3 text-sm" data-testid="profile-grid">
                <Info label="Pendidikan" value={a.education} />
                <Info label="Usia" value={a.age} />
                <Info label="Pengalaman" value={`${a.experience_years} tahun`} />
                <Info label="Sertifikasi" value={(a.certifications || []).join(", ") || "—"} />
                <Info label="Dilamar" value={formatDate(a.applied_at)} />
                <Info label="Update terakhir" value={formatDate(a.updated_at)} />
              </div>
              {a.cover_letter && (
                <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-1">Cover Letter</div>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap">{a.cover_letter}</div>
                </div>
              )}
              <div className="mt-4">
                <div className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2">Riwayat Tahapan</div>
                <div className="space-y-2">
                  {[...(a.history || [])].reverse().map((h, i) => {
                    const s = STAGE_BY_KEY[h.stage];
                    return (
                      <div key={i} className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-100">
                        <div className="w-7 h-7 rounded-md grid place-items-center"
                             style={{ background: s?.bg, color: s?.text, border: `1px solid ${s?.border}` }}>
                          <ClipboardList size={14} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-slate-900">{s?.label}</div>
                          <div className="text-xs text-slate-500">{h.note}</div>
                        </div>
                        <div className="text-[11px] text-slate-400">{formatDate(h.at)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const Info = ({ label, value }) => (
  <div className="p-3 rounded-lg border border-slate-200 bg-white">
    <div className="text-[10px] uppercase tracking-widest font-bold text-slate-500">{label}</div>
    <div className="text-sm font-semibold text-slate-900 mt-0.5">{value}</div>
  </div>
);

// silence unused import warning when MessageSquare not referenced
// eslint-disable-next-line no-unused-vars
const _kept = { MessageSquare };
