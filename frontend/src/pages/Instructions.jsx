import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ScreenShare, UserCheck } from "lucide-react";
import { useExam } from "../context/ExamContext";
import { PageContainer } from "../components/quiz/layout/PageContainer";
import { Checkbox } from "../components/quiz/common/Checkbox";
import { Button } from "../components/quiz/common/Button";
import { Card } from "../components/quiz/common/Card";
import { ThemeToggle } from "../components/quiz/common/ThemeToggle";
import { ScreenRecordingModal } from "../components/quiz/instructions/ScreenRecordingModal";
import { getQuizQuestions } from "../lib/api";
import MLSCLogo from "../assets/MLSC-logo.png";

export const Instructions = () => {
  const { candidate, setExamStarted, questions } = useExam();
  const { cameraAccess, setCameraAccess } = useExam();
  const { screenRecordingConsent, setScreenRecordingConsent } = useExam();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [isStartingExam, setIsStartingExam] = useState(false);
  const [startError, setStartError] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const [requestingCamera, setRequestingCamera] = useState(false);
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [screenConsentDeclined, setScreenConsentDeclined] = useState(false);

  useEffect(() => {
    if (!candidate) navigate("/");
  }, [candidate, navigate]);

  useEffect(() => {
    try {
      const nav = navigator;
      const mobile =
        (nav && nav.userAgentData && nav.userAgentData.mobile) ||
        /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(
          navigator.userAgent || "",
        );
      setIsMobile(!!mobile);
    } catch (err) {
      setIsMobile(false);
    }
  }, []);

  if (!candidate) return null;

  const launchFullscreen = async () => {
    const element = document.documentElement;
    try {
      if (element.requestFullscreen) await element.requestFullscreen();
      else if (element.webkitRequestFullscreen)
        await element.webkitRequestFullscreen();
      else if (element.mozRequestFullScreen)
        await element.mozRequestFullScreen();
      else if (element.msRequestFullscreen) await element.msRequestFullscreen();
    } catch (err) {
      console.warn("Fullscreen request blocked:", err);
    }
  };

  // The "Launch Portal Session" button first makes sure screen-recording
  // consent has been explicitly given. If it hasn't, the consent modal is
  // shown and the candidate must grant consent, then click Launch again to
  // actually start the exam — granting consent alone no longer starts it.
  const handleStartExam = async () => {
    if (!screenRecordingConsent) {
      setScreenConsentDeclined(false);
      setShowScreenModal(true);
      return;
    }
    await proceedStartExam();
  };

  const handleAllowScreenRecording = () => {
    setScreenRecordingConsent(true);
    setScreenConsentDeclined(false);
    setShowScreenModal(false);
  };

  const handleDenyScreenRecording = () => {
    setScreenRecordingConsent(false);
    setScreenConsentDeclined(true);
  };

  const proceedStartExam = async () => {
    setIsStartingExam(true);
    setStartError("");

    try {
      if (isMobile) {
        throw new Error(
          "Quiz is not supported on mobile devices. Please open this portal on a desktop or laptop with a webcam.",
        );
      }
      if (!candidate.accessToken) {
        throw new Error(
          "Your session could not be verified. Please sign in again.",
        );
      }

      // Ensure camera permission is granted before starting
      if (!cameraAccess) {
        // Attempt to request once more on user gesture (start button)
        try {
          await requestCameraPermission();
        } catch (err) {
          throw new Error(
            "Camera access is required to start the quiz. Please allow camera permission.",
          );
        }
      }

      const data = await getQuizQuestions(candidate.accessToken);

      if (!data.questions?.length) {
        throw new Error("No quiz questions are available right now.");
      }

      await launchFullscreen();
      setExamStarted(data.questions, data.savedResponses);
      navigate("/quiz");
    } catch (error) {
      setStartError(error.message || "Could not start the quiz.");
    } finally {
      setIsStartingExam(false);
    }
  };

  const requestCameraPermission = async () => {
    if (
      !navigator ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      throw new Error("Camera API not available in this browser.");
    }

    setRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // stop tracks immediately; we only needed permission
      stream.getTracks().forEach((t) => t.stop());
      setCameraAccess(true);
      setRequestingCamera(false);
      return true;
    } catch (err) {
      setCameraAccess(false);
      setRequestingCamera(false);
      throw err;
    }
  };

  return (
    <PageContainer className="max-w-5xl px-4 sm:px-6 py-6 sm:py-8 antialiased text-[#111827] dark:text-slate-100 gap-6">
      {/* Letterhead */}
      <div className="border-b-2 border-[#0F172A] dark:border-slate-200 pb-6 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-5">
        <div className="flex items-start gap-3.5 min-w-0">
          <img
            src={MLSCLogo}
            alt="Microsoft Learn Student Ambassador Logo"
            className="w-9 h-auto object-contain shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#0067B8] dark:text-blue-300 mb-1.5">
              MLSC Recruitment Portal &middot; 2026
            </p>
            <h1 className="m-0 text-[26px] sm:text-3xl font-bold text-[#0F172A] dark:text-slate-50 tracking-tight leading-tight">
              Examination Instructions
            </h1>
            <p className="text-sm text-[#64748B] dark:text-slate-400 mt-1.5 max-w-lg leading-relaxed">
              Review the protocol below before proceeding. Its terms are
              binding for the full duration of your session.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
          <dl className="flex flex-1 sm:flex-none divide-x divide-[#CBD5E1] dark:divide-neutral-700 border border-[#CBD5E1] dark:border-neutral-700 bg-white dark:bg-neutral-900">
            <div className="px-4 py-2 flex flex-col gap-0.5 min-w-[76px]">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-slate-500">
                Questions
              </dt>
              <dd className="m-0 font-mono text-sm font-bold text-[#0F172A] dark:text-slate-50">
                {questions?.length || 15}
              </dd>
            </div>
            <div className="px-4 py-2 flex flex-col gap-0.5 min-w-[76px]">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-slate-500">
                Duration
              </dt>
              <dd className="m-0 font-mono text-sm font-bold text-[#0F172A] dark:text-slate-50">
                20 min
              </dd>
            </div>
            <div className="px-4 py-2 flex flex-col gap-0.5 min-w-[76px]">
              <dt className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#94A3B8] dark:text-slate-500">
                Max Marks
              </dt>
              <dd className="m-0 font-mono text-sm font-bold text-[#0F172A] dark:text-slate-50">
                {questions?.length || 15}
              </dd>
            </div>
          </dl>
          <ThemeToggle />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-5">
        <div className="space-y-5">
          {/* Section A — Security protocol */}
          <Card className="border border-[#E2E8F0] dark:border-neutral-700 border-l-[3px] border-l-red-500 dark:border-l-red-500 bg-white dark:bg-neutral-900 p-0 rounded-md shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#F1F5F9] dark:border-neutral-800">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-600 dark:text-red-400 mb-1">
                Section A
              </p>
              <h2 className="m-0 text-base font-bold tracking-tight text-[#0F172A] dark:text-slate-50">
                Security Protocol
              </h2>
              <p className="text-xs text-[#94A3B8] dark:text-slate-500 mt-0.5">
                Strictly enforced for the full duration of the exam.
              </p>
            </div>
            <ul className="px-5 sm:px-6 py-5 space-y-3 text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-slate-600 mt-2 shrink-0" />
                <span>
                  Fullscreen mode is required. Exiting or minimizing the page
                  records a warning.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-slate-600 mt-2 shrink-0" />
                <span>
                  Tab switches, window blur, and context menu actions are
                  monitored in real time.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-slate-600 mt-2 shrink-0" />
                <span>
                  Shortcuts for new tabs, devtools, reload, print, and
                  back/forward navigation are blocked during the exam.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-slate-600 mt-2 shrink-0" />
                <span>
                  Your screen and webcam are recorded for the full duration of
                  the exam.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-slate-600 mt-2 shrink-0" />
                <span>
                  At{" "}
                  <span className="text-red-700 dark:text-red-400 font-semibold">
                    3 warnings
                  </span>
                  , the quiz is submitted automatically.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-slate-600 mt-2 shrink-0" />
                <span>
                  Do not clear browser data or close this browser until the
                  submission is confirmed.
                </span>
              </li>
            </ul>
          </Card>

          {/* Section B — Marking scheme */}
          <Card className="border border-[#E2E8F0] dark:border-neutral-700 border-l-[3px] border-l-emerald-500 dark:border-l-emerald-500 bg-white dark:bg-neutral-900 p-0 rounded-md shadow-sm overflow-hidden">
            <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#F1F5F9] dark:border-neutral-800">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-400 mb-1">
                Section B
              </p>
              <h2 className="m-0 text-base font-bold tracking-tight text-[#0F172A] dark:text-slate-50">
                Scoring
              </h2>
              <p className="text-xs text-[#94A3B8] dark:text-slate-500 mt-0.5">
                Your final score follows this marking pattern.
              </p>
            </div>
            <ul className="px-5 sm:px-6 py-5 space-y-3 text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-slate-600 mt-2 shrink-0" />
                <span>
                  Correct answer:{" "}
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    +1 mark
                  </span>
                  .
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-slate-600 mt-2 shrink-0" />
                <span>
                  Incorrect answer:{" "}
                  <span className="text-emerald-700 dark:text-emerald-400 font-semibold">
                    no negative marking
                  </span>
                  .
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-1 h-1 rounded-full bg-[#CBD5E1] dark:bg-slate-600 mt-2 shrink-0" />
                <span>
                  Unanswered questions count as{" "}
                  <span className="text-[#64748B] dark:text-slate-400 font-semibold">
                    0 marks
                  </span>
                  .
                </span>
              </li>
            </ul>
          </Card>
        </div>

        {/* Candidate verification */}
        <div className="flex flex-col gap-5">
          <Card className="border-[#CBD5E1] dark:border-neutral-700 bg-white dark:bg-neutral-900 p-0 rounded-md shadow-sm h-fit lg:sticky lg:top-6 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-5 py-4 border-b border-[#E2E8F0] dark:border-neutral-700 bg-[#F8FAFC] dark:bg-neutral-950">
              <div className="flex items-center gap-2.5 min-w-0">
                <UserCheck className="w-4 h-4 text-[#0067B8] dark:text-blue-300 shrink-0" />
                <h2 className="m-0 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0F172A] dark:text-slate-50 truncate">
                  Candidate Verification
                </h2>
              </div>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                <Check className="w-3 h-3" />
                Verified
              </span>
            </div>

            <dl className="px-5 py-1 divide-y divide-[#F1F5F9] dark:divide-neutral-800">
              <div className="py-3">
                <dt className="text-[10px] uppercase font-bold text-[#94A3B8] dark:text-slate-500 tracking-wider">
                  Full Name
                </dt>
                <dd className="m-0 text-base font-bold text-[#111827] dark:text-slate-50 mt-0.5">
                  {candidate.fullName}
                </dd>
              </div>

              <div className="py-3">
                <dt className="text-[10px] uppercase font-bold text-[#94A3B8] dark:text-slate-500 tracking-wider">
                  Enrollment No.
                </dt>
                <dd className="m-0 text-base font-bold text-[#334155] dark:text-slate-200 font-mono mt-0.5 tracking-tight">
                  {candidate.enrollmentNumber}
                </dd>
              </div>

              {candidate.college && (
                <div className="py-3">
                  <dt className="text-[10px] uppercase font-bold text-[#94A3B8] dark:text-slate-500 tracking-wider">
                    College
                  </dt>
                  <dd className="m-0 text-xs font-semibold text-[#4B5563] dark:text-slate-300 mt-0.5 leading-relaxed">
                    {candidate.college}
                  </dd>
                </div>
              )}
            </dl>

            <div className="px-5 pb-5 pt-3 space-y-2 border-t border-[#F1F5F9] dark:border-neutral-800">
              <p className="text-[10px] uppercase font-bold text-[#94A3B8] dark:text-slate-500 tracking-wider mb-1">
                Required Permissions
              </p>

              <Button
                variant="secondary"
                onClick={requestCameraPermission}
                disabled={requestingCamera || cameraAccess}
                className="w-full justify-center px-3 py-2 text-xs !rounded-md !text-[#0067B8] !border-[#DBEAFE] hover:!border-[#b3d7ff] hover:!bg-[#F0F7FF] dark:!text-blue-300 dark:!border-blue-500/20 dark:hover:!border-blue-500/40 dark:hover:!bg-blue-500/10"
              >
                {requestingCamera
                  ? "Requesting..."
                  : cameraAccess
                    ? "Camera Allowed"
                    : "Allow Camera"}
              </Button>

              <Button
                variant="secondary"
                onClick={() => {
                  setScreenConsentDeclined(false);
                  setShowScreenModal(true);
                }}
                disabled={screenRecordingConsent}
                className="w-full justify-center px-3 py-2 text-xs gap-1.5 !rounded-md !text-[#0067B8] !border-[#DBEAFE] hover:!border-[#b3d7ff] hover:!bg-[#F0F7FF] dark:!text-blue-300 dark:!border-blue-500/20 dark:hover:!border-blue-500/40 dark:hover:!bg-blue-500/10"
              >
                <ScreenShare className="w-3.5 h-3.5" />
                {screenRecordingConsent
                  ? "Screen Recording Allowed"
                  : "Allow Screen Recording"}
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Declaration & launch */}
      <Card className="border-[#CBD5E1] dark:border-neutral-700 bg-white dark:bg-neutral-900 p-0 rounded-md shadow-sm overflow-hidden">
        <div className="px-5 pt-4 pb-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#0067B8] dark:text-blue-300">
            Final Step &middot; Declaration
          </p>
        </div>
        <div className="p-5 pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <Checkbox
            id="agree"
            label={
              <span className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 font-medium select-none cursor-pointer hover:text-[#111827] dark:hover:text-slate-50 transition-colors leading-relaxed">
                I confirm that I have read and understood the instructions
                above and agree to the terms of this examination.
              </span>
            }
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="flex-1"
          />

          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 shrink-0">
            {isMobile && (
              <p className="text-xs sm:text-sm font-semibold text-red-700 dark:text-red-400">
                Not supported on mobile devices.
              </p>
            )}

            <Button
              variant="primary"
              disabled={!agreed || isStartingExam || isMobile || !cameraAccess}
              onClick={handleStartExam}
              className="w-full sm:w-auto px-7 py-3 text-sm font-bold tracking-wide !rounded-md shrink-0"
            >
              {isStartingExam ? "Preparing Quiz..." : "Launch Portal Session"}
            </Button>
          </div>
        </div>
      </Card>
      {startError && (
        <p className="text-sm font-semibold text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-md px-4 py-3">
          {startError}
        </p>
      )}
      <ScreenRecordingModal
        open={showScreenModal}
        declined={screenConsentDeclined}
        onAllow={handleAllowScreenRecording}
        onDeny={handleDenyScreenRecording}
      />
    </PageContainer>
  );
};
