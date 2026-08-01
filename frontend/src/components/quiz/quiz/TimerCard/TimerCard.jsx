import React from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Clock } from 'lucide-react';

export const TimerCard = () => {
  const { timeLeft } = useExam();

  // Total initial duration of the exam (20 minutes = 1200 seconds).
  // The countdown itself is owned by ExamContext, so this component only
  // renders the value it's given — an extra local interval here would
  // decrement timeLeft twice per second (a pre-existing bug).
  const totalDuration = 20 * 60;

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return { hours: h, minutes: m, seconds: s };
  };

  const { hours, minutes, seconds } = formatTime(timeLeft);

  // Percentage calculations
  const percentageLeft = Math.max(0, Math.min(100, (timeLeft / totalDuration) * 100));

  // Color logic matching your system benchmarks
  let iconColor = 'text-emerald-500';
  let digitsColor = 'text-[#059669]'; // Safe green
  let containerColor = 'bg-emerald-50 border-emerald-100 dark:bg-emerald-500/10 dark:border-emerald-500/20';

  if (percentageLeft <= 15) {
    iconColor = 'text-rose-500';
    digitsColor = 'text-[#DC2626]'; // Critical red
    containerColor = 'bg-rose-50 border-rose-100 dark:bg-rose-500/10 dark:border-rose-500/20 animate-pulse';
  } else if (percentageLeft <= 35) {
    iconColor = 'text-amber-500';
    digitsColor = 'text-[#D97706]'; // Warning orange/amber
    containerColor = 'bg-amber-50 border-amber-100 dark:bg-amber-500/10 dark:border-amber-500/20';
  }

  return (
    <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 select-none transition-colors duration-300 ${containerColor}`}>
      <Clock className={`w-3.5 h-3.5 shrink-0 ${iconColor}`} />
      <span className={`text-xs font-bold font-mono tracking-wide transition-colors duration-300 ${digitsColor}`}>
        {hours}:{minutes}:{seconds}
      </span>
    </div>
  );
};
