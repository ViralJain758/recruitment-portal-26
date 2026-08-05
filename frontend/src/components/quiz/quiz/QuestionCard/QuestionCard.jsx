import React, { useEffect, useMemo, useState } from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Card } from '../../common/Card';
import { Badge } from '../../common/Badge';
import { motion } from 'framer-motion';

function decodeSvgPayload(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') return '';

  const value = imageUrl.trim();
  if (!value) return '';

  if (value.startsWith('<svg') || (value.includes('<svg') && value.includes('</svg>'))) {
    return value;
  }

  if (value.toLowerCase().startsWith('data:image/svg+xml')) {
    const commaIndex = value.indexOf(',');
    if (commaIndex === -1) return '';

    const payload = value.slice(commaIndex + 1);

    if (!payload) return '';

    try {
      const decodedPayload = decodeURIComponent(payload);
      return decodedPayload.includes('<svg') ? decodedPayload : '';
    } catch {
      return payload.includes('<svg') ? payload : '';
    }
  }

  return '';
}

function isSvgDataUrl(imageUrl) {
  return typeof imageUrl === 'string' && imageUrl.trim().toLowerCase().startsWith('data:image/svg+xml');
}

function getOptionDisplayData(option) {
  if (typeof option === 'string') {
    return { type: 'text', value: option };
  }

  if (option && typeof option === 'object') {
    const optionType = String(option.type || option.kind || '').toLowerCase();

    if (optionType === 'image') {
      return {
        type: 'image',
        value: option.value ?? option.imageUrl ?? option.src ?? option.url ?? '',
      };
    }

    return {
      type: 'text',
      value: option.text ?? option.label ?? option.value ?? option.content ?? '',
    };
  }

  return { type: 'text', value: '' };
}

