import React, { useState } from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { HelpCircle, AlertCircle, CheckCircle2, RefreshCw, WifiOff } from 'lucide-react';

export const SubmitModal = ({ isOpen, onClose }) => {
  const {
    questions,
    responses,
    completeExam,
    submissionPending,
    retrySubmission,
    timeLeft,
    securityWarnings,
    examCompleted,
  } = useExam();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isForcedPending =
    submissionPending ||
    (timeLeft <= 0 && !examCompleted) ||
    (securityWarnings >= 3 && !examCompleted);

  const shouldDisplay = isOpen || isForcedPending;

  if (!shouldDisplay) return null;

  const totalQuestions = questions.length;
  const answeredCount = Object.keys(responses).length;
  const unansweredCount = totalQuestions - answeredCount;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const success = await completeExam();
      if (!success) {
        setErrorMessage(
          'Could not connect to the server to submit your test. Your answers are saved safely on this device. Please check your internet connection and click Retry.',
        );
      }
    } catch (err) {
      setErrorMessage(
        err?.message ||
          'Failed to submit test. Please check your network connection.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      const success = await retrySubmission();
      if (!success) {
        setErrorMessage(
          'Still unable to reach the server. Your answers remain saved safely on this device. Please check your internet connection and click Retry.',
        );
      }
    } catch (err) {
      setErrorMessage(
        err?.message ||
          'Network error during retry. Please check your connection.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 dark:bg-black/70 backdrop-blur-sm select-none animate-fadeIn">
      <Card className="max-w-md w-full border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl">
        {submissionPending || isForcedPending ? (
          <div className="text-center py-2">
            <div
              className={`mx-auto mb-4 w-14 h-14 rounded-full flex items-center justify-center ${
                isSubmitting
                  ? 'bg-blue-50 dark:bg-blue-500/15 text-[#0067B8] dark:text-blue-400'
                  : 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400'
              }`}
            >
              {isSubmitting ? (
                <RefreshCw className="w-7 h-7 animate-spin" />
              ) : (
                <WifiOff className="w-7 h-7" />
              )}
            </div>

            <h3 className="text-lg font-bold text-[#111827] dark:text-slate-50 mb-2">
              {isSubmitting
                ? 'Submitting Your Quiz...'
                : 'Network Connection Error'}
            </h3>

            <p className="text-xs leading-relaxed text-[#64748B] dark:text-slate-400 mb-5 px-2">
              {isSubmitting
                ? 'Please wait while we send your answers to the server...'
                : errorMessage ||
                  'Your test answers are saved safely on this device. However, we could not connect to the server to submit your score. Please check your internet connection and click Retry.'}
            </p>

            <div className="p-3 bg-[#F8FAFC] dark:bg-[#121212] border border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] rounded-lg mb-5 flex items-center justify-around text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-slate-400 block">
                  Answered
                </span>
                <span className="font-bold font-mono text-[#111827] dark:text-slate-100 text-sm">
                  {answeredCount} / {totalQuestions}
                </span>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
              <div>
                <span className="text-[10px] uppercase font-bold text-[#6B7280] dark:text-slate-400 block">
                  Status
                </span>
                <span className="font-bold text-amber-600 dark:text-amber-400 text-xs">
                  Score Pending Server
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <Button
                variant="primary"
                onClick={handleRetry}
                disabled={isSubmitting}
                className="w-full py-3 text-xs font-bold flex items-center justify-center gap-2 shadow-md"
              >
                <RefreshCw
                  className={`w-4 h-4 ${isSubmitting ? 'animate-spin' : ''}`}
                />
                {isSubmitting ? 'Retrying Submission...' : 'Retry Submission'}
              </Button>

              <p className="text-[11px] text-[#6B7280] dark:text-slate-500 flex items-center justify-center gap-1.5 pt-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                </span>
                Auto-retrying when internet is restored...
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-[#0067B8] dark:text-slate-100 mb-5">
              <div className="p-2 bg-[#0067B8]/10 dark:bg-white/5 border border-[#0067B8]/15 dark:border-[rgba(161,161,170,0.18)] rounded-lg">
                <HelpCircle className="w-6 h-6 text-[#0067B8] dark:text-slate-200" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#111827] dark:text-slate-50 tracking-wide">
                  Submit Examination
                </h3>
                <p className="text-xs text-[#6B7280] dark:text-slate-400">
                  Please review your submission summary below.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="p-3 bg-[#F8FAFC] dark:bg-[#121212] border border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] rounded-lg flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#059669] dark:text-slate-300 flex-shrink-0" />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280] dark:text-slate-400">
                    Answered
                  </p>
                  <p className="text-sm font-bold text-[#111827] dark:text-slate-50 font-mono">
                    {answeredCount} / {totalQuestions}
                  </p>
                </div>
              </div>

              <div className="p-3 bg-[#F8FAFC] dark:bg-[#121212] border border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] rounded-lg flex items-center gap-2.5">
                <AlertCircle
                  className={`w-4 h-4 flex-shrink-0 ${unansweredCount > 0 ? 'text-[#b45309] dark:text-slate-300' : 'text-[#6B7280] dark:text-slate-500'}`}
                />
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-[#6B7280] dark:text-slate-400">
                    Unanswered
                  </p>
                  <p
                    className={`text-sm font-bold font-mono ${unansweredCount > 0 ? 'text-[#b45309] dark:text-slate-300' : 'text-[#6B7280] dark:text-slate-500'}`}
                  >
                    {unansweredCount}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-[#6B7280] dark:text-slate-400 leading-relaxed bg-[#FFFBEB] dark:bg-[#121212] border border-[#FDE68A] dark:border-[rgba(161,161,170,0.18)] p-3 rounded-lg mb-6">
              <span className="text-[#374151] dark:text-slate-100 font-medium">
                Important Note:
              </span>{' '}
              Once submitted, you will not be able to re-enter this assessment
              or modify your answers. Your progress will be saved instantly.
            </p>

            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 py-2.5 text-xs"
              >
                Cancel & Review
              </Button>
              <Button
                variant="success"
                onClick={handleConfirm}
                disabled={isSubmitting}
                className="flex-1 py-2.5 text-xs font-bold shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />{' '}
                    Submitting...
                  </>
                ) : (
                  'Confirm Submission'
                )}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};
