import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { markAttendance, getAttendanceStats } from "../lib/api";

export default function AttendanceScanner({ adminBypass = false, onClose, scannerPassword }) {
  const scannerRef = useRef(null);
  const isScanningRef = useRef(false);
  const isSubmittingRef = useRef(false);
  const timeoutRef = useRef(null);
  const lastScanRef = useRef("");

  const successSoundRef = useRef(new Audio("/sounds/success.mp3"));
  const errorSoundRef = useRef(new Audio("/sounds/error.mp3"));

  const [result, setResult] = useState({
    type: "idle",
    title: "Ready",
    message: "Point the camera at a candidate QR code.",
  });

  const [toasts, setToasts] = useState([]);
  const [slotStats, setSlotStats] = useState([]);
  const [unassignedStats, setUnassignedStats] = useState({
    totalCandidates: 0,
    presentCandidates: 0,
  });
  const [slotFilter, setSlotFilter] = useState("all");
  const [history, setHistory] = useState([]);

  function formatSlotLabel(slot) {
    const parts = [`Day ${slot.day}`, `Slot ${slot.slotNumber}`];
    if (slot.venue) parts.push(slot.venue);
    return parts.join(" · ");
  }

  function bumpSlotPresent(candidate) {
    if (!candidate?.slot_id) {
      setUnassignedStats((cur) => ({
        ...cur,
        presentCandidates: cur.presentCandidates + 1,
      }));
      return;
    }
    setSlotStats((cur) =>
      cur.map((slot) =>
        slot.slotId === candidate.slot_id
          ? { ...slot, presentCandidates: slot.presentCandidates + 1 }
          : slot,
      ),
    );
  }

  const overallStats = {
    totalCandidates:
      slotStats.reduce((sum, s) => sum + s.totalCandidates, 0) +
      unassignedStats.totalCandidates,
    presentCandidates:
      slotStats.reduce((sum, s) => sum + s.presentCandidates, 0) +
      unassignedStats.presentCandidates,
  };

  const selectedSlot =
    slotFilter === "all"
      ? null
      : slotFilter === "unassigned"
        ? { label: "Unassigned", ...unassignedStats }
        : (() => {
            const slot = slotStats.find(
              (s) => String(s.slotId) === slotFilter,
            );
            return slot ? { label: formatSlotLabel(slot), ...slot } : null;
          })();

  const displayedStats = selectedSlot ?? {
    label: "All Slots",
    ...overallStats,
  };
  const { totalCandidates, presentCandidates } = displayedStats;
  const remainingCandidates = totalCandidates - presentCandidates;
  const percentage = totalCandidates
    ? Math.round((presentCandidates / totalCandidates) * 100)
    : 0;

  async function startScanner() {
    if (isScanningRef.current) return;
    isScanningRef.current = true;

    try {
      const scanner = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: false,
          experimentalFeatures: { useBarCodeDetectorIfSupported: true },
        },
        (decodedText) => handleScan(decodedText),
        () => {}, // suppress per-frame "not found" errors
      );
    } catch (err) {
      // fallback: try front camera if environment camera fails
      try {
        await scannerRef.current.start(
          { facingMode: "user" },
          {
            fps: 15,
            qrbox: { width: 250, height: 250 },
            disableFlip: false,
            experimentalFeatures: { useBarCodeDetectorIfSupported: true },
          },
          (decodedText) => handleScan(decodedText),
          () => {},
        );
      } catch (fallbackErr) {
        isScanningRef.current = false;
        setResult({
          type: "error",
          title: "Camera Error",
          message: fallbackErr.message || err.message,
        });
      }
    }
  }

  async function stopScanner() {
    if (!scannerRef.current || !isScanningRef.current) return;
    isScanningRef.current = false;
    try {
      await scannerRef.current.stop();
      await scannerRef.current.clear();
    } catch {
      // already stopped — ignore
    }
    scannerRef.current = null;

    // Release any lingering camera tracks
    document.querySelectorAll("video").forEach((video) => {
      const stream = video.srcObject;
      if (stream instanceof MediaStream) {
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    });
  }

  async function handleClose() {
    await stopScanner();
    onClose?.();
  }

  async function handleScan(decodedText) {
    if (isSubmittingRef.current) return;
    if (decodedText === lastScanRef.current) return;

    lastScanRef.current = decodedText;
    clearTimeout(timeoutRef.current);

    isSubmittingRef.current = true;
    try {
      const response = await markAttendance(decodedText, {
        adminBypass,
        scannerPassword,
      });
      const { candidate, alreadyPresent } = response;

      if (alreadyPresent) {
        errorSoundRef.current.currentTime = 0;
        errorSoundRef.current.play().catch(() => {});
        setResult({
          type: "warning",
          title: "Already Present",
          message: `${candidate.full_name} was already marked present.`,
        });
        addToast("warning", `${candidate.full_name} is already checked in.`);
        addHistory("Already Present", candidate.full_name);
      } else {
        successSoundRef.current.currentTime = 0;
        successSoundRef.current.play().catch(() => {});
        bumpSlotPresent(candidate);
        navigator.vibrate?.(200);
        setResult({
          type: "success",
          title: "Attendance Marked",
          message: `${candidate.full_name} marked present.`,
        });
        addToast("success", `Marked ${candidate.full_name} present ✓`);
        addHistory("Present", candidate.full_name);
      }
    } catch (error) {
      // Clear lastScanRef immediately on error so the same QR can be retried
      lastScanRef.current = "";
      errorSoundRef.current.currentTime = 0;
      errorSoundRef.current.play().catch(() => {});
      const msg = error.message || "Attendance update failed.";
      const isNotYet =
        msg.toLowerCase().includes("not valid yet") ||
        msg.toLowerCase().includes("unlocks");
      const isInvalidQr =
        msg.toLowerCase().includes("not found") ||
        msg.toLowerCase().includes("invalid") ||
        msg.toLowerCase().includes("unrecognized");
      setResult({
        type: "error",
        title: isNotYet ? "Too Early" : "Scan Failed",
        message: msg,
      });
      addToast(
        "error",
        isNotYet
          ? `⏰ ${msg}`
          : isInvalidQr
            ? "Invalid QR code — not a registered candidate."
            : `Error: ${msg}`,
      );
      addHistory("Failed", decodedText);
    } finally {
      setTimeout(() => {
        isSubmittingRef.current = false;
        // Allow re-scan of same code after 3s (success/warning path)
        timeoutRef.current = setTimeout(() => {
          lastScanRef.current = "";
        }, 3000);
      }, 1000);
    }
  }

  function addHistory(status, value) {
    setHistory((cur) =>
      [{ status, value, time: new Date().toLocaleTimeString() }, ...cur].slice(
        0,
        10,
      ),
    );
  }

  function addToast(type, message) {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3500,
    );
  }

  function dismissToast(id) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  useEffect(() => {
    successSoundRef.current.load();
    errorSoundRef.current.load();
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const stats = await getAttendanceStats({
          adminBypass,
          scannerPassword,
        });
        setSlotStats(stats.slots ?? []);
        setUnassignedStats(
          stats.unassigned ?? { totalCandidates: 0, presentCandidates: 0 },
        );
      } catch (error) {
        console.error(error);
      }
    }
    loadStats();
  }, [adminBypass, scannerPassword]);

  useEffect(() => {
    const id = setTimeout(() => {
      startScanner();
    }, 0);

    return () => {
      clearTimeout(id);
      clearTimeout(timeoutRef.current);
      stopScanner();
    };
  }, []);

  return (
    <div className="scanner-overlay">
      <div className="toast-stack">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`toast toast--${toast.type}`}
            onClick={() => dismissToast(toast.id)}
          >
            <span className="toast-icon">
              {toast.type === "success" && "✓"}
              {toast.type === "warning" && "⚠"}
              {toast.type === "error" && "✕"}
            </span>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>

      <div className={`scanner-modal${onClose ? " scanner-modal--closable" : ""}`}>
        {onClose && (
          <button
            className="scanner-close"
            onClick={handleClose}
            aria-label="Close Scanner"
          >
            ×
          </button>
        )}

        {/* QR reader is always in the DOM — never hidden or conditionally rendered */}
        <div className="scanner-main">
          <h2>Attendance Scanner</h2>
          <div id="qr-reader" />
        </div>

        <div className="scanner-sidebar">
          <div className="filter-select-wrap scanner-slot-filter">
            <svg
              className="filter-select-icon"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="3" y="4" width="18" height="17" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="16" y1="2" x2="16" y2="6" />
            </svg>
            <select
              value={slotFilter}
              onChange={(e) => setSlotFilter(e.target.value)}
              aria-label="Filter by slot"
            >
              <option value="all">All Slots</option>
              {slotStats.map((slot) => (
                <option key={slot.slotId} value={String(slot.slotId)}>
                  {formatSlotLabel(slot)}
                </option>
              ))}
              {unassignedStats.totalCandidates > 0 && (
                <option value="unassigned">Unassigned</option>
              )}
            </select>
          </div>

          <p className="scanner-slot-current">{displayedStats.label}</p>

          <div className="scanner-stats">
            <div>
              <strong>{totalCandidates}</strong>
              <span>Total</span>
            </div>
            <div>
              <strong>{presentCandidates}</strong>
              <span>Present</span>
            </div>
            <div>
              <strong>{remainingCandidates}</strong>
              <span>Remaining</span>
            </div>
          </div>

          <div className="attendance-progress">
            <div
              className="attendance-progress-fill"
              style={{ width: `${percentage}%` }}
            />
          </div>

          <p className="attendance-percentage">
            {presentCandidates} of {totalCandidates} checked in
          </p>

          <div className={`scanner-result ${result.type}`}>
            <h3>{result.title}</h3>
            <p>{result.message}</p>
          </div>

          <div className="scanner-history">
            <h3>Recent Scans</h3>
            <ul>
              {history.map((item, index) => (
                <li
                  key={index}
                  className={`history-item history-item--${
                    item.status === "Present"
                      ? "success"
                      : item.status === "Already Present"
                        ? "warning"
                        : "error"
                  }`}
                >
                  <span className="history-status">{item.status}</span>
                  <span className="history-name">{item.value}</span>
                  <span className="history-time">{item.time}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
