import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowRight, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

function formatApiErrorDetail(detail) {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const u = await login(email, password);
      toast.success(`Selamat datang, ${u.name}!`);
      navigate(u.role === "hr" ? "/hr" : "/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Login gagal");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (type) => {
    if (type === "hr") {
      setEmail("hr@pertacareer.id");
      setPassword("hr123456");
    } else {
      setEmail("pelamar@pertacareer.id");
      setPassword("pelamar123");
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Visual side */}
      <div className="hidden lg:block relative bg-slate-900 overflow-hidden">
        <img src="https://images.unsplash.com/photo-1711720743865-10787dd6934a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMzN8MHwxfHNlYXJjaHwxfHxwcm9mZXNzaW9uYWwlMjBvZmZpY2UlMjBidWlsZGluZyUyMGNvcnBvcmF0ZXxlbnwwfHx8fDE3Nzg2NzM0NzB8MA&ixlib=rb-4.1.0&q=85"
             className="absolute inset-0 w-full h-full object-cover opacity-60" alt="Office" />
        <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/95 via-slate-900/60 to-transparent" />
        <div className="relative h-full flex flex-col justify-between p-12 text-white">
          <Link to="/" className="flex items-center gap-2" data-testid="brand-login">
            <div className="w-9 h-9 rounded-lg bg-white grid place-items-center">
              <span className="text-slate-900 font-display font-bold">P</span>
            </div>
            <div className="font-display text-lg font-bold tracking-tight">Pertacareer</div>
          </Link>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-slate-300">Recruitment Portal</div>
            <h2 className="font-display text-4xl font-bold mt-3 leading-tight">
              Karir profesional<br/>dimulai dari sini.
            </h2>
            <p className="text-slate-300 mt-3 max-w-md leading-relaxed">
              Kelola lamaran, jadwal interview, hingga hasil seleksi —
              semuanya di satu dashboard terintegrasi.
            </p>
          </motion.div>
          <div />
        </div>
      </div>

      {/* Form side */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-slate-50">
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <Link to="/" className="lg:hidden inline-flex items-center gap-2 mb-8">
            <div className="w-9 h-9 rounded-lg bg-slate-900 grid place-items-center">
              <span className="text-white font-display font-bold">P</span>
            </div>
            <div className="font-display text-lg font-bold tracking-tight">Pertacareer</div>
          </Link>

          <div className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500">Welcome back</div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 tracking-tight text-slate-900">Masuk ke akun anda</h1>
          <p className="text-slate-500 mt-2 text-sm">Belum punya akun? <Link to="/register" className="text-slate-900 font-semibold underline-offset-4 hover:underline" data-testid="goto-register-link">Daftar di sini</Link></p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4" data-testid="login-form">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email}
                     onChange={(e) => setEmail(e.target.value)}
                     placeholder="anda@email.com"
                     data-testid="login-email-input"
                     className="h-11" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password}
                     onChange={(e) => setPassword(e.target.value)}
                     placeholder="••••••••"
                     data-testid="login-password-input"
                     className="h-11" />
            </div>
            <Button type="submit" disabled={loading}
                    className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
                    data-testid="login-submit-btn">
              {loading ? "Memproses…" : (<>Masuk <ArrowRight className="ml-2 h-4 w-4" /></>)}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <div className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500 mb-3">Demo Akun</div>
            <div className="grid grid-cols-2 gap-3">
              <button type="button"
                      onClick={() => fillDemo("hr")}
                      data-testid="demo-hr-btn"
                      className="text-left p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase size={14} className="text-slate-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">HR / Admin</span>
                </div>
                <div className="text-xs text-slate-500 font-mono break-all">hr@pertacareer.id</div>
              </button>
              <button type="button"
                      onClick={() => fillDemo("pelamar")}
                      data-testid="demo-pelamar-btn"
                      className="text-left p-3 rounded-lg border border-slate-200 hover:border-slate-300 bg-white transition-all">
                <div className="flex items-center gap-2 mb-1">
                  <Briefcase size={14} className="text-slate-500" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">Pelamar</span>
                </div>
                <div className="text-xs text-slate-500 font-mono break-all">pelamar@pertacareer.id</div>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
