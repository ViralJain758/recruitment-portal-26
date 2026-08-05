import React from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { HelpCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

export const SubmitModal = ({ isOpen, onClose }) => {
  const { questions, responses, completeExam } = useExam();

  if (!isOpen) return null;

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(responses).length;
  const unansweredCount = totalQuestions - answeredCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/30 dark:bg-black/50 backdrop-blur-sm select-none animate-fadeIn">
      <Card className="max-w-md w-full border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl">
        <div className="flex items-center gap-3 text-[#0067B8] dark:text-slate-100 mb-5">
          <div className="p-2 bg-[#0067B8]/10 dark:bg-white/5 border border-[#0067B8]/15 dark:border-[rgba(161,161,170,0.18)] rounded-lg">
            <HelpCircle className="w-6 h-6 text-[#0067B8] dark:text-slate-200" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#111827] dark:text-slate-50 tracking-wide">Submit Examination</h3>
            <p className="text-xs text-[#6B7280] dark:text-slate-400">Please review your submission summary below.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 bg-[#F8FAFC] dark:bg-[#121212] border border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] rounded-lg flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-slate-300 flex-shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280] dark:text-slate-400">Answered</p>
              <p className="text-sm font-bold text-[#111827] dark:text-slate-50 font-mono">{answeredCount} / {totalQuestions}</p>
            </div>
          </div>

          <div className="p-3 bg-[#F8FAFC] dark:bg-[#121212] border border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] rounded-lg flex items-center gap-2.5">
            <AlertCircle className={`w-4 h-4 flex-shrink-0 ${unansweredCount > 0 ? 'text-[#b45309] dark:text-slate-300' : 'text-[#6B7280] dark:text-slate-500'}`} />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280] dark:text-slate-400">Unanswered</p>
              <p className={`text-sm font-bold font-mono ${unansweredCount > 0 ? 'text-[#b45309] dark:text-slate-300' : 'text-[#6B7280] dark:text-slate-500'}`}>{unansweredCount}</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-[#6B7280] dark:text-slate-400 leading-relaxed bg-[#FFFBEB] dark:bg-[#121212] border border-[#FDE68A] dark:border-[rgba(161,161,170,0.18)] p-3 rounded-lg mb-6">
          <span className="text-[#374151] dark:text-slate-100 font-medium">Important Note:</span> Once submitted, you will not be able to re-enter this assessment or modify your answers. Your progress will be saved instantly.
        </p>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1 py-2.5 text-xs">
            Cancel & Review
          </Button>
          <Button variant="success" onClick={completeExam} className="flex-1 py-2.5 text-xs font-bold shadow-lg shadow-emerald-900/20">
            Confirm Submission
          </Button>
        </div>
      </Card>
    </div>
  );
};
