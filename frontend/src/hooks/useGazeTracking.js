import { useEffect, useRef, useState } from 'react';

// Local, self-hosted copy of the MediaPipe WASM runtime (see public/mediapipe/wasm).
// Self-hosting avoids depending on a third-party CDN being reachable during a live exam.
const WASM_BASE_PATH = '/mediapipe/wasm';

// Google's official model zoo. This one file (~a few MB) is the only asset that still
// comes from a remote host; the browser caches it after the first load. If you want a
// fully offline build, download this file yourself and point MODEL_ASSET_PATH at a local
// copy under /public instead.
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// How often (ms) we actually run inference on a video frame. Gaze direction doesn't need
// to be checked 60x/second — a few checks a second is plenty and keeps CPU usage low.
const DETECTION_INTERVAL_MS = 350;

// How many consecutive "away" readings are needed before we surface a warning, and how
// many consecutive "centered" readings are needed before we clear it. This debouncing
// stops normal blinking, brief glances at the keyboard, etc. from triggering false
// warnings — the candidate has to be looking away for roughly this many checks in a row.
const AWAY_STREAK_TO_WARN = 4; // ~1.4s of sustained "away"
const CENTER_STREAK_TO_CLEAR = 3; // ~1.05s of sustained "centered"

// Landmark indices from MediaPipe's 468/478-point face mesh topology (stable across
// versions). These are well-known anatomical reference points:
const NOSE_TIP = 1;
const NOSE_BRIDGE = 6;
const RIGHT_TEMPLE = 234; // face edge, image-left side of a non-mirrored frame
const LEFT_TEMPLE = 454; // face edge, image-right side of a non-mirrored frame
const FOREHEAD = 10;
const CHIN = 152;

// Tunable "how far is too far" thresholds, expressed as a ratio of nose position between
// the two reference edges (0 = at one edge, 0.5 = perfectly centered, 1 = at other edge).
const H_RATIO_MIN = 0.35;
const H_RATIO_MAX = 0.65;
const V_RATIO_MIN = 0.28; // looking up
const V_RATIO_MAX = 0.68; // looking down

/**
 * Pure function: given a single face's landmark array from FaceLandmarker, decide
 * whether the candidate appears to be looking at the screen or away from it.
 * Exported separately from the hook so it can be unit-tested without a real camera,
 * video element, or WASM runtime.
 */
export function computeGazeStatus(landmarks) {
  if (!landmarks || landmarks.length === 0) {
    return { status: 'no-face' };
  }

  const nose = landmarks[NOSE_TIP];
  const bridge = landmarks[NOSE_BRIDGE];
  const rightTemple = landmarks[RIGHT_TEMPLE];
  const leftTemple = landmarks[LEFT_TEMPLE];
  const forehead = landmarks[FOREHEAD];
  const chin = landmarks[CHIN];

  if (!nose || !bridge || !rightTemple || !leftTemple || !forehead || !chin) {
    return { status: 'no-face' };
  }

  const leftX = Math.min(rightTemple.x, leftTemple.x);
  const rightX = Math.max(rightTemple.x, leftTemple.x);
  const faceWidth = rightX - leftX;

  const topY = forehead.y;
  const bottomY = chin.y;
  const faceHeight = bottomY - topY;

  if (faceWidth <= 0.001 || faceHeight <= 0.001) {
    return { status: 'no-face' };
  }

  const hRatio = (nose.x - leftX) / faceWidth;
  const vRatio = (bridge.y - topY) / faceHeight;

  const lookingSideways = hRatio < H_RATIO_MIN || hRatio > H_RATIO_MAX;
  const lookingUpOrDown = vRatio < V_RATIO_MIN || vRatio > V_RATIO_MAX;

  if (lookingSideways || lookingUpOrDown) {
    return { status: 'looking-away', hRatio, vRatio };
  }

  return { status: 'centered', hRatio, vRatio };
}

const STATUS_MESSAGES = {
  'no-face': 'Your face is not visible to the camera. Please stay in frame.',
  'looking-away': 'Please keep your eyes on the screen during the assessment.',
};

/**
 * Tracks whether the candidate appears to be looking at the screen, using the webcam
 * feed already attached to `videoRef`. This is intentionally decoupled from the app's
 * security-violation / auto-submit system: it only ever reports a status and message for
 * display, and never calls triggerWarning or anything that could end the exam.
 *
 * @param {React.RefObject<HTMLVideoElement>} videoRef - ref to the already-playing video element
 * @param {boolean} active - whether tracking should be running right now
 */
export function useGazeTracking(videoRef, active) {
  const [gazeStatus, setGazeStatus] = useState('idle'); // idle | loading | centered | looking-away | no-face | unavailable
  const [gazeMessage, setGazeMessage] = useState('');
  const landmarkerRef = useRef(null);
  const awayStreakRef = useRef(0);
  const centerStreakRef = useRef(0);
  const displayedAwayRef = useRef(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!active) {
      setGazeStatus('idle');
      setGazeMessage('');
      return undefined;
    }

    cancelledRef.current = false;
    awayStreakRef.current = 0;
    centerStreakRef.current = 0;
    displayedAwayRef.current = false;
    let intervalId;

    const init = async () => {
      setGazeStatus('loading');
      try {
        const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
        const filesetResolver = await FilesetResolver.forVisionTasks(WASM_BASE_PATH);

        if (cancelledRef.current) return;

        const landmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
          baseOptions: {
            modelAssetPath: MODEL_ASSET_PATH,
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });

        if (cancelledRef.current) {
          landmarker.close();
          return;
        }

        landmarkerRef.current = landmarker;
        setGazeStatus('centered');
        setGazeMessage('');

        intervalId = window.setInterval(() => {
          const video = videoRef.current;
          if (!video || video.readyState < 2 || !landmarkerRef.current) return;

          let result;
          try {
            result = landmarkerRef.current.detectForVideo(video, performance.now());
          } catch (detectError) {
            return; // transient decode hiccup, just skip this tick
          }

          const { status } = computeGazeStatus(result?.faceLandmarks?.[0]);

          if (status === 'centered') {
            centerStreakRef.current += 1;
            awayStreakRef.current = 0;
            if (displayedAwayRef.current && centerStreakRef.current >= CENTER_STREAK_TO_CLEAR) {
              displayedAwayRef.current = false;
              setGazeStatus('centered');
              setGazeMessage('');
            }
          } else {
            awayStreakRef.current += 1;
            centerStreakRef.current = 0;
            if (!displayedAwayRef.current && awayStreakRef.current >= AWAY_STREAK_TO_WARN) {
              displayedAwayRef.current = true;
              setGazeStatus(status);
              setGazeMessage(STATUS_MESSAGES[status] || STATUS_MESSAGES['looking-away']);
            }
          }
        }, DETECTION_INTERVAL_MS);
      } catch (error) {
        if (!cancelledRef.current) {
          setGazeStatus('unavailable');
          setGazeMessage('');
          console.warn('Gaze tracking unavailable:', error);
        }
      }
    };

    init();

    return () => {
      cancelledRef.current = true;
      if (intervalId) window.clearInterval(intervalId);
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
        landmarkerRef.current = null;
      }
    };
  }, [active, videoRef]);

  return { gazeStatus, gazeMessage };
}