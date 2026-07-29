import React from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { motion } from 'framer-motion';

export const QuestionCard = () => {
  const { questions, currentQuestionIndex, responses, setResponses } = useExam();
  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) return null;

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(responses).length;

  return (
    <Card className="border-[#E5E7EB] bg-white flex flex-col justify-between h-full overflow-hidden p-4 sm:p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* Progress Bar Container */}
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[10px] font-bold text-[#6B7280] uppercase tracking-wider">Attempt Progress</span>
            <span className="text-[10px] font-extrabold text-[#0067B8] font-mono whitespace-nowrap">{answeredCount} of {totalQuestions} Answered</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 15 }}
              className="bg-gradient-to-r from-[#0067B8] to-[#00bfff] h-full rounded-full"
            />
          </div>
        </div>

        {/* Scrollable Main Content Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 select-none">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E7EB]">
            <span className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Question {currentQuestionIndex + 1} of {totalQuestions}</span>
            <Badge variant="info">{currentQuestion.section}</Badge>
          </div>
          
          <p className="text-lg sm:text-xl font-semibold text-[#111827] leading-relaxed select-none">{currentQuestion.text}</p>
          
          {/* CONDITIONAL IMAGE COMPONENT */}
          {currentQuestion.imageUrl && (
            <div className="w-full bg-slate-50 border border-[#E5E7EB]/60 rounded-lg p-4 flex justify-center items-center overflow-hidden">
              <img 
                src={currentQuestion.imageUrl} 
                alt="Question illustration reference" 
                className="max-h-[160px] w-auto object-contain rounded-lg shadow-sm select-none pointer-events-none"
                loading="lazy"
              />
            </div>
          )}

          <div className="space-y-3 pb-2">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = responses[currentQuestion.id] === idx;
              const letter = String.fromCharCode(65 + idx);
              return (
                <motion.button
                  type="button"
                  key={idx} 
                  onClick={() => setResponses(prev => ({ ...prev, [currentQuestion.id]: idx }))} 
                  whileHover={{ scale: 1.01, x: 4 }}
                  whileTap={{ scale: 0.99 }}
                  className={`group w-full text-left flex items-center gap-4 p-4 rounded-lg border text-sm sm:text-base font-medium cursor-pointer transition-all duration-150 select-none focus:outline-none focus:ring-4 focus:ring-[#0067B8]/15 ${isSelected ? 'bg-[#0067B8]/[.07] border-[#0067B8] text-[#0067B8] shadow-sm' : 'bg-white border-[#E5E7EB] text-[#4B5563] hover:border-[#0067B8]/50 hover:bg-[#F8FAFC]'}`}
                >
                  <span className={`w-7 h-7 rounded-full flex shrink-0 items-center justify-center text-xs font-bold transition-colors ${isSelected ? 'bg-[#0067B8] text-white' : 'bg-slate-100 text-[#4B5563] group-hover:bg-[#0067B8]/10 group-hover:text-[#0067B8]'}`}>{letter}</span>
                  <span className="flex-1">{option}</span>
                </motion.button>
              );
            })}
          </div>
        </div>

      </div>
    </Card>
  );
};
