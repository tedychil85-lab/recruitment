import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const formatDt = (iso) => {
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" });
  } catch { return iso; }
};

export default function ChatPanel({ applicationId, currentUserId, currentUserRole }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  const load = async () => {
    if (!applicationId) return;
    const { data } = await api.get("/messages", { params: { application_id: applicationId } });
    setMessages(data);
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await api.post("/messages", { application_id: applicationId, text });
      setText("");
      await load();
    } finally {
      setSending(false);
    }
  };

  if (!applicationId) {
    return <div className="p-6 text-sm text-slate-500" data-testid="chat-empty">Pilih kandidat / lamaran untuk memulai percakapan.</div>;
  }

  return (
    <div className="flex flex-col h-full" data-testid="chat-panel">
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-2 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-8">Belum ada pesan. Sapa {currentUserRole === "hr" ? "kandidat" : "HR"} terlebih dahulu.</div>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}
                 data-testid={`chat-msg-${m.id}`}>
              <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                mine ? "bg-slate-900 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-900 rounded-bl-sm"
              }`}>
                <div className="text-[11px] opacity-70 mb-0.5">
                  {m.sender_name} · {m.sender_role.toUpperCase()}
                </div>
                <div className="leading-snug whitespace-pre-wrap">{m.text}</div>
                <div className={`text-[10px] mt-1 ${mine ? "text-slate-300" : "text-slate-400"}`}>{formatDt(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="border-t border-slate-200 p-3 flex gap-2 bg-white">
        <Input value={text} onChange={(e) => setText(e.target.value)}
               placeholder="Tulis pesan…" className="h-10"
               data-testid="chat-input" />
        <Button type="submit" disabled={sending || !text.trim()}
                className="bg-slate-900 hover:bg-slate-800 text-white h-10 rounded-lg"
                data-testid="chat-send-btn">
          <Send size={16} />
        </Button>
      </form>
    </div>
  );
}
