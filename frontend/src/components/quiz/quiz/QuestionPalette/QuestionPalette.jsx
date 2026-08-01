import React from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Card } from '../../common/Card';
import { motion } from 'framer-motion';

export const QuestionPalette = () => {
  const { questions, currentQuestionIndex, setCurrentQuestionIndex, responses, reviewStatus } = useExam();
  
  const getStatusClass = (idx, qId) => {
    if (idx === currentQuestionIndex) return 'bg-[#0067B8] dark:bg-blue-400 border-[#0067B8] dark:border-blue-400 text-white dark:text-slate-950 font-bold ring-4 ring-[#0067B8]/20 dark:ring-blue-400/20';
    if (reviewStatus[qId]) return 'bg-[#F59E0B] border-[#F59E0B] text-white font-semibold';
    if (responses[qId] !== undefined) return 'bg-[#10B981] border-[#10B981] text-white font-semibold';
    return 'bg-white dark:bg-slate-950 border-[#E5E7EB] dark:border-slate-700 text-[#4B5563] dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500';
  };

  return (
    <Card className="p-4 border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-slate-900 lg:flex-1 lg:min-h-[220px] shrink-0 lg:shrink overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-xs font-bold text-[#6B7280] dark:text-slate-400 tracking-wider uppercase select-none">Question Palette</h4>
        <span className="text-[11px] font-semibold text-[#94A3B8] dark:text-slate-500">{questions.length} total</span>
      </div>
      <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-5 gap-2 overflow-y-auto lg:flex-1 pr-1">
        {questions.map((q, idx) => (
          <motion.button 
            key={q.id} 
            onClick={() => setCurrentQuestionIndex(idx)} 
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className={`h-9 w-full rounded-lg border text-xs flex items-center justify-center font-mono font-semibold focus:outline-none focus:ring-4 focus:ring-[#0067B8]/15 transition-all duration-150 ${getStatusClass(idx, q.id)}`}
          >
            {idx + 1}
          </motion.button>
        ))}
      </div>
    </Card>
  );
};
