import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import api from "@/lib/api";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";

const formatDt = (iso) => {
  try {
    return new Date(iso).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
};

export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const unread = items.filter((n) => !n.read).length;

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data);
    } catch (err) {
      console.warn("notifications load failed:", err.message);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, []);

  const markAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative w-10 h-10 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 grid place-items-center transition-all"
          data-testid="notif-bell"
        >
          <Bell size={18} className="text-slate-700" />
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center"
                  data-testid="notif-unread-count">{unread}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-slate-100">
          <div className="font-display font-semibold">Notifikasi</div>
          <button onClick={markAll}
                  className="text-xs flex items-center gap-1 text-slate-500 hover:text-slate-900"
                  data-testid="notif-mark-all">
            <CheckCheck size={14} /> Tandai dibaca
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {items.length === 0 && (
            <div className="p-6 text-center text-sm text-slate-400">Belum ada notifikasi.</div>
          )}
          {items.map((n) => (
            <div key={n.id}
                 className={`p-3 border-b border-slate-100 last:border-b-0 ${n.read ? "" : "bg-slate-50"}`}
                 data-testid={`notif-item-${n.id}`}>
              <div className="text-sm font-semibold text-slate-900">{n.title}</div>
              <div className="text-xs text-slate-600 mt-0.5 leading-snug">{n.body}</div>
              <div className="text-[10px] text-slate-400 mt-1">{formatDt(n.created_at)}</div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
