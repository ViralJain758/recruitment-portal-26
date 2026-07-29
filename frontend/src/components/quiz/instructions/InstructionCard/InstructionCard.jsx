import React from 'react';
import { Card } from '../../common/Card';
import { CheckCircle2 } from 'lucide-react';
export const InstructionCard = () => {
  const guides = [
    "The exam consists of 20 multiple choice questions.", "Total duration of the exam is 30 minutes.",
    "The timer will start immediately after you begin.", "Once started, the timer cannot be paused.",
    "Do not refresh, close or switch tabs during the exam.", "If any malpractice is detected, your exam will be auto submitted.",
    "Make sure you are in a distraction-free environment.", "Full screen mode is mandatory for this exam."
  ];
  return (
    <Card className="border-slate-800 bg-slate-900/40 h-full">
      <h3 className="text-lg font-bold text-slate-200 mb-4 border-b border-slate-800 pb-2">Important Instructions</h3>
      <div className="space-y-3.5">
        {guides.map((text, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs font-medium text-slate-300 leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};