import React from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Button } from '../../common/Button';
import { ArrowLeft, ArrowRight, Bookmark, XCircle, CheckCircle } from 'lucide-react';

export const NavigationBar = ({ onSubmitClick }) => {
  const { questions, currentQuestionIndex, setCurrentQuestionIndex, responses, setResponses, reviewStatus, setReviewStatus } = useExam();
  
  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="w-full bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border-t border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] shadow-[0_-4px_18px_rgba(15,23,42,.04)] px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 select-none">
      <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
        <Button variant="secondary" onClick={() => currentQuestionIndex > 0 && setCurrentQuestionIndex(p => p - 1)} disabled={currentQuestionIndex === 0} className="disabled:opacity-40">
          <ArrowLeft className="w-4 h-4" /> Previous
        </Button>
        <Button variant="secondary" onClick={() => currentQuestionIndex < questions.length - 1 && setCurrentQuestionIndex(p => p + 1)} disabled={currentQuestionIndex === questions.length - 1} className="disabled:opacity-40">
          Next <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-3 sm:flex items-center gap-2 w-full sm:w-auto sm:justify-end">
        <Button variant="secondary" onClick={() => setResponses(p => { const u = { ...p }; delete u[currentQuestion.id]; return u; })} className="text-[#6B7280]">
          <XCircle className="w-4 h-4" /> Clear
        </Button>
        <Button variant="secondary" onClick={() => setReviewStatus(p => ({ ...p, [currentQuestion.id]: !p[currentQuestion.id] }))} className={reviewStatus[currentQuestion?.id] ? '!bg-[#F59E0B]/10 !border-[#F59E0B] !text-[#b45309]' : ''}>
          <Bookmark className="w-4 h-4" /> Review
        </Button>
        
        {/* Triggers custom modal state instead of native prompt */}
        <Button variant="success" onClick={onSubmitClick} className="sm:ml-2">
          <CheckCircle className="w-4 h-4" /> Submit
        </Button>
      </div>
    </div>
  );
};
