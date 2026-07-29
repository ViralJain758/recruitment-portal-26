import React, { createContext, useContext, useState, useEffect } from 'react';
import { mockQuestions } from '../utils/questions';

const ExamContext = createContext(null);

export const ExamProvider = ({ children }) => {
  const [candidate, setCandidate] = useState(() => {
    const saved = localStorage.getItem('mlsc_candidate');
    return saved ? JSON.parse(saved) : null;
  });
  const [examStarted, setExamStarted] = useState(() => localStorage.getItem('mlsc_exam_started') === 'true');
  const [examCompleted, setExamCompleted] = useState(() => localStorage.getItem('mlsc_exam_completed') === 'true');
  const [examPaused, setExamPaused] = useState(false);
  
  // ✨ UPDATED: Load the shuffled questions array from localStorage if it exists, otherwise start empty
  const [questions, setQuestions] = useState(() => {
    const savedQuestions = localStorage.getItem('mlsc_shuffled_questions');
    return savedQuestions ? JSON.parse(savedQuestions) : [];
  });

  const [responses, setResponses] = useState(() => {
    const saved = localStorage.getItem('mlsc_responses');
    return saved ? JSON.parse(saved) : {};
  });
  const [reviewStatus, setReviewStatus] = useState(() => {
    const saved = localStorage.getItem('mlsc_review');
    return saved ? JSON.parse(saved) : {};
  });
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem('mlsc_time_left');
    return saved ? parseInt(saved, 10) : 30 * 60;
  });
  const [securityWarnings, setSecurityWarnings] = useState(() => {
    const saved = localStorage.getItem('mlsc_warnings');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityViolationType, setSecurityViolationType] = useState('');

  // Computed question helper maps cleanly to our active shuffled pool
  const currentQuestion = questions[currentQuestionIndex] || null;

  // Sync state modifications
  useEffect(() => {
    if (candidate) localStorage.setItem('mlsc_candidate', JSON.stringify(candidate));
    else localStorage.removeItem('mlsc_candidate');
  }, [candidate]);

  useEffect(() => { localStorage.setItem('mlsc_exam_started', examStarted); }, [examStarted]);
  useEffect(() => { localStorage.setItem('mlsc_exam_completed', examCompleted); }, [examCompleted]);
  useEffect(() => { localStorage.setItem('mlsc_responses', JSON.stringify(responses)); }, [responses]);
  useEffect(() => { localStorage.setItem('mlsc_review', JSON.stringify(reviewStatus)); }, [reviewStatus]);
  useEffect(() => { localStorage.setItem('mlsc_time_left', timeLeft); }, [timeLeft]);

  // ✨ NEW: Keep the shuffled question array saved on browser reloads
  useEffect(() => {
    if (questions.length > 0) {
      localStorage.setItem('mlsc_shuffled_questions', JSON.stringify(questions));
    } else {
      localStorage.removeItem('mlsc_shuffled_questions');
    }
  }, [questions]);

  useEffect(() => {
    localStorage.setItem('mlsc_warnings', securityWarnings);
    if (securityWarnings >= 3 && examStarted && !examCompleted && !examPaused) {
      completeExam();
    }
  }, [securityWarnings, examStarted, examCompleted, examPaused]);

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

  // ✨ UPDATED: Shuffles questions using the Durstenfeld/Fisher-Yates Shuffle Algorithm
  const startExam = (selectedAdminQuestions = mockQuestions) => {
    // 1. Take the 15 questions selected from your pool
    let pool = [...selectedAdminQuestions];
    
    // 2. Shuffle them in-place randomly
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    // 3. Optional Bonus: If you want to jumble the options inside the questions as well!
    const randomizedPool = pool.map(q => {
      let optionsCopy = [...q.options];
      // Keep track of where the correct answer goes if you score on frontend
      const originalCorrectText = q.options[q.correctAnswer]; 
      
      for (let i = optionsCopy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [optionsCopy[i], optionsCopy[j]] = [optionsCopy[j], optionsCopy[i]];
      }

      return {
        ...q,
        options: optionsCopy,
        correctAnswer: originalCorrectText ? optionsCopy.indexOf(originalCorrectText) : q.correctAnswer
      };
    });

    setQuestions(randomizedPool);
    setResponses({});
    setReviewStatus({});
    setCurrentQuestionIndex(0);
    setTimeLeft(30 * 60);
    setSecurityWarnings(0);
    setShowSecurityModal(false);
    setExamPaused(false);
    setExamCompleted(false);
    setExamStarted(true);
  };

  const triggerWarning = (type) => {
    if (!examStarted || examCompleted || examPaused) return;
    setSecurityViolationType(type);
    setSecurityWarnings((prev) => prev + 1);
    setShowSecurityModal(true);
  };

  const completeExam = () => {
    setExamCompleted(true);
    localStorage.setItem('mlsc_exam_completed', 'true');
  };

  const resetExamData = () => {
    [
      'mlsc_candidate',
      'mlsc_exam_started',
      'mlsc_exam_completed',
      'mlsc_shuffled_questions',
      'mlsc_responses',
      'mlsc_review',
      'mlsc_time_left',
      'mlsc_warnings',
    ].forEach((key) => localStorage.removeItem(key));

    setCandidate(null);
    setExamStarted(false);
    setExamCompleted(false);
    setQuestions([]);
    setResponses({});
    setReviewStatus({});
    setCurrentQuestionIndex(0);
    setTimeLeft(30 * 60);
    setSecurityWarnings(0);
    setShowSecurityModal(false);
    setExamPaused(false);
  };

  return (
    <ExamContext.Provider value={{
      candidate, setCandidate, examStarted, setExamStarted: startExam, examCompleted, setExamCompleted,
      examPaused, setExamPaused,
      responses, setResponses, reviewStatus, setReviewStatus, currentQuestionIndex, setCurrentQuestionIndex,
      timeLeft, setTimeLeft, securityWarnings, triggerWarning, showSecurityModal, setShowSecurityModal,
      securityViolationType, completeExam, resetExamData,
      questions,
      currentQuestion
    }}>
      {children}
    </ExamContext.Provider>
  );
};

export const useExam = () => useContext(ExamContext);
