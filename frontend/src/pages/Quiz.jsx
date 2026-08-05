import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExam } from '../context/ExamContext';
import { PageContainer } from '../components/quiz/layout/PageContainer';
import { TimerCard } from '../components/quiz/quiz/TimerCard';
import { QuestionCard } from '../components/quiz/quiz/QuestionCard';
import { QuestionPalette } from '../components/quiz/quiz/QuestionPalette';
import { NavigationBar } from '../components/quiz/quiz/NavigationBar';
import { SecurityModal } from '../components/quiz/quiz/SecurityModal';
import { SubmitModal } from '../components/quiz/quiz/SubmitModal';
import { Card } from '../components/quiz/common/Card';
import { Button } from '../components/quiz/common/Button';
import { ThemeToggle } from '../components/quiz/common/ThemeToggle';
import { useGazeTracking } from '../hooks/useGazeTracking';
import { Camera, EyeOff, Maximize2, RefreshCw, ShieldAlert, UserCheck } from 'lucide-react';

const EXTENSION_SELECTORS = [
  'grammarly-desktop-integration',
  'grammarly-extension',
  '[data-grammarly-shadow-root]',
  '[data-lt-installed]',
  '[data-new-gr-c-s-check-loaded]',
  '[data-new-gr-c-s-loaded]',
  '[data-quillbot-extension]',
  '[class*="quillbot"]',
  '[id*="quillbot"]',
  '[class*="wordtune"]',
  '[id*="wordtune"]',
  '[class*="deepl"]',
  '[id*="deepl"]',
  '[class*="google_translate"]',
  '[id*="google_translate"]',
  '.skiptranslate',
  'iframe.goog-te-menu-frame',
  'iframe[src*="translate.google"]',
  '[id^="loom-companion"]',
  '[id*="screenshot"]',
  '[class*="screenshot"]',
  '[id*="screen-recorder"]',
  '[class*="screen-recorder"]',
];

const EXTENSION_ASSET_PATTERN = /(?:grammarly|languagetool|quillbot|wordtune|deepl|translate|loom|screen.?record|screenshot)/i;
const EXTENSION_ATTRIBUTE_NAMES = [
  'data-lt-installed',
  'data-new-gr-c-s-check-loaded',
  'data-new-gr-c-s-loaded',
  'data-grammarly-shadow-root',
  'data-quillbot-extension',
];

const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

const removeStaleExtensionArtifacts = () => {
  if (typeof document === 'undefined') return;

  EXTENSION_ATTRIBUTE_NAMES.forEach((attributeName) => {
    document.documentElement.removeAttribute(attributeName);
    document.body?.removeAttribute(attributeName);
  });

  EXTENSION_SELECTORS.forEach((selector) => {
    document.querySelectorAll(selector).forEach((node) => {
      if (node === document.documentElement || node === document.body) {
        EXTENSION_ATTRIBUTE_NAMES.forEach((attributeName) => node.removeAttribute(attributeName));
        return;
      }

      node.remove();
    });
  });

  document.querySelectorAll('script, iframe, link').forEach((node) => {
    const source = node.src || node.href || '';
    if (EXTENSION_ASSET_PATTERN.test(source)) {
      node.remove();
    }
  });
};

const createExtensionProbe = () => {
  const probe = document.createElement('textarea');
  probe.setAttribute('aria-hidden', 'true');
  probe.setAttribute('data-extension-probe', 'true');
  probe.value = 'Extension detection probe';
  probe.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:-9999px',
    'width:1px',
    'height:1px',
    'opacity:0',
    'pointer-events:none',
  ].join(';');

  document.body.appendChild(probe);
  probe.focus();
  return probe;
};

const getExtensionBlockReason = () => {
  if (typeof document === 'undefined' || typeof window === 'undefined') return '';

  const matchedNode = EXTENSION_SELECTORS
    .map((selector) => document.querySelector(selector))
    .find(Boolean);

  if (matchedNode) {
    return 'Browser extension content was detected on this page.';
  }

  const hasHighRiskExtensionAsset = Array.from(document.querySelectorAll('script, iframe, link'))
    .some((node) => {
      const source = node.src || node.href || '';
      return EXTENSION_ASSET_PATTERN.test(source);
    });

  if (hasHighRiskExtensionAsset) {
    return 'High-risk extension content was detected in the exam environment.';
  }

  return '';
};

