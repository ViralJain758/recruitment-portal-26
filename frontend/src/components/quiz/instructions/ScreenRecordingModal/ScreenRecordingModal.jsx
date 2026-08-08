import React from "react";
import { ScreenShare, ShieldCheck, X } from "lucide-react";
import { Card } from "../../common/Card";
import { Button } from "../../common/Button";

// Asks the candidate for explicit consent to record their screen during the
// exam session. No actual capture happens here or during the quiz — the
// recording indicator shown in the quiz UI is a simulated proctoring signal,
// not a real screen capture — but the candidate's choice is still a genuine
// consent decision, so it's presented up front and required before the exam
// can start, the same way camera access is.
export const ScreenRecordingModal = ({ open, onAllow, onDeny, declined }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/40 dark:bg-black/60 backdrop-blur-sm">
      <Card className="max-w-md w-full border-[#CBD5E1] dark:border-slate-700 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center gap-3 text-[#0067B8] dark:text-blue-300 mb-4">
          <ScreenShare className="w-6 h-6" />
          <h3 className="text-base font-bold uppercase tracking-wide">
            Screen Recording Permission
          </h3>
        </div>

        <div className="space-y-3 mb-6 text-sm text-[#374151] dark:text-slate-300 leading-relaxed">
          <p>
            This exam session monitors your screen for the full duration of
            the quiz as part of the integrity-proctoring process, alongside
            your webcam and tab-activity checks.
          </p>
          <p>
            A recording indicator will stay visible on screen the entire time
            it's active. You can decline, but the quiz cannot be started
            without granting this permission.
          </p>
        </div>

        {declined && (
          <p className="text-xs font-semibold text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <X className="w-3.5 h-3.5 shrink-0" />
            Screen recording permission is required to start the quiz.
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5">
          <Button
            variant="secondary"
            onClick={onDeny}
            className="flex-1 py-2.5 text-sm"
          >
            Decline
          </Button>
          <Button
            variant="primary"
            onClick={onAllow}
            className="flex-1 py-2.5 text-sm gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            Allow & Continue
          </Button>
        </div>
      </Card>
    </div>
  );
};
