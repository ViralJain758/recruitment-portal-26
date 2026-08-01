import React from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Card } from '../../common/Card';
import { CheckCircle2 } from 'lucide-react';

export const StatsCard = () => {
  const { questions, responses } = useExam();
  const answered = Object.keys(responses).length;
  return (
    <Card className="p-3 border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-slate-900 h-full">
      <div className="flex items-center gap-1.5 font-semibold text-[#6B7280] dark:text-slate-400 mb-1.5">
        <span className="w-6 h-6 rounded-md bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5" />
        </span>
        <span className="text-[9px] font-bold uppercase tracking-wider truncate">Answered</span>
      </div>
      <div>
        <span className="text-lg font-black text-[#111827] dark:text-slate-50 font-mono">{answered}</span>
        <span className="text-xs"> / {questions.length}</span>
      </div>
    </Card>
  );
};
