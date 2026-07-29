import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Award, Check, ShieldAlert, UserCheck, X } from 'lucide-react';
import { useExam } from '../context/ExamContext';
import { PageContainer } from '../components/quiz/layout/PageContainer';
import { Checkbox } from '../components/quiz/common/Checkbox';
import { Button } from '../components/quiz/common/Button';
import { Card } from '../components/quiz/common/Card';
import mlsaLogo from '../assets/MLSC-logo.png';

export const Instructions = () => {
  const { candidate, setExamStarted, questions } = useExam();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    if (!candidate) navigate('/');
  }, [candidate, navigate]);

  if (!candidate) return null;

  const launchFullscreen = async () => {
    const element = document.documentElement;
    try {
      if (element.requestFullscreen) await element.requestFullscreen();
      else if (element.webkitRequestFullscreen) await element.webkitRequestFullscreen();
      else if (element.mozRequestFullScreen) await element.mozRequestFullScreen();
      else if (element.msRequestFullscreen) await element.msRequestFullscreen();
    } catch (err) {
      console.warn('Fullscreen request blocked:', err);
    }
  };

  const handleStartExam = async () => {
    await launchFullscreen();
    setExamStarted();
    navigate('/quiz');
  };

  return (
    <PageContainer className="max-w-5xl px-4 sm:px-6 py-5 sm:py-7 antialiased text-[#111827] gap-5">
      <div className="border-b border-[#CBD5E1] pb-5 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <img
            src={mlsaLogo}
            alt="Microsoft Learn Student Ambassador Logo"
            className="w-8 sm:w-9 h-auto object-contain shrink-0"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0067B8] mb-1">
              MLSA Recruitment Portal
            </p>
            <h1 className="m-0 text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight leading-tight">
              Exam Instructions
            </h1>
            <p className="text-sm text-[#64748B] mt-1 max-w-xl">
              Read the ground rules once before entering the locked quiz environment.
            </p>
          </div>
        </div>

        <div className="flex w-full sm:w-auto divide-x divide-[#CBD5E1] border border-[#CBD5E1] bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">
          <div className="px-3 py-2">
            Questions <span className="ml-2 font-mono text-[#0F172A]">{questions?.length || 15}</span>
          </div>
          <div className="px-3 py-2">
            Time <span className="ml-2 font-mono text-[#0F172A]">30m</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-4 sm:gap-5">
        <div className="space-y-4">
          <Card className="border-[#E2E8F0] bg-white p-0 rounded-lg shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 self-stretch bg-red-500" />
              <div className="w-10 h-10 bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="py-4 pr-4">
                <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-[#0F172A]">
                  Security rules
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">These are enforced during the quiz.</p>
              </div>
            </div>
            <ul className="px-5 sm:px-6 pb-5 space-y-3 text-sm text-[#475569] leading-relaxed">
              <li className="flex items-start gap-3">
                <X className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                <span>
                  Fullscreen mode is required. Exiting or minimizing the page records a warning.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <X className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                <span>Tab switches, window blur, and context menu actions are monitored.</span>
              </li>
              <li className="flex items-start gap-3">
                <X className="w-4 h-4 text-red-500 mt-1 shrink-0" />
                <span>
                  At <span className="text-red-700 font-semibold">3 warnings</span>, the quiz is submitted automatically.
                </span>
              </li>
            </ul>
          </Card>

          <Card className="border-[#E2E8F0] bg-white p-0 rounded-lg shadow-sm overflow-hidden">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-1.5 self-stretch bg-emerald-500" />
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
              <div className="py-4 pr-4">
                <h2 className="m-0 text-base sm:text-lg font-bold tracking-tight text-[#0F172A]">
                  Scoring
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">Your final score follows this marking pattern.</p>
              </div>
            </div>
            <ul className="px-5 sm:px-6 pb-5 space-y-3 text-sm text-[#475569] leading-relaxed">
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                <span>
                  Correct answer: <span className="text-emerald-700 font-semibold">+4 marks</span>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                <span>
                  Incorrect answer: <span className="text-emerald-700 font-semibold">no negative marking</span>.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Check className="w-4 h-4 text-emerald-500 mt-1 shrink-0" />
                <span>Unanswered questions count as <span className="text-[#64748B] font-semibold">0 marks</span>.</span>
              </li>
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card className="border-[#CBD5E1] bg-[#F8FAFC] p-4 sm:p-5 rounded-lg shadow-none h-fit space-y-4 lg:sticky lg:top-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="w-9 h-9 bg-white border border-[#DBEAFE] text-[#0067B8] flex items-center justify-center shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="m-0 text-sm font-bold text-[#0F172A] tracking-tight">Candidate</h2>
                <p className="text-[10px] text-[#64748B] font-semibold uppercase tracking-wider">Verified</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider">Name</label>
                <p className="text-base font-bold text-[#111827] mt-0.5">{candidate.fullName}</p>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider">Enrollment</label>
                <p className="text-base font-bold text-[#0067B8] font-mono mt-0.5 tracking-tight">{candidate.enrollmentNumber}</p>
              </div>

              {candidate.college && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-[#64748B] tracking-wider">College</label>
                  <p className="text-xs font-semibold text-[#4B5563] mt-0.5 leading-relaxed">{candidate.college}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="border-[#CBD5E1] bg-white p-4 rounded-lg shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <Checkbox
          id="agree"
          label={
            <span className="text-xs sm:text-sm text-[#475569] font-medium select-none cursor-pointer hover:text-[#111827] transition-colors leading-relaxed">
              I have read the instructions and understand the quiz rules.
            </span>
          }
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="flex-1"
        />

        <Button
          variant="primary"
          disabled={!agreed}
          onClick={handleStartExam}
          className="w-full sm:w-auto px-7 py-3 text-sm font-bold tracking-wide text-white bg-[#0067B8] hover:bg-[#005A9E] rounded-lg border border-blue-500/10 shadow-lg shadow-blue-900/10 transition-all shrink-0"
        >
          Launch Portal Session
        </Button>
      </Card>
    </PageContainer>
  );
};
