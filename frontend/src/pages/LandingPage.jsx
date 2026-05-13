import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, Clock, MessageSquare, BarChart3, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { STAGES } from "@/lib/stages";

const features = [
  { icon: Clock, title: "Realtime Progress", body: "Pantau tahapan seleksi setiap saat — dari Applied hingga Accepted." },
  { icon: MessageSquare, title: "Chat HR Langsung", body: "Tanyakan informasi lamaran tanpa perlu menunggu balasan email." },
  { icon: BarChart3, title: "Ranking SAW", body: "HR mengevaluasi kandidat secara objektif menggunakan metode SAW." },
  { icon: Sparkles, title: "Notifikasi Cerdas", body: "Pengingat jadwal interview, hasil tes, dan pengumuman seleksi." },
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top Nav */}
      <header className="sticky top-0 z-30">
        <div className="glass">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2" data-testid="brand-link">
              <div className="w-9 h-9 rounded-lg bg-slate-900 grid place-items-center">
                <span className="text-white font-display font-bold">P</span>
              </div>
              <div className="font-display text-lg font-bold tracking-tight">Pertacareer</div>
            </Link>
            <nav className="flex items-center gap-2">
              {user ? (
                <Button
                  data-testid="goto-dashboard-btn"
                  onClick={() => navigate(user.role === "hr" ? "/hr" : "/dashboard")}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
                >
                  Ke Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <>
                  <Link to="/login">
                    <Button variant="ghost" data-testid="nav-login-btn" className="text-slate-700">Masuk</Button>
                  </Link>
                  <Link to="/register">
                    <Button data-testid="nav-register-btn" className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg">
                      Daftar
                    </Button>
                  </Link>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-24 grid lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 rounded-full bg-white border border-slate-200 px-3 py-1.5 text-xs font-semibold tracking-wide text-slate-600"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> SISTEM REKRUTMEN REALTIME
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.05 }}
              className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.05] mt-6 text-slate-900"
            >
              Pantau seleksi karir Anda
              <span className="block text-slate-500">selangkah demi selangkah.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mt-5 text-lg text-slate-600 max-w-xl leading-relaxed"
            >
              Dashboard rekrutmen profesional ala BUMN: timeline 8 tahapan, jadwal interview,
              chat langsung dengan HR, hingga ranking kandidat dengan metode SAW.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link to="/register">
                <Button data-testid="hero-register-btn" size="lg" className="bg-slate-900 hover:bg-slate-800 text-white rounded-lg px-6 h-12">
                  Mulai Lamar Sekarang <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button data-testid="hero-login-btn" size="lg" variant="outline" className="rounded-lg px-6 h-12 border-slate-300">
                  Login HR / Pelamar
                </Button>
              </Link>
            </motion.div>

            <div className="mt-10 grid grid-cols-3 gap-6 max-w-md">
              <Stat n="8" label="Tahapan Seleksi" />
              <Stat n="100%" label="Realtime Update" />
              <Stat n="SAW" label="Metode Ranking" />
            </div>
          </div>

          {/* Hero Visual: stages preview card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-xs uppercase tracking-widest font-bold text-slate-500">Status Lamaran</div>
                  <div className="font-display text-lg font-semibold">Petroleum Engineer</div>
                </div>
                <span className="px-2.5 py-1 rounded-md text-xs font-semibold"
                      style={{ background: "#FAF5FF", color: "#7E22CE" }}>
                  Online Interview
                </span>
              </div>
              <div className="space-y-2.5">
                {STAGES.slice(0, 6).map((s, i) => {
                  const Icon = s.icon;
                  const done = i < 4;
                  const active = i === 4;
                  return (
                    <div key={s.key}
                         className="flex items-center justify-between p-3 rounded-lg border"
                         style={{
                           background: done || active ? s.bg : "#F8FAFC",
                           borderColor: done || active ? s.border : "#E2E8F0",
                         }}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center"
                             style={{
                               background: done || active ? s.text : "#E2E8F0",
                               color: done || active ? "#fff" : "#94A3B8",
                             }}>
                          {done ? <CheckCircle2 size={16} /> : <Icon size={16} />}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{s.label}</div>
                          <div className="text-xs text-slate-500">Step {i + 1}</div>
                        </div>
                      </div>
                      {active && <span className="text-xs font-semibold" style={{ color: s.text }}>Sedang berlangsung</span>}
                      {done && <span className="text-xs font-semibold text-emerald-600">Selesai</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="grid md:grid-cols-2 gap-10 items-end mb-10">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500">Fitur Inti</div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold mt-3 text-slate-900 tracking-tight">
                Semua tahapan rekrutmen,
                <span className="block text-slate-500">dalam satu dashboard.</span>
              </h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Mengikuti standar rekrutmen perusahaan BUMN besar — transparan untuk pelamar,
              terstruktur untuk HR, dan terintegrasi dengan metode skoring objektif.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="p-6 rounded-xl border border-slate-200 bg-white hover:shadow-md hover:border-slate-300 transition-all">
                  <div className="w-11 h-11 rounded-lg bg-slate-900 text-white grid place-items-center mb-4">
                    <Icon size={20} />
                  </div>
                  <div className="font-display text-lg font-semibold text-slate-900">{f.title}</div>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-sm text-slate-500">© 2026 Pertacareer. Dashboard rekrutmen realtime.</div>
          <div className="flex items-center gap-4 text-sm text-slate-500">
            <span>HR demo: <span className="font-mono">hr@pertacareer.id / hr123456</span></span>
          </div>
        </div>
      </footer>
    </div>
  );
}

const Stat = ({ n, label }) => (
  <div>
    <div className="font-display text-3xl font-bold text-slate-900 tracking-tight">{n}</div>
    <div className="text-xs uppercase tracking-widest font-semibold text-slate-500 mt-1">{label}</div>
  </div>
);