export const Quiz = () => {
  const { candidate, examStarted, examCompleted, triggerWarning, setExamPaused } = useExam();
  const navigate = useNavigate();
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [extensionBlockReason, setExtensionBlockReason] = useState('');
  const [isCheckingExtensions, setIsCheckingExtensions] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [proctorWarning, setProctorWarning] = useState('');
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraRetryCount, setCameraRetryCount] = useState(0);
  const [cameraRequested, setCameraRequested] = useState(true);
  const extensionBlockActiveRef = useRef(false);
  const extensionRecheckInProgressRef = useRef(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  
  // Track if the app is actively in fullscreen mode
  const [isFullscreenActive, setIsFullscreenActive] = useState(
    () => !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement)
  );

  // ✨ ANTI-RACE CONDITION LOCK: Prevents multiple events from triggering at the exact same millisecond
  const lastViolationTime = useRef(0);

  useEffect(() => {
    extensionBlockActiveRef.current = Boolean(extensionBlockReason);
  }, [extensionBlockReason]);

  // ✨ INSTANT POST-REFRESH SWIPE LOCK: Executes immediately when component loads
  useEffect(() => {
    // Disable overscroll behaviors on the root body element programmatically on refresh mount
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';

    // Push dummy states into browser history stack to break horizontal swiping navigation mechanisms
    window.history.pushState(null, null, window.location.href);
    const handlePopState = () => {
      window.history.pushState(null, null, window.location.href);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.overscrollBehavior = '';
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!candidate) navigate('/');
    else if (!examStarted) navigate('/instructions');
    else if (examCompleted) navigate('/result');
  }, [candidate, examStarted, examCompleted, navigate]);

  const retryCamera = () => {
    setCameraRequested(true);
    setCameraRetryCount((prev) => prev + 1);
    setCameraError('');
    setCameraReady(false);
    setCameraStream(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!examStarted || examCompleted || !cameraRequested) return;

    let cancelled = false;

    const startCamera = async () => {
      setCameraReady(false);
      setCameraError('');

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera access is not supported in this browser.');
        return;
      }

      const tryGetStream = async (constraints) => {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        return stream;
      };

      try {
        let stream;
        const attempts = [
          { video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } }, audio: false },
          { video: { width: { ideal: 320 }, height: { ideal: 240 } }, audio: false },
          { video: true, audio: false },
        ];

        for (const constraints of attempts) {
          try {
            stream = await tryGetStream(constraints);
            break;
          } catch (error) {
            if (constraints === attempts[attempts.length - 1]) {
              throw error;
            }
          }
        }

        if (!stream) {
          throw new Error('No camera stream available.');
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        setCameraStream(stream);
        setCameraError('');

        if (videoRef.current) {
          try {
            videoRef.current.srcObject = stream;
            videoRef.current.muted = true;
            videoRef.current.playsInline = true;
            videoRef.current.onloadedmetadata = () => {
              if (!cancelled) {
                setCameraReady(true);
              }
            };
            await videoRef.current.play();
            if (!cancelled) {
              setCameraReady(true);
            }
          } catch (playError) {
            setCameraReady(false);
            setCameraError('Camera preview could not be started.');
          }
        }
      } catch (error) {
        if (!cancelled) {
          setCameraError('Camera permission is required for proctoring.');
          setCameraReady(false);
        }
      }
    };

    const fallbackTimer = window.setTimeout(() => {
      if (!cancelled && !cameraReady && !cameraStream) {
        setCameraError('Camera permission was not granted or the device is unavailable.');
      }
    }, 4000);

    startCamera();

    return () => {
      window.clearTimeout(fallbackTimer);
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setCameraStream(null);
      setCameraReady(false);
    };
  }, [examStarted, examCompleted, cameraRetryCount, cameraRequested]);

  // Gaze/face-direction tracking. This is deliberately separate from the
  // triggerWarning/securityWarnings system above (which can auto-submit the exam at 3
  // strikes) — looking away from the screen only ever shows a banner, it never counts
  // toward that limit and never submits the test.
  const { gazeMessage } = useGazeTracking(videoRef, examStarted && !examCompleted && cameraReady);

  useEffect(() => {
    if (!examStarted || examCompleted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setProctorWarning('Please keep your attention on the screen.');
      } else {
        setProctorWarning('');
      }
    };

    const handleBlur = () => {
      setProctorWarning('Please keep your attention on the screen.');
    };

    const handleFocus = () => {
      setProctorWarning('');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [examStarted, examCompleted]);

  useEffect(() => {
    if (!examStarted || examCompleted) return;

    const checkExtensions = () => {
      if (extensionRecheckInProgressRef.current) return '';

      const reason = getExtensionBlockReason();
      extensionBlockActiveRef.current = Boolean(reason);
      setExtensionBlockReason(reason);
      setExamPaused(Boolean(reason));
      return reason;
    };

    checkExtensions();

    const observer = new MutationObserver(() => {
      checkExtensions();
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src', 'href', 'id', 'class', 'data-lt-installed', 'data-new-gr-c-s-check-loaded'],
    });

    const interval = window.setInterval(checkExtensions, 2500);

    return () => {
      observer.disconnect();
      window.clearInterval(interval);
      setExamPaused(false);
    };
  }, [examStarted, examCompleted, setExamPaused]);

  useEffect(() => {
    if (!examStarted || examCompleted) return;

    // Helper wrapper to ensure warnings can only trigger once every 1.5 seconds
    const safeTriggerWarning = (reason) => {
      if (extensionBlockActiveRef.current || getExtensionBlockReason()) {
        extensionBlockActiveRef.current = true;
        setExtensionBlockReason('High-risk extension detected.');
        setExamPaused(true);
        return;
      }

      const now = Date.now();
      if (now - lastViolationTime.current > 1500) { 
        lastViolationTime.current = now;
        triggerWarning(reason);
      }
    };

    const handleVisibilityChange = () => { 
      if (document.hidden) safeTriggerWarning("Tab Switch Detected"); 
    };
    
    const handleBlur = () => {
      // Small timeout ensures alert dialog box blurs don't trigger false positives
      setTimeout(() => {
        if (!document.hasFocus() && !examCompleted) {
          safeTriggerWarning("Window Blur Detected");
        }
      }, 200);
    };
    
    const handleFullscreenChange = () => {
      const activeElement = document.fullscreenElement || 
                            document.webkitFullscreenElement || 
                            document.mozFullScreenElement || 
                            document.msFullscreenElement;
      
      const checkFullscreen = !!activeElement;
      setIsFullscreenActive(checkFullscreen);

      if (!checkFullscreen && !examCompleted && !extensionBlockActiveRef.current) {
        safeTriggerWarning("Exited Fullscreen Mode");
      }
    };

    // TOUCHPAD LOCKDOWN: Prevent Control + Scroll zoom tricks on Trackpads
    const handleWheelZoom = (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    };

    // TOUCHPAD LOCKDOWN: Block browser secondary tap options context menus 
    const handleContextMenu = (e) => {
      e.preventDefault();
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    // Bind trackpad defensive listeners with passive flag set to false to support preventDefault()
    window.addEventListener('wheel', handleWheelZoom, { passive: false });
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
      
      window.removeEventListener('wheel', handleWheelZoom);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [examStarted, examCompleted, setExamPaused]);

  // Function to lock fullscreen mode again post-refresh
  const handleRestoreFullscreen = async () => {
    const element = document.documentElement;
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) {
        await element.msRequestFullscreen();
      }
      setIsFullscreenActive(true);
    } catch (err) {
      console.warn("Fullscreen recovery blocked:", err);
    }
  };

  if (!candidate || !examStarted) return null;

  if (extensionBlockReason && !examCompleted) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F8FAFC] dark:bg-[#071225] flex items-center justify-center p-6 select-none overscroll-none touch-none">
        <Card className="max-w-md w-full border-[#FECACA] dark:border-[rgba(161,161,170,0.18)] bg-white dark:bg-[#1a1a1a] text-center p-8 shadow-2xl">
          <div className="mx-auto w-12 h-12 bg-red-50 border border-red-100 rounded-lg flex items-center justify-center text-red-600 mb-4">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-[#111827] dark:text-slate-50 tracking-wide mb-2">Extension Blocked</h2>
          <p className="text-sm text-[#374151] dark:text-slate-300 leading-relaxed mb-3">
            Please disable browser extensions before continuing the quiz.
          </p>
          <p className="text-xs text-[#b91c1c] leading-relaxed bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-6">
            High-risk extension detected.
          </p>
          <Button
            variant="primary"
            disabled={isCheckingExtensions}
            onClick={async () => {
              setIsCheckingExtensions(true);
              extensionRecheckInProgressRef.current = true;
              removeStaleExtensionArtifacts();
              const probe = createExtensionProbe();
              await wait(1500);
              probe.remove();
              extensionRecheckInProgressRef.current = false;

              const reason = getExtensionBlockReason();
              if (reason) {
                extensionBlockActiveRef.current = true;
                setExtensionBlockReason(reason);
                setExamPaused(true);
                setIsCheckingExtensions(false);
                return;
              }

              extensionBlockActiveRef.current = false;
              setExtensionBlockReason('');
              setExamPaused(false);
              setIsCheckingExtensions(false);
              handleRestoreFullscreen();
            }}
            className="w-full py-3 font-semibold text-sm gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isCheckingExtensions ? 'animate-spin' : ''}`} />
            {isCheckingExtensions ? 'Checking...' : 'Check Again'}
          </Button>
        </Card>
      </div>
    );
  }

  // INTERCEPTOR VIEWPORT: Triggered if the student reloads the page or escapes fullscreen
  // Added overscroll-none utilities here to keep it disabled even when stuck on the interceptor screen
  if (!isFullscreenActive && !examCompleted) {
    return (
      <div className="fixed inset-0 z-50 bg-[#F8FAFC] dark:bg-slate-950 flex items-center justify-center p-6 select-none overscroll-none touch-none">
        <Card className="max-w-md w-full border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-slate-900 text-center p-8 shadow-2xl">
          <div className="mx-auto w-12 h-12 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl flex items-center justify-center text-[#b45309] mb-4">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <h2 className="text-xl font-black text-[#111827] dark:text-slate-50 tracking-wide mb-2">Fullscreen Required</h2>
          <p className="text-xs text-[#6B7280] dark:text-slate-400 leading-relaxed mb-6">
            The page environment was reloaded or disrupted. To protect evaluation security and resume your assessment session, you must lock the screen context.
          </p>
          <Button variant="primary" onClick={handleRestoreFullscreen} className="w-full py-3 font-semibold text-sm gap-2">
            <Maximize2 className="w-4 h-4" /> Restore Fullscreen Mode
          </Button>
        </Card>
      </div>
    );
  }

  // STANDARD VIEWPORT: Shown when everything is operating securely
  // Injected overscroll-none and touch-none layout properties globally
  return (
    <div className="w-full min-h-[calc(100svh-65px)] lg:h-[calc(100vh-65px)] flex flex-col bg-[#F8FAFC] dark:bg-[#121212] overscroll-none touch-none overflow-hidden select-none">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 lg:pt-5">
        <div className="bg-white dark:bg-[#1a1a1a] border border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] rounded-lg shadow-sm px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-white/5 text-[#0067B8] dark:text-slate-100 flex items-center justify-center shrink-0">
              <UserCheck className="w-5 h-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64748B] dark:text-slate-400">Candidate</p>
              <p className="text-sm font-bold text-[#111827] dark:text-slate-50 truncate">{candidate.fullName || candidate.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="font-mono text-xs font-bold text-[#0067B8] dark:text-slate-100 bg-[#0067B8]/10 dark:bg-white/5 border border-[#0067B8]/15 dark:border-[rgba(161,161,170,0.18)] rounded-lg px-3 py-2 w-fit">
              {candidate.enrollmentNumber || candidate.applicationId}
            </div>
            <TimerCard />
            <ThemeToggle />
          </div>
        </div>
      </div>

      {(proctorWarning || gazeMessage) && (
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 space-y-2">
          {proctorWarning && (
            <div className="rounded-lg border border-amber-200 dark:border-[rgba(161,161,170,0.18)] bg-amber-50 dark:bg-[#121212] px-4 py-3 text-sm font-medium text-amber-800 dark:text-slate-300 shadow-sm">
              {proctorWarning}
            </div>
          )}
          {gazeMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-[rgba(161,161,170,0.18)] bg-amber-50 dark:bg-[#121212] px-4 py-3 text-sm font-medium text-amber-800 dark:text-slate-300 shadow-sm">
              <EyeOff className="w-4 h-4 shrink-0" />
              {gazeMessage}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-5 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-4 lg:gap-6 overflow-y-auto lg:overflow-hidden">
        <div className="min-h-[520px] lg:min-h-0 lg:h-full overflow-hidden flex flex-col">
          <QuestionCard />
        </div>
        <div className="min-h-0 space-y-3 lg:h-full overflow-y-auto flex flex-col pr-0.5">
          <div className="rounded-xl border border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] bg-white dark:bg-[#1a1a1a] p-2.5 shadow-sm shrink-0">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-6 h-6 rounded-md bg-blue-50 dark:bg-white/5 text-[#0067B8] dark:text-slate-100 flex items-center justify-center shrink-0">
                <Camera className="w-3 h-3" />
              </div>
              <div className="min-w-0 flex items-center justify-between gap-2 flex-1">
                <p className="text-[11px] font-semibold text-[#111827] dark:text-slate-50">Live camera</p>
                <p className="text-[8px] font-bold uppercase tracking-[0.16em] text-[#64748B] dark:text-slate-400">Proctoring</p>
              </div>
            </div>
            <div className="relative w-full aspect-video overflow-hidden rounded-lg border border-[#E5E7EB] dark:border-[rgba(161,161,170,0.18)] bg-black/90">
              <video
                ref={videoRef}
                muted
                playsInline
                autoPlay
                className={`absolute inset-0 h-full w-full object-cover ${cameraStream && cameraReady ? '' : 'hidden'}`}
              />
              {!(cameraStream && cameraReady) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#121212] px-3 text-center text-xs text-slate-300">
                  <span>{cameraError || 'Camera is starting…'}</span>
                  {cameraError && (
                    <button
                      type="button"
                      onClick={retryCamera}
                      className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-100 transition hover:bg-slate-700"
                    >
                      Retry camera
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <QuestionPalette />
        </div>
      </div>
      <NavigationBar onSubmitClick={() => setShowSubmitModal(true)} />
      <SecurityModal />
      <SubmitModal isOpen={showSubmitModal} onClose={() => setShowSubmitModal(false)} />
    </div>
  );
};