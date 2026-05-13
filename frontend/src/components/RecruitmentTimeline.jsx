import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { STAGES, TERMINAL, stageIndex } from "@/lib/stages";

/**
 * Horizontal animated recruitment timeline.
 * - Completed stages: filled, with check icon
 * - Active stage: filled with pulsing ring
 * - Pending stages: gray outline
 */
export default function RecruitmentTimeline({ currentStage }) {
  const activeIdx = stageIndex(currentStage);
  const terminal = TERMINAL[currentStage];
  const stagesToShow = terminal
    ? [...STAGES.slice(0, 7), { ...terminal, label: terminal.label }]
    : STAGES;

  return (
    <div className="w-full" data-testid="recruitment-timeline">
      {/* Mobile: vertical */}
      <div className="md:hidden space-y-3">
        {stagesToShow.map((s, idx) => {
          const Icon = s.icon;
          const isCompleted = idx < activeIdx;
          const isActive = idx === activeIdx;
          return (
            <div key={s.key} className="flex items-start gap-3"
                 data-testid={`timeline-step-${s.key}`}>
              <div className="flex flex-col items-center">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: isActive || isCompleted ? s.text : "#F1F5F9",
                    color: isActive || isCompleted ? "#fff" : "#94A3B8",
                  }}
                >
                  {isCompleted ? <Check size={18} /> : <Icon size={18} />}
                </div>
                {idx < stagesToShow.length - 1 && (
                  <div className="w-0.5 flex-1 my-1"
                       style={{ background: isCompleted ? s.text : "#E2E8F0", minHeight: 24 }} />
                )}
              </div>
              <div className="pt-1 pb-4">
                <div className="text-xs uppercase tracking-widest font-semibold"
                     style={{ color: isActive || isCompleted ? s.text : "#94A3B8" }}>
                  Step {idx + 1}
                </div>
                <div className="font-display text-base font-semibold text-slate-900">{s.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.description}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: horizontal */}
      <div className="hidden md:block">
        <div className="relative pt-2">
          {/* Background line */}
          <div className="absolute top-7 left-6 right-6 h-0.5 bg-slate-200" />
          {/* Progress line */}
          <motion.div
            className="absolute top-7 left-6 h-0.5"
            initial={{ width: 0 }}
            animate={{ width: `calc(${(activeIdx / Math.max(stagesToShow.length - 1, 1)) * 100}% - 1.5rem)` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            style={{ background: "#0F172A" }}
          />

          <div className="relative grid"
               style={{ gridTemplateColumns: `repeat(${stagesToShow.length}, minmax(0, 1fr))` }}>
            {stagesToShow.map((s, idx) => {
              const Icon = s.icon;
              const isCompleted = idx < activeIdx;
              const isActive = idx === activeIdx;
              const isPending = idx > activeIdx;
              return (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.08, duration: 0.4 }}
                  className="flex flex-col items-center px-2"
                  data-testid={`timeline-step-${s.key}`}
                >
                  <div className="relative">
                    {isActive && (
                      <span
                        className="absolute inset-0 rounded-full pulse-ring"
                        style={{ color: s.text }}
                      />
                    )}
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center border-2 relative z-10 transition-all"
                      style={{
                        background: isPending ? "#fff" : s.text,
                        color: isPending ? "#94A3B8" : "#fff",
                        borderColor: isPending ? "#E2E8F0" : s.text,
                      }}
                    >
                      {isCompleted ? <Check size={22} /> : <Icon size={22} />}
                    </div>
                  </div>
                  <div className="mt-3 text-center">
                    <div
                      className="text-[10px] uppercase tracking-[0.18em] font-bold"
                      style={{ color: isPending ? "#94A3B8" : s.text }}
                    >
                      Step {idx + 1}
                    </div>
                    <div className={`font-display text-sm font-semibold ${isPending ? "text-slate-400" : "text-slate-900"}`}>
                      {s.label}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
