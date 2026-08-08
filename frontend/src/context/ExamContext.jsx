import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { submitQuiz } from "../lib/api";
const ExamContext = createContext(null);

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const ExamProvider = ({ children }) => {
  const [candidate, setCandidate] = useState(() => {
    return readJsonStorage("mlsc_candidate", null);
  });
  const [examStarted, setExamStarted] = useState(
    () => localStorage.getItem("mlsc_exam_started") === "true",
  );
  const [examCompleted, setExamCompleted] = useState(
    () => localStorage.getItem("mlsc_exam_completed") === "true",
  );
  const [examPaused, setExamPaused] = useState(false);

  const [questions, setQuestions] = useState(() => {
    return (
      readJsonStorage("mlsc_quiz_questions", null) ||
      readJsonStorage("mlsc_shuffled_questions", [])
    );
  });

  const [responses, setResponses] = useState(() => {
    return readJsonStorage("mlsc_responses", {});
  });
  const [visitedQuestions, setVisitedQuestions] = useState(() => {
    return readJsonStorage("mlsc_visited_questions", {});
  });
  const [reviewStatus, setReviewStatus] = useState(() => {
    return readJsonStorage("mlsc_review", {});
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem("mlsc_time_left");
    return saved ? parseInt(saved, 10) : 20 * 60;
  });
  const [securityWarnings, setSecurityWarnings] = useState(() => {
    const saved = localStorage.getItem("mlsc_warnings");
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityViolationType, setSecurityViolationType] = useState("");
  const [cameraAccess, setCameraAccess] = useState(false);
  const [screenRecordingConsent, setScreenRecordingConsent] = useState(() => {
    return localStorage.getItem("mlsc_screen_consent") === "true";
  });
  const [recordingSeconds, setRecordingSeconds] = useState(() => {
    const saved = localStorage.getItem("mlsc_recording_seconds");
    return saved ? parseInt(saved, 10) : 0;
  });

  // Tracks a submission that has been finalized locally (timer ran out, 3
  // security strikes, or the candidate confirmed) but hasn't yet been
  // confirmed by the server — typically because the network was down at the
  // moment of submission. While this is true, a background effect below
  // keeps retrying until the server confirms receipt, including across page
  // reloads (it's seeded from localStorage on mount).
  const [submissionPending, setSubmissionPending] = useState(
    () => localStorage.getItem("mlsc_submission_pending") === "true",
  );

  // Refs mirroring the latest state for use inside the background retry
  // loop below, so a retry firing minutes after exam completion (once
  // connectivity returns) always submits the final answers instead of a
  // stale closure captured back when the loop was first scheduled.
  const responsesRef = useRef(responses);
  const candidateRef = useRef(candidate);
  const questionsRef = useRef(questions);
  useEffect(() => {
    responsesRef.current = responses;
  }, [responses]);
  useEffect(() => {
    candidateRef.current = candidate;
  }, [candidate]);
  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  // Computed question helper maps cleanly to the active DB paper.
  const currentQuestion = questions[currentQuestionIndex] || null;

  // Sync state modifications
  useEffect(() => {
    if (candidate)
      localStorage.setItem("mlsc_candidate", JSON.stringify(candidate));
    else localStorage.removeItem("mlsc_candidate");
  }, [candidate]);

  useEffect(() => {
    localStorage.setItem("mlsc_exam_started", examStarted);
  }, [examStarted]);
  useEffect(() => {
    localStorage.setItem("mlsc_exam_completed", examCompleted);
  }, [examCompleted]);
  useEffect(() => {
    localStorage.setItem("mlsc_responses", JSON.stringify(responses));
  }, [responses]);
  useEffect(() => {
    localStorage.setItem("mlsc_visited_questions", JSON.stringify(visitedQuestions));
  }, [visitedQuestions]);
  useEffect(() => {
    localStorage.setItem("mlsc_review", JSON.stringify(reviewStatus));
  }, [reviewStatus]);
  useEffect(() => {
    localStorage.setItem("mlsc_time_left", timeLeft);
  }, [timeLeft]);
  useEffect(() => {
    localStorage.setItem("mlsc_screen_consent", screenRecordingConsent);
  }, [screenRecordingConsent]);
  useEffect(() => {
    localStorage.setItem("mlsc_recording_seconds", recordingSeconds);
  }, [recordingSeconds]);
  useEffect(() => {
    if (submissionPending) {
      localStorage.setItem("mlsc_submission_pending", "true");
    } else {
      localStorage.removeItem("mlsc_submission_pending");
    }
  }, [submissionPending]);

  useEffect(() => {
    if (questions.length > 0) {
      localStorage.setItem("mlsc_quiz_questions", JSON.stringify(questions));
      localStorage.removeItem("mlsc_shuffled_questions");
    } else {
      localStorage.removeItem("mlsc_quiz_questions");
      localStorage.removeItem("mlsc_shuffled_questions");
    }
  }, [questions]);

  useEffect(() => {
    localStorage.setItem("mlsc_warnings", securityWarnings);
    if (securityWarnings >= 3 && examStarted && !examCompleted && !examPaused) {
      completeExam();
    }
  }, [securityWarnings, examStarted, examCompleted, examPaused]);

  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex >= 0) {
      const currentQuestion = questions[currentQuestionIndex];
      if (currentQuestion?.id !== undefined && currentQuestion?.id !== null) {
        setVisitedQuestions((prev) => {
          if (prev[currentQuestion.id]) return prev;
          return { ...prev, [currentQuestion.id]: true };
        });
      }
    }
  }, [currentQuestionIndex, questions]);

  useEffect(() => {
    let timer;
    if (examStarted && !examCompleted && !examPaused && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            completeExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [examStarted, examCompleted, examPaused, timeLeft]);

  const startExam = (selectedAdminQuestions = []) => {
    if (
      !Array.isArray(selectedAdminQuestions) ||
      selectedAdminQuestions.length === 0
    ) {
      throw new Error("No quiz questions are available.");
    }

    // Defense in depth: the app is expected to route candidates away from
    // Instructions/Dashboard entirely while an attempt is open (see
    // ExamInProgressGuard in App.jsx), but this guard makes sure that even if
    // that's ever bypassed, a still-open attempt can never be silently reset
    // back to a fresh timer/warning count/answer sheet.
    if (examStarted && !examCompleted) {
      return;
    }

    setQuestions(selectedAdminQuestions);
    setResponses({});
    setVisitedQuestions({});
    setReviewStatus({});
    setCurrentQuestionIndex(0);
    setTimeLeft(20 * 60);
    setSecurityWarnings(0);
    setShowSecurityModal(false);
    setExamPaused(false);
    setExamCompleted(false);
    setRecordingSeconds(0);
    setExamStarted(true);
  };

  const triggerWarning = (type) => {
    if (!examStarted || examCompleted || examPaused) return;
    setSecurityViolationType(type);
    setSecurityWarnings((prev) => prev + 1);
    setShowSecurityModal(true);
  };

  // Tries once to hand the final responses to the server. Returns true if
  // the server has (or already had) the submission — i.e. nothing left to
  // retry — and false if this attempt failed for a reason that a retry
  // could plausibly fix (no connectivity, or a transient 5xx).
  const attemptSubmission = async () => {
    const submissionCandidate = candidateRef.current;
    const submissionQuestions = questionsRef.current;

    if (!submissionCandidate?.accessToken || submissionQuestions.length === 0) {
      // Nothing meaningful to submit (e.g. exam ended before any questions
      // ever loaded) — don't get stuck retrying forever.
      setSubmissionPending(false);
      return true;
    }

    try {
      await submitQuiz({ responses: responsesRef.current }, submissionCandidate.accessToken);
      setSubmissionPending(false);
      return true;
    } catch (error) {
      if (/already|submitted/i.test(error.message || "")) {
        // The server already has an earlier attempt on file — nothing to retry.
        setSubmissionPending(false);
        return true;
      }

      // A response with a status code means the request *reached* the
      // server and it rejected it for a real reason (bad payload, auth,
      // etc.) — retrying the same request won't change that, so don't loop
      // on it forever. Anything else (fetch itself threw, or a 5xx) is
      // treated as connectivity/server trouble worth retrying.
      const isRetryable = !error.status || error.status >= 500;

      if (!isRetryable) {
        console.error(error);
        setSubmissionPending(false);
        return true;
      }

      setSubmissionPending(true);
      return false;
    }
  };

  // Finalizes the exam locally right away (stops the timer, kicks the
  // candidate to the Result screen) regardless of connectivity, then tries
  // to deliver the submission. If that first attempt fails because the
  // candidate is offline, submissionPending flips on and the background
  // effect below takes over — retrying automatically the moment the browser
  // reports it's back online (and periodically in the background besides),
  // resuming even across a page reload since submissionPending is restored
  // from localStorage on mount.
  const completeExam = async () => {
    if (examCompleted && !submissionPending) return true;

    setExamCompleted(true);
    localStorage.setItem("mlsc_exam_completed", "true");

    await attemptSubmission();

    return true;
  };

  // Background sync: as long as a submission is pending, keep trying to
  // deliver it — immediately on mount/whenever it becomes pending (covers
  // connectivity that was restored before this effect even attached, e.g.
  // right after reopening the app), again the instant the browser fires
  // 'online', and periodically as a fallback for browsers/networks that
  // don't reliably fire that event.
  useEffect(() => {
    if (!submissionPending) return;

    let cancelled = false;
    let retryTimeoutId = null;
    const RETRY_INTERVAL_MS = 8000;

    const scheduleRetry = () => {
      if (cancelled) return;
      retryTimeoutId = window.setTimeout(runAttempt, RETRY_INTERVAL_MS);
    };

    const runAttempt = async () => {
      if (cancelled) return;
      const delivered = await attemptSubmission();
      if (!delivered) scheduleRetry();
    };

    const handleOnline = () => {
      if (retryTimeoutId) window.clearTimeout(retryTimeoutId);
      runAttempt();
    };

    window.addEventListener("online", handleOnline);
    runAttempt();

    return () => {
      cancelled = true;
      if (retryTimeoutId) window.clearTimeout(retryTimeoutId);
      window.removeEventListener("online", handleOnline);
    };
  }, [submissionPending]);

  const resetExamData = () => {
    // If a submission is still trying to reach the server, wiping local
    // state now would throw away the only copy of the candidate's answers
    // before delivery is confirmed. Let the background retry effect finish
    // first — Result.jsx surfaces the "syncing" state so this isn't
    // reachable from the UI while pending, but the guard is kept here too
    // as a safety net.
    if (submissionPending) return;

    [
      "mlsc_candidate",
      "mlsc_exam_started",
      "mlsc_exam_completed",
      "mlsc_quiz_questions",
      "mlsc_shuffled_questions",
      "mlsc_responses",
      "mlsc_visited_questions",
      "mlsc_review",
      "mlsc_time_left",
      "mlsc_warnings",
      "mlsc_screen_consent",
      "mlsc_recording_seconds",
      "mlsc_submission_pending",
    ].forEach((key) => localStorage.removeItem(key));

    setCandidate(null);
    setScreenRecordingConsent(false);
    setRecordingSeconds(0);
    setExamStarted(false);
    setExamCompleted(false);
    setQuestions([]);
    setResponses({});
    setVisitedQuestions({});
    setReviewStatus({});
    setCurrentQuestionIndex(0);
    setTimeLeft(20 * 60);
    setSecurityWarnings(0);
    setShowSecurityModal(false);
    setExamPaused(false);
  };

  return (
    <ExamContext.Provider
      value={{
        candidate,
        setCandidate,
        examStarted,
        setExamStarted: startExam,
        examCompleted,
        setExamCompleted,
        examPaused,
        setExamPaused,
        responses,
        setResponses,
        visitedQuestions,
        setVisitedQuestions,
        reviewStatus,
        setReviewStatus,
        currentQuestionIndex,
        setCurrentQuestionIndex,
        timeLeft,
        setTimeLeft,
        securityWarnings,
        triggerWarning,
        showSecurityModal,
        setShowSecurityModal,
        securityViolationType,
        completeExam,
        resetExamData,
        submissionPending,
        retrySubmission: attemptSubmission,
        questions,
        currentQuestion,
        cameraAccess,
        setCameraAccess,
        screenRecordingConsent,
        setScreenRecordingConsent,
        recordingSeconds,
        setRecordingSeconds,
      }}
    >
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => useContext(ExamContext);
