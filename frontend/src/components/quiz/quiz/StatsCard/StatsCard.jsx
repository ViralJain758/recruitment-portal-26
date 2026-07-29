import React from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Card } from '../../common/Card';
import { CheckCircle2 } from 'lucide-react';

export const StatsCard = () => {
  const { questions, responses } = useExam();
  const answered = Object.keys(responses).length;
  return (
    <Card className="p-4 border-[#E5E7EB] bg-white">
      <div className="flex items-center justify-between gap-3 font-semibold text-[#6B7280]">
        <div className="flex items-center gap-2">
          <span className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </span>
          <span className="text-xs font-bold uppercase tracking-wider">Answered</span>
        </div>
        <div>
          <span className="text-2xl font-black text-[#111827] font-mono">{answered}</span>
          <span className="text-sm"> / {questions.length}</span>
        </div>
      </div>
    </Card>
  );
};
