import React from 'react';
import { useExam } from '../../../../context/ExamContext';
import { Card } from '../../common/Card';
import { Button } from '../../common/Button';
import { AlertTriangle } from 'lucide-react';

export const SecurityModal = () => {
  const { showSecurityModal, setShowSecurityModal, securityWarnings, securityViolationType } = useExam();
  
  if (!showSecurityModal) return null;

  // Re-request fullscreen mode on user interaction to satisfy browser security
  const reLaunchFullscreen = async () => {
    const element = document.documentElement;
    try {
      if (element.requestFullscreen) {
        await element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) { // Safari / Chrome
        await element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) { // Firefox
        await element.mozRequestFullScreen();
      } else if (element.msRequestFullscreen) { // IE/Edge
        await element.msRequestFullscreen();
      }
    } catch (err) {
      console.warn("Fullscreen recovery was bypassed or denied:", err);
    }
  };

  const handleDismissWarning = async () => {
    await reLaunchFullscreen(); // Re-lock screen aspect ratio constraints
    setShowSecurityModal(false); // Clear the modal display overlay state
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#111827]/30 dark:bg-black/50 backdrop-blur-sm select-none">
      <Card className="max-w-md w-full border-[#FECACA] dark:border-red-900/70 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-center gap-3 text-[#dc2626] mb-4">
          <AlertTriangle className="w-6 h-6 animate-pulse" />
          <h3 className="text-base font-bold uppercase tracking-wide">Security Warning</h3>
        </div>
        
        <div className="space-y-3 mb-6">
          <p className="text-sm text-[#374151] dark:text-slate-300">
            Violation Detected: <span className="text-[#dc2626] dark:text-red-300 font-mono font-bold bg-[#EF4444]/10 px-2 py-0.5 rounded">{securityViolationType}</span>
          </p>
          <p className="text-xs text-[#b45309] dark:text-amber-300 leading-relaxed font-medium">
            Total Warnings: <span className="font-bold underline">{securityWarnings} / 3</span>. Reaching 3 total platform violations triggers automatic script submission pipelines immediately.
          </p>
        </div>

        <Button variant="danger" onClick={handleDismissWarning} className="w-full py-2.5 font-semibold text-sm">
          Return to Exam & Restore Fullscreen
        </Button>
      </Card>
    </div>
  );
};
