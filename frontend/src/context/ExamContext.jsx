import React, { createContext, useContext, useState, useEffect } from "react";
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

  const completeExam = async () => {
    if (examCompleted) return true;

    try {
      if (candidate?.accessToken && questions.length > 0) {
        await submitQuiz({ responses }, candidate.accessToken);
      }
    } catch (error) {
      if (!/already|submitted/i.test(error.message || "")) {
        console.error(error);
      }
    } finally {
      setExamCompleted(true);
      localStorage.setItem("mlsc_exam_completed", "true");
    }

    return true;
  };

  const resetExamData = () => {
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
