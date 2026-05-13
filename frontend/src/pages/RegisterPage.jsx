import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/AuthContext";

function formatApiErrorDetail(detail) {
  if (detail == null) return "Terjadi kesalahan. Coba lagi.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  return String(detail);
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [loading, setLoading] = useState(false);

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register({ ...form, role: "pelamar" });
      toast.success("Pendaftaran berhasil!");
      navigate("/dashboard");
    } catch (err) {
      toast.error(formatApiErrorDetail(err.response?.data?.detail) || "Registrasi gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
        className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8"
      >
        <Link to="/" className="inline-flex items-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-lg bg-slate-900 grid place-items-center">
            <span className="text-white font-display font-bold">P</span>
          </div>
          <div className="font-display text-lg font-bold tracking-tight">Pertacareer</div>
        </Link>
        <div className="text-xs uppercase tracking-[0.2em] font-bold text-slate-500">Daftar Pelamar</div>
        <h1 className="font-display text-3xl font-bold mt-2 tracking-tight text-slate-900">Buat akun baru</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Sudah punya akun? <Link to="/login" className="text-slate-900 font-semibold underline-offset-4 hover:underline" data-testid="goto-login-link">Masuk</Link>
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" data-testid="register-form">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nama lengkap</Label>
            <Input id="name" required value={form.name} onChange={(e) => upd("name", e.target.value)}
                   data-testid="reg-name-input" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => upd("email", e.target.value)}
                   data-testid="reg-email-input" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">No. HP</Label>
            <Input id="phone" value={form.phone} onChange={(e) => upd("phone", e.target.value)}
                   placeholder="+62…" data-testid="reg-phone-input" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password (min 6 karakter)</Label>
            <Input id="password" type="password" required minLength={6}
                   value={form.password} onChange={(e) => upd("password", e.target.value)}
                   data-testid="reg-password-input" className="h-11" />
          </div>
          <Button type="submit" disabled={loading}
                  className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-lg"
                  data-testid="register-submit-btn">
            {loading ? "Memproses…" : (<>Daftar <ArrowRight className="ml-2 h-4 w-4" /></>)}
          </Button>
        </form>
      </motion.div>
    </div>
  );
}
