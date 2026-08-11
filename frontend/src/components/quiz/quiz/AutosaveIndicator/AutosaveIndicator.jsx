import { useExam } from '../../../../context/ExamContext';
import { Cloud, CloudOff, RefreshCw } from 'lucide-react';

// Small, unobtrusive readout of the incremental backend autosave (separate
// from final submission). Purely informational — never blocks anything.
export const AutosaveIndicator = () => {
  const { autosaveStatus } = useExam();

  if (autosaveStatus === 'idle') return null;

  const config = {
    saving: {
      icon: <RefreshCw className="w-3.5 h-3.5 shrink-0 animate-spin" />,
      label: 'Saving…',
      className:
        'text-[#64748B] dark:text-slate-300 bg-[#F8FAFC] dark:bg-white/5 border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)]',
    },
    saved: {
      icon: <Cloud className="w-3.5 h-3.5 shrink-0" />,
      label: 'Saved',
      className:
        'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200 dark:border-emerald-500/30',
    },
    offline: {
      icon: <CloudOff className="w-3.5 h-3.5 shrink-0" />,
      label: 'Offline — will retry',
      className:
        'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border-amber-200 dark:border-amber-500/30',
    },
  }[autosaveStatus];

  if (!config) return null;

  return (
    <div
      className={`hidden sm:flex items-center gap-1.5 font-mono text-xs font-bold rounded-lg px-3 py-2 w-fit border select-none transition-colors duration-300 ${config.className}`}
      title="Your answers are periodically saved to the server as you go."
    >
      {config.icon}
      {config.label}
    </div>
  );
};
