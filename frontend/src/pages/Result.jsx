import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { useExam } from '../context/ExamContext';
import { PageContainer } from '../components/quiz/layout/PageContainer';
import { Button } from '../components/quiz/common/Button';

export const Result = () => {
  const { candidate, examCompleted, resetExamData, submissionPending } = useExam();
  const navigate = useNavigate();

  useEffect(() => {
    if (!candidate) navigate('/');
    else if (!examCompleted) navigate('/quiz');
  }, [candidate, examCompleted, navigate]);

  if (!candidate || !examCompleted) return null;

  return (
    <PageContainer className="max-w-xl py-12 justify-center">
      <div className="bg-white dark:bg-slate-900 border border-[#E5E7EB] dark:border-slate-700 rounded-lg shadow-sm p-8 text-center">
        <div
          className={`mx-auto mb-5 w-14 h-14 rounded-lg flex items-center justify-center ${
            submissionPending
              ? 'bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-300'
              : 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
          }`}
        >
          {submissionPending ? (
            <RefreshCw className="w-8 h-8 animate-spin" />
          ) : (
            <CheckCircle2 className="w-8 h-8" />
          )}
        </div>
        <h2 className="m-0 text-2xl font-extrabold text-[#111827] dark:text-slate-50">
          {submissionPending ? 'Finishing Your Submission…' : 'Examination Submitted'}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[#64748B] dark:text-slate-400">
          {submissionPending
            ? "Your answers are saved on this device, but we couldn't reach the server to deliver them yet — this usually means your internet connection dropped. Keep this tab open; submission will finish automatically the moment your connection is back, with no action needed from you."
            : 'Your responses have been recorded successfully. Results will be reviewed by the recruitment team.'}
        </p>
        <div className="mt-6 rounded-lg border border-[#E5E7EB] dark:border-slate-700 bg-[#F8FAFC] dark:bg-slate-950 px-4 py-3 text-left">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B] dark:text-slate-400">Candidate</p>
          <p className="mt-1 text-sm font-bold text-[#111827] dark:text-slate-50">{candidate.fullName || candidate.name}</p>
          <p className="mt-1 font-mono text-xs font-bold text-[#0067B8] dark:text-blue-300">
            {candidate.enrollmentNumber || candidate.applicationId}
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            // Leaving the page is fine even mid-sync — the retry loop lives
            // in ExamProvider (mounted for the whole app), so it keeps
            // trying in the background. We just must not clear local state
            // (resetExamData) until the server has actually confirmed
            // receipt, or the unsynced answers would be lost for good.
            if (!submissionPending) resetExamData();
            navigate('/dashboard');
          }}
          className="w-full mt-6"
        >
          {submissionPending ? 'Return to Dashboard (syncing in background)' : 'Return to Dashboard'}
        </Button>
      </div>
    </PageContainer>
  );
};