export const QuestionCard = () => {
  const { questions, currentQuestionIndex, responses, setResponses } = useExam();
  const currentQuestion = questions[currentQuestionIndex];
  if (!currentQuestion) return null;

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(responses).length;
  const [imageFailed, setImageFailed] = useState(false);
  const svgMarkup = useMemo(
    () => decodeSvgPayload(currentQuestion.imageUrl),
    [currentQuestion.imageUrl],
  );
  const svgDataUrl = useMemo(
    () => isSvgDataUrl(currentQuestion.imageUrl),
    [currentQuestion.imageUrl],
  );
  const rasterImageUrl =
    !svgMarkup && typeof currentQuestion.imageUrl === 'string' && !svgDataUrl
      ? currentQuestion.imageUrl.trim()
      : '';
  const imageSource = rasterImageUrl || (svgDataUrl ? currentQuestion.imageUrl : '');

  useEffect(() => {
    setImageFailed(false);
  }, [currentQuestion.id, currentQuestion.imageUrl]);

  return (
    <Card className="border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] bg-white dark:bg-[#1a1a1a] flex flex-col justify-between h-full overflow-hidden p-4 sm:p-6 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col h-full overflow-hidden">
        
        {/* Progress Bar Container */}
        <div className="mb-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-[10px] font-bold text-[#6B7280] dark:text-slate-400 uppercase tracking-wider">Attempt Progress</span>
            <span className="text-[10px] font-extrabold text-[#0067B8] dark:text-[#8db9df] font-mono whitespace-nowrap">{answeredCount} of {totalQuestions} Answered</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-[#27272a] rounded-full h-2 overflow-hidden relative">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${(answeredCount / totalQuestions) * 100}%` }}
              transition={{ type: 'spring', stiffness: 80, damping: 15 }}
              className="bg-gradient-to-r from-[#0067B8] to-[#4ea3da] h-full rounded-full"
            />
          </div>
        </div>

        {/* Scrollable Main Content Container */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-5 select-none">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)]">
            <span className="text-xs font-bold text-[#6B7280] dark:text-slate-400 uppercase tracking-wider">Question {currentQuestionIndex + 1} of {totalQuestions}</span>
            <Badge variant="info">{currentQuestion.section}</Badge>
          </div>
          
          <p className="text-lg sm:text-xl font-semibold text-[#111827] dark:text-slate-50 leading-relaxed select-none">{currentQuestion.text}</p>
          
          {/* CONDITIONAL IMAGE COMPONENT */}
          {(svgMarkup || (imageSource && !imageFailed)) && (
            <div className="w-full min-h-[132px] bg-slate-50 dark:bg-[#121212] border border-[#E5E7EB]/60 dark:border-[rgba(161,161,170,0.16)] rounded-lg px-3 py-3 sm:px-4 flex justify-center items-center overflow-hidden">
              {svgMarkup ? (
                <div
                  className="question-svg max-h-[120px] sm:max-h-[150px] max-w-full w-full flex justify-center [&>svg]:max-h-[120px] sm:[&>svg]:max-h-[150px] [&>svg]:max-w-full [&>svg]:h-auto"
                  aria-label="Question illustration reference"
                  dangerouslySetInnerHTML={{ __html: svgMarkup }}
                />
              ) : (
                <img
                  src={imageSource}
                  alt="Question illustration reference"
                  className="max-h-[120px] sm:max-h-[150px] max-w-full w-auto object-contain rounded-md select-none pointer-events-none"
                  loading="lazy"
                  onError={() => setImageFailed(true)}
                />
              )}
            </div>
          )}

          <div className="space-y-3 pb-2">
            {currentQuestion.options.map((option, idx) => {
              const isSelected = responses[currentQuestion.id] === idx;
              const letter = String.fromCharCode(65 + idx);
              const optionDisplay = getOptionDisplayData(option);
              const svgMarkup = decodeSvgPayload(optionDisplay.value);
              const isSvgOption = optionDisplay.type === 'image' && Boolean(svgMarkup);

              return (
                <motion.button
                  type="button"
                  key={idx} 
                  onClick={() => setResponses(prev => ({ ...prev, [currentQuestion.id]: idx }))} 
                  whileHover={{ scale: 1.01, x: 4 }}
                  whileTap={{ scale: 0.99 }}
                  className={`group w-full text-left flex items-center gap-4 p-4 rounded-lg border text-sm sm:text-base font-medium cursor-pointer transition-all duration-150 select-none focus:outline-none focus:ring-4 focus:ring-[#0067B8]/15 ${isSelected ? 'bg-[#0067B8]/[.07] dark:bg-[#232323] border-[#0067B8] dark:border-[rgba(161,161,170,0.34)] text-[#0067B8] dark:text-slate-100 shadow-sm' : 'bg-white dark:bg-[#121212] border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] text-[#4B5563] dark:text-slate-300 hover:border-[#0067B8]/50 dark:hover:border-[rgba(161,161,170,0.3)] hover:bg-[#F8FAFC] dark:hover:bg-[#202020]'}`}
                >
                  <span className={`w-7 h-7 rounded-full flex shrink-0 items-center justify-center text-xs font-bold transition-colors ${isSelected ? 'bg-[#0067B8] dark:bg-[#dbe7f3] text-white dark:text-[#121212]' : 'bg-slate-100 dark:bg-[#27272a] text-[#4B5563] dark:text-slate-300 group-hover:bg-[#0067B8]/10 group-hover:text-[#0067B8] dark:group-hover:text-[#dbe7f3]'}`}>{letter}</span>
                  {optionDisplay.type === 'image' ? (
                    <div className="flex-1 flex items-center justify-center py-1">
                      {isSvgOption ? (
                        <div
                          className="max-h-[90px] max-w-full [&>svg]:max-h-[90px] [&>svg]:max-w-full [&>svg]:h-auto"
                          dangerouslySetInnerHTML={{ __html: svgMarkup }}
                        />
                      ) : (
                        <img
                          src={optionDisplay.value}
                          alt="Option illustration"
                          className="max-h-[90px] max-w-full w-auto object-contain rounded-md"
                          loading="lazy"
                        />
                      )}
                    </div>
                  ) : (
                    <span className="flex-1">{optionDisplay.value}</span>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

      </div>
    </Card>
  );
};
