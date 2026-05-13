import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  LogOut, MapPin, Building2, Briefcase, Calendar, FileText, ChevronRight,
  ClipboardList, MessageSquare, Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";

import api from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import RecruitmentTimeline from "@/components/RecruitmentTimeline";
import NotificationBell from "@/components/NotificationBell";
import ChatPanel from "@/components/ChatPanel";
import { STAGE_BY_KEY, stageIndex } from "@/lib/stages";

const formatDate = (iso) => {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return iso; }
};

const StageBadge = ({ stage }) => {
  const s = STAGE_BY_KEY[stage];
  if (!s) return null;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold"
          style={{ background: s.bg, color: s.text, border: `1px solid ${s.border}` }}
          data-testid={`stage-badge-${stage}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.text }} />
      {s.label}
    </span>
  );
};

export default function PelamarDashboard() {
  const { user, logout } = useAuth();
  const [apps, setApps] = useState([]);
  const [positions, setPositions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [interviews, setInterviews] = useState([]);
  const [openApply, setOpenApply] = useState(false);

  const loadApps = useCallback(async () => {
    const { data } = await api.get("/applications/mine");
    setApps(data);
    if (!selectedId && data.length > 0) setSelectedId(data[0].id);
  }, [selectedId]);

  const loadPositions = useCallback(async () => {
    const { data } = await api.get("/positions");
    setPositions(data);
  }, []);

  const loadInterviews = useCallback(async () => {
    if (!selectedId) return setInterviews([]);
    const { data } = await api.get("/interviews", { params: { application_id: selectedId } });
    setInterviews(data);
  }, [selectedId]);

  useEffect(() => { loadApps(); loadPositions(); }, [loadApps, loadPositions]);
  useEffect(() => {
    loadInterviews();
    if (!selectedId) return;
    // Realtime polling for selected application
    const t = setInterval(async () => {
      const { data } = await api.get(`/applications/${selectedId}`);
      setApps((prev) => prev.map((a) => (a.id === data.id ? data : a)));
    }, 5000);
    return () => clearInterval(t);
  }, [selectedId, loadInterviews]);

  const selected = apps.find((a) => a.id === selectedId);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-slate-900 grid place-items-center">
              <span className="text-white font-display font-bold">P</span>
            </div>
            <div>
              <div className="font-display text-lg font-bold tracking-tight leading-none">Pertacareer</div>
              <div className="text-[11px] text-slate-500 uppercase tracking-widest font-semibold">Dashboard Pelamar</div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <ApplyDialog open={openApply} setOpen={setOpenApply} positions={positions} apps={apps} onCreated={loadApps} />
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2 px-3 h-10 rounded-lg border border-slate-200 bg-white">
              <div className="w-7 h-7 rounded-full bg-slate-900 grid place-items-center text-white text-xs font-bold">
                {user?.name?.[0] ?? "U"}
              </div>
              <div className="text-sm">
                <div className="font-semibold text-slate-900 leading-none">{user?.name}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{user?.email}</div>
              </div>
            </div>
            <Button onClick={logout} variant="ghost" className="text-slate-700" data-testid="logout-btn">
              <LogOut size={16} className="mr-1.5" /> Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Hero / current status card */}
        {selected ? (
          <motion.section
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
            data-testid="current-status-card"
          >
            <div className="px-6 py-5 bg-gradient-to-r from-slate-900 to-slate-700 text-white flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-300">Posisi dilamar</div>
                <div className="font-display text-2xl font-bold mt-1">{selected.position_title}</div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-1"><Building2 size={14} />{selected.department}</span>
                  <span className="inline-flex items-center gap-1"><MapPin size={14} />{selected.location}</span>
                  <span className="inline-flex items-center gap-1"><Calendar size={14} />Dilamar: {formatDate(selected.applied_at)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-[0.2em] font-semibold text-slate-300">Status Saat ini</div>
                <div className="mt-1.5"><StageBadge stage={selected.stage} /></div>
                <div className="mt-3 w-48 ml-auto">
                  <div className="text-xs text-slate-300 mb-1 flex justify-between">
                    <span>Progress</span><span>{selected.progress_percent}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/20 overflow-hidden">
                    <motion.div
                      className="h-full bg-white"
                      initial={{ width: 0 }}
                      animate={{ width: `${selected.progress_percent}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <RecruitmentTimeline currentStage={selected.stage} />
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 flex items-start gap-3"
                   data-testid="stage-description">
                <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 grid place-items-center text-slate-700">
                  <FileText size={16} />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Keterangan</div>
                  <div className="text-sm text-slate-700 mt-0.5">
                    {STAGE_BY_KEY[selected.stage]?.description}
                  </div>
                </div>
              </div>
            </div>
          </motion.section>
        ) : (
          <EmptyState onApply={() => setOpenApply(true)} />
        )}

        {/* My applications + details */}
        <div className="grid lg:grid-cols-12 gap-6">
          <aside className="lg:col-span-4">
            <div className="rounded-2xl border border-slate-200 bg-white">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Lamaran Saya</div>
                  <div className="font-display text-lg font-semibold">{apps.length} lamaran aktif</div>
                </div>
              </div>
              <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto scrollbar-thin">
                {apps.map((a) => {
                  const s = STAGE_BY_KEY[a.stage];
                  const active = a.id === selectedId;
                  return (
                    <button
                      key={a.id}
                      onClick={() => setSelectedId(a.id)}
                      className={`w-full text-left px-5 py-4 hover:bg-slate-50 transition-all ${active ? "bg-slate-50" : ""}`}
                      data-testid={`app-list-item-${a.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <div className="font-display text-sm font-semibold text-slate-900 truncate">{a.position_title}</div>
                          <div className="text-xs text-slate-500 mt-0.5 truncate">{a.department} · {a.location}</div>
                        </div>
                        <ChevronRight size={16} className="text-slate-300 shrink-0" />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <StageBadge stage={a.stage} />
                        <span className="text-xs text-slate-400">{a.progress_percent}%</span>
                      </div>
                      <div className="h-1.5 mt-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full" style={{ width: `${a.progress_percent}%`, background: s?.text ?? "#0F172A" }} />
                      </div>
                    </button>
                  );
                })}
                {apps.length === 0 && (
                  <div className="p-6 text-center text-sm text-slate-400">Belum ada lamaran.</div>
                )}
              </div>
            </div>
          </aside>

          <section className="lg:col-span-8">
            {selected ? (
              <Tabs defaultValue="history" className="bg-white rounded-2xl border border-slate-200">
                <TabsList className="bg-transparent p-2 border-b border-slate-100 rounded-none w-full justify-start">
                  <TabsTrigger value="history" data-testid="tab-history" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                    Riwayat
                  </TabsTrigger>
                  <TabsTrigger value="interviews" data-testid="tab-interviews" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                    Jadwal
                  </TabsTrigger>
                  <TabsTrigger value="chat" data-testid="tab-chat" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white">
                    Chat HR
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="history" className="p-5">
                  <div className="space-y-3" data-testid="history-list">
                    {[...(selected.history || [])].reverse().map((h, i) => {
                      const s = STAGE_BY_KEY[h.stage];
                      return (
                        <div key={i} className="flex gap-3 items-start" data-testid={`history-item-${i}`}>
                          <div className="w-9 h-9 rounded-full grid place-items-center shrink-0"
                               style={{ background: s?.bg, color: s?.text, border: `1px solid ${s?.border}` }}>
                            {s?.icon ? <s.icon size={16} /> : <ClipboardList size={16} />}
                          </div>
                          <div className="flex-1 pb-3 border-b border-slate-100 last:border-b-0">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="font-display font-semibold text-sm text-slate-900">{s?.label ?? h.stage}</div>
                              <div className="text-xs text-slate-400">{formatDate(h.at)}</div>
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">{h.note}</div>
                            {h.by && <div className="text-[10px] text-slate-400 mt-1">oleh {h.by}</div>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="interviews" className="p-5">
                  <div className="space-y-3" data-testid="interviews-list">
                    {interviews.length === 0 && (
                      <div className="text-sm text-slate-400 text-center py-8">Belum ada jadwal interview.</div>
                    )}
                    {interviews.map((it) => (
                      <div key={it.id}
                           className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap items-start justify-between gap-3"
                           data-testid={`interview-item-${it.id}`}>
                        <div className="flex gap-3 items-start">
                          <div className="w-10 h-10 rounded-lg bg-white border border-slate-200 grid place-items-center text-slate-700">
                            <Calendar size={18} />
                          </div>
                          <div>
                            <div className="font-display font-semibold text-sm capitalize text-slate-900">
                              {it.type.replace(/_/g, " ")}
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">{formatDate(it.scheduled_at)}</div>
                            {it.location && <div className="text-xs text-slate-500 mt-0.5">📍 {it.location}</div>}
                            {it.notes && <div className="text-xs text-slate-500 mt-1">{it.notes}</div>}
                          </div>
                        </div>
                        {it.meeting_link && (
                          <a href={it.meeting_link} target="_blank" rel="noreferrer"
                             className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800">
                            Buka link
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="chat" className="p-0 h-[480px]">
                  <ChatPanel applicationId={selected.id} currentUserId={user.id} currentUserRole={user.role} />
                </TabsContent>
              </Tabs>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <Briefcase className="mx-auto text-slate-400" size={32} />
                <div className="font-display text-lg font-semibold mt-3">Belum ada lamaran dipilih</div>
                <Button onClick={() => setOpenApply(true)}
                        className="mt-4 bg-slate-900 hover:bg-slate-800 text-white"
                        data-testid="cta-apply-btn">
                  Lamar posisi pertama anda
                </Button>
              </div>
            )}
          </section>
        </div>

        {/* Open positions list */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Lowongan Terbuka</div>
              <div className="font-display text-xl font-semibold">Posisi yang sedang dibuka</div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="positions-grid">
            {positions.map((p) => {
              const alreadyApplied = apps.some((a) => a.position_id === p.id);
              return (
                <div key={p.id} className="rounded-xl border border-slate-200 p-5 hover:shadow-md transition-all flex flex-col"
                     data-testid={`position-card-${p.id}`}>
                  <div>
                    <div className="text-xs uppercase tracking-widest font-semibold text-slate-500">{p.department}</div>
                    <div className="font-display text-lg font-semibold mt-1 text-slate-900">{p.title}</div>
                    <div className="text-xs text-slate-500 mt-1 inline-flex items-center gap-1"><MapPin size={12} />{p.location}</div>
                    <p className="text-sm text-slate-600 mt-3 leading-relaxed line-clamp-3">{p.description}</p>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500">Tutup: {p.closing_date || "—"}</span>
                    <ApplyDialog
                      position={p}
                      apps={apps}
                      positions={positions}
                      disabled={alreadyApplied}
                      onCreated={loadApps}
                      trigger={
                        <Button size="sm" disabled={alreadyApplied}
                                className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg disabled:opacity-50"
                                data-testid={`apply-btn-${p.id}`}>
                          {alreadyApplied ? "Sudah dilamar" : "Lamar"}
                        </Button>
                      }
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function EmptyState({ onApply }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <MessageSquare className="mx-auto text-slate-400" size={32} />
      <div className="font-display text-xl font-semibold mt-3">Selamat datang!</div>
      <p className="text-sm text-slate-500 mt-1">Mulai dengan melamar posisi pertama anda.</p>
      <Button onClick={onApply} className="mt-4 bg-slate-900 hover:bg-slate-800 text-white"
              data-testid="empty-apply-btn">
        <Plus size={16} className="mr-1.5" /> Lamar Posisi
      </Button>
    </div>
  );
}

function ApplyDialog({ open, setOpen, position, positions = [], apps = [], onCreated, trigger, disabled }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof setOpen === "function";
  const dlgOpen = isControlled ? open : internalOpen;
  const setDlgOpen = isControlled ? setOpen : setInternalOpen;
  const [positionId, setPositionId] = useState(position?.id ?? "");
  const [form, setForm] = useState({ education: "", experience_years: 0, age: 22, certifications: "", cover_letter: "" });
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!positionId) { toast.error("Pilih posisi terlebih dahulu"); return; }
    setSubmitting(true);
    try {
      await api.post("/applications", {
        position_id: positionId,
        education: form.education,
        experience_years: Number(form.experience_years) || 0,
        age: Number(form.age) || 18,
        certifications: form.certifications.split(",").map((s) => s.trim()).filter(Boolean),
        cover_letter: form.cover_letter,
      });
      toast.success("Lamaran terkirim!");
      setDlgOpen(false);
      onCreated?.();
    } catch (err) {
      const d = err.response?.data?.detail;
      toast.error(typeof d === "string" ? d : "Gagal mengirim lamaran");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button data-testid="open-apply-dialog" className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg" disabled={disabled}>
            <Plus size={16} className="mr-1.5" /> Lamar Posisi
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">Form Lamaran Kerja</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4" data-testid="apply-form">
          <div className="space-y-1.5">
            <Label>Posisi</Label>
            <select
              value={positionId}
              onChange={(e) => setPositionId(e.target.value)}
              className="w-full h-11 px-3 rounded-md border border-slate-200 bg-white text-sm"
              required
              data-testid="apply-position-select"
            >
              <option value="">— Pilih posisi —</option>
              {positions.map((p) => {
                const used = apps.some((a) => a.position_id === p.id);
                return (
                  <option key={p.id} value={p.id} disabled={used}>
                    {p.title} {used ? "(sudah dilamar)" : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pendidikan</Label>
              <Input value={form.education} required
                     onChange={(e) => setForm({ ...form, education: e.target.value })}
                     placeholder="S1 Teknik …" data-testid="apply-education" />
            </div>
            <div className="space-y-1.5">
              <Label>Usia</Label>
              <Input type="number" min={18} max={60} value={form.age}
                     onChange={(e) => setForm({ ...form, age: e.target.value })}
                     data-testid="apply-age" />
            </div>
            <div className="space-y-1.5">
              <Label>Pengalaman (tahun)</Label>
              <Input type="number" min={0} value={form.experience_years}
                     onChange={(e) => setForm({ ...form, experience_years: e.target.value })}
                     data-testid="apply-experience" />
            </div>
            <div className="space-y-1.5">
              <Label>Sertifikasi (pisah koma)</Label>
              <Input value={form.certifications}
                     onChange={(e) => setForm({ ...form, certifications: e.target.value })}
                     placeholder="SPE Member, K3 Migas" data-testid="apply-certs" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Cover Letter</Label>
            <Textarea rows={4} value={form.cover_letter}
                      onChange={(e) => setForm({ ...form, cover_letter: e.target.value })}
                      placeholder="Ceritakan motivasi anda…" data-testid="apply-cover-letter" />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={submitting}
                    className="bg-slate-900 hover:bg-slate-800 text-white"
                    data-testid="apply-submit-btn">
              {submitting ? "Mengirim…" : "Kirim Lamaran"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
